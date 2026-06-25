// Genera supabase/02_seed_matches.sql con los 72 partidos REALES de
// fase de grupos del Mundial FIFA 2026 + 16 partidos de octavos
// (Round of 32) como placeholders.
//
// Uso: node scripts/generate-seed.mjs
//
// Fuentes verificadas: FIFA, Wikipedia (2026 FIFA World Cup Group A,
// Group D), Sky Sports schedule. Las horas de Sky Sports están en
// UK BST (UTC+1 en junio); aquí se almacenan en UTC y la app las
// muestra en hora Colombia (UTC-5).

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "supabase", "02_seed_matches.sql");

// 16 sedes del Mundial 2026
const VENUES = {
  MEX_CDMX: { venue: "Estadio Banorte (Azteca)", city: "Ciudad de México", country: "México" },
  MEX_GDL:  { venue: "Estadio Akron",            city: "Guadalajara",      country: "México" },
  MEX_MTY:  { venue: "Estadio BBVA",              city: "Monterrey",        country: "México" },
  CAN_TOR:  { venue: "BMO Field",                 city: "Toronto",          country: "Canadá" },
  CAN_VAN:  { venue: "BC Place",                  city: "Vancouver",        country: "Canadá" },
  USA_ATL:  { venue: "Mercedes-Benz Stadium",     city: "Atlanta",          country: "Estados Unidos" },
  USA_BOS:  { venue: "Gillette Stadium",          city: "Boston",           country: "Estados Unidos" },
  USA_DAL:  { venue: "AT&T Stadium",              city: "Dallas",           country: "Estados Unidos" },
  USA_HOU:  { venue: "NRG Stadium",               city: "Houston",          country: "Estados Unidos" },
  USA_KC:   { venue: "Arrowhead Stadium",         city: "Kansas City",      country: "Estados Unidos" },
  USA_LA:   { venue: "SoFi Stadium",              city: "Los Ángeles",      country: "Estados Unidos" },
  USA_MIA:  { venue: "Hard Rock Stadium",         city: "Miami",            country: "Estados Unidos" },
  USA_NY:   { venue: "MetLife Stadium",           city: "Nueva York / NJ",  country: "Estados Unidos" },
  USA_PHI:  { venue: "Lincoln Financial Field",   city: "Filadelfia",       country: "Estados Unidos" },
  USA_SF:   { venue: "Levi's Stadium",            city: "San Francisco Bay",country: "Estados Unidos" },
  USA_SEA:  { venue: "Lumen Field",               city: "Seattle",          country: "Estados Unidos" },
};

// Helper: convierte una hora UK BST (UTC+1) a ISO UTC.
function bstToUtcIso(dateStr, timeStr) {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:MM"
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  // BST = UTC+1 → UTC = BST - 1 hora
  const utc = new Date(Date.UTC(y, m - 1, d, hh - 1, mm));
  return utc.toISOString().replace(/\.\d+Z$/, "Z");
}

