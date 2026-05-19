-- ==============================================================
-- Polla Mundial 2026 — esquema de base de datos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ==============================================================

-- Extensiones
create extension if not exists "uuid-ossp";

-- --------------------------------------------------------------
-- 1. PROFILES (extiende auth.users)
-- --------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  role text not null default 'player' check (role in ('admin', 'player')),
  created_at timestamptz not null default now()
);

-- Trigger para crear el profile automáticamente cuando se registra un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'player')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------
-- 2. MATCHES
-- --------------------------------------------------------------
create table if not exists public.matches (
  id uuid primary key default uuid_generate_v4(),
  match_number int not null unique,
  phase text not null check (phase in (
    'group', 'round_of_32', 'round_of_16',
    'quarterfinal', 'semifinal', 'third_place', 'final'
  )),
  group_letter text,
  home_team text not null,
  away_team text not null,
  home_is_placeholder boolean not null default false,
  away_is_placeholder boolean not null default false,
  kickoff_at timestamptz not null,
  venue text,
  city text,
  country text,
  home_score int,
  away_score int,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  created_at timestamptz not null default now()
);

create index if not exists matches_kickoff_idx on public.matches (kickoff_at);
create index if not exists matches_phase_idx on public.matches (phase);
create index if not exists matches_group_idx on public.matches (group_letter);

-- --------------------------------------------------------------
-- 3. PREDICTIONS
-- --------------------------------------------------------------
create table if not exists public.predictions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_score int not null check (home_score >= 0 and home_score <= 30),
  away_score int not null check (away_score >= 0 and away_score <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists predictions_user_idx on public.predictions (user_id);
create index if not exists predictions_match_idx on public.predictions (match_id);

-- Enforce 2h lock at DB level — incluso si el frontend lo evita,
-- el backend rechaza inserts/updates demasiado tarde.
create or replace function public.enforce_prediction_lock()
returns trigger
language plpgsql
as $$
declare
  match_kickoff timestamptz;
  match_placeholder boolean;
  lock_at timestamptz;
begin
  select kickoff_at, (home_is_placeholder or away_is_placeholder)
    into match_kickoff, match_placeholder
    from public.matches where id = new.match_id;

  if match_kickoff is null then
    raise exception 'Partido no existe';
  end if;

  if match_placeholder then
    raise exception 'No se pueden predecir partidos con equipos por definir';
  end if;

  lock_at := match_kickoff - interval '2 hours';

  if now() >= lock_at then
    raise exception 'El marcador de este partido está bloqueado (faltan menos de 2 horas para el inicio)';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists predictions_lock_insert on public.predictions;
create trigger predictions_lock_insert
  before insert on public.predictions
  for each row execute function public.enforce_prediction_lock();

drop trigger if exists predictions_lock_update on public.predictions;
create trigger predictions_lock_update
  before update on public.predictions
  for each row execute function public.enforce_prediction_lock();

-- --------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- --------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

-- Helper: ¿el usuario actual es admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ===== profiles =====
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all" on public.profiles
  for select using (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin());

-- ===== matches =====
drop policy if exists "matches_authenticated_select" on public.matches;
create policy "matches_authenticated_select" on public.matches
  for select using (auth.role() = 'authenticated');

drop policy if exists "matches_admin_all" on public.matches;
create policy "matches_admin_all" on public.matches
  for all using (public.is_admin()) with check (public.is_admin());

-- ===== predictions =====
drop policy if exists "predictions_self_select" on public.predictions;
create policy "predictions_self_select" on public.predictions
  for select using (auth.uid() = user_id);

drop policy if exists "predictions_admin_select" on public.predictions;
create policy "predictions_admin_select" on public.predictions
  for select using (public.is_admin());

drop policy if exists "predictions_self_insert" on public.predictions;
create policy "predictions_self_insert" on public.predictions
  for insert with check (auth.uid() = user_id);

drop policy if exists "predictions_self_update" on public.predictions;
create policy "predictions_self_update" on public.predictions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "predictions_self_delete" on public.predictions;
create policy "predictions_self_delete" on public.predictions
  for delete using (auth.uid() = user_id);

-- ==============================================================
-- LISTO. Después correr 02_seed_matches.sql para cargar partidos.
-- ==============================================================
