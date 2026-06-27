create table if not exists public.highscores (
  user_id uuid not null references auth.users(id) on delete cascade,
  duration smallint not null check (duration in (10, 15, 20, 30, 40, 50, 60)),
  layout text not null,
  scores jsonb not null default '[]'::jsonb check (jsonb_typeof(scores) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (user_id, duration, layout)
);

alter table public.highscores enable row level security;

grant select, insert, update on public.highscores to authenticated;

drop policy if exists "Users can read own highscores" on public.highscores;
create policy "Users can read own highscores"
on public.highscores for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own highscores" on public.highscores;
create policy "Users can insert own highscores"
on public.highscores for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own highscores" on public.highscores;
create policy "Users can update own highscores"
on public.highscores for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
