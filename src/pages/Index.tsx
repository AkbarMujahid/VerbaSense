import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ThumbsUp, ThumbsDown, MinusCircle, BarChart3, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface SentimentResult {
  sentiment: "positive" | "negative" | "neutral";
  score: number;
  explanation: string;
  keywords: string[];
}

const Index = () => {
  const [text, setText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<SentimentResult | null>(null);
  const { toast } = useToast();

  const analyzeSentiment = async () => {
    if (!text.trim()) {
      toast({
        title: "Text required",
        description: "Please enter some text to analyze",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-sentiment", {
        body: { text },
      });

      if (error) {
        console.error("Error invoking function:", error);
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      toast({
        title: "Analysis complete",
        description: `Sentiment detected: ${data.sentiment}`,
      });
    } catch (error) {
      console.error("Error analyzing sentiment:", error);
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Failed to analyze text",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return <ThumbsUp className="h-5 w-5" />;
      case "negative":
        return <ThumbsDown className="h-5 w-5" />;
      default:
        return <MinusCircle className="h-5 w-5" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-green-500/10 text-green-700 border-green-500/20";
      case "negative":
        return "bg-red-500/10 text-red-700 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="text-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Text Sentiment Analyzer
            </h1>
            <p className="text-lg text-muted-foreground">
              Powered by AI • Analyze emotions and sentiment in any text
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Link to="/dashboard">
              <Button variant="outline" size="sm">
                <BarChart3 className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link to="/batch">
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Batch Upload
              </Button>
            </Link>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Enter Text to Analyze</CardTitle>
            <CardDescription>
              Type or paste any text to detect its sentiment and emotional tone
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Example: I love this product! The quality is amazing and the support team was very helpful."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[150px] text-base"
              disabled={isAnalyzing}
            />
            <Button
              onClick={analyzeSentiment}
              disabled={isAnalyzing || !text.trim()}
              className="w-full"
              size="lg"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Sentiment"
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Analysis Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={`${getSentimentColor(result.sentiment)} text-lg px-4 py-2 font-semibold capitalize`}
                  >
                    {getSentimentIcon(result.sentiment)}
                    <span className="ml-2">{result.sentiment}</span>
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Confidence</div>
                  <div className="text-2xl font-bold">
                    {Math.round(result.score * 100)}%
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Explanation</h3>
                <p className="text-base leading-relaxed">{result.explanation}</p>
              </div>

              {result.keywords && result.keywords.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">Key Indicators</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.keywords.map((keyword, index) => (
                      <Badge key={index} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
