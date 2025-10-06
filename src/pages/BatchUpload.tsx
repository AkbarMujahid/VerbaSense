import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface BatchJob {
  id: string;
  status: string;
  total_items: number;
  processed_items: number;
  results?: Array<{ text: string; sentiment: string; success: boolean }>;
}

const BatchUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [job, setJob] = useState<BatchJob | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
      setJob(null);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
    }
  };

  const parseCSV = (text: string): string[] => {
    const lines = text.split("\n").filter(line => line.trim());
    // Skip header if present
    const dataLines = lines[0].toLowerCase().includes("text") ? lines.slice(1) : lines;
    return dataLines.map(line => line.trim()).filter(line => line.length > 0);
  };

  const processBatch = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const text = await file.text();
      const texts = parseCSV(text);

      if (texts.length === 0) {
        throw new Error("No valid text found in CSV");
      }

      toast({
        title: "Starting batch analysis",
        description: `Processing ${texts.length} texts...`,
      });

      const { data, error } = await supabase.functions.invoke("batch-analyze", {
        body: { texts },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setJob({
        id: data.job_id,
        status: "processing",
        total_items: texts.length,
        processed_items: 0,
      });

      // Poll for status
      pollJobStatus(data.job_id);

    } catch (error) {
      console.error("Error processing batch:", error);
      toast({
        title: "Batch processing failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("batch-status", {
          method: "GET",
        });

        // Manually construct the URL with query parameter
        const response = await fetch(
          `https://pxngdmfgwzpxaacvipze.supabase.co/functions/v1/batch-status?job_id=${jobId}`,
          {
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          }
        );

        if (!response.ok) throw new Error("Failed to fetch job status");
        const jobData = await response.json();

        setJob(jobData);

        if (jobData.status === "completed" || jobData.status === "failed") {
          clearInterval(interval);
          setIsProcessing(false);
          
          toast({
            title: jobData.status === "completed" ? "Batch completed" : "Batch failed",
            description: `Processed ${jobData.processed_items} of ${jobData.total_items} items`,
            variant: jobData.status === "completed" ? "default" : "destructive",
          });
        }
      } catch (error) {
        console.error("Error polling job status:", error);
        clearInterval(interval);
        setIsProcessing(false);
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Batch Upload</h1>
            <p className="text-muted-foreground mt-1">Upload CSV files for bulk sentiment analysis</p>
          </div>
          <div className="flex gap-2">
            <Link to="/dashboard">
              <Button variant="outline">Dashboard</Button>
            </Link>
            <Link to="/">
              <Button variant="outline">Analyzer</Button>
            </Link>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Upload a CSV file with one text per line. First line can be a header.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
                disabled={isProcessing}
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Click to upload CSV</p>
                    <p className="text-sm text-muted-foreground">or drag and drop</p>
                  </div>
                </div>
              </label>
            </div>

            {file && (
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-sm">{file.name}</span>
                <Button
                  onClick={processBatch}
                  disabled={isProcessing}
                  size="sm"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Start Analysis"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {job && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Batch Job Status
                <Badge variant={job.status === "completed" ? "default" : "secondary"}>
                  {job.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{job.processed_items} / {job.total_items}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{
                      width: `${(job.processed_items / job.total_items) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {job.status === "completed" && job.results && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  <h3 className="font-semibold">Results</h3>
                  {job.results.map((result, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-3 rounded-lg border text-sm"
                    >
                      {result.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{result.text}</p>
                        {result.success && (
                          <Badge variant="outline" className="mt-1 capitalize">
                            {result.sentiment}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BatchUpload;
