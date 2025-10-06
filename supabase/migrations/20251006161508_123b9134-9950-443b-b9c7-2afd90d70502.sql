-- Create analysis_history table to store all sentiment analyses
CREATE TABLE public.analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  score DECIMAL(3, 2) NOT NULL CHECK (score >= 0 AND score <= 1),
  explanation TEXT,
  keywords TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create batch_jobs table for CSV batch processing
CREATE TABLE public.batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  results JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;

-- Public read access for analysis history
CREATE POLICY "Allow public read access to analysis history"
ON public.analysis_history
FOR SELECT
USING (true);

-- Public insert access for analysis history
CREATE POLICY "Allow public insert to analysis history"
ON public.analysis_history
FOR INSERT
WITH CHECK (true);

-- Public access for batch jobs
CREATE POLICY "Allow public read access to batch jobs"
ON public.batch_jobs
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to batch jobs"
ON public.batch_jobs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update to batch jobs"
ON public.batch_jobs
FOR UPDATE
USING (true);

-- Create indexes for performance
CREATE INDEX idx_analysis_history_created_at ON public.analysis_history(created_at DESC);
CREATE INDEX idx_analysis_history_sentiment ON public.analysis_history(sentiment);
CREATE INDEX idx_batch_jobs_status ON public.batch_jobs(status);
CREATE INDEX idx_batch_jobs_created_at ON public.batch_jobs(created_at DESC);