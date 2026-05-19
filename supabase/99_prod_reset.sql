-- ==============================================================
-- Polla Mundial 2026 — RESET PRE-PRODUCCIÓN
--
-- ⚠️ DESTRUCTIVO E IRREVERSIBLE ⚠️
--
-- Este script borra TODOS los datos de prueba y deja la base lista
-- para el primer día real de la polla:
--
--   • Borra todos los usuarios excepto los admins
--     → CASCADE limpia sus profiles, entries y predictions
--   • Borra las entries del propio admin (por si jugó en pruebas)
--     → CASCADE limpia las predictions del admin
--   • Resetea TODOS los partidos a status='scheduled' con score=null
--     → mantiene el calendario y los equipos
--
-- NO toca:
--   • La estructura (tablas, índices, RLS, funciones, triggers)
--   • Los partidos en sí (solo limpia scores y status)
--   • La cuenta admin
--
-- ANTES DE CORRERLO:
--   1. Toma un backup manual en Supabase Dashboard → Database →
--      Backups → "Create backup". Por si te arrepientes.
--   2. Asegúrate de que NINGÚN usuario real esté logueado todavía.
--   3. Corre PRIMERO solo la sección PREVIEW (hasta el primer ';')
--      para ver cuántas filas afecta. Si los números cuadran, corre
--      el resto.
-- ==============================================================


-- ----------------------------------------------------------------
-- SECCIÓN 1 — PREVIEW (no borra nada, solo cuenta)
-- ----------------------------------------------------------------
select
  (select count(*) from auth.users) as users_totales,
  (select count(*) from public.profiles where role = 'admin') as admins_a_conservar,
  (select count(*) from auth.users u
    where not exists (
      select 1 from public.profiles p where p.id = u.id and p.role = 'admin'
    )
  ) as users_a_borrar,
  (select count(*) from public.profiles where role <> 'admin' or role is null) as profiles_a_borrar,
  (select count(*) from public.entries) as entries_totales_a_borrar,
  (select count(*) from public.predictions) as predictions_totales_a_borrar,
  (select count(*) from public.matches where status <> 'scheduled' or home_score is not null) as matches_a_resetear;


-- ----------------------------------------------------------------
-- SECCIÓN 2 — BORRADO REAL
-- Detente aquí si los números del preview no son lo que esperas.
-- ----------------------------------------------------------------

-- 2.1 Borrar usuarios no-admin de auth.users.
--     CASCADE limpia profiles, entries y predictions de ellos.
delete from auth.users u
where not exists (
  select 1 from public.profiles p
  where p.id = u.id and p.role = 'admin'
);

-- 2.2 Limpiar pollas/predicciones del propio admin (por si jugó en
--     pruebas). CASCADE de entries → predictions.
delete from public.entries
where user_id in (select id from public.profiles where role = 'admin');

-- 2.3 Resetear todos los partidos al estado inicial.
update public.matches
set home_score = null,
    away_score = null,
    status = 'scheduled';


-- ----------------------------------------------------------------
-- SECCIÓN 3 — VERIFICACIÓN
-- Debe quedar: 1 user (admin), 1 profile (admin), 0 entries,
-- 0 predictions, 0 matches con score o status distinto a scheduled.
-- ----------------------------------------------------------------
select
  (select count(*) from auth.users) as users_restantes,
  (select count(*) from public.profiles) as profiles_restantes,
  (select count(*) from public.entries) as entries_restantes,
  (select count(*) from public.predictions) as predictions_restantes,
  (select count(*) from public.matches) as matches_totales,
  (select count(*) from public.matches where status <> 'scheduled') as matches_no_scheduled,
  (select count(*) from public.matches where home_score is not null) as matches_con_score;

-- Detalle del admin que quedó (en query separado, sin subquery escalar):
select email, role, is_approved
from public.profiles
order by created_at;

-- ==============================================================
-- LISTO. La base está limpia, el calendario intacto, y el admin
-- conservado. Ya puedes desplegar a prod.
-- ==============================================================
