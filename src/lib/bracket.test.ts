import { describe, it, expect } from "vitest";
import { computeBracketUpdates, isThirdPlaceToken } from "./bracket";
import type { Match, MatchStatus, Phase } from "../types/database";

let idc = 0;
function gm(
  match_number: number,
  group: string,
  home: string,
  away: string,
  hs: number | null,
  as_: number | null
): Match {
  return {
    id: `g${++idc}`,
    match_number,
    phase: "group" as Phase,
    group_letter: group,
    home_team: home,
    away_team: away,
    home_is_placeholder: false,
    away_is_placeholder: false,
    kickoff_at: "2026-06-11T19:00:00Z",
    venue: null,
    city: null,
    country: null,
    home_score: hs,
    away_score: as_,
    home_penalties: null,
    away_penalties: null,
    status: (hs !== null ? "finished" : "scheduled") as MatchStatus,
  };
}

function km(
  match_number: number,
  phase: Phase,
  home: string,
  away: string,
  opts: Partial<Match> = {}
): Match {
  return {
    id: `k${match_number}`,
    match_number,
    phase,
    group_letter: null,
    home_team: home,
    away_team: away,
    home_is_placeholder: true,
    away_is_placeholder: true,
    kickoff_at: "2026-06-28T17:00:00Z",
    venue: null,
    city: null,
    country: null,
    home_score: null,
    away_score: null,
    home_penalties: null,
    away_penalties: null,
    status: "scheduled" as MatchStatus,
    ...opts,
  };
}

// Grupo A completo: Brasil 1º, Francia 2º (Brasil 9 pts, Francia 6, etc.)
function groupAComplete(): Match[] {
  return [
    gm(1, "A", "Brasil", "Francia", 1, 0),
    gm(2, "A", "Egipto", "Noruega", 0, 0),
    gm(25, "A", "Brasil", "Egipto", 2, 0),
    gm(28, "A", "Francia", "Noruega", 3, 1),
    gm(53, "A", "Brasil", "Noruega", 2, 1),
    gm(54, "A", "Francia", "Egipto", 2, 0),
  ];
  // Brasil 9, Francia 6, Noruega 1, Egipto 1 → 1º Brasil, 2º Francia
}

describe("isThirdPlaceToken", () => {
  it("detecta tokens de mejor tercero", () => {
    expect(isThirdPlaceToken("3C/3D/3E/3F")).toBe(true);
    expect(isThirdPlaceToken("1A")).toBe(false);
    expect(isThirdPlaceToken("Ganador 73")).toBe(false);
  });
});

describe("computeBracketUpdates — posiciones de grupo", () => {
  // #79 es el partido "1A vs 3C/3E/3F/3H/3I" en el cuadro oficial.
  it("NO resuelve si el grupo aún no termina", () => {
    const partial = groupAComplete().map((m, i) =>
      i === 0 ? { ...m, home_score: null, away_score: null, status: "scheduled" as MatchStatus } : m
    );
    const r79 = km(79, "round_of_32", "1A", "3C/3E/3F/3H/3I");
    const updates = computeBracketUpdates([...partial, r79]);
    expect(updates.find((u) => u.match_number === 79)).toBeUndefined();
  });

  it("resuelve 1A→Brasil cuando el grupo A termina (y deja el tercero intacto)", () => {
    const r79 = km(79, "round_of_32", "1A", "3C/3E/3F/3H/3I");
    const updates = computeBracketUpdates([...groupAComplete(), r79]);
    const u = updates.find((x) => x.match_number === 79);
    expect(u).toBeDefined();
    expect(u!.home_team).toBe("Brasil");
    expect(u!.home_is_placeholder).toBe(false);
    // El lado del tercero NO se toca (asignación manual).
    expect(u!.away_team).toBeUndefined();
    expect(u!.away_is_placeholder).toBeUndefined();
  });
});

