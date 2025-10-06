import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, TrendingUp, ThumbsUp, ThumbsDown, MinusCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface AnalysisRecord {
  id: string;
  text: string;
  sentiment: string;
  score: number;
  created_at: string;
}

interface Stats {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  avgScore: number;
}

const Dashboard = () => {
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    positive: 0,
    negative: 0,
    neutral: 0,
    avgScore: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("analysis_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data) {
        setHistory(data);
        
        // Calculate stats
        const total = data.length;
        const positive = data.filter(r => r.sentiment === "positive").length;
        const negative = data.filter(r => r.sentiment === "negative").length;
        const neutral = data.filter(r => r.sentiment === "neutral").length;
        const avgScore = data.reduce((sum, r) => sum + Number(r.score), 0) / total || 0;

        setStats({ total, positive, negative, neutral, avgScore });
      }
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return <ThumbsUp className="h-4 w-4" />;
      case "negative":
        return <ThumbsDown className="h-4 w-4" />;
      default:
        return <MinusCircle className="h-4 w-4" />;
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
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">Monitor sentiment analysis trends and history</p>
          </div>
          <Link to="/">
            <Button variant="outline">Back to Analyzer</Button>
          </Link>
        </header>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positive</CardTitle>
              <ThumbsUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.positive}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negative</CardTitle>
              <ThumbsDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.negative}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.negative / stats.total) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats.avgScore * 100)}%</div>
              <p className="text-xs text-muted-foreground">Across all analyses</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Analyses</CardTitle>
            <CardDescription>Last 50 sentiment analyses</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : history.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No analyses yet</p>
            ) : (
              <div className="space-y-4">
                {history.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <Badge
                      variant="outline"
                      className={`${getSentimentColor(record.sentiment)} mt-1 capitalize`}
                    >
                      {getSentimentIcon(record.sentiment)}
                      <span className="ml-1">{record.sentiment}</span>
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">{record.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(record.created_at).toLocaleString()} • Confidence: {Math.round(Number(record.score) * 100)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
