import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RevenueAggregation {
  company_id: string;
  date: string;
  amount_accrual: number;
  amount_cash: number;
  product_id: string | null;
  region: string | null;
  channel: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { company_id, start_date, end_date } = await req.json();

    console.log('ETL Revenue - Starting for company:', company_id, 'Period:', start_date, 'to', end_date);

    // Fetch invoices for accrual basis (by issue_date)
    const { data: invoices, error: invoicesError } = await supabaseClient
      .from('invoices')
      .select('*')
      .eq('company_id', company_id)
      .gte('issue_date', start_date)
      .lte('issue_date', end_date)
      .in('status', ['Open', 'Paid', 'Partially Paid']);

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      throw invoicesError;
    }

    // Fetch payments for cash basis (by payment date)
    const { data: payments, error: paymentsError } = await supabaseClient
      .from('payments')
      .select('*, invoices!inner(product_id, region, channel)')
      .eq('invoices.company_id', company_id)
      .gte('date', start_date)
      .lte('date', end_date)
      .eq('status', 'Paid');

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      throw paymentsError;
    }

    console.log('Found', invoices?.length || 0, 'invoices and', payments?.length || 0, 'payments');

    // Aggregate accrual revenue by date, product, region, channel
    const accrualMap = new Map<string, RevenueAggregation>();
    
    invoices?.forEach((invoice: any) => {
      const key = `${invoice.issue_date}|${invoice.product_id || ''}|${invoice.region || ''}|${invoice.channel || ''}`;
      
      if (!accrualMap.has(key)) {
        accrualMap.set(key, {
          company_id: invoice.company_id,
          date: invoice.issue_date,
          amount_accrual: 0,
          amount_cash: 0,
          product_id: invoice.product_id || null,
          region: invoice.region || null,
          channel: invoice.channel || null,
        });
      }
      
      const agg = accrualMap.get(key)!;
      agg.amount_accrual += Number(invoice.amount_total_base || invoice.amount_total || 0);
    });

    // Aggregate cash revenue by date, product, region, channel
    const cashMap = new Map<string, RevenueAggregation>();
    
    payments?.forEach((payment: any) => {
      const key = `${payment.date}|${payment.invoices?.product_id || ''}|${payment.invoices?.region || ''}|${payment.invoices?.channel || ''}`;
      
      if (!cashMap.has(key)) {
        cashMap.set(key, {
          company_id: company_id,
          date: payment.date,
          amount_accrual: 0,
          amount_cash: 0,
          product_id: payment.invoices?.product_id || null,
          region: payment.invoices?.region || null,
          channel: payment.invoices?.channel || null,
        });
      }
      
      const agg = cashMap.get(key)!;
      agg.amount_cash += Number(payment.amount_base || payment.amount || 0);
    });

    // Merge accrual and cash maps
    const allKeys = new Set([...accrualMap.keys(), ...cashMap.keys()]);
    const factsRevenue: RevenueAggregation[] = [];

    allKeys.forEach(key => {
      const accrual = accrualMap.get(key);
      const cash = cashMap.get(key);
      
      if (accrual && cash) {
        // Both exist - merge
        factsRevenue.push({
          ...accrual,
          amount_cash: cash.amount_cash,
        });
      } else if (accrual) {
        factsRevenue.push(accrual);
      } else if (cash) {
        factsRevenue.push(cash);
      }
    });

    console.log('Generated', factsRevenue.length, 'revenue fact records');

    // Delete old revenue facts for the date range and insert new ones
    const { error: deleteError } = await supabaseClient
      .from('facts_revenue_daily')
      .delete()
      .eq('company_id', company_id)
      .gte('date', start_date)
      .lte('date', end_date);

    if (deleteError) {
      console.error('Error deleting old revenue facts:', deleteError);
      throw deleteError;
    }

    // Insert new revenue facts
    if (factsRevenue.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('facts_revenue_daily')
        .insert(factsRevenue);

      if (insertError) {
        console.error('Error inserting revenue facts:', insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        records_processed: factsRevenue.length,
        message: 'Revenue ETL completed successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ETL Revenue:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});