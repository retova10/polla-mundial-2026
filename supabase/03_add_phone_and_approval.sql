-- ==============================================================
-- Polla Mundial 2026 — migración: campo celular + aprobación
-- Ejecutar en Supabase SQL Editor (DESPUÉS de 01_schema.sql)
-- Idempotente: se puede correr varias veces sin romper.
-- ==============================================================

-- 1. Nuevas columnas en profiles
alter table public.profiles
  add column if not exists phone text,
  add column if not exists is_approved boolean not null default false;

-- 2. Marcar a los admins existentes como aprobados (siempre)
update public.profiles set is_approved = true where role = 'admin';

-- 3. Recrear el trigger handle_new_user para copiar phone
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, phone, role, is_approved)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'player'),
    -- admins arrancan aprobados; jugadores requieren aprobación manual
    coalesce(new.raw_user_meta_data->>'role', 'player') = 'admin'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 4. Reforzar RLS de predictions: solo usuarios APROBADOS pueden enviar/editar
drop policy if exists "predictions_self_insert" on public.predictions;
create policy "predictions_self_insert" on public.predictions
  for insert with check (
    auth.uid() = user_id
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
      select 1 from public.profiles
      where id = auth.uid() and is_approved = true
    )
  );

-- 5. Permitir que el admin actualice profiles (ya estaba, pero re-confirmamos
--    que también permita togglear is_approved y phone)
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin())
  with check (public.is_admin());

-- 6. Cada usuario puede actualizar su propio profile (display_name, phone),
--    pero NO puede cambiar su rol ni is_approved.
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (select role from public.profiles where id = auth.uid()) = role
    and (select is_approved from public.profiles where id = auth.uid()) = is_approved
  );

-- ==============================================================
-- LISTO. Ahora los registros nuevos (signUp público) entran como
-- player con is_approved=false. El admin los aprueba desde el panel.
-- ==============================================================