// Calendario oficial del Mundial 2026, fase de grupos (72 partidos).
// [matchNum, group, home, away, dateUK, timeUK_BST, venueKey]
const SCHEDULE = [
  // Jueves 11 jun
  [1,  "A", "México",        "Sudáfrica",            "2026-06-11", "20:00", "MEX_CDMX"],
  // Viernes 12 jun
  [2,  "A", "Corea del Sur", "Chequia",              "2026-06-12", "03:00", "MEX_GDL"],
  [3,  "B", "Canadá",        "Bosnia y Herzegovina", "2026-06-12", "20:00", "CAN_TOR"],
  // Sábado 13 jun
  [4,  "D", "Estados Unidos","Paraguay",             "2026-06-13", "02:00", "USA_LA"],
  [5,  "B", "Catar",         "Suiza",                "2026-06-13", "20:00", "USA_SF"],
  [6,  "C", "Brasil",        "Marruecos",            "2026-06-13", "23:00", "USA_NY"],
  // Domingo 14 jun
  [7,  "C", "Haití",         "Escocia",              "2026-06-14", "02:00", "USA_BOS"],
  [8,  "D", "Australia",     "Turquía",              "2026-06-14", "05:00", "CAN_VAN"],
  [9,  "E", "Alemania",      "Curazao",              "2026-06-14", "18:00", "USA_HOU"],
  [10, "F", "Países Bajos",  "Japón",                "2026-06-14", "21:00", "USA_DAL"],
  // Lunes 15 jun
  [11, "E", "Costa de Marfil","Ecuador",             "2026-06-15", "00:00", "USA_PHI"],
  [12, "F", "Suecia",        "Túnez",                "2026-06-15", "03:00", "MEX_MTY"],
  [13, "H", "España",        "Cabo Verde",           "2026-06-15", "17:00", "USA_ATL"],
  [14, "G", "Bélgica",       "Egipto",               "2026-06-15", "20:00", "USA_SEA"],
  [15, "H", "Arabia Saudita","Uruguay",              "2026-06-15", "23:00", "USA_MIA"],
  // Martes 16 jun
  [16, "G", "Irán",          "Nueva Zelanda",        "2026-06-16", "02:00", "USA_LA"],
  [17, "I", "Francia",       "Senegal",              "2026-06-16", "20:00", "USA_NY"],
  [18, "I", "Iraq",          "Noruega",              "2026-06-16", "23:00", "USA_BOS"],
  // Miércoles 17 jun
  [19, "J", "Argentina",     "Argelia",              "2026-06-17", "02:00", "USA_KC"],
  [20, "J", "Austria",       "Jordania",             "2026-06-17", "05:00", "USA_SF"],
  [21, "K", "Portugal",      "RD Congo",             "2026-06-17", "18:00", "USA_HOU"],
  [22, "L", "Inglaterra",    "Croacia",              "2026-06-17", "21:00", "USA_DAL"],
  // Jueves 18 jun
  [23, "L", "Ghana",         "Panamá",               "2026-06-18", "00:00", "CAN_TOR"],
  [24, "K", "Uzbekistán",    "Colombia",             "2026-06-18", "03:00", "MEX_CDMX"],
  [25, "A", "Chequia",       "Sudáfrica",            "2026-06-18", "17:00", "USA_ATL"],
  [26, "B", "Suiza",         "Bosnia y Herzegovina", "2026-06-18", "20:00", "USA_LA"],
  [27, "B", "Canadá",        "Catar",                "2026-06-18", "23:00", "CAN_VAN"],
  // Viernes 19 jun
  [28, "A", "México",        "Corea del Sur",        "2026-06-19", "02:00", "MEX_GDL"],
  [29, "D", "Estados Unidos","Australia",            "2026-06-19", "20:00", "USA_SEA"],
  [30, "C", "Escocia",       "Marruecos",            "2026-06-19", "23:00", "USA_BOS"],
  // Sábado 20 jun
  [31, "C", "Brasil",        "Haití",                "2026-06-20", "01:30", "USA_PHI"],
  [32, "D", "Turquía",       "Paraguay",             "2026-06-20", "04:00", "USA_SF"],
  [33, "F", "Países Bajos",  "Suecia",               "2026-06-20", "18:00", "USA_HOU"],
  [34, "E", "Alemania",      "Costa de Marfil",      "2026-06-20", "21:00", "CAN_TOR"],
  // Domingo 21 jun
  [35, "E", "Ecuador",       "Curazao",              "2026-06-21", "01:00", "USA_KC"],
  [36, "F", "Túnez",         "Japón",                "2026-06-21", "05:00", "MEX_MTY"],
  [37, "H", "España",        "Arabia Saudita",       "2026-06-21", "17:00", "USA_ATL"],
  [38, "G", "Bélgica",       "Irán",                 "2026-06-21", "20:00", "USA_LA"],
  [39, "H", "Uruguay",       "Cabo Verde",           "2026-06-21", "23:00", "USA_MIA"],
  // Lunes 22 jun
  [40, "G", "Nueva Zelanda", "Egipto",               "2026-06-22", "02:00", "CAN_VAN"],
  [41, "J", "Argentina",     "Austria",              "2026-06-22", "18:00", "USA_DAL"],
  [42, "I", "Francia",       "Iraq",                 "2026-06-22", "22:00", "USA_PHI"],
  // Martes 23 jun
  [43, "I", "Noruega",       "Senegal",              "2026-06-23", "01:00", "CAN_TOR"],
  [44, "J", "Jordania",      "Argelia",              "2026-06-23", "04:00", "USA_SF"],
  [45, "K", "Portugal",      "Uzbekistán",           "2026-06-23", "18:00", "USA_HOU"],
  [46, "L", "Inglaterra",    "Ghana",                "2026-06-23", "21:00", "USA_BOS"],
  // Miércoles 24 jun
  [47, "L", "Panamá",        "Croacia",              "2026-06-24", "00:00", "USA_BOS"],
  [48, "K", "Colombia",      "RD Congo",             "2026-06-24", "03:00", "MEX_GDL"],
  [49, "B", "Suiza",         "Canadá",               "2026-06-24", "20:00", "CAN_VAN"],
  [50, "B", "Bosnia y Herzegovina", "Catar",         "2026-06-24", "20:00", "USA_SEA"],
  [51, "C", "Marruecos",     "Haití",                "2026-06-24", "23:00", "USA_ATL"],
  [52, "C", "Escocia",       "Brasil",               "2026-06-24", "23:00", "USA_MIA"],
  // Jueves 25 jun
  [53, "A", "Sudáfrica",     "Corea del Sur",        "2026-06-25", "02:00", "MEX_MTY"],
  [54, "A", "Chequia",       "México",               "2026-06-25", "02:00", "MEX_CDMX"],
  [55, "E", "Curazao",       "Costa de Marfil",      "2026-06-25", "21:00", "USA_PHI"],
  [56, "E", "Ecuador",       "Alemania",             "2026-06-25", "21:00", "USA_NY"],
  // Viernes 26 jun
  [57, "F", "Túnez",         "Países Bajos",         "2026-06-26", "00:00", "USA_KC"],
  [58, "F", "Japón",         "Suecia",               "2026-06-26", "00:00", "USA_DAL"],
  [59, "D", "Turquía",       "Estados Unidos",       "2026-06-26", "03:00", "USA_LA"],
  [60, "D", "Paraguay",      "Australia",            "2026-06-26", "03:00", "USA_SF"],
  [61, "I", "Noruega",       "Francia",              "2026-06-26", "20:00", "USA_BOS"],
  [62, "I", "Senegal",       "Iraq",                 "2026-06-26", "20:00", "CAN_TOR"],
  // Sábado 27 jun
  [63, "H", "Cabo Verde",    "Arabia Saudita",       "2026-06-27", "01:00", "USA_HOU"],
  [64, "H", "Uruguay",       "España",               "2026-06-27", "01:00", "MEX_GDL"],
  [65, "G", "Nueva Zelanda", "Bélgica",              "2026-06-27", "04:00", "CAN_VAN"],
  [66, "G", "Egipto",        "Irán",                 "2026-06-27", "04:00", "USA_SEA"],
  [67, "L", "Panamá",        "Inglaterra",           "2026-06-27", "22:00", "USA_NY"],
  [68, "L", "Croacia",       "Ghana",                "2026-06-27", "22:00", "USA_PHI"],
  // Domingo 28 jun
  [69, "K", "Colombia",      "Portugal",             "2026-06-28", "00:30", "USA_MIA"],
  [70, "K", "RD Congo",      "Uzbekistán",           "2026-06-28", "00:30", "USA_ATL"],
  [71, "J", "Argelia",       "Austria",              "2026-06-28", "03:00", "USA_KC"],
  [72, "J", "Jordania",      "Argentina",            "2026-06-28", "03:00", "USA_DAL"],
];

