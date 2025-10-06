import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function analyzeSingleText(text: string, lovableApiKey: string) {
  const systemPrompt = `You are a sentiment analysis expert. Analyze the sentiment of the given text and respond ONLY with a JSON object in this exact format:
{
  "sentiment": "positive" | "negative" | "neutral",
  "score": 0.85,
  "explanation": "Brief explanation of the sentiment",
  "keywords": ["keyword1", "keyword2"]
}

Rules:
- sentiment must be exactly "positive", "negative", or "neutral"
- score must be between 0 and 1 (confidence level)
- explanation should be 1-2 sentences
- keywords should be 2-5 words that influenced the sentiment
- Return ONLY valid JSON, no markdown or extra text`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this text: "${text}"` },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.choices?.[0]?.message?.content;
  
  if (!aiResponse) {
    throw new Error("No response from AI");
  }

  const cleanedResponse = aiResponse.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleanedResponse);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts } = await req.json();
    
    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(
        JSON.stringify({ error: "texts array is required and must not be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create batch job
    const { data: job, error: jobError } = await supabase
      .from("batch_jobs")
      .insert({ status: "processing", total_items: texts.length })
      .select()
      .single();

    if (jobError || !job) {
      console.error("Error creating batch job:", jobError);
      return new Response(
        JSON.stringify({ error: "Failed to create batch job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created batch job ${job.id} with ${texts.length} items`);

    // Process in background
    (async () => {
      const results = [];
      let processedCount = 0;

      for (const text of texts) {
        try {
          const result = await analyzeSingleText(text, LOVABLE_API_KEY);
          
          // Store in history
          await supabase.from("analysis_history").insert({
            text,
            sentiment: result.sentiment,
            score: result.score,
            explanation: result.explanation,
            keywords: result.keywords || [],
          });

          results.push({ text, ...result, success: true });
          processedCount++;

          // Update progress
          await supabase
            .from("batch_jobs")
            .update({ processed_items: processedCount })
            .eq("id", job.id);

        } catch (error) {
          console.error(`Error analyzing text "${text.substring(0, 50)}":`, error);
          results.push({ 
            text, 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
          });
          processedCount++;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Mark job as completed
      await supabase
        .from("batch_jobs")
        .update({
          status: "completed",
          processed_items: processedCount,
          results: results,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      console.log(`Batch job ${job.id} completed`);
    })();

    return new Response(
      JSON.stringify({ 
        job_id: job.id, 
        status: "processing",
        message: "Batch job started. Check status with the job_id." 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in batch-analyze:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
