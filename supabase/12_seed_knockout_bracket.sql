-- ===========================================================
-- Polla Mundial 2026 — seed de la FASE FINAL completa
-- (octavos → final + 3er puesto).
--
-- El seed original (02_seed_matches.sql) llega hasta round_of_32
-- (partidos 73–88). Aquí agregamos los 16 partidos restantes del
-- cuadro de eliminación, con sus cruces oficiales FIFA:
--
--   round_of_16 : 89–96   (ganadores de los R32)
--   quarterfinal: 97–100
--   semifinal   : 101–102
--   third_place : 103      (perdedores de las semis)
--   final       : 104
--
-- Los equipos son placeholders ("Ganador 73", "Perdedor 101", …):
-- el admin los reemplaza por la selección real conforme avanza el
-- torneo. El emparejamiento (qué ganador juega contra cuál) está
-- fijado por número de partido según el bracket oficial; el front
-- (KnockoutBracket) usa esos mismos números para dibujar las llaves.
--
-- Horas en UTC (la app las muestra en hora Colombia).
-- Idempotente: re-borra el rango 89–104 antes de insertar.
-- Fuente del bracket: Wikipedia / FIFA (2026 knockout stage).
-- ===========================================================

delete from public.matches where match_number between 89 and 104;

insert into public.matches
  (match_number, phase, group_letter, home_team, away_team,
   home_is_placeholder, away_is_placeholder,
   kickoff_at, venue, city, country)
values
  -- ===== Octavos de final (round_of_16) =====
  (89, 'round_of_16', null, 'Ganador 74', 'Ganador 77', true, true, '2026-07-04T21:00:00Z', 'Lincoln Financial Field', 'Filadelfia', 'Estados Unidos'),
  (90, 'round_of_16', null, 'Ganador 73', 'Ganador 75', true, true, '2026-07-04T17:00:00Z', 'NRG Stadium', 'Houston', 'Estados Unidos'),
  (91, 'round_of_16', null, 'Ganador 76', 'Ganador 78', true, true, '2026-07-05T20:00:00Z', 'MetLife Stadium', 'Nueva York / NJ', 'Estados Unidos'),
  (92, 'round_of_16', null, 'Ganador 79', 'Ganador 80', true, true, '2026-07-06T00:00:00Z', 'Estadio Banorte (Azteca)', 'Ciudad de México', 'México'),
  (93, 'round_of_16', null, 'Ganador 83', 'Ganador 84', true, true, '2026-07-06T19:00:00Z', 'AT&T Stadium', 'Dallas', 'Estados Unidos'),
  (94, 'round_of_16', null, 'Ganador 81', 'Ganador 82', true, true, '2026-07-07T00:00:00Z', 'Lumen Field', 'Seattle', 'Estados Unidos'),
  (95, 'round_of_16', null, 'Ganador 86', 'Ganador 88', true, true, '2026-07-07T16:00:00Z', 'Mercedes-Benz Stadium', 'Atlanta', 'Estados Unidos'),
  (96, 'round_of_16', null, 'Ganador 85', 'Ganador 87', true, true, '2026-07-07T20:00:00Z', 'BC Place', 'Vancouver', 'Canadá'),

  -- ===== Cuartos de final (quarterfinal) =====
  (97, 'quarterfinal', null, 'Ganador 89', 'Ganador 90', true, true, '2026-07-09T20:00:00Z', 'Gillette Stadium', 'Boston', 'Estados Unidos'),
  (98, 'quarterfinal', null, 'Ganador 93', 'Ganador 94', true, true, '2026-07-10T19:00:00Z', 'SoFi Stadium', 'Los Ángeles', 'Estados Unidos'),
  (99, 'quarterfinal', null, 'Ganador 91', 'Ganador 92', true, true, '2026-07-11T21:00:00Z', 'Hard Rock Stadium', 'Miami', 'Estados Unidos'),
  (100, 'quarterfinal', null, 'Ganador 95', 'Ganador 96', true, true, '2026-07-12T01:00:00Z', 'Arrowhead Stadium', 'Kansas City', 'Estados Unidos'),

  -- ===== Semifinales (semifinal) =====
  (101, 'semifinal', null, 'Ganador 97', 'Ganador 98', true, true, '2026-07-14T19:00:00Z', 'AT&T Stadium', 'Dallas', 'Estados Unidos'),
  (102, 'semifinal', null, 'Ganador 99', 'Ganador 100', true, true, '2026-07-15T19:00:00Z', 'Mercedes-Benz Stadium', 'Atlanta', 'Estados Unidos'),

  -- ===== Tercer puesto (third_place) =====
  (103, 'third_place', null, 'Perdedor 101', 'Perdedor 102', true, true, '2026-07-18T21:00:00Z', 'Hard Rock Stadium', 'Miami', 'Estados Unidos'),

  -- ===== Final (final) =====
  (104, 'final', null, 'Ganador 101', 'Ganador 102', true, true, '2026-07-19T19:00:00Z', 'MetLife Stadium', 'Nueva York / NJ', 'Estados Unidos');

-- Total fase final: 88 previos + 16 = 104 partidos.
