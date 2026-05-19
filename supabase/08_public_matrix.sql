-- ==============================================================
-- Polla Mundial 2026 — RLS para matriz pública entre jugadores
--
-- (v2 — sin recursión sobre profiles)
--
-- Regla clave: NUNCA poner sobre `profiles` una policy cuyo USING
-- vuelva a consultar `profiles`, ni siquiera vía una función. Aunque
-- el patrón SECURITY DEFINER debería evitar la recursión, en algunos
-- setups de Supabase Postgres aún la dispara.
--
-- Por eso:
--   - profiles: cualquier USUARIO AUTENTICADO puede leer (display_name,
--     email, role, is_approved). Lo necesario para renderizar nombres
--     en la matriz. No hay consulta recursiva.
--   - entries:  solo APROBADOS, vía función helper que consulta
--     profiles (la función puede consultar profiles porque no estamos
--     poniendo una policy de profiles encima de profiles).
--   - predictions: solo APROBADOS y solo de partidos `finished`.
--
-- El admin sigue viendo TODO por sus políticas `*_admin_select_all`.
-- Idempotente.
-- ==============================================================

-- 0. HELPER: ¿el usuario actual está aprobado?
--    Mismo patrón que public.is_admin() definido en 01_schema.sql.
create or replace function public.is_approved_self()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_approved = true
  );
$$;

-- 1. PROFILES: lectura abierta a cualquier autenticado.
--    Sin function call, sin subquery sobre profiles → cero recursión.
--    (Las policies existentes profiles_self_select y
--    profiles_admin_select_all se mantienen; esta política amplía la
--    lectura porque las policies se combinan con OR.)
drop policy if exists "profiles_approved_select_all" on public.profiles; -- limpieza de v1 si quedó
drop policy if exists "profiles_authenticated_select_all" on public.profiles;
create policy "profiles_authenticated_select_all" on public.profiles
  for select using (auth.role() = 'authenticated');

-- 2. ENTRIES: lectura para aprobados
drop policy if exists "entries_approved_select_all" on public.entries;
create policy "entries_approved_select_all" on public.entries
  for select using (public.is_approved_self());

-- 3. PREDICTIONS: aprobados ven solo las de partidos finalizados
drop policy if exists "predictions_approved_select_finished" on public.predictions;
create policy "predictions_approved_select_finished" on public.predictions
  for select using (
    public.is_approved_self()
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id and m.status = 'finished'
    )
  );

-- ==============================================================
-- LISTO. La página /matrix ya muestra a todos los participantes
-- (RLS lo permite) y revela los pronósticos a medida que cada
-- partido termina.
-- ==============================================================