const matches = SCHEDULE.map(([n, g, home, away, date, time, vk]) => ({
  number: n,
  phase: "group",
  group: g,
  home,
  away,
  kickoff: bstToUtcIso(date, time),
  ...VENUES[vk],
}));

// --- ROUND OF 32 (placeholders) ---
// Cruces oficiales FIFA 2026 (orden por número de partido 73→88). Las
// fechas/sedes que este script asigna abajo son APROXIMADAS; los valores
// reales viven en supabase/02_seed_matches.sql (y la corrección 13). Los
// partidos 89–104 (octavos→final) están en supabase/12_seed_knockout_bracket.
const r32Matchups = [
  ["2A", "2B"],
  ["1E", "3A/3B/3C/3D/3F"],
  ["1F", "2C"],
  ["1C", "2F"],
  ["1I", "3C/3D/3F/3G/3H"],
  ["2E", "2I"],
  ["1A", "3C/3E/3F/3H/3I"],
  ["1L", "3E/3H/3I/3J/3K"],
  ["1D", "3B/3E/3F/3I/3J"],
  ["1G", "3A/3E/3H/3I/3J"],
  ["2K", "2L"],
  ["1H", "2J"],
  ["1B", "3E/3F/3G/3I/3J"],
  ["1J", "2H"],
  ["1K", "3D/3E/3I/3J/3L"],
  ["2D", "2G"],
];
const r32Days = [
  "2026-06-28", "2026-06-29", "2026-06-30",
  "2026-07-01", "2026-07-02", "2026-07-03",
];
const r32Times = ["18:00", "21:00", "23:00"]; // BST
const venueKeys = Object.keys(VENUES);
let mn = 72;
for (let i = 0; i < r32Matchups.length; i++) {
  const [home, away] = r32Matchups[i];
  const day = r32Days[Math.floor(i / 3) % r32Days.length];
  const time = r32Times[i % r32Times.length];
  const venue = VENUES[venueKeys[i % venueKeys.length]];
  matches.push({
    number: ++mn,
    phase: "round_of_32",
    group: null,
    home,
    away,
    kickoff: bstToUtcIso(day, time),
    ...venue,
    isPlaceholder: true,
  });
}

