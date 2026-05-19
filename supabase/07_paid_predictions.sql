-- ==============================================================
-- Polla Mundial 2026 — endurecer RLS: solo pollas PAGADAS pueden
-- recibir/modificar pronósticos.
-- Idempotente.
-- ==============================================================

-- INSERT: el usuario debe ser dueño de la entry, estar aprobado,
--         Y la entry debe estar marcada como pagada.
drop policy if exists "predictions_self_insert" on public.predictions;
create policy "predictions_self_insert" on public.predictions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.entries
      where id = predictions.entry_id
        and user_id = auth.uid()
        and paid = true
    )
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_approved = true
    )
  );

-- UPDATE: igual condición.
drop policy if exists "predictions_self_update" on public.predictions;
create policy "predictions_self_update" on public.predictions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.entries
      where id = predictions.entry_id
        and user_id = auth.uid()
        and paid = true
    )
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_approved = true
    )
  );

-- ==============================================================
-- LISTO. A partir de ahora, ni la app ni un cliente con la anon key
-- pueden insertar/editar pronósticos en una polla no pagada.
-- ==============================================================
