import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user's company_id
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('ETL AP - Auth error:', userError);
      throw new Error('Unauthorized');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.company_id) {
      throw new Error('Company not found for user');
    }

    const companyId = profile.company_id;
    console.log('ETL AP - Starting for company:', companyId);

    // Fetch all open vendor bills
    const { data: vendorBills, error: billsError } = await supabase
      .from('vendor_bills')
      .select('*')
      .eq('company_id', companyId)
      .in('status', ['open', 'partial']);

    if (billsError) {
      console.error('ETL AP - Error fetching vendor bills:', billsError);
      throw billsError;
    }

    console.log(`Found ${vendorBills?.length || 0} open vendor bills`);

    // Clear existing AP facts for this company
    const { error: deleteError } = await supabase
      .from('facts_ap')
      .delete()
      .eq('company_id', companyId);

    if (deleteError) {
      console.error('ETL AP - Error deleting old AP facts:', deleteError);
      throw deleteError;
    }

    if (!vendorBills || vendorBills.length === 0) {
      console.log('ETL AP - No open vendor bills to process');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No open vendor bills to process',
          recordsGenerated: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate aging and generate AP facts
    const today = new Date();
    const apFacts = vendorBills.map(bill => {
      const dueDate = new Date(bill.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let agingBucket: string;
      if (daysOverdue < -30) {
        agingBucket = 'Due later';
      } else if (daysOverdue < -7) {
        agingBucket = 'Due within 30 days';
      } else {
        agingBucket = 'Due within 7 days';
      }

      return {
        company_id: companyId,
        vendor_id: null, // We don't have a vendors FK yet
        open_amount_base: bill.amount_total_base || bill.amount_total,
        days_overdue: daysOverdue,
        aging_bucket: agingBucket,
      };
    });

    // Insert new AP facts
    const { error: insertError } = await supabase
      .from('facts_ap')
      .insert(apFacts);

    if (insertError) {
      console.error('ETL AP - Error inserting AP facts:', insertError);
      throw insertError;
    }

    console.log(`Generated ${apFacts.length} AP fact records`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully processed ${apFacts.length} vendor bills`,
        recordsGenerated: apFacts.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('ETL AP - Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
