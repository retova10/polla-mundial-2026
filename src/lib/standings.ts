import type { Match } from "../types/database";
import { isDemoMode } from "./demo";

export interface TeamStats {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

/**
 * Calcula la tabla de posiciones a partir de los partidos de un grupo.
 * Solo cuentan los partidos con status='finished' (o 'live' que ya tienen score).
 * Ordena por: puntos desc → diferencia de goles desc → goles a favor desc.
 */
export function computeGroupStandings(groupMatches: Match[]): TeamStats[] {
  const teams = new Set<string>();
  for (const m of groupMatches) {
    if (!m.home_is_placeholder) teams.add(m.home_team);
    if (!m.away_is_placeholder) teams.add(m.away_team);
  }

  const stats: Record<string, TeamStats> = {};
  for (const team of teams) {
    stats[team] = {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };
  }

  for (const m of groupMatches) {
    if (m.status !== "finished") continue;
    if (m.home_score === null || m.away_score === null) continue;
    if (m.home_is_placeholder || m.away_is_placeholder) continue;

    const home = stats[m.home_team];
    const away = stats[m.away_team];
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += m.home_score;
    home.goalsAgainst += m.away_score;
    away.goalsFor += m.away_score;
    away.goalsAgainst += m.home_score;

    if (m.home_score > m.away_score) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (m.home_score < m.away_score) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      home.points += 1;
      away.drawn++;
      away.points += 1;
    }
  }

  for (const team of Object.keys(stats)) {
    stats[team].goalDifference =
      stats[team].goalsFor - stats[team].goalsAgainst;
  }

  return Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.localeCompare(b.team);
  });
}

/**
 * Devuelve true si el partido está sucediendo ahora (entre kickoff y kickoff+2.5h)
 * O si su status ya es 'live'.
 */
export function isMatchLive(match: Match, now: Date = new Date()): boolean {
  if (match.status === "live") return true;
  if (match.status === "finished") return false;
  // En modo demo, "EN VIVO" se controla 100% por status; ignoramos la ventana horaria.
  if (isDemoMode()) return false;
  const k = new Date(match.kickoff_at).getTime();
  const t = now.getTime();
  return t >= k && t <= k + 150 * 60 * 1000; // 2.5 horas
}
