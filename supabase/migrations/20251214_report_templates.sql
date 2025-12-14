-- Report Templates and Scheduled Reports Schema

-- Table to store custom report templates
CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- 'registrations', 'financial', 'capacity', 'custom'
  fields JSONB NOT NULL, -- Array of field configurations
  filters JSONB, -- Filter configurations
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT, -- Admin user who created it
  is_favorite BOOLEAN DEFAULT false
);

-- Table to store scheduled reports
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES public.report_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schedule_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  schedule_config JSONB, -- Day of week, day of month, time, etc.
  recipient_emails TEXT[], -- Email addresses to send to
  format TEXT NOT NULL, -- 'csv', 'pdf', 'excel'
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table to track report generation history
CREATE TABLE IF NOT EXISTS public.report_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES public.report_templates(id) ON DELETE SET NULL,
  scheduled_report_id UUID REFERENCES public.scheduled_reports(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL,
  format TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  generated_by TEXT,
  record_count INTEGER,
  file_size INTEGER,
  date_range_start DATE,
  date_range_end DATE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON public.report_templates(report_type);
CREATE INDEX IF NOT EXISTS idx_report_templates_created_at ON public.report_templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON public.scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_report_history_generated_at ON public.report_history(generated_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for report_templates
DROP TRIGGER IF EXISTS update_report_templates_updated_at ON public.report_templates;
CREATE TRIGGER update_report_templates_updated_at
    BEFORE UPDATE ON public.report_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- View: Recent report history with template details
CREATE OR REPLACE VIEW public.report_history_detail AS
SELECT
  h.id,
  h.report_type,
  h.format,
  h.generated_at,
  h.generated_by,
  h.record_count,
  h.file_size,
  h.date_range_start,
  h.date_range_end,
  t.name as template_name,
  s.name as scheduled_report_name
FROM public.report_history h
LEFT JOIN public.report_templates t ON h.template_id = t.id
LEFT JOIN public.scheduled_reports s ON h.scheduled_report_id = s.id
ORDER BY h.generated_at DESC
LIMIT 100;

-- Enable RLS
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow all access to report_templates" ON public.report_templates;
CREATE POLICY "Allow all access to report_templates"
  ON public.report_templates
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to scheduled_reports" ON public.scheduled_reports;
CREATE POLICY "Allow all access to scheduled_reports"
  ON public.scheduled_reports
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to report_history" ON public.report_history;
CREATE POLICY "Allow all access to report_history"
  ON public.report_history
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.report_templates TO anon;
GRANT ALL ON public.scheduled_reports TO anon;
GRANT ALL ON public.report_history TO anon;
GRANT SELECT ON public.report_history_detail TO anon;

-- Insert default templates
INSERT INTO public.report_templates (name, description, report_type, fields, is_favorite) VALUES
  (
    'All Registrations',
    'Complete list of all registrations with contact and program details',
    'registrations',
    '[
      {"key": "created_at", "label": "Date", "type": "date"},
      {"key": "playerFullName", "label": "Player Name", "type": "text"},
      {"key": "playerCategory", "label": "Category", "type": "text"},
      {"key": "programType", "label": "Program", "type": "text"},
      {"key": "groupFrequency", "label": "Frequency", "type": "text"},
      {"key": "parentEmail", "label": "Parent Email", "type": "text"},
      {"key": "parentPhone", "label": "Phone", "type": "text"},
      {"key": "payment_status", "label": "Payment Status", "type": "text"}
    ]'::jsonb,
    true
  ),
  (
    'Financial Summary',
    'Payment status and subscription details for accounting',
    'financial',
    '[
      {"key": "created_at", "label": "Registration Date", "type": "date"},
      {"key": "playerFullName", "label": "Player Name", "type": "text"},
      {"key": "programType", "label": "Program", "type": "text"},
      {"key": "payment_status", "label": "Payment Status", "type": "text"},
      {"key": "payment_method_id", "label": "Payment Method", "type": "text"}
    ]'::jsonb,
    true
  ),
  (
    'Capacity Utilization',
    'Time slot capacity and utilization rates',
    'capacity',
    '[
      {"key": "time_slot_name", "label": "Time Slot", "type": "text"},
      {"key": "day_of_week", "label": "Day", "type": "text"},
      {"key": "capacity", "label": "Capacity", "type": "number"},
      {"key": "current_registrations", "label": "Current", "type": "number"},
      {"key": "utilization_rate", "label": "Utilization %", "type": "number"}
    ]'::jsonb,
    true
  )
ON CONFLICT DO NOTHING;
