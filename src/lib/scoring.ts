// Sistema de puntaje OFICIAL de la polla.
//
// Reglas:
//   - Marcador exacto                                     → 4 pts
//   - Ganador correcto + uno de los dos marcadores        → 3 pts
//   - Ganador correcto (sin acertar ningún marcador)      → 2 pts
//   - Empate correctamente predicho (sin marcador exacto) → 2 pts
//   - Predijiste empate, hubo ganador, pero acertaste     → 1 pt
//     uno de los marcadores
//   - Predijiste ganador, hubo empate, pero acertaste     → 1 pt
//     uno de los marcadores
//   - Predijiste al ganador contrario al real, pero        → 1 pt
//     acertaste uno de los dos marcadores
//   - Cualquier otro caso (sin acertar ningún marcador
//     ni el ganador)                                       → 0 pts

import type { Match, Prediction } from "../types/database";

export const SCORING = {
  EXACT: 4,
  WINNER_WITH_SCORE: 3,
  WINNER_OR_DRAW: 2,
  SCORE_ONLY: 1,
  WRONG: 0,
} as const;

export type ScoreCategory =
  | "exact"           // 4 pts — marcador exacto
  | "winner_score"    // 3 pts — ganador + uno de los marcadores
  | "winner_or_draw"  // 2 pts — solo ganador, o empate correcto
  | "score_only"      // 1 pt  — un marcador acertado sin acertar el ganador
  | "wrong"           // 0 pts
  | "pending";        // partido no finalizado

export function categorize(
  prediction: Prediction | null | undefined,
  match: Match
): ScoreCategory {
  if (!prediction) return "pending";
  if (
    match.status !== "finished" ||
    match.home_score === null ||
    match.away_score === null
  )
    return "pending";

  const ph = prediction.home_score;
  const pa = prediction.away_score;
  const mh = match.home_score;
  const ma = match.away_score;

  // 1. Marcador exacto
  if (ph === mh && pa === ma) return "exact";

  const po = Math.sign(ph - pa); // 1 home, 0 draw, -1 away
  const ro = Math.sign(mh - ma);
  const oneScoreMatches = ph === mh || pa === ma;

  // 2. Predijo al equipo contrario como ganador.
  //    Aun así, si acertó uno de los dos marcadores, suma 1 pt.
  if (po !== 0 && ro !== 0 && po !== ro) {
    return oneScoreMatches ? "score_only" : "wrong";
  }

  // 3. Mismo ganador (no exacto)
  if (po === ro && ro !== 0) {
    return oneScoreMatches ? "winner_score" : "winner_or_draw";
  }

  // 4. Ambos empates (no exacto)
  if (po === 0 && ro === 0) return "winner_or_draw";

  // 5. Predijo empate y hubo ganador, o predijo ganador y hubo empate
  return oneScoreMatches ? "score_only" : "wrong";
}

export function pointsFor(cat: ScoreCategory): number {
  switch (cat) {
    case "exact": return SCORING.EXACT;
    case "winner_score": return SCORING.WINNER_WITH_SCORE;
    case "winner_or_draw": return SCORING.WINNER_OR_DRAW;
    case "score_only": return SCORING.SCORE_ONLY;
    default: return 0;
  }
}

export interface EntryScoreBreakdown {
  points: number;
  exact: number;          // 4 pts cada uno
  winner_score: number;   // 3 pts cada uno
  winner_or_draw: number; // 2 pts cada uno
  score_only: number;     // 1 pt cada uno
  wrong: number;
  predictions_count: number;
}

/**
 * Suma de puntos de una entry sobre todos sus pronósticos
 * para los partidos ya finalizados.
 */
export function computeEntryScore(
  predictions: Prediction[],
  matches: Match[]
): EntryScoreBreakdown {
  const matchById = new Map<string, Match>();
  for (const m of matches) matchById.set(m.id, m);

  const out: EntryScoreBreakdown = {
    points: 0,
    exact: 0,
    winner_score: 0,
    winner_or_draw: 0,
    score_only: 0,
    wrong: 0,
    predictions_count: predictions.length,
  };

  for (const p of predictions) {
    const m = matchById.get(p.match_id);
    if (!m) continue;
    const cat = categorize(p, m);
    if (cat === "pending") continue;
    out.points += pointsFor(cat);
    if (cat === "exact") out.exact++;
    else if (cat === "winner_score") out.winner_score++;
    else if (cat === "winner_or_draw") out.winner_or_draw++;
    else if (cat === "score_only") out.score_only++;
    else if (cat === "wrong") out.wrong++;
  }

  return out;
}
