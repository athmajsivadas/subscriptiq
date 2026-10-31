import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ARFact {
  company_id: string;
  invoice_id: string;
  open_amount_base: number;
  days_overdue: number;
  aging_bucket: string;
}

function getAgingBucket(daysOverdue: number): string {
  if (daysOverdue < 0) return 'not_due';
  if (daysOverdue <= 30) return '0-30';
  if (daysOverdue <= 60) return '31-60';
  return '61+';
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

    const { company_id } = await req.json();

    console.log('ETL AR - Starting for company:', company_id);

    // Fetch open invoices
    const { data: invoices, error: invoicesError } = await supabaseClient
      .from('invoices')
      .select('*')
      .eq('company_id', company_id)
      .in('status', ['Open', 'Partially Paid']);

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      throw invoicesError;
    }

    console.log('Found', invoices?.length || 0, 'open invoices');

    // Fetch payments for each invoice
    const factsAR: ARFact[] = [];
    const today = new Date();

    for (const invoice of invoices || []) {
      // Get total paid amount
      const { data: payments, error: paymentsError } = await supabaseClient
        .from('payments')
        .select('amount_base, amount')
        .eq('invoice_id', invoice.id)
        .eq('status', 'Paid');

      if (paymentsError) {
        console.error('Error fetching payments for invoice:', invoice.id, paymentsError);
        continue;
      }

      const totalPaid = payments?.reduce((sum: number, p: any) => 
        sum + Number(p.amount_base || p.amount || 0), 0) || 0;

      const openAmount = Number(invoice.amount_total_base || invoice.amount_total || 0) - totalPaid;

      // Only process if there's an open amount
      if (openAmount > 0) {
        const dueDate = new Date(invoice.due_date);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        factsAR.push({
          company_id: invoice.company_id,
          invoice_id: invoice.id,
          open_amount_base: openAmount,
          days_overdue: daysOverdue,
          aging_bucket: getAgingBucket(daysOverdue),
        });
      }
    }

    console.log('Generated', factsAR.length, 'AR fact records');

    // Delete old AR facts and insert new ones
    const { error: deleteError } = await supabaseClient
      .from('facts_ar')
      .delete()
      .eq('company_id', company_id);

    if (deleteError) {
      console.error('Error deleting old AR facts:', deleteError);
      throw deleteError;
    }

    // Insert new AR facts
    if (factsAR.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('facts_ar')
        .insert(factsAR);

      if (insertError) {
        console.error('Error inserting AR facts:', insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        records_processed: factsAR.length,
        message: 'AR ETL completed successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ETL AR:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});