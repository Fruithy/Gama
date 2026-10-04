-- Live leaderboards: publish the best tables to Supabase Realtime.
-- Guarded so this is a no-op on plain Postgres / PGlite (no such publication).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.personal_bests;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.period_bests;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
