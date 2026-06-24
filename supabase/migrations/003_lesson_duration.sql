-- Track total active solve time per lesson run, surfaced on the completion
-- screen and used as the "comfortability" metric.
--   started_at:        when the current run began (set on first start / restart)
--   last_duration_ms:  summed active solve time of the most recent completed run

alter table public.lesson_progress
  add column if not exists started_at timestamptz,
  add column if not exists last_duration_ms integer;
