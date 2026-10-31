import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrencySymbol } from "@/lib/currencySymbols";

export const useCurrencyConversion = (currency: string = 'USD') => {
  // Fetch ALL FX rates (not just latest) to enable date-specific conversions
  const { data: allFxRatesData } = useQuery({
    queryKey: ["all-fx-rates-with-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fx_rates")
        .select("rate_to_base, currency, date, created_at")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching FX rates:", error);
        return { byDate: {}, latest: {} };
      }

      // Group rates by currency and date for date-specific lookups
      const byDate: Record<string, Record<string, number>> = {};
      const latest: Record<string, { rate_to_base: number; currency: string }> = {};
      
      data?.forEach((rate) => {
        // Store by currency and date
        if (!byDate[rate.currency]) {
          byDate[rate.currency] = {};
        }
        if (!byDate[rate.currency][rate.date]) {
          byDate[rate.currency][rate.date] = rate.rate_to_base;
        }
        
        // Store latest rate for each currency
        if (!latest[rate.currency]) {
          latest[rate.currency] = {
            rate_to_base: rate.rate_to_base,
            currency: rate.currency
          };
        }
      });

      return { byDate, latest };
    },
  });

  const { data: fxRate } = useQuery({
    queryKey: ["fx-rate", currency],
    queryFn: async () => {
      // If currency is USD (base currency), no conversion needed
      if (currency === 'USD') {
        return { rate_to_base: 1, currency: 'USD' };
      }

      // Fetch the latest FX rate for the selected currency
      const { data, error } = await supabase
        .from("fx_rates")
        .select("rate_to_base, currency, date")
        .eq("currency", currency)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching FX rate:", error);
        return { rate_to_base: 1, currency: 'USD' };
      }

      if (!data) {
        console.warn(`No FX rate found for ${currency}, using 1:1`);
        return { rate_to_base: 1, currency };
      }

      return data;
    },
    enabled: !!currency,
  });

  // Get FX rate for a specific date (or closest prior date)
  const getFxRateForDate = (targetCurrency: string, date: string): number => {
    if (targetCurrency === 'USD') return 1;
    if (!allFxRatesData?.byDate[targetCurrency]) return 1;
    
    const currencyRates = allFxRatesData.byDate[targetCurrency];
    
    // Try exact date match first
    if (currencyRates[date]) {
      return currencyRates[date];
    }
    
    // Find closest prior date
    const sortedDates = Object.keys(currencyRates).sort().reverse();
    const priorDate = sortedDates.find(d => d <= date);
    
    if (priorDate) {
      return currencyRates[priorDate];
    }
    
    // Fallback to latest rate
    return allFxRatesData.latest[targetCurrency]?.rate_to_base || 1;
  };

  // Convert from any currency to the selected target currency
  // If transactionDate is provided, uses FX rate for that date
  const convertAmount = (amount: number, fromCurrency: string = 'USD', transactionDate?: string): number => {
    if (!allFxRatesData || !fxRate) return amount;
    
    // If same currency, no conversion needed
    if (fromCurrency === currency) return amount;

    // Get appropriate FX rates
    let fromRate: number;
    let toRate: number;
    
    if (transactionDate) {
      // Use date-specific rates
      fromRate = fromCurrency === 'USD' ? 1 : getFxRateForDate(fromCurrency, transactionDate);
      toRate = currency === 'USD' ? 1 : getFxRateForDate(currency, transactionDate);
    } else {
      // Use latest rates
      fromRate = fromCurrency === 'USD' ? 1 : (allFxRatesData.latest[fromCurrency]?.rate_to_base || 1);
      toRate = currency === 'USD' ? 1 : fxRate.rate_to_base;
    }

    // amount in fromCurrency * fromRate = amount in USD (base)
    // amount in USD / toRate = amount in target currency
    const amountInBase = amount * fromRate;
    return amountInBase / toRate;
  };

  return {
    fxRate,
    convertAmount,
    currencySymbol: getCurrencySymbol(currency),
    isLoading: !fxRate,
  };
};
