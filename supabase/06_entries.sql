-- ==============================================================
-- Polla Mundial 2026 — sistema de pollas (entries) por jugador
-- Cada usuario puede tener múltiples pollas (cada una pagada por
-- separado). Los pronósticos se enlazan a entries, no a usuarios.
-- Idempotente: se puede correr varias veces.
-- ==============================================================

-- 1. TABLA ENTRIES
create table if not exists public.entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mi polla',
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists entries_user_idx on public.entries (user_id);

-- 2. AGREGAR entry_id A PREDICTIONS
alter table public.predictions
  add column if not exists entry_id uuid references public.entries(id) on delete cascade;

-- 3. BACKFILL: si hay pronósticos sin entry, crear UNA entry por usuario
--    y enlazar los pronósticos existentes.
do $$
declare
  u record;
  e_id uuid;
begin
  for u in (
    select distinct user_id from public.predictions where entry_id is null
  ) loop
    insert into public.entries (user_id, name, paid)
    values (u.user_id, 'Mi polla', true)
    returning id into e_id;
    update public.predictions set entry_id = e_id
      where user_id = u.user_id and entry_id is null;
  end loop;
end;
$$;

-- 4. AHORA SÍ: entry_id obligatorio
alter table public.predictions
  alter column entry_id set not null;

-- 5. CAMBIAR UNIQUE: ahora un par (entry_id, match_id) es único,
--    no (user_id, match_id). Así un mismo usuario puede tener
--    varias pollas con marcadores distintos para el mismo partido.
alter table public.predictions
  drop constraint if exists predictions_user_id_match_id_key;
alter table public.predictions
  drop constraint if exists predictions_entry_match_unique;
alter table public.predictions
  add constraint predictions_entry_match_unique unique (entry_id, match_id);

-- 6. INDICES
create index if not exists predictions_entry_idx on public.predictions (entry_id);

-- 7. RLS PARA ENTRIES
alter table public.entries enable row level security;

drop policy if exists "entries_self_select" on public.entries;
create policy "entries_self_select" on public.entries
  for select using (auth.uid() = user_id);

drop policy if exists "entries_admin_select_all" on public.entries;
create policy "entries_admin_select_all" on public.entries
  for select using (public.is_admin());

drop policy if exists "entries_admin_all" on public.entries;
create policy "entries_admin_all" on public.entries
  for all using (public.is_admin()) with check (public.is_admin());

-- Los usuarios NO pueden crear ni borrar entries. Solo el admin.
-- Pero pueden actualizar el nombre de su propia polla.
drop policy if exists "entries_self_update_name" on public.entries;
create policy "entries_self_update_name" on public.entries
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (select paid from public.entries where id = entries.id) = paid
  );

-- 8. ACTUALIZAR RLS DE PREDICTIONS (ahora se valida via entry_id)
drop policy if exists "predictions_self_select" on public.predictions;
create policy "predictions_self_select" on public.predictions
  for select using (
    auth.uid() = user_id
  );

-- Insert: el user_id debe coincidir con el dueño del entry, y el
-- usuario debe estar aprobado.
drop policy if exists "predictions_self_insert" on public.predictions;
create policy "predictions_self_insert" on public.predictions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.entries
      where id = predictions.entry_id and user_id = auth.uid()
    )
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_approved = true
    )
  );

drop policy if exists "predictions_self_update" on public.predictions;
create policy "predictions_self_update" on public.predictions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.entries
      where id = predictions.entry_id and user_id = auth.uid()
    )
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_approved = true
    )
  );

-- 9. AUTO-CREAR primera entry cuando se aprueba a un jugador
create or replace function public.handle_player_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Si pasa de no-aprobado a aprobado y no tiene entries, crear una
  if new.is_approved = true
     and (old.is_approved = false or old.is_approved is null)
     and not exists (select 1 from public.entries where user_id = new.id)
  then
    insert into public.entries (user_id, name, paid)
    values (new.id, 'Mi polla', false);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_after_approval on public.profiles;
create trigger profiles_after_approval
  after update on public.profiles
  for each row execute function public.handle_player_approved();

-- 10. Trigger BEFORE INSERT para auto-llenar user_id en predictions
--     a partir de entry_id (consistencia).
create or replace function public.predictions_fill_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    select user_id into new.user_id
    from public.entries where id = new.entry_id;
  end if;
  return new;
end;
$$;

drop trigger if exists predictions_fill_user on public.predictions;
create trigger predictions_fill_user
  before insert on public.predictions
  for each row execute function public.predictions_fill_user_id();

-- 11. Habilitar Realtime también para entries
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'entries'
  ) then
    alter publication supabase_realtime add table public.entries;
  end if;
end;
$$;

-- 12. Crear entries para admins/aprobados existentes que no tengan
insert into public.entries (user_id, name, paid)
select id, 'Mi polla', case when role = 'admin' then true else false end
from public.profiles
where is_approved = true
  and not exists (select 1 from public.entries e where e.user_id = profiles.id);

-- ==============================================================
-- LISTO. A partir de ahora, predictions vive bajo entries.
-- El admin puede crear más entries por usuario desde el panel.
-- ==============================================================
