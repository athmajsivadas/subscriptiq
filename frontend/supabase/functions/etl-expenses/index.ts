import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExpenseAggregation {
  company_id: string;
  date: string;
  amount: number;
  category: string;
  vendor: string | null;
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

    console.log('ETL Expenses - Starting for company:', company_id, 'Period:', start_date, 'to', end_date);

    // Fetch expenses
    const { data: expenses, error: expensesError } = await supabaseClient
      .from('expenses_new')
      .select('*')
      .eq('company_id', company_id)
      .gte('date', start_date)
      .lte('date', end_date);

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError);
      throw expensesError;
    }

    console.log('Found', expenses?.length || 0, 'expenses');

    // Aggregate by date, category, vendor
    const expenseMap = new Map<string, ExpenseAggregation>();
    
    expenses?.forEach((expense: any) => {
      const key = `${expense.date}|${expense.category}|${expense.vendor || ''}`;
      
      if (!expenseMap.has(key)) {
        expenseMap.set(key, {
          company_id: expense.company_id,
          date: expense.date,
          amount: 0,
          category: expense.category,
          vendor: expense.vendor || null,
        });
      }
      
      const agg = expenseMap.get(key)!;
      agg.amount += Number(expense.amount_base || expense.amount || 0);
    });

    const factsExpenses = Array.from(expenseMap.values());

    console.log('Generated', factsExpenses.length, 'expense fact records');

    // Upsert into facts_expenses_daily
    if (factsExpenses.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('facts_expenses_daily')
        .upsert(factsExpenses, {
          onConflict: 'company_id,date,category,vendor',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error('Error upserting expense facts:', upsertError);
        throw upsertError;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        records_processed: factsExpenses.length,
        message: 'Expenses ETL completed successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ETL Expenses:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});