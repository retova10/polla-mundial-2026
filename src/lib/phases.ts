import type { Match, Phase } from "../types/database";

// Etiquetas oficiales de cada fase. Nota: el cuadro 2026 arranca en
// round_of_32 (32 equipos = dieciseisavos), por eso round_of_16 son los
// octavos. Centralizado aquí para que toda la app use la misma nomenclatura.
const PHASE_LABELS: Record<Phase, string> = {
  group: "Fase de grupos",
  round_of_32: "Dieciseisavos",
  round_of_16: "Octavos",
  quarterfinal: "Cuartos",
  semifinal: "Semifinal",
  third_place: "Tercer puesto",
  final: "Final",
};

/** Etiqueta de la fase. Para grupos incluye la letra ("Grupo A"). */
export function phaseLabel(match: Pick<Match, "phase" | "group_letter">): string {
  if (match.phase === "group") {
    return match.group_letter ? `Grupo ${match.group_letter}` : "Fase de grupos";
  }
  return PHASE_LABELS[match.phase] ?? match.phase;
}

/** Etiqueta corta de una fase (sin letra de grupo), para filtros y chips. */
export function phaseLabelShort(phase: Phase): string {
  return PHASE_LABELS[phase];
}

// Códigos ultracortos para celdas/columnas estrechas (p. ej. la matriz).
const PHASE_MINI: Record<Phase, string> = {
  group: "Grp",
  round_of_32: "R32",
  round_of_16: "8vos",
  quarterfinal: "4tos",
  semifinal: "SF",
  third_place: "3er",
  final: "Final",
};

/** Código mini de fase. Para grupos incluye la letra ("Grp A"). */
export function phaseLabelMini(match: Pick<Match, "phase" | "group_letter">): string {
  if (match.phase === "group") {
    return match.group_letter ? `Grp ${match.group_letter}` : "Grp";
  }
  return PHASE_MINI[match.phase] ?? match.phase;
}

// Orden de las fases eliminatorias para selects de filtro.
export const KNOCKOUT_PHASES: Phase[] = [
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "third_place",
  "final",
];
