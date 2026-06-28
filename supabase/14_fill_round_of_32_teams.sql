-- ===========================================================
-- Polla Mundial 2026 — llenar dieciseisavos YA definidos.
--
-- Estos 7 cruces involucran a un ganador de grupo contra un mejor
-- tercero, por lo que la app NO los puede deducir sola (la asignación
-- de terceros es manual). Aquí se asignan los equipos reales conocidos
-- al 27/06/2026. Cada partido se identifica por su ganador de grupo,
-- que es único en el cuadro:
--
--   P74  Alemania (1E)        vs Paraguay (3D)
--   P77  Francia (1I)         vs Suecia (3F)
--   P79  México (1A)          vs Ecuador (3E)
--   P80  Inglaterra (1L)      vs RD Congo (3K)
--   P81  Estados Unidos (1D)  vs Bosnia y Herzegovina (3B)
--   P82  Bélgica (1G)         vs Senegal (3I)
--   P87  Colombia (1K)        vs Ghana (3L)
--
-- Requiere haber aplicado antes 13_fix_knockout_bracket.sql (cuadro
-- corregido). No toca marcadores ni estado: los partidos quedan listos
-- para pronosticar. Idempotente. Nombres = canónicos de data/countries.
-- ===========================================================

update public.matches m set
  home_team           = v.home_team,
  away_team           = v.away_team,
  home_is_placeholder = false,
  away_is_placeholder = false
from (values
  (74, 'Alemania',       'Paraguay'),
  (77, 'Francia',        'Suecia'),
  (79, 'México',         'Ecuador'),
  (80, 'Inglaterra',     'RD Congo'),
  (81, 'Estados Unidos', 'Bosnia y Herzegovina'),
  (82, 'Bélgica',        'Senegal'),
  (87, 'Colombia',       'Ghana')
) as v(match_number, home_team, away_team)
where m.match_number = v.match_number;
