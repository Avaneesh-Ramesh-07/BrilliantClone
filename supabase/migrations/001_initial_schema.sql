-- AlgebraPath initial schema

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  created_at timestamptz default now() not null
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  lesson_id text not null,
  status text not null check (status in ('not_started', 'in_progress', 'complete')),
  current_step_index int default 0 not null,
  completed_at timestamptz,
  updated_at timestamptz default now() not null,
  unique (user_id, lesson_id)
);

create table public.step_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  lesson_id text not null,
  step_id text not null,
  problem_id text not null,
  correct boolean not null,
  hints_used int default 0 not null,
  attempted_at timestamptz default now() not null
);

create table public.streaks (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  current_streak int default 0 not null,
  longest_streak int default 0 not null,
  last_activity_date date
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.step_attempts enable row level security;
alter table public.streaks enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can view own lesson progress"
  on public.lesson_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own lesson progress"
  on public.lesson_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update own lesson progress"
  on public.lesson_progress for update
  using (auth.uid() = user_id);

create policy "Users can view own step attempts"
  on public.step_attempts for select
  using (auth.uid() = user_id);

create policy "Users can insert own step attempts"
  on public.step_attempts for insert
  with check (auth.uid() = user_id);

create policy "Users can view own streak"
  on public.streaks for select
  using (auth.uid() = user_id);

create policy "Users can insert own streak"
  on public.streaks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own streak"
  on public.streaks for update
  using (auth.uid() = user_id);

-- Indexes
create index step_attempts_user_lesson_step_idx
  on public.step_attempts (user_id, lesson_id, step_id);

create index lesson_progress_user_idx
  on public.lesson_progress (user_id);
