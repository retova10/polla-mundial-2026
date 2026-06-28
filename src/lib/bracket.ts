// Resolución del cuadro de eliminación: convierte los placeholders de los
// partidos de fase final ("1A", "Ganador 73", "Perdedor 101", …) en los
// equipos reales que van clasificando, a partir de los resultados.
//
// Modelo HÍBRIDO:
//   - AUTOMÁTICO (seguro): posición de grupo (1º/2º) cuando el grupo terminó,
//     y ganador/perdedor de una llave cuando el partido terminó con marcador
//     decisivo. Estos slots los gestiona la app.
//   - MANUAL (admin): los "mejores terceros" ("3C/3D/3E/3F") y los desempates
//     por penales (eliminatorias que acaban en empate). La app NO toca esos
//     slots; el admin asigna el equipo a mano.
//
// La fuente (token) de cada slot vive aquí, en KNOCKOUT_SOURCES, no en la BD:
// así se puede re-resolver siempre, aunque home_team ya contenga el equipo
// real. Persistir el resultado a la tabla `matches` (home_team + quitar el
// flag placeholder) hace que TODAS las vistas lo reflejen y habilita el
// pronóstico del partido.

import type { Match } from "../types/database";
import { computeGroupStandings } from "./standings";

export interface Slot {
  home: string;
  away: string;
}

// Token de cada lado de cada partido de fase final, por match_number.
// Posición de grupo: "1A".."2L". Tercero: "3X/3Y/3Z/3W" (manual).
// Llave: "Ganador N" / "Perdedor N".
export const KNOCKOUT_SOURCES: Record<number, Slot> = {
  // Dieciseisavos (round_of_32) — cruces oficiales FIFA 2026.
  73: { home: "2A", away: "2B" },
  74: { home: "1E", away: "3A/3B/3C/3D/3F" },
  75: { home: "1F", away: "2C" },
  76: { home: "1C", away: "2F" },
  77: { home: "1I", away: "3C/3D/3F/3G/3H" },
  78: { home: "2E", away: "2I" },
  79: { home: "1A", away: "3C/3E/3F/3H/3I" },
  80: { home: "1L", away: "3E/3H/3I/3J/3K" },
  81: { home: "1D", away: "3B/3E/3F/3I/3J" },
  82: { home: "1G", away: "3A/3E/3H/3I/3J" },
  83: { home: "2K", away: "2L" },
  84: { home: "1H", away: "2J" },
  85: { home: "1B", away: "3E/3F/3G/3I/3J" },
  86: { home: "1J", away: "2H" },
  87: { home: "1K", away: "3D/3E/3I/3J/3L" },
  88: { home: "2D", away: "2G" },
  // Octavos (round_of_16)
  89: { home: "Ganador 74", away: "Ganador 77" },
  90: { home: "Ganador 73", away: "Ganador 75" },
  91: { home: "Ganador 76", away: "Ganador 78" },
  92: { home: "Ganador 79", away: "Ganador 80" },
  93: { home: "Ganador 83", away: "Ganador 84" },
  94: { home: "Ganador 81", away: "Ganador 82" },
  95: { home: "Ganador 86", away: "Ganador 88" },
  96: { home: "Ganador 85", away: "Ganador 87" },
  // Cuartos
  97: { home: "Ganador 89", away: "Ganador 90" },
  98: { home: "Ganador 93", away: "Ganador 94" },
  99: { home: "Ganador 91", away: "Ganador 92" },
  100: { home: "Ganador 95", away: "Ganador 96" },
  // Semifinales
  101: { home: "Ganador 97", away: "Ganador 98" },
  102: { home: "Ganador 99", away: "Ganador 100" },
  // Tercer puesto
  103: { home: "Perdedor 101", away: "Perdedor 102" },
  // Final
  104: { home: "Ganador 101", away: "Ganador 102" },
};

const POS_RE = /^([12])([A-L])$/;
const WINNER_RE = /^Ganador (\d+)$/;
const LOSER_RE = /^Perdedor (\d+)$/;

/** True si el token es un "mejor tercero" (se asigna manualmente). */
export function isThirdPlaceToken(token: string): boolean {
  return token.includes("/");
}

interface MutableTeam {
  team: string; // equipo real o token
  placeholder: boolean;
}
interface MutableMatch {
  match: Match;
  home: MutableTeam;
  away: MutableTeam;
}

/** Ganador (o perdedor) real de un partido ya jugado, o null si aún no es
 *  decidible: no finalizado, equipos sin definir, o empate sin penales
 *  cargados. Si hubo empate, se decide por el marcador de penales. */
