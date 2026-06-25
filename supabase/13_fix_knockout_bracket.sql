-- ===========================================================
-- Polla Mundial 2026 — CORREGIR los cruces de dieciseisavos (R32).
--
-- El seed original (02) tenía emparejamientos equivocados para los
-- partidos 73–88 (formato antiguo: terceros de 4 grupos y posiciones
-- mal asignadas). Esta migración los reescribe con el cuadro OFICIAL
-- FIFA 2026 (terceros de 5 grupos, posiciones correctas), junto con
-- las sedes y horarios reales.
--
-- A diferencia de re-correr 02 (que hace DELETE de toda la tabla y
-- borraría los marcadores de grupos), aquí solo se hace UPDATE de los
-- 16 partidos 73–88. Se resetean a "por definir" (placeholders) para
-- que la sincronización de clasificados los vuelva a llenar bien con
-- los cruces corregidos. Los partidos 1–72 (grupos) y 89–104 (octavos
-- en adelante) NO se tocan.
--
-- SEGURO de re-ejecutar. Aplica ANTES de que se jueguen los R32.
-- Fuente: Wikipedia / FIFA (2026 knockout stage).
-- ===========================================================

update public.matches m set
  home_team           = v.home_team,
  away_team           = v.away_team,
  home_is_placeholder = true,
  away_is_placeholder = true,
  home_score          = null,
  away_score          = null,
  status              = 'scheduled',
  kickoff_at          = v.kickoff_at,
  venue               = v.venue,
  city                = v.city,
  country             = v.country
from (values
  (73, '2A', '2B',                '2026-06-28T19:00:00Z'::timestamptz, 'SoFi Stadium',             'Los Ángeles',       'Estados Unidos'),
  (74, '1E', '3A/3B/3C/3D/3F',    '2026-06-29T20:30:00Z'::timestamptz, 'Gillette Stadium',         'Boston',            'Estados Unidos'),
  (75, '1F', '2C',                '2026-06-30T01:00:00Z'::timestamptz, 'Estadio BBVA',             'Monterrey',         'México'),
  (76, '1C', '2F',                '2026-06-29T20:30:00Z'::timestamptz, 'NRG Stadium',              'Houston',           'Estados Unidos'),
  (77, '1I', '3C/3D/3F/3G/3H',    '2026-06-30T21:00:00Z'::timestamptz, 'MetLife Stadium',          'Nueva York / NJ',   'Estados Unidos'),
  (78, '2E', '2I',                '2026-06-30T17:00:00Z'::timestamptz, 'AT&T Stadium',             'Dallas',            'Estados Unidos'),
  (79, '1A', '3C/3E/3F/3H/3I',    '2026-07-01T01:00:00Z'::timestamptz, 'Estadio Banorte (Azteca)', 'Ciudad de México',  'México'),
  (80, '1L', '3E/3H/3I/3J/3K',    '2026-07-01T16:00:00Z'::timestamptz, 'Mercedes-Benz Stadium',    'Atlanta',           'Estados Unidos'),
  (81, '1D', '3B/3E/3F/3I/3J',    '2026-07-02T00:00:00Z'::timestamptz, 'Levi''s Stadium',          'San Francisco Bay', 'Estados Unidos'),
  (82, '1G', '3A/3E/3H/3I/3J',    '2026-07-01T20:00:00Z'::timestamptz, 'Lumen Field',              'Seattle',           'Estados Unidos'),
  (83, '2K', '2L',                '2026-07-02T23:00:00Z'::timestamptz, 'BMO Field',                'Toronto',           'Canadá'),
  (84, '1H', '2J',                '2026-07-02T19:00:00Z'::timestamptz, 'SoFi Stadium',             'Los Ángeles',       'Estados Unidos'),
  (85, '1B', '3E/3F/3G/3I/3J',    '2026-07-03T03:00:00Z'::timestamptz, 'BC Place',                 'Vancouver',         'Canadá'),
  (86, '1J', '2H',                '2026-07-03T22:00:00Z'::timestamptz, 'Hard Rock Stadium',        'Miami',             'Estados Unidos'),
  (87, '1K', '3D/3E/3I/3J/3L',    '2026-07-04T01:30:00Z'::timestamptz, 'Arrowhead Stadium',        'Kansas City',       'Estados Unidos'),
  (88, '2D', '2G',                '2026-07-03T18:00:00Z'::timestamptz, 'AT&T Stadium',             'Dallas',            'Estados Unidos')
) as v(match_number, home_team, away_team, kickoff_at, venue, city, country)
where m.match_number = v.match_number;

-- Tras aplicar: el admin entra a Marcadores → "Actualizar clasificados"
-- para volver a propagar los 1º/2º de los grupos ya terminados al cuadro
-- corregido. Los octavos en adelante (89–104) ya eran correctos.
