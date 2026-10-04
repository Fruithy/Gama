-- ════════════════════════════════════════════════════════════════════════
-- FILTER ARCADE — initial schema
--
-- Design notes
--  * All writes go through server endpoints that connect with a privileged
--    role (service role / direct connection). Browser clients (anon /
--    authenticated roles) get READ-ONLY access to public data via RLS.
--  * Leaderboards never scan raw runs: they read from compact "best"
--    tables (one row per player per board) with covering indexes.
--  * Every board sorts on `sort_score DESC, achieved_at ASC`. Lower-is-better
--    games store sort_score = -score, so one index shape serves both.
--  * Email addresses live only in auth.users (Supabase). Profiles never
--    store email or IP addresses.
-- ════════════════════════════════════════════════════════════════════════

-- ── profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                  uuid primary key default gen_random_uuid(),
  auth_user_id        uuid unique,
  username            text not null,
  username_claimed    boolean not null default false,
  username_changed_at timestamptz,
  avatar              text not null default 'b0-c0',
  country             text check (country ~ '^[A-Z]{2}$'),
  country_source      text not null default 'unknown' check (country_source in ('unknown','geo','user')),
  xp                  bigint not null default 0,
  level               int not null default 1,
  total_plays         int not null default 0,
  games_played        int not null default 0,
  daily_streak        int not null default 0,
  longest_streak      int not null default 0,
  last_daily_day      date,
  last_play_day       date,
  challenge_wins      int not null default 0,
  daily_wins          int not null default 0,
  personal_best_count int not null default 0,
  role                text not null default 'player' check (role in ('player','admin')),
  is_banned           boolean not null default false,
  ban_reason          text,
  is_seed             boolean not null default false,
  session_version     int not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_seen_at        timestamptz not null default now()
);
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
create index if not exists profiles_xp_idx on public.profiles (xp desc);
create index if not exists profiles_created_idx on public.profiles (created_at);

-- Public, email-free projection used by profile pages & leaderboards.
create or replace view public.public_profiles as
  select id, username, avatar, country, xp, level, total_plays, games_played,
         daily_streak, longest_streak, challenge_wins, daily_wins, created_at
  from public.profiles
  where is_banned = false;

-- ── games (registry mirror + admin overrides) ─────────────────────────────
create table if not exists public.games (
  id                text primary key,
  slug              text not null unique,
  name              text not null,
  category          text not null,
  difficulty        text not null check (difficulty in ('easy','medium','hard','impossible')),
  score_direction   text not null check (score_direction in ('higher','lower')),
  current_version   int not null default 1,
  status            text not null default 'live',
  enabled           boolean not null default true,
  featured          boolean not null default false,
  trending_override boolean not null default false,
  is_new            boolean not null default false,
  thumbnail_url     text,
  short_description text,
  sort_order        int not null default 0,
  admin_overrides   jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.game_versions (
  game_id    text not null references public.games(id) on delete cascade,
  version    int not null,
  rules      jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_id, version)
);