function decisiveWinner(
  mm: MutableMatch | undefined,
  want: "winner" | "loser"
): string | null {
  if (!mm) return null;
  const m = mm.match;
  if (m.status !== "finished") return null;
  if (m.home_score === null || m.away_score === null) return null;
  if (mm.home.placeholder || mm.away.placeholder) return null;

  let homeAdvances: boolean;
  if (m.home_score !== m.away_score) {
    homeAdvances = m.home_score > m.away_score;
  } else {
    // Empate en el reglamentario → lo define el marcador de penales.
    if (m.home_penalties == null || m.away_penalties == null) return null;
    if (m.home_penalties === m.away_penalties) return null; // sin definir
    homeAdvances = m.home_penalties > m.away_penalties;
  }
  const winnerSide = homeAdvances ? mm.home : mm.away;
  const loserSide = homeAdvances ? mm.away : mm.home;
  return (want === "winner" ? winnerSide : loserSide).team;
}

export interface BracketUpdate {
  id: string;
  match_number: number;
  home_team?: string;
  away_team?: string;
  home_is_placeholder?: boolean;
  away_is_placeholder?: boolean;
}

/**
 * Calcula los cambios necesarios para reflejar los clasificados en los
 * partidos de fase final, a partir de los resultados actuales. Solo toca
 * slots AUTO-resolubles (posición de grupo y ganador/perdedor de llave);
 * los slots de "mejor tercero" se dejan intactos para asignación manual.
 *
 * Es idempotente: re-ejecutarlo tras corregir un marcador reordena los
 * clasificados afectados (p. ej. si cambia quién gana un grupo).
 */
export function computeBracketUpdates(matches: Match[]): BracketUpdate[] {
  // Tablas de posiciones por grupo COMPLETO (todos sus partidos finalizados).
  const groupMatches = new Map<string, Match[]>();
  for (const m of matches) {
    if (m.phase !== "group" || !m.group_letter) continue;
    const arr = groupMatches.get(m.group_letter) ?? [];
    arr.push(m);
    groupMatches.set(m.group_letter, arr);
  }
  const groupPos = new Map<string, string[]>(); // letra → [1º, 2º, …]
  for (const [letter, ms] of groupMatches) {
    const complete = ms.length > 0 && ms.every((m) => m.status === "finished");
    if (!complete) continue;
    groupPos.set(
      letter,
      computeGroupStandings(ms).map((s) => s.team)
    );
  }

  // Estado mutable de cada partido de fase final, indexado por número.
  const byNumber = new Map<number, MutableMatch>();
  for (const m of matches) {
    if (!(m.match_number in KNOCKOUT_SOURCES)) continue;
    byNumber.set(m.match_number, {
      match: m,
      home: { team: m.home_team, placeholder: m.home_is_placeholder },
      away: { team: m.away_team, placeholder: m.away_is_placeholder },
    });
  }

  function resolveToken(token: string): string | null {
    const pos = POS_RE.exec(token);
    if (pos) {
      const rank = Number(pos[1]); // 1 o 2
      const letter = pos[2];
      const standings = groupPos.get(letter);
      return standings ? standings[rank - 1] ?? null : null;
    }
    const win = WINNER_RE.exec(token);
    if (win) return decisiveWinner(byNumber.get(Number(win[1])), "winner");
    const lose = LOSER_RE.exec(token);
    if (lose) return decisiveWinner(byNumber.get(Number(lose[1])), "loser");
    return null; // tercero u otro → manual
  }

  const updates: BracketUpdate[] = [];

  // Aplica el equipo resuelto sobre un lado SI se puede determinar de forma
  // afirmativa, mutando el estado en memoria y devolviendo el parche del
  // update. Nunca revierte a placeholder: respeta lo que ya haya (resoluciones
  // previas o asignaciones manuales del admin, p. ej. ganadores por penales).
  // La auto-corrección sí ocurre: si el grupo terminó y cambió el 1º, el slot
  // se reescribe con el nuevo clasificado.
  function settle(
    slot: MutableTeam,
    token: string
  ): { team: string; placeholder: boolean } | null {
    if (isThirdPlaceToken(token)) return null; // manual: no tocar
    const resolved = resolveToken(token);
    if (resolved === null) return null; // sin dato afirmativo: no tocar
    if (slot.team === resolved && !slot.placeholder) return null;
    slot.team = resolved;
    slot.placeholder = false;
    return { team: resolved, placeholder: false };
  }

  // Orden ascendente: así "Ganador 73" ve el #73 ya resuelto en esta pasada.
  const numbers = Array.from(byNumber.keys()).sort((a, b) => a - b);
  for (const n of numbers) {
    const mm = byNumber.get(n)!;
    const src = KNOCKOUT_SOURCES[n];
    const update: BracketUpdate = { id: mm.match.id, match_number: n };
    let changed = false;

    const h = settle(mm.home, src.home);
    if (h) {
      update.home_team = h.team;
      update.home_is_placeholder = h.placeholder;
      changed = true;
    }
    const a = settle(mm.away, src.away);
    if (a) {
      update.away_team = a.team;
      update.away_is_placeholder = a.placeholder;
      changed = true;
    }

    if (changed) updates.push(update);
  }

  return updates;
}