// ============== SQL OUTPUT ==============
function esc(v) {
  if (v === null || v === undefined) return "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}

const lines = [
  "-- ===========================================================",
  "-- Polla Mundial 2026 — seed de partidos (datos reales FIFA)",
  "-- Sorteo final del 5 dic 2025. 72 partidos fase de grupos +",
  "-- 16 octavos placeholder = 88 partidos.",
  "-- Generado por scripts/generate-seed.mjs",
  "-- Fuentes: FIFA, Wikipedia, Sky Sports.",
  "-- Horas almacenadas en UTC. La app las muestra en hora Colombia.",
  "-- ===========================================================",
  "",
  "delete from public.matches;",
  "",
  "insert into public.matches",
  "  (match_number, phase, group_letter, home_team, away_team,",
  "   home_is_placeholder, away_is_placeholder,",
  "   kickoff_at, venue, city, country)",
  "values",
];

const rows = matches.map((m) => {
  const isPh = m.isPlaceholder === true;
  const parts = [
    m.number,
    esc(m.phase),
    esc(m.group),
    esc(m.home),
    esc(m.away),
    isPh ? "true" : "false",
    isPh ? "true" : "false",
    esc(m.kickoff),
    esc(m.venue),
    esc(m.city),
    esc(m.country),
  ];
  return `  (${parts.join(", ")})`;
});

lines.push(rows.join(",\n") + ";");
lines.push("");
lines.push(`-- Total: ${matches.length} partidos.`);
lines.push("");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(`Wrote ${matches.length} matches to ${OUT}`);
