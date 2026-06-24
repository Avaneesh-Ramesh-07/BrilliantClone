-- Track how long each problem attempt took (internal analytics only).
-- Used to derive a "comfortability" metric on the mastery page; never shown
-- to the learner as a raw timer.

alter table public.step_attempts
  add column if not exists duration_ms integer;
