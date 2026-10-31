import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export interface SearchResult {
  id: string;
  type: 'invoice' | 'payment' | 'customer' | 'contact';
  title: string;
  subtitle: string;
  amount?: number;
  status?: string;
  date?: string;
}

export const useGlobalSearch = (searchQuery: string) => {
  const [isSearching, setIsSearching] = useState(false);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['global-search', searchQuery],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        return [];
      }

      setIsSearching(true);
      const query = searchQuery.toLowerCase().trim();
      const allResults: SearchResult[] = [];

      try {
        // Search invoices
        const { data: invoices } = await supabase
          .from('invoices')
          .select('id, issue_date, amount_total, status, customer_id, customers(name)')
          .or(`status.ilike.%${query}%,customers.name.ilike.%${query}%`)
          .limit(5);

        if (invoices) {
          invoices.forEach((inv: any) => {
            allResults.push({
              id: inv.id,
              type: 'invoice',
              title: `Invoice - ${inv.customers?.name || 'Unknown'}`,
              subtitle: `${inv.status} • ${inv.issue_date}`,
              amount: inv.amount_total,
              status: inv.status,
              date: inv.issue_date,
            });
          });
        }

        // Search customers
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name, email')
          .ilike('name', `%${query}%`)
          .limit(5);

        if (customers) {
          customers.forEach((cust) => {
            allResults.push({
              id: cust.id,
              type: 'customer',
              title: cust.name,
              subtitle: cust.email || 'Customer',
            });
          });
        }

        // Search contacts
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, name, email, phone, address')
          .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,address.ilike.%${query}%`)
          .limit(5);

        if (contacts) {
          contacts.forEach((contact) => {
            const details = [contact.email, contact.phone].filter(Boolean).join(' • ');
            allResults.push({
              id: contact.id,
              type: 'contact',
              title: contact.name,
              subtitle: details || contact.address || 'Contact',
            });
          });
        }

        // Search payments
        const { data: payments } = await supabase
          .from('payments')
          .select('id, date, amount, status, invoice_id, invoices(customer_id, customers(name))')
          .or(`status.ilike.%${query}%`)
          .limit(5);

        if (payments) {
          payments.forEach((pmt: any) => {
            allResults.push({
              id: pmt.id,
              type: 'payment',
              title: `Payment - ${pmt.invoices?.customers?.name || 'Unknown'}`,
              subtitle: `${pmt.status} • ${pmt.date}`,
              amount: pmt.amount,
              status: pmt.status,
              date: pmt.date,
            });
          });
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }

      return allResults;
    },
    enabled: searchQuery.trim().length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  });

  return {
    results,
    isLoading: isLoading || isSearching,
  };
};