describe("computeBracketUpdates — ganadores/perdedores de llave", () => {
  it("propaga el ganador de un octavo al cuarto, en una sola pasada", () => {
    // #73 ya resuelto y jugado: Brasil 2-0 → Brasil gana.
    const r73 = km(73, "round_of_32", "Brasil", "Marruecos", {
      home_is_placeholder: false,
      away_is_placeholder: false,
      home_score: 2,
      away_score: 0,
      status: "finished",
    });
    // #75 jugado: España gana.
    const r75 = km(75, "round_of_32", "España", "Uruguay", {
      home_is_placeholder: false,
      away_is_placeholder: false,
      home_score: 1,
      away_score: 0,
      status: "finished",
    });
    // #90 = Ganador 73 vs Ganador 75
    const r90 = km(90, "round_of_16", "Ganador 73", "Ganador 75");
    const updates = computeBracketUpdates([r73, r75, r90]);
    const u90 = updates.find((x) => x.match_number === 90);
    expect(u90).toBeDefined();
    expect(u90!.home_team).toBe("Brasil");
    expect(u90!.away_team).toBe("España");
    expect(u90!.home_is_placeholder).toBe(false);
    expect(u90!.away_is_placeholder).toBe(false);
  });

  it("NO resuelve el ganador si hubo empate y aún no se cargan penales", () => {
    const r73 = km(73, "round_of_32", "Brasil", "Marruecos", {
      home_is_placeholder: false,
      away_is_placeholder: false,
      home_score: 1,
      away_score: 1,
      status: "finished",
    });
    const r90 = km(90, "round_of_16", "Ganador 73", "Ganador 75");
    const updates = computeBracketUpdates([r73, r90]);
    expect(updates.find((x) => x.match_number === 90)).toBeUndefined();
  });

  it("resuelve por PENALES cuando el reglamentario terminó empatado", () => {
    // Empate 1-1, Marruecos gana 5-4 en penales → avanza Marruecos.
    const r73 = km(73, "round_of_32", "Brasil", "Marruecos", {
      home_is_placeholder: false,
      away_is_placeholder: false,
      home_score: 1,
      away_score: 1,
      home_penalties: 4,
      away_penalties: 5,
      status: "finished",
    });
    const r90 = km(90, "round_of_16", "Ganador 73", "Ganador 75");
    const updates = computeBracketUpdates([r73, r90]);
    const u90 = updates.find((x) => x.match_number === 90);
    expect(u90).toBeDefined();
    expect(u90!.home_team).toBe("Marruecos"); // ganó los penales
    expect(u90!.home_is_placeholder).toBe(false);
  });

  it("NO resuelve si los penales también quedan empatados", () => {
    const r73 = km(73, "round_of_32", "Brasil", "Marruecos", {
      home_is_placeholder: false,
      away_is_placeholder: false,
      home_score: 1,
      away_score: 1,
      home_penalties: 3,
      away_penalties: 3,
      status: "finished",
    });
    const r90 = km(90, "round_of_16", "Ganador 73", "Ganador 75");
    const updates = computeBracketUpdates([r73, r90]);
    expect(updates.find((x) => x.match_number === 90)).toBeUndefined();
  });

  it("el perdedor de semifinal alimenta el 3er puesto", () => {
    const sf101 = km(101, "semifinal", "Argentina", "Brasil", {
      home_is_placeholder: false,
      away_is_placeholder: false,
      home_score: 0,
      away_score: 1,
      status: "finished",
    });
    const third = km(103, "third_place", "Perdedor 101", "Perdedor 102");
    const updates = computeBracketUpdates([sf101, third]);
    const u = updates.find((x) => x.match_number === 103);
    expect(u).toBeDefined();
    expect(u!.home_team).toBe("Argentina"); // perdió la 101
    expect(u!.home_is_placeholder).toBe(false);
    expect(u!.away_team).toBeUndefined(); // 102 no jugada
  });
});

describe("computeBracketUpdates — idempotencia y correcciones", () => {
  it("no genera updates si ya está todo resuelto", () => {
    const r79 = km(79, "round_of_32", "Brasil", "3C/3E/3F/3H/3I", {
      home_is_placeholder: false,
    });
    const updates = computeBracketUpdates([...groupAComplete(), r79]);
    // home ya es Brasil y no-placeholder → sin cambios; tercero intacto.
    expect(updates.find((x) => x.match_number === 79)).toBeUndefined();
  });

  it("NO revierte un equipo ya resuelto/manual si el feeder deja de estar disponible", () => {
    // #79 quedó con Brasil resuelto, pero ahora el grupo A no está completo.
    const partial = groupAComplete().map((m) =>
      m.match_number === 54
        ? { ...m, home_score: null, away_score: null, status: "scheduled" as MatchStatus }
        : m
    );
    const r79 = km(79, "round_of_32", "Brasil", "3C/3E/3F/3H/3I", {
      home_is_placeholder: false,
    });
    const updates = computeBracketUpdates([...partial, r79]);
    // No hay dato afirmativo (grupo incompleto) → no se toca, mantiene Brasil.
    expect(updates.find((x) => x.match_number === 79)).toBeUndefined();
  });

  it("auto-corrige si el grupo terminó y cambió el clasificado", () => {
    // #79 tenía a Francia en 1A, pero el grupo da Brasil como 1º.
    const r79 = km(79, "round_of_32", "Francia", "3C/3E/3F/3H/3I", {
      home_is_placeholder: false,
    });
    const updates = computeBracketUpdates([...groupAComplete(), r79]);
    const u = updates.find((x) => x.match_number === 79);
    expect(u).toBeDefined();
    expect(u!.home_team).toBe("Brasil"); // corrige 1A → Brasil
    expect(u!.home_is_placeholder).toBe(false);
  });
});
