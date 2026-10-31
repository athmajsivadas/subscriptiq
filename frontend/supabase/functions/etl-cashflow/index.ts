import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CashflowAggregation {
  company_id: string;
  date: string;
  inflow: number;
  outflow: number;
}

interface RevenueAggregation {
  company_id: string;
  date: string;
  amount_accrual: number;
  amount_cash: number;
  product_id: string | null;
  region: string | null;
  channel: string | null;
}

interface ExpenseAggregation {
  company_id: string;
  date: string;
  amount: number;
  category: string;
  vendor: string | null;
}

// Helper function to determine if a category is revenue-related
function isRevenueCategory(category: string): boolean {
  if (!category) return false;
  const lowerCategory = category.toLowerCase();
  const revenueKeywords = ['revenue', 'sales', 'income', 'deposit', 'payment received', 'customer payment', 'subscription', 'service fee'];
  return revenueKeywords.some(keyword => lowerCategory.includes(keyword));
}

// Helper function to determine if a category is expense-related
function isExpenseCategory(category: string): boolean {
  if (!category) return false;
  const lowerCategory = category.toLowerCase();
  const expenseKeywords = ['expense', 'salary', 'rent', 'utilities', 'supplies', 'payroll', 'vendor payment', 'software', 'marketing', 'travel', 'office', 'insurance', 'tax', 'fee', 'subscription', 'consulting'];
  return expenseKeywords.some(keyword => lowerCategory.includes(keyword));
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

    console.log('ETL Cashflow - Starting for company:', company_id, 'Period:', start_date, 'to', end_date);

    // Fetch bank transactions
    const { data: transactions, error: transactionsError } = await supabaseClient
      .from('bank_transactions')
      .select('*')
      .eq('company_id', company_id)
      .gte('date', start_date)
      .lte('date', end_date);

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      throw transactionsError;
    }

    // Fetch account names for transfer detection
    const { data: accounts, error: accountsError } = await supabaseClient
      .from('accounts')
      .select('name')
      .eq('company_id', company_id);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      throw accountsError;
    }

    const accountNames = new Set(accounts?.map((a: any) => a.name.toLowerCase()) || []);

    console.log('Found', transactions?.length || 0, 'transactions and', accountNames.size, 'accounts');

    // Aggregate by date, excluding internal transfers
    const cashflowMap = new Map<string, CashflowAggregation>();
    const revenueMap = new Map<string, RevenueAggregation>();
    const expenseMap = new Map<string, ExpenseAggregation>();
    
    transactions?.forEach((txn: any) => {
      // Detect internal transfers
      const counterparty = (txn.counterparty || '').toLowerCase();
      const isInternalTransfer = accountNames.has(counterparty) || 
                                 counterparty.includes('transfer') ||
                                 counterparty.includes('internal');

      if (isInternalTransfer) {
        console.log('Skipping internal transfer:', txn.id, counterparty);
        return;
      }

      const key = txn.date;
      const amount = Number(txn.amount_base || txn.amount || 0);
      
      // Always add to cashflow
      if (!cashflowMap.has(key)) {
        cashflowMap.set(key, {
          company_id: txn.company_id,
          date: txn.date,
          inflow: 0,
          outflow: 0,
        });
      }
      
      const cashflowAgg = cashflowMap.get(key)!;

      if (txn.type === 'in') {
        cashflowAgg.inflow += Math.abs(amount);
        
        // If it's a revenue category, also add to revenue facts
        if (isRevenueCategory(txn.category)) {
          const revenueKey = `${txn.date}|Bank Transaction|${txn.category || 'Other'}`;
          if (!revenueMap.has(revenueKey)) {
            revenueMap.set(revenueKey, {
              company_id: txn.company_id,
              date: txn.date,
              amount_accrual: 0,
              amount_cash: 0,
              product_id: null,
              region: null,
              channel: 'Bank Transaction',
            });
          }
          const revenueAgg = revenueMap.get(revenueKey)!;
          revenueAgg.amount_cash += Math.abs(amount);
        }
      } else if (txn.type === 'out') {
        cashflowAgg.outflow += Math.abs(amount);
        
        // If it's an expense category, also add to expense facts
        if (isExpenseCategory(txn.category)) {
          const expenseKey = `${txn.date}|${txn.category || 'Other'}|${txn.counterparty || ''}`;
          if (!expenseMap.has(expenseKey)) {
            expenseMap.set(expenseKey, {
              company_id: txn.company_id,
              date: txn.date,
              amount: 0,
              category: txn.category || 'Other',
              vendor: txn.counterparty || null,
            });
          }
          const expenseAgg = expenseMap.get(expenseKey)!;
          expenseAgg.amount += Math.abs(amount);
        }
      }
    });

    const factsCashflow = Array.from(cashflowMap.values());
    const factsRevenue = Array.from(revenueMap.values());
    const factsExpenses = Array.from(expenseMap.values());

    console.log('Generated', factsCashflow.length, 'cashflow fact records,', factsRevenue.length, 'revenue records,', factsExpenses.length, 'expense records');

    // Upsert into facts_cashflow_daily
    if (factsCashflow.length > 0) {
      const { error: upsertError } = await supabaseClient
        .from('facts_cashflow_daily')
        .upsert(factsCashflow, {
          onConflict: 'company_id,date',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error('Error upserting cashflow facts:', upsertError);
        throw upsertError;
      }
    }

    // Upsert into facts_revenue_daily
    if (factsRevenue.length > 0) {
      const { error: revenueError } = await supabaseClient
        .from('facts_revenue_daily')
        .upsert(factsRevenue, {
          onConflict: 'company_id,date,product_id,region,channel',
          ignoreDuplicates: false,
        });

      if (revenueError) {
        console.error('Error upserting revenue facts:', revenueError);
        throw revenueError;
      }
    }

    // Upsert into facts_expenses_daily
    if (factsExpenses.length > 0) {
      const { error: expenseError } = await supabaseClient
        .from('facts_expenses_daily')
        .upsert(factsExpenses, {
          onConflict: 'company_id,date,category,vendor',
          ignoreDuplicates: false,
        });

      if (expenseError) {
        console.error('Error upserting expense facts:', expenseError);
        throw expenseError;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        cashflow_records: factsCashflow.length,
        revenue_records: factsRevenue.length,
        expense_records: factsExpenses.length,
        message: 'Cashflow ETL completed successfully with revenue and expense classification' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ETL Cashflow:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});