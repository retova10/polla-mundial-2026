-- ==============================================================
-- Polla Mundial 2026 — habilitar Realtime para tabla matches
-- Esto permite que cuando el admin actualiza el marcador o estado
-- de un partido, todos los clientes con la app abierta lo vean
-- inmediatamente sin recargar.
-- ==============================================================

-- Agregar la tabla a la publicación de Realtime de Supabase.
-- Idempotente: si ya está, ignora.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end;
$$;

-- También para predictions (futuro: mostrar pronósticos de todos en vivo).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'predictions'
  ) then
    alter publication supabase_realtime add table public.predictions;
  end if;
end;
$$;