-- ── daily challenges ──────────────────────────────────────────────────────
create table if not exists public.daily_challenges (
  id         uuid primary key default gen_random_uuid(),
  day        date not null unique,
  game_id    text not null references public.games(id),
  seed       text not null,
  source     text not null default 'auto' check (source in ('auto','admin')),
  winner_id  uuid,
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── friend challenges ─────────────────────────────────────────────────────
create table if not exists public.challenges (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique,
  game_id      text not null references public.games(id),
  game_version int not null,
  creator_id   uuid not null references public.profiles(id) on delete cascade,
  run_id       uuid,
  score        bigint not null,
  sort_score   bigint not null,
  seed         text not null,
  opens        int not null default 0,
  attempts     int not null default 0,
  wins         int not null default 0,
  conversions  int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists challenges_creator_idx on public.challenges (creator_id, created_at desc);
create index if not exists challenges_created_idx on public.challenges (created_at);

-- ── score runs (append-only log, source for fraud review) ────────────────
create table if not exists public.score_runs (
  id                 uuid primary key default gen_random_uuid(),
  game_id            text not null references public.games(id),
  game_version       int not null,
  player_id          uuid not null references public.profiles(id) on delete cascade,
  mode               text not null default 'normal' check (mode in ('normal','daily','challenge')),
  daily_challenge_id uuid references public.daily_challenges(id),
  challenge_id       uuid references public.challenges(id) on delete set null,
  seed               text not null,
  nonce              text not null,
  status             text not null default 'started' check (status in ('started','accepted','flagged','rejected','removed')),
  completed          boolean,
  score              bigint,
  sort_score         bigint,
  duration_ms        int,
  server_elapsed_ms  int,
  actions            int,
  peak_aps           int,
  stats              jsonb,
  input_summary      jsonb,
  checkpoints        jsonb,
  flags              text[] not null default '{}',
  client_ts          timestamptz,
  idempotency_key    text,
  country            text,
  xp_awarded         int not null default 0,
  result             jsonb,
  started_at         timestamptz not null default now(),
  submitted_at       timestamptz,
  reviewed_at        timestamptz,
  reviewed_by        uuid
);
create index if not exists score_runs_player_idx on public.score_runs (player_id, started_at desc);
create index if not exists score_runs_game_submitted_idx on public.score_runs (game_id, submitted_at desc) where submitted_at is not null;
create index if not exists score_runs_flagged_idx on public.score_runs (submitted_at desc) where status = 'flagged';
create index if not exists score_runs_submitted_idx on public.score_runs (submitted_at) where submitted_at is not null;
create index if not exists score_runs_started_idx on public.score_runs (started_at);

alter table public.challenges
  drop constraint if exists challenges_run_fk;
alter table public.challenges
  add constraint challenges_run_fk foreign key (run_id) references public.score_runs(id) on delete set null;

-- ── leaderboard: all-time personal bests (GLOBAL / COUNTRY / FRIENDS) ────
create table if not exists public.personal_bests (
  player_id   uuid not null references public.profiles(id) on delete cascade,
  game_id     text not null references public.games(id) on delete cascade,
  score       bigint not null,
  sort_score  bigint not null,
  run_id      uuid,
  country     text,
  achieved_at timestamptz not null default now(),
  primary key (player_id, game_id)
);
create index if not exists personal_bests_board_idx on public.personal_bests (game_id, sort_score desc, achieved_at asc);
create index if not exists personal_bests_country_idx on public.personal_bests (game_id, country, sort_score desc, achieved_at asc);

-- ── leaderboard: period bests (TODAY / THIS WEEK) ────────────────────────
create table if not exists public.period_bests (
  game_id     text not null references public.games(id) on delete cascade,
  period      text not null check (period in ('day','week')),
  period_key  date not null,
  player_id   uuid not null references public.profiles(id) on delete cascade,
  score       bigint not null,
  sort_score  bigint not null,
  run_id      uuid,
  country     text,
  achieved_at timestamptz not null default now(),
  primary key (game_id, period, period_key, player_id)
);
create index if not exists period_bests_board_idx on public.period_bests (game_id, period, period_key, sort_score desc, achieved_at asc);
create index if not exists period_bests_country_idx on public.period_bests (game_id, period, period_key, country, sort_score desc, achieved_at asc);

-- Cached board sizes (avoid COUNT(*) on hot paths). key = 'global' | 'day:2026-10-04' | 'week:2026-09-28' | 'daily:<uuid>'
create table if not exists public.leaderboard_counts (
  game_id text not null,
  board   text not null,
  entries bigint not null default 0,
  primary key (game_id, board)
);

-- ── daily challenge scores ────────────────────────────────────────────────
create table if not exists public.daily_challenge_scores (
  daily_challenge_id uuid not null references public.daily_challenges(id) on delete cascade,
  player_id          uuid not null references public.profiles(id) on delete cascade,
  best_score         bigint not null,
  sort_score         bigint not null,
  best_run_id        uuid,
  attempts           int not null default 1,
  country            text,
  achieved_at        timestamptz not null default now(),
  first_played_at    timestamptz not null default now(),
  primary key (daily_challenge_id, player_id)
);
create index if not exists daily_scores_board_idx on public.daily_challenge_scores (daily_challenge_id, sort_score desc, achieved_at asc);
create index if not exists daily_scores_country_idx on public.daily_challenge_scores (daily_challenge_id, country, sort_score desc, achieved_at asc);
create index if not exists daily_scores_player_idx on public.daily_challenge_scores (player_id);

create table if not exists public.challenge_attempts (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  player_id    uuid not null references public.profiles(id) on delete cascade,
  run_id       uuid,
  score        bigint not null,
  won          boolean not null,
  margin       bigint not null,
  created_at   timestamptz not null default now()
);
create index if not exists challenge_attempts_challenge_idx on public.challenge_attempts (challenge_id, created_at desc);

-- ── per player per game stats (plays, XP anti-farming) ───────────────────
create table if not exists public.player_game_stats (
  player_id      uuid not null references public.profiles(id) on delete cascade,
  game_id        text not null references public.games(id) on delete cascade,
  plays          int not null default 0,
  total_duration_ms bigint not null default 0,
  xp_day         date,
  xp_plays_today int not null default 0,
  best_stats     jsonb not null default '{}'::jsonb,
  first_played_at timestamptz not null default now(),
  last_played_at timestamptz not null default now(),
  primary key (player_id, game_id)
);

-- ── achievements ──────────────────────────────────────────────────────────
create table if not exists public.achievements (
  id          text primary key,
  name        text not null,
  description text not null,
  icon        text not null,
  xp          int not null default 100,
  rule        jsonb not null,
  tier        text not null default 'bronze',
  enabled     boolean not null default true,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);

create table if not exists public.player_achievements (
  player_id      uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  game_id        text,
  run_id         uuid,
  unlocked_at    timestamptz not null default now(),
  primary key (player_id, achievement_id)
);

-- ── social ────────────────────────────────────────────────────────────────
create table if not exists public.favorites (
  player_id  uuid not null references public.profiles(id) on delete cascade,
  game_id    text not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id, game_id)
);
create index if not exists favorites_game_idx on public.favorites (game_id, created_at);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

create table if not exists public.ratings (
  player_id  uuid not null references public.profiles(id) on delete cascade,
  game_id    text not null references public.games(id) on delete cascade,
  fun        boolean not null,
  created_at timestamptz not null default now(),
  primary key (player_id, game_id)
);

create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid references public.profiles(id) on delete set null,
  kind             text not null check (kind in ('bug','cheating','username','other')),
  game_id          text,
  run_id           uuid,
  target_player_id uuid references public.profiles(id) on delete set null,
  message          text not null default '',
  status           text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolution       text,
  resolved_by      uuid,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

-- ── analytics ─────────────────────────────────────────────────────────────
create table if not exists public.analytics_events (
  id         bigint generated always as identity primary key,
  name       text not null,
  player_id  uuid,
  game_id    text,
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_time_idx on public.analytics_events (created_at);
create index if not exists analytics_events_game_idx on public.analytics_events (game_id, name, created_at);

-- Daily rollups keep dashboards and trending O(games × days).
create table if not exists public.game_daily_stats (
  game_id            text not null,
  day                date not null,
  impressions        int not null default 0,
  opens              int not null default 0,
  starts             int not null default 0,
  completions        int not null default 0,
  fails              int not null default 0,
  retries            int not null default 0,
  shares             int not null default 0,
  challenges_created int not null default 0,
  challenge_opens    int not null default 0,
  favorites          int not null default 0,
  total_duration_ms  bigint not null default 0,
  primary key (game_id, day)
);

-- ── security / ops ────────────────────────────────────────────────────────
create table if not exists public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (key, window_start)
);

create table if not exists public.security_events (
  id         bigint generated always as identity primary key,
  player_id  uuid,
  kind       text not null,
  severity   text not null default 'info' check (severity in ('info','warn','high')),
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists security_events_time_idx on public.security_events (created_at desc);

create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text not null default '',
  updated_at  timestamptz not null default now()
);

create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- Browser roles: read public data only. No insert/update/delete policies
-- exist for anon/authenticated → all writes must go through the server.
-- ════════════════════════════════════════════════════════════════════════
alter table public.profiles               enable row level security;
alter table public.games                  enable row level security;
alter table public.game_versions          enable row level security;
alter table public.daily_challenges       enable row level security;
alter table public.challenges             enable row level security;
alter table public.score_runs             enable row level security;
alter table public.personal_bests         enable row level security;
alter table public.period_bests           enable row level security;
alter table public.leaderboard_counts     enable row level security;
alter table public.daily_challenge_scores enable row level security;
alter table public.challenge_attempts     enable row level security;
alter table public.player_game_stats      enable row level security;
alter table public.achievements           enable row level security;
alter table public.player_achievements    enable row level security;
alter table public.favorites              enable row level security;
alter table public.follows                enable row level security;
alter table public.ratings                enable row level security;
alter table public.reports                enable row level security;
alter table public.analytics_events       enable row level security;
alter table public.game_daily_stats       enable row level security;
alter table public.rate_limits            enable row level security;
alter table public.security_events        enable row level security;
alter table public.feature_flags          enable row level security;
alter table public.app_config             enable row level security;

-- Public read
drop policy if exists games_read on public.games;
create policy games_read on public.games for select to anon, authenticated using (enabled and status = 'live');
drop policy if exists game_versions_read on public.game_versions;
create policy game_versions_read on public.game_versions for select to anon, authenticated using (true);
drop policy if exists daily_read on public.daily_challenges;
create policy daily_read on public.daily_challenges for select to anon, authenticated using (day <= current_date);
drop policy if exists pb_read on public.personal_bests;
create policy pb_read on public.personal_bests for select to anon, authenticated using (true);
drop policy if exists period_read on public.period_bests;
create policy period_read on public.period_bests for select to anon, authenticated using (true);
drop policy if exists counts_read on public.leaderboard_counts;
create policy counts_read on public.leaderboard_counts for select to anon, authenticated using (true);
drop policy if exists daily_scores_read on public.daily_challenge_scores;
create policy daily_scores_read on public.daily_challenge_scores for select to anon, authenticated using (true);
drop policy if exists achievements_read on public.achievements;
create policy achievements_read on public.achievements for select to anon, authenticated using (enabled);
drop policy if exists player_achievements_read on public.player_achievements;
create policy player_achievements_read on public.player_achievements for select to anon, authenticated using (true);
drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select to anon, authenticated using (true);
drop policy if exists flags_read on public.feature_flags;
create policy flags_read on public.feature_flags for select to anon, authenticated using (true);

-- Own-row read for signed-in players (Supabase auth.uid()).
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for select to authenticated using (auth_user_id = auth.uid());
drop policy if exists runs_own on public.score_runs;
create policy runs_own on public.score_runs for select to authenticated
  using (player_id in (select id from public.profiles where auth_user_id = auth.uid()));
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for select to authenticated
  using (player_id in (select id from public.profiles where auth_user_id = auth.uid()));
drop policy if exists stats_own on public.player_game_stats;
create policy stats_own on public.player_game_stats for select to authenticated
  using (player_id in (select id from public.profiles where auth_user_id = auth.uid()));

-- Grants: the public view is the only profile surface for anonymous readers.
grant select on public.public_profiles to anon, authenticated;
revoke insert, update, delete on all tables in schema public from anon, authenticated;
