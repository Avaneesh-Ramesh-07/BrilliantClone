-- Durable "completed at least once" flag, separate from completed_at.
--   ever_completed: set true the first time a lesson is finished and never
--                   cleared — used to keep later lessons unlocked even after the
--                   learner restarts an earlier lesson (which clears completed_at
--                   so that lesson reads as a fresh run again).

alter table public.lesson_progress
  add column if not exists ever_completed boolean not null default false;

-- Backfill: any lesson currently/previously marked complete stays unlocked.
update public.lesson_progress
  set ever_completed = true
  where completed_at is not null or status = 'complete';
