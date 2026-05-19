-- ==============================================================
-- Polla Mundial 2026 — bloquear rol admin a un solo correo
-- Ejecutar DESPUÉS de 03_add_phone_and_approval.sql
-- Idempotente: se puede correr varias veces.
-- ==============================================================

-- 1. Asegurar que retova10@gmail.com sea admin y esté aprobado.
--    Si el profile no existe (porque el usuario aún no se creó en Auth),
--    no hace nada — al crearlo, el trigger lo dejará como player y el
--    siguiente paso lo promueve solo cuando exista.
update public.profiles
set role = 'admin', is_approved = true
where email = 'retova10@gmail.com';

-- 2. Trigger que evita que CUALQUIER otro correo se vuelva admin.
--    Aunque alguien haga un update por SQL, falla.
create or replace function public.enforce_admin_email()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'admin' and lower(new.email) <> 'retova10@gmail.com' then
    raise exception 'Solo retova10@gmail.com puede tener rol admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_admin_email on public.profiles;
create trigger profiles_enforce_admin_email
  before insert or update on public.profiles
  for each row execute function public.enforce_admin_email();

-- 3. Asegurarse de que la promoción inicial siga válida después
--    de crear el trigger (el orden importa).
update public.profiles
set role = 'admin', is_approved = true
where email = 'retova10@gmail.com';

-- 4. Verificación
do $$
declare
  admin_count int;
begin
  select count(*) into admin_count
  from public.profiles
  where role = 'admin' and email = 'retova10@gmail.com';
  if admin_count = 0 then
    raise warning 'retova10@gmail.com aún no tiene un profile. '
      'Crea el usuario primero en Authentication → Users y vuelve a correr este SQL.';
  else
    raise notice 'OK: retova10@gmail.com es admin y está aprobado.';
  end if;
end;
$$;

-- ==============================================================
-- LISTO. Solo retova10@gmail.com puede ser admin desde ahora.
-- Cualquier intento de promover otro correo a admin fallará.
-- ==============================================================
