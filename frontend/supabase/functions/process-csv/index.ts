import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CSVRow {
  [key: string]: string;
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

    const { file_path, data_type } = await req.json();
    
    console.log('Processing CSV:', file_path, 'Type:', data_type);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's company
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.company_id) {
      throw new Error('Company not found');
    }

    const company_id = profile.company_id;

    // Download CSV file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('csv-imports')
      .download(file_path);

    if (downloadError) throw downloadError;

    // Parse CSV - handle different line endings and formats
    const text = await fileData.text();
    
    // Normalize line endings (handle \r\n, \r, and \n)
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n').filter(line => line.trim());
    
    console.log(`Total lines found: ${lines.length}`);
    
    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid - needs at least header and one data row');
    }

    // Parse CSV with proper handling of quoted fields
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            current += '"';
            i++;
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // End of field
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      // Add the last field
      result.push(current.trim());
      
      return result;
    };

    // Helper function to normalize column names to snake_case
    const toSnakeCase = (str: string): string => {
      return str
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w_]/g, '');
    };

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    console.log(`Headers: ${headers.join(', ')}`);
    
    const rows: CSVRow[] = lines.slice(1).map((line, index) => {
      const values = parseCSVLine(line).map(v => v.replace(/^"|"$/g, '').trim());
      const row: CSVRow = {};
      headers.forEach((header, idx) => {
        // Normalize header to snake_case for consistent access
        const normalizedHeader = toSnakeCase(header);
        row[normalizedHeader] = values[idx] || '';
      });
      return row;
    });

    console.log(`Parsed ${rows.length} rows from CSV`);

    let processed = 0;
    let rejected = 0;
    const batchId = crypto.randomUUID();
    const rejects: any[] = [];

    // Helper function to normalize status
    const normalizeStatus = (status: string): string => {
      const normalized = status.trim();
      // Map common variations
      if (normalized.toLowerCase() === 'canceled') return 'Cancelled';
      return normalized;
    };

    // Helper function to normalize transaction type
    const normalizeTransactionType = (type: string): 'in' | 'out' => {
      const normalized = type.trim().toLowerCase();
      // Map to 'in' for incoming transactions
      if (['deposit', 'income', 'receipt', 'credit', 'refund'].includes(normalized)) {
        return 'in';
      }
      // Everything else is 'out' (withdrawal, purchase, payment, fee, transfer, debit, expense)
      return 'out';
    };

    // Process based on data type with batch inserts
    switch (data_type) {
      case 'invoices':
        const invoiceBatch: any[] = [];
        const customerCache = new Map<string, string>();

        for (const row of rows) {
          try {
            // Find or create customer
            let customerId;
            const { data: existingCustomer } = await supabaseClient
              .from('customers')
              .select('id')
              .eq('company_id', company_id)
              .eq('name', row.customer_name)
              .single();

            if (existingCustomer) {
              customerId = existingCustomer.id;
            } else {
              const { data: newCustomer, error: customerError } = await supabaseClient
                .from('customers')
                .insert({ company_id, name: row.customer_name, email: row.customer_email || null })
                .select('id')
                .single();
              
              if (customerError) throw customerError;
              customerId = newCustomer.id;
            }

            invoiceBatch.push({
              company_id,
              customer_id: customerId,
              issue_date: row.issue_date,
              due_date: row.due_date,
              amount_total: parseFloat(row.amount_total),
              open_amount: parseFloat(row.amount_total),
              status: normalizeStatus(row.status || 'Open'),
              product_id: row.product_id || null,
              region: row.region || null,
              channel: row.channel || null,
              original_currency: row.original_currency || 'USD',
              original_amount: row.original_amount ? parseFloat(row.original_amount) : null,
            });
            processed++;
          } catch (error) {
            console.error('Error processing invoice row:', error);
            rejects.push({
              company_id,
              import_batch_id: batchId,
              table_name: 'invoices',
              row_data: row,
              rejection_reason: error instanceof Error ? error.message : 'Unknown error',
            });
            rejected++;
          }
        }
        
        // Batch insert invoices
        if (invoiceBatch.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < invoiceBatch.length; i += batchSize) {
            const batch = invoiceBatch.slice(i, i + batchSize);
            const { error: batchError } = await supabaseClient
              .from('invoices')
              .insert(batch);
            
            if (batchError) {
              console.error('Batch insert error:', batchError);
              // Move failed batch items to rejects
              batch.forEach(item => {
                rejects.push({
                  company_id: item.company_id,
                  import_batch_id: batchId,
                  table_name: 'invoices',
                  row_data: item,
                  rejection_reason: batchError.message,
                });
              });
              processed -= batch.length;
              rejected += batch.length;
            }
          }
        }
        break;

      case 'payments':
        const paymentBatch: any[] = [];
        const invoiceUpdates = new Map<string, number>(); // Track amount to subtract per invoice

        for (const row of rows) {
          try {
            // Look up invoice
            const { data: invoice, error: invoiceLookupError } = await supabaseClient
              .from('invoices')
              .select('id, open_amount')
              .eq('company_id', company_id)
              .eq('id', row.invoice_id)
              .single();

            if (invoiceLookupError || !invoice) {
              throw new Error(`Invoice not found: ${row.invoice_id}`);
            }

            const paymentAmount = parseFloat(row.amount);

            paymentBatch.push({
              company_id,
              invoice_id: invoice.id,
              date: row.date,
              amount: paymentAmount,
              status: normalizeStatus(row.status || 'Completed'),
              original_currency: row.original_currency || 'USD',
              original_amount: row.original_amount ? parseFloat(row.original_amount) : null,
            });

            // Track invoice updates
            const currentDeduction = invoiceUpdates.get(invoice.id) || 0;
            invoiceUpdates.set(invoice.id, currentDeduction + paymentAmount);

            processed++;
          } catch (error) {
            console.error('Error processing payment row:', error);
            rejects.push({
              company_id,
              import_batch_id: batchId,
              table_name: 'payments',
              row_data: row,
              rejection_reason: error instanceof Error ? error.message : 'Unknown error',
            });
            rejected++;
          }
        }

        // Batch insert payments
        if (paymentBatch.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < paymentBatch.length; i += batchSize) {
            const batch = paymentBatch.slice(i, i + batchSize);
            const { error: batchError } = await supabaseClient
              .from('payments')
              .insert(batch);
            
            if (batchError) {
              console.error('Batch insert error:', batchError);
              batch.forEach(item => {
                rejects.push({
                  company_id: item.company_id,
                  import_batch_id: batchId,
                  table_name: 'payments',
                  row_data: item,
                  rejection_reason: batchError.message,
                });
              });
              processed -= batch.length;
              rejected += batch.length;
            }
          }

          // Update invoice open_amounts
          for (const [invoiceId, amountToSubtract] of invoiceUpdates.entries()) {
            try {
              const { data: currentInvoice } = await supabaseClient
                .from('invoices')
                .select('open_amount')
                .eq('id', invoiceId)
                .single();

              if (currentInvoice) {
                const newOpenAmount = Math.max(0, currentInvoice.open_amount - amountToSubtract);
                await supabaseClient
                  .from('invoices')
                  .update({ open_amount: newOpenAmount })
                  .eq('id', invoiceId);
              }
            } catch (error) {
              console.error(`Error updating invoice ${invoiceId} open_amount:`, error);
            }
          }
        }
        break;

      case 'expenses':
        for (const row of rows) {
          try {
            const { error: insertError } = await supabaseClient
              .from('expenses_new')
              .insert({
                company_id,
                date: row.date,
                amount: parseFloat(row.amount),
                category: row.category,
                vendor: row.vendor || null,
                project_id: row.project_id || null,
                original_currency: row.original_currency || 'USD',
                original_amount: row.original_amount ? parseFloat(row.original_amount) : null,
              });

            if (insertError) throw insertError;
            processed++;
          } catch (error) {
            console.error('Error processing expense row:', error);
            await supabaseClient.from('data_rejects').insert({
              company_id,
              import_batch_id: batchId,
              table_name: 'expenses_new',
              row_data: row,
              rejection_reason: error instanceof Error ? error.message : 'Unknown error',
            });
            rejected++;
          }
        }
        break;

      case 'bank_transactions':
        for (const row of rows) {
          try {
            // Find or create account
            let accountId;
            const { data: existingAccount } = await supabaseClient
              .from('accounts')
              .select('id')
              .eq('company_id', company_id)
              .eq('name', row.account_name)
              .single();

            if (existingAccount) {
              accountId = existingAccount.id;
            } else {
              const { data: newAccount, error: accountError } = await supabaseClient
                .from('accounts')
                .insert({ 
                  company_id, 
                  name: row.account_name,
                  currency: row.original_currency || 'USD',
                })
                .select('id')
                .single();
              
              if (accountError) throw accountError;
              accountId = newAccount.id;
            }

            const { error: insertError } = await supabaseClient
              .from('bank_transactions')
              .insert({
                company_id,
                account_id: accountId,
                date: row.date,
                amount: parseFloat(row.amount),
                type: normalizeTransactionType(row.type),
                counterparty: row.counterparty || null,
                category: row.category || null,
                original_currency: row.original_currency || 'USD',
                original_amount: row.original_amount ? parseFloat(row.original_amount) : null,
              });

            if (insertError) throw insertError;
            processed++;
          } catch (error) {
            console.error('Error processing transaction row:', error);
            await supabaseClient.from('data_rejects').insert({
              company_id,
              import_batch_id: batchId,
              table_name: 'bank_transactions',
              row_data: row,
              rejection_reason: error instanceof Error ? error.message : 'Unknown error',
            });
            rejected++;
          }
        }
        break;

      case 'fx_rates':
        for (const row of rows) {
          try {
            const { error: upsertError } = await supabaseClient
              .from('fx_rates')
              .upsert({
                company_id,
                date: row.date,
                currency: row.currency,
                rate_to_base: parseFloat(row.rate_to_base),
                is_imputed: false,
              }, {
                onConflict: 'company_id,date,currency',
              });

            if (upsertError) throw upsertError;
            processed++;
          } catch (error) {
            console.error('Error processing FX rate row:', error);
            await supabaseClient.from('data_rejects').insert({
              company_id,
              import_batch_id: batchId,
              table_name: 'fx_rates',
              row_data: row,
              rejection_reason: error instanceof Error ? error.message : 'Unknown error',
            });
            rejected++;
          }
        }
        break;

      case 'vendor_bills':
        const vendorBillsBatch: any[] = [];

        for (const row of rows) {
          try {
            vendorBillsBatch.push({
              company_id,
              vendor_name: row.vendor_name,
              issue_date: row.issue_date,
              due_date: row.due_date,
              amount_total: parseFloat(row.amount_total),
              open_amount: parseFloat(row.amount_total),
              status: normalizeStatus(row.status || 'open'),
              category: row.category || null,
              description: row.description || null,
              original_currency: row.original_currency || 'USD',
              original_amount: row.original_amount ? parseFloat(row.original_amount) : null,
            });
            processed++;
          } catch (error) {
            console.error('Error processing vendor bill row:', error);
            rejects.push({
              company_id,
              import_batch_id: batchId,
              table_name: 'vendor_bills',
              row_data: row,
              rejection_reason: error instanceof Error ? error.message : 'Unknown error',
            });
            rejected++;
          }
        }
        
        // Batch insert vendor bills
        if (vendorBillsBatch.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < vendorBillsBatch.length; i += batchSize) {
            const batch = vendorBillsBatch.slice(i, i + batchSize);
            const { error: batchError } = await supabaseClient
              .from('vendor_bills')
              .insert(batch);
            
            if (batchError) {
              console.error('Batch insert error:', batchError);
              batch.forEach(item => {
                rejects.push({
                  company_id: item.company_id,
                  import_batch_id: batchId,
                  table_name: 'vendor_bills',
                  row_data: item,
                  rejection_reason: batchError.message,
                });
              });
            }
          }
        }
        break;

      case 'accounts':
        const accountsBatch: any[] = [];

        for (const row of rows) {
          try {
            // Check if account already exists
            const { data: existingAccount } = await supabaseClient
              .from('accounts')
              .select('id')
              .eq('company_id', company_id)
              .eq('name', row.account_name)
              .single();

            if (existingAccount) {
              // Update existing account balance
              const { error: updateError } = await supabaseClient
                .from('accounts')
                .update({ 
                  balance: parseFloat(row.balance),
                  currency: row.currency || 'USD'
                })
                .eq('id', existingAccount.id);

              if (updateError) throw updateError;
            } else {
              // Add new account
              accountsBatch.push({
                company_id,
                name: row.account_name,
                balance: parseFloat(row.balance),
                currency: row.currency || 'USD',
              });
            }
            processed++;
          } catch (error) {
            console.error('Error processing account row:', error);
            rejects.push({
              company_id,
              import_batch_id: batchId,
              table_name: 'accounts',
              row_data: row,
              rejection_reason: error instanceof Error ? error.message : 'Unknown error',
            });
            rejected++;
          }
        }
        
        // Batch insert new accounts
        if (accountsBatch.length > 0) {
          const { error: batchError } = await supabaseClient
            .from('accounts')
            .insert(accountsBatch);
          
          if (batchError) {
            console.error('Batch insert error:', batchError);
            accountsBatch.forEach(item => {
              rejects.push({
                company_id: item.company_id,
                import_batch_id: batchId,
                table_name: 'accounts',
                row_data: item,
                rejection_reason: batchError.message,
              });
            });
          }
        }
        break;

      default:
        throw new Error(`Unsupported data type: ${data_type}`);
    }

    // Insert all rejects in batch
    if (rejects.length > 0) {
      const { error: rejectError } = await supabaseClient
        .from('data_rejects')
        .insert(rejects);
      
      if (rejectError) {
        console.error('Error inserting rejects:', rejectError);
      }
    }

    console.log(`Processed: ${processed}, Rejected: ${rejected}`);

    // Trigger relevant ETL jobs based on data type
    const etlJobs: { [key: string]: string[] } = {
      invoices: ['etl-revenue', 'etl-ar'],
      payments: ['etl-revenue', 'etl-ar'],
      expenses: ['etl-expenses'],
      bank_transactions: ['etl-cashflow'],
      fx_rates: ['fx-imputation'],
      vendor_bills: ['etl-ap'],
      accounts: [], // No ETL needed for accounts
    };

    const jobsToRun = etlJobs[data_type] || [];
    
    // Get proper date field based on data type
    const getDateField = (type: string): string => {
      switch (type) {
        case 'invoices': return 'issue_date';
        case 'payments': return 'date';
        case 'expenses': return 'date';
        case 'bank_transactions': return 'date';
        case 'fx_rates': return 'date';
        case 'vendor_bills': return 'issue_date';
        default: return 'date';
      }
    };
    
    // Run ETL jobs in background without blocking response
    const runEtlJobs = async () => {
      for (const job of jobsToRun) {
        try {
          console.log(`Triggering ${job} ETL job`);
          // Calculate date range from imported data using correct date field
          const dateField = getDateField(data_type);
          const dates = rows
            .map(r => r[dateField])
            .filter(d => d && d !== 'undefined' && d.trim() !== '')
            .sort();
          
          if (dates.length > 0) {
            const startDate = dates[0];
            const endDate = dates[dates.length - 1];
            
            console.log(`ETL date range: ${startDate} to ${endDate}`);
            
            await supabaseClient.functions.invoke(job, {
              body: { company_id, start_date: startDate, end_date: endDate },
            });
          } else {
            console.warn(`No valid dates found for ${job}, skipping ETL trigger`);
          }
        } catch (error) {
          console.error(`Error triggering ${job}:`, error);
        }
      }
      console.log('All ETL jobs completed');
    };
    
    // Start ETL jobs in background
    if (jobsToRun.length > 0) {
      EdgeRuntime.waitUntil(runEtlJobs());
    }

    const isSuccess = processed > 0;
    const message = isSuccess 
      ? `Successfully imported ${processed} records${rejected > 0 ? ` (${rejected} rejected)` : ''}`
      : `Import failed: All ${rejected} records were rejected`;

    return new Response(
      JSON.stringify({
        success: isSuccess,
        processed,
        rejected,
        message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-csv:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage, success: false, processed: 0, rejected: 0 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
