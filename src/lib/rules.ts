// Fuente única de verdad para el contenido de las reglas de puntaje.
// La consumen la página /reglas y las instrucciones de la página de login,
// de modo que ambas SIEMPRE coinciden. El puntaje no se escribe a mano:
// se deriva de SCORING vía pointsFor() para no desincronizarse de la lógica.

import type { Match, Prediction } from "../types/database";
import { categorize, pointsFor, type ScoreCategory } from "./scoring";

export type ScoringCategory = Exclude<ScoreCategory, "pending">;

export interface CategoryMeta {
  label: string;
  description: string;
  /** Clases de fondo+texto para el badge del puntaje. */
  badge: string;
  /** Clase del ring del badge. */
  ring: string;
}

export const CATEGORY_META: Record<ScoringCategory, CategoryMeta> = {
  exact: {
    label: "Marcador exacto",
    description: "Acertaste el resultado exacto del partido.",
    badge: "bg-brand-50 text-brand-700",
    ring: "ring-brand-200",
  },
  winner_score: {
    label: "Ganador + un marcador",
    description:
      "Acertaste quién gana (o el empate) y, además, el número de goles de uno de los dos equipos.",
    badge: "bg-emerald-50 text-emerald-700",
    ring: "ring-emerald-200",
  },
  winner_or_draw: {
    label: "Solo ganador o empate",
    description:
      "Acertaste quién gana (o que hubo empate), pero no acertaste el marcador de ningún equipo.",
    badge: "bg-blue-50 text-blue-700",
    ring: "ring-blue-200",
  },
  score_only: {
    label: "Un marcador, sin ganador",
    description:
      "Te equivocaste en el resultado (empate por ganador o viceversa), pero acertaste los goles de uno de los equipos.",
    badge: "bg-amber-50 text-amber-700",
    ring: "ring-amber-200",
  },
  wrong: {
    label: "Sin aciertos",
    description:
      "No acertaste el resultado ni los goles. Incluye predecir al ganador contrario al real.",
    badge: "bg-slate-100 text-slate-600",
    ring: "ring-slate-200",
  },
};

// Orden de mayor a menor puntaje.
export const CATEGORY_ORDER: ScoringCategory[] = [
  "exact",
  "winner_score",
  "winner_or_draw",
  "score_only",
  "wrong",
];

export interface Example {
  pred: [number, number];
  real: [number, number];
  note?: string;
}

export const EXAMPLES: Record<ScoringCategory, Example[]> = {
  exact: [
    { pred: [2, 1], real: [2, 1] },
    { pred: [0, 0], real: [0, 0], note: "Empate exacto" },
  ],
  winner_score: [
    { pred: [2, 1], real: [2, 0], note: "Acertaste los goles del local" },
    { pred: [1, 2], real: [0, 2], note: "Acertaste los goles del visitante" },
  ],
  winner_or_draw: [
    { pred: [3, 1], real: [2, 0], note: "Ganó el local, marcador distinto" },
    { pred: [1, 1], real: [2, 2], note: "Empate, pero con otro marcador" },
  ],
  score_only: [
    { pred: [1, 1], real: [1, 0], note: "Predijiste empate, hubo ganador" },
    { pred: [2, 0], real: [2, 2], note: "Predijiste ganador, hubo empate" },
  ],
  wrong: [
    { pred: [2, 1], real: [0, 3], note: "Ganador contrario al real" },
    { pred: [1, 1], real: [3, 0], note: "Ni resultado ni goles" },
  ],
};

// Construye objetos mínimos para alimentar categorize(): solo usa los
// marcadores y el status. Así el puntaje mostrado es el real, calculado.
export function evalExample(ex: Example): {
  cat: ScoreCategory;
  points: number;
} {
  const prediction = {
    home_score: ex.pred[0],
    away_score: ex.pred[1],
  } as Prediction;
  const match = {
    status: "finished",
    home_score: ex.real[0],
    away_score: ex.real[1],
  } as Match;
  const cat = categorize(prediction, match);
  return { cat, points: pointsFor(cat) };
}
