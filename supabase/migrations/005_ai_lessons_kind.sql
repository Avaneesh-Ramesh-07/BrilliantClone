-- Distinguishes AI-generated content by kind so the Sandbox list can hide
-- generated practice tests from the "build your own lesson" history.
--   kind = 'lesson'        : a normal AI-built lesson (the default).
--   kind = 'practice_test' : a generated practice test (challenging word
--                            problems drawn from earlier-reviewed concepts).
-- Existing rows default to 'lesson'. RLS is already owner-only on ai_lessons.

alter table public.ai_lessons
  add column if not exists kind text not null default 'lesson';
