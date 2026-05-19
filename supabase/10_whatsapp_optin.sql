-- ==============================================================
-- Polla Mundial 2026 — Opt-in al grupo de WhatsApp
--
-- Al registrarse, el jugador puede marcar si quiere unirse al
-- grupo de WhatsApp de la polla. Es opcional (default false) y
-- visible para el admin al momento de aprobar y luego en el listado
-- de jugadores aprobados, para saber a quién agregar al grupo.
--
-- Idempotente: se puede correr varias veces.
-- ==============================================================

-- 1. Agregar columna (default false para usuarios ya existentes)
alter table public.profiles
  add column if not exists whatsapp_group_optin boolean not null default false;

-- 2. Actualizar el trigger handle_new_user para leer el opt-in del
--    raw_user_meta_data que viene del signUp del frontend.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, display_name, phone, role, is_approved, whatsapp_group_optin
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'player'),
    -- admins arrancan aprobados; jugadores requieren aprobación manual
    coalesce(new.raw_user_meta_data->>'role', 'player') = 'admin',
    coalesce((new.raw_user_meta_data->>'whatsapp_group_optin')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. (La política profiles_self_update ya permite que el usuario
--    actualice su propia preferencia. El admin la lee vía las
--    políticas profiles_admin_select_all / authenticated_select_all
--    que ya existen.)
