import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    
    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analyzing sentiment for text:", text.substring(0, 50) + "...");

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

    const apiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("AI gateway error:", apiResponse.status, errorText);
      
      if (apiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (apiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to analyze sentiment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await apiResponse.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      console.error("No response from AI");
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI response:", aiResponse);

    // Parse the JSON response from AI
    let result;
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = aiResponse.replace(/```json\n?|\n?```/g, "").trim();
      result = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid AI response format" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the result structure
    if (!result.sentiment || !result.score || !result.explanation) {
      console.error("Invalid result structure:", result);
      return new Response(
        JSON.stringify({ error: "Invalid sentiment analysis result" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultData = {
      sentiment: result.sentiment,
      score: result.score,
      explanation: result.explanation,
      keywords: result.keywords || [],
    };

    // Store result in database
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { error: dbError } = await supabase
        .from("analysis_history")
        .insert({
          text,
          sentiment: resultData.sentiment,
          score: resultData.score,
          explanation: resultData.explanation,
          keywords: resultData.keywords,
        });

      if (dbError) {
        console.error("Error storing in database:", dbError);
        // Don't fail the request if database storage fails
      }
    } catch (dbError) {
      console.error("Database error:", dbError);
    }

    return new Response(
      JSON.stringify(resultData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-sentiment:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
