-- ===========================================================
-- Polla Mundial 2026 — marcador de PENALES en fases finales.
--
-- En eliminatorias, un empate en el tiempo reglamentario se define
-- por penales. Estas columnas guardan ese marcador (solo se llenan
-- cuando hubo definición por penales). El sistema de puntos NO los
-- usa (el pronóstico se evalúa con el marcador reglamentario); sirven
-- únicamente para saber quién avanza en el cuadro.
--
-- Idempotente.
-- ===========================================================

alter table public.matches
  add column if not exists home_penalties int,
  add column if not exists away_penalties int;
