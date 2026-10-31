import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('FX Imputation - Starting for company:', company_id, 'Period:', start_date, 'to', end_date);

    // Get all currencies used by this company
    const { data: currencies, error: currenciesError } = await supabaseClient
      .from('fx_rates')
      .select('currency')
      .eq('company_id', company_id)
      .order('currency');

    if (currenciesError) {
      console.error('Error fetching currencies:', currenciesError);
      throw currenciesError;
    }

    const uniqueCurrencies = [...new Set(currencies?.map((c: any) => c.currency) || [])];
    console.log('Found', uniqueCurrencies.length, 'unique currencies');

    // Fetch ALL existing rates including is_imputed flag
    const { data: allRates, error: ratesError } = await supabaseClient
      .from('fx_rates')
      .select('currency, date, rate_to_base, is_imputed')
      .eq('company_id', company_id)
      .gte('date', start_date)
      .lte('date', end_date)
      .order('currency')
      .order('date');

    if (ratesError) {
      console.error('Error fetching all rates:', ratesError);
      throw ratesError;
    }

    // Create a map for fast lookups: currency -> date -> {rate, is_imputed}
    const ratesMap = new Map<string, Map<string, { rate: number; is_imputed: boolean }>>();
    for (const rate of allRates || []) {
      if (!ratesMap.has(rate.currency)) {
        ratesMap.set(rate.currency, new Map());
      }
      ratesMap.get(rate.currency)!.set(rate.date, {
        rate: rate.rate_to_base,
        is_imputed: rate.is_imputed
      });
    }

    // For each currency, ensure we have rates for every day in the range
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    const imputedRates = [];

    for (const currency of uniqueCurrencies) {
      let lastKnownRate: number | null = null;
      const currencyRates = ratesMap.get(currency) || new Map();
      
      // Get the most recent rate before the start date as initial value
      const startDateStr = startDateObj.toISOString().split('T')[0];
      const existingStartRate = currencyRates.get(startDateStr);
      
      if (!existingStartRate) {
        const { data: priorRate } = await supabaseClient
          .from('fx_rates')
          .select('rate_to_base')
          .eq('company_id', company_id)
          .eq('currency', currency)
          .lt('date', start_date)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (priorRate) {
          lastKnownRate = priorRate.rate_to_base;
        }
      }

      let currentDate = new Date(startDateObj);
      while (currentDate <= endDateObj) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const existingRate = currencyRates.get(dateStr);

        if (existingRate !== undefined) {
          // Only use as lastKnownRate if it's actual data, not imputed
          // This ensures we don't propagate imputed values
          if (!existingRate.is_imputed) {
            lastKnownRate = existingRate.rate;
          }
        } else if (lastKnownRate !== null) {
          // Only impute rate if no data exists for this date
          imputedRates.push({
            company_id,
            currency,
            date: dateStr,
            rate_to_base: lastKnownRate,
            is_imputed: true,
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    console.log('Generated', imputedRates.length, 'imputed FX rates');

    // Insert imputed rates - ignoreDuplicates true means we won't overwrite existing data
    if (imputedRates.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('fx_rates')
        .upsert(imputedRates, {
          onConflict: 'company_id,date,currency',
          ignoreDuplicates: true, // Don't overwrite existing rates (including uploaded ones)
        });

      if (insertError) {
        console.error('Error inserting imputed rates:', insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imputed_rates: imputedRates.length,
        message: 'FX imputation completed successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in FX Imputation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});