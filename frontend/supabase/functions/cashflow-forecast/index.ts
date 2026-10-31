import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { historicalData } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Prepare historical summary for AI
    const historicalSummary = historicalData.map((d: any) => 
      `${d.period}: Inflow ${d.inflow}, Outflow ${d.outflow}, Net ${d.net}`
    ).join("; ");

    const systemPrompt = `You are a financial forecasting AI. Based on historical cash flow data, generate realistic monthly forecasts for the next 12 months. 
Consider seasonal patterns, growth trends, and typical business cycles. Return forecasts in JSON format.`;

    const userPrompt = `Historical monthly cash flow data: ${historicalSummary}

Generate a 12-month cash flow forecast with monthly periods. For each month, provide:
- period: Month name (e.g., "Mar 2025")
- inflow: Projected cash inflow
- outflow: Projected cash outflow
- net: Net cash flow (inflow - outflow)

Consider the historical trends and provide realistic projections. Return ONLY valid JSON array.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_forecast",
            description: "Generate 12-month cash flow forecast",
            parameters: {
              type: "object",
              properties: {
                forecast: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      period: { type: "string" },
                      inflow: { type: "number" },
                      outflow: { type: "number" },
                      net: { type: "number" }
                    },
                    required: ["period", "inflow", "outflow", "net"]
                  }
                }
              },
              required: ["forecast"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_forecast" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No forecast data returned from AI");
    }

    const forecastData = JSON.parse(toolCall.function.arguments);
    
    return new Response(JSON.stringify(forecastData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Forecast error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to generate forecast" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
