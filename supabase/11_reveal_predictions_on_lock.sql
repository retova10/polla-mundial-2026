-- ==============================================================
-- Polla Mundial 2026 — revelar pronósticos al BLOQUEARSE el partido
--
-- Cambio: los jugadores aprobados (no-admin) podían leer los
-- pronósticos ajenos SOLO de partidos `finished`. Ahora también de
-- partidos ya BLOQUEADOS (faltan ≤ 2 horas para el inicio), que es el
-- mismo umbral en que nadie puede modificar su marcador
-- (ver enforce_prediction_lock en 01_schema.sql).
--
-- Así la matriz tiene total transparencia: en cuanto un partido se
-- bloquea, todos pueden ver lo que cada quien puso.
--
-- El admin sigue viendo TODO por sus políticas `*_admin_select_all`.
-- Cada usuario sigue viendo SIEMPRE sus propios pronósticos vía
-- `predictions_self_select` (definida en 06_entries.sql), por lo que
-- puede crear/editar antes del bloqueo aunque aún no sean públicos.
-- Idempotente.
-- ==============================================================

-- Reemplaza la política que solo revelaba partidos finalizados.
drop policy if exists "predictions_approved_select_finished" on public.predictions;
drop policy if exists "predictions_approved_select_locked_or_finished" on public.predictions;

create policy "predictions_approved_select_locked_or_finished" on public.predictions
  for select using (
    public.is_approved_self()
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and (
          m.status = 'finished'
          or now() >= m.kickoff_at - interval '2 hours'
        )
    )
  );

-- ==============================================================
-- LISTO. La matriz revela los pronósticos de todos en cuanto cada
-- partido se bloquea (2h antes), no solo al finalizar.
-- ==============================================================
