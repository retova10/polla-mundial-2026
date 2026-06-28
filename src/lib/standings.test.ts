import { describe, it, expect, vi, afterEach } from "vitest";
import { computeGroupStandings, isMatchLive } from "./standings";
import type { Match, MatchStatus } from "../types/database";

afterEach(() => {
  vi.unstubAllEnvs();
});

let counter = 0;
function makeMatch(
  home: string,
  away: string,
  homeScore: number | null,
  awayScore: number | null,
  status: MatchStatus = "finished",
  overrides: Partial<Match> = {}
): Match {
  counter++;
  return {
    id: `m-${counter}`,
    match_number: counter,
    phase: "group",
    group_letter: "A",
    home_team: home,
    away_team: away,
    home_is_placeholder: false,
    away_is_placeholder: false,
    kickoff_at: "2026-06-15T20:00:00Z",
    venue: null,
    city: null,
    country: null,
    home_score: homeScore,
    away_score: awayScore,
    home_penalties: null,
    away_penalties: null,
    status,
    ...overrides,
  };
}

describe("computeGroupStandings() — tabla de posiciones", () => {
  it("calcula pts/GD/GF/GC/PJ correctamente para un grupo completo", () => {
    // Grupo: México, Argentina, Colombia, Brasil
    // MEX 3-1 ARG, COL 2-2 BRA, MEX 0-0 COL, ARG 1-3 BRA, MEX 2-1 BRA, ARG 0-1 COL
    const matches = [
      makeMatch("México", "Argentina", 3, 1),
      makeMatch("Colombia", "Brasil", 2, 2),
      makeMatch("México", "Colombia", 0, 0),
      makeMatch("Argentina", "Brasil", 1, 3),
      makeMatch("México", "Brasil", 2, 1),
      makeMatch("Argentina", "Colombia", 0, 1),
    ];
    const table = computeGroupStandings(matches);

    // México: 3 PJ, 2W 1D 0L, GF=5 GC=2 → 7 pts
    const mex = table.find((t) => t.team === "México")!;
    expect(mex.played).toBe(3);
    expect(mex.won).toBe(2);
    expect(mex.drawn).toBe(1);
    expect(mex.lost).toBe(0);
    expect(mex.goalsFor).toBe(5);
    expect(mex.goalsAgainst).toBe(2);
    expect(mex.goalDifference).toBe(3);
    expect(mex.points).toBe(7);

    // Colombia: 3 PJ, 1W 2D 0L, GF=3 GC=2 → 5 pts
    const col = table.find((t) => t.team === "Colombia")!;
    expect(col.won).toBe(1);
    expect(col.drawn).toBe(2);
    expect(col.lost).toBe(0);
    expect(col.goalsFor).toBe(3);
    expect(col.goalsAgainst).toBe(2);
    expect(col.points).toBe(5);

    // Brasil: 3 PJ, 1W 1D 1L, GF=6 GC=4 → 4 pts
    const bra = table.find((t) => t.team === "Brasil")!;
    expect(bra.won).toBe(1);
    expect(bra.drawn).toBe(1);
    expect(bra.lost).toBe(1);
    expect(bra.points).toBe(4);

    // Argentina: 3 PJ, 0W 0D 3L → 0 pts
    const arg = table.find((t) => t.team === "Argentina")!;
    expect(arg.lost).toBe(3);
    expect(arg.points).toBe(0);
  });

  it("ordena por puntos descendente", () => {
    const matches = [
      makeMatch("A", "B", 3, 0), // A: 3pts
      makeMatch("C", "D", 1, 1), // C, D: 1pt
      makeMatch("A", "C", 1, 0), // A: 6pts, C: 1pt
      makeMatch("B", "D", 2, 2), // B: 1pt, D: 2pts
    ];
    const table = computeGroupStandings(matches);
    expect(table.map((t) => t.team)).toEqual(["A", "D", "C", "B"]);
  });

  it("desempata por diferencia de goles cuando hay empate en puntos", () => {
    // A y B con mismos pts pero distinto GD
    const matches = [
      makeMatch("A", "C", 5, 0), // A: 3pts, GD+5
      makeMatch("B", "D", 1, 0), // B: 3pts, GD+1
      makeMatch("C", "D", 0, 0), // C, D: 1pt
      makeMatch("A", "D", 0, 1), // A: 3pts GD+4 | D: 4pts
      makeMatch("B", "C", 0, 1), // B: 3pts | C: 4pts
    ];
    const table = computeGroupStandings(matches);
    const a = table.find((t) => t.team === "A")!;
    const b = table.find((t) => t.team === "B")!;
    expect(a.points).toBe(b.points);
    expect(a.goalDifference).toBeGreaterThan(b.goalDifference);
    // A debe ir antes que B en la tabla
    expect(table.findIndex((t) => t.team === "A")).toBeLessThan(
      table.findIndex((t) => t.team === "B")
    );
  });

  it("desempata por goles a favor cuando coinciden pts y GD", () => {
    // A: 2-0 vs C → 3pts, GF=2, GD=+2
    // B: 3-1 vs D → 3pts, GF=3, GD=+2
    // A pierde 0-1 vs B → A 3pts GF=2 GD=+1 | B 6pts
    // B pierde 0-1 vs C → A 3pts GF=2 GD=+1 | B 6pts | C 3pts GF=1 GD=-1
    // Para forzar A vs B con mismos pts y GD pero distinto GF:
    const matches = [
      makeMatch("A", "X", 2, 0), // A: 3pts GF=2 GD=+2
      makeMatch("B", "Y", 3, 1), // B: 3pts GF=3 GD=+2
      makeMatch("A", "Y", 0, 1), // A: 3pts GF=2 GD=+1 | Y: 3pts
      makeMatch("B", "X", 0, 1), // B: 3pts GF=3 GD=+1 | X: 3pts
    ];
    const table = computeGroupStandings(matches);
    const a = table.find((t) => t.team === "A")!;
    const b = table.find((t) => t.team === "B")!;
    expect(a.points).toBe(b.points);
    expect(a.goalDifference).toBe(b.goalDifference);
    expect(b.goalsFor).toBeGreaterThan(a.goalsFor);
    expect(table.findIndex((t) => t.team === "B")).toBeLessThan(
      table.findIndex((t) => t.team === "A")
    );
  });

  it("ignora partidos no finalizados", () => {
    const matches = [
      makeMatch("A", "B", 3, 0, "finished"),
      makeMatch("A", "C", 5, 0, "scheduled"),
      makeMatch("A", "D", 1, 0, "live"),
    ];
    const table = computeGroupStandings(matches);
    const a = table.find((t) => t.team === "A")!;
    expect(a.played).toBe(1);
    expect(a.points).toBe(3);
    expect(a.goalsFor).toBe(3);
  });

  it("ignora partidos con score nulo aunque status='finished'", () => {
    const matches = [
      makeMatch("A", "B", null, null, "finished"),
      makeMatch("A", "C", 2, 1, "finished"),
    ];
    const table = computeGroupStandings(matches);
    const a = table.find((t) => t.team === "A")!;
    expect(a.played).toBe(1);
    expect(a.points).toBe(3);
  });

  it("ignora equipos placeholder", () => {
    const matches = [
      makeMatch("A", "B", 1, 0, "finished"),
      makeMatch("A", "TBD", 5, 0, "finished", { away_is_placeholder: true }),
    ];
    const table = computeGroupStandings(matches);
    expect(table.find((t) => t.team === "TBD")).toBeUndefined();
    const a = table.find((t) => t.team === "A")!;
    // Solo cuenta el partido A vs B; el de placeholder no se suma
    expect(a.played).toBe(1);
    expect(a.goalsFor).toBe(1);
  });

  it("empate técnico (mismos pts/GD/GF) usa orden alfabético del nombre del equipo", () => {
    const matches = [
      makeMatch("Brasil", "X", 1, 0),
      makeMatch("Argentina", "Y", 1, 0),
      makeMatch("Brasil", "Y", 0, 0),
      makeMatch("Argentina", "X", 0, 0),
    ];
    const table = computeGroupStandings(matches);
    const arg = table.find((t) => t.team === "Argentina")!;
    const bra = table.find((t) => t.team === "Brasil")!;
    expect(arg.points).toBe(bra.points);
    expect(arg.goalDifference).toBe(bra.goalDifference);
    expect(arg.goalsFor).toBe(bra.goalsFor);
    // Alfabéticamente Argentina < Brasil
    expect(table.findIndex((t) => t.team === "Argentina")).toBeLessThan(
      table.findIndex((t) => t.team === "Brasil")
    );
  });

  it("grupo vacío de partidos finalizados devuelve a todos los equipos en 0", () => {
    const matches = [
      makeMatch("A", "B", null, null, "scheduled"),
      makeMatch("C", "D", null, null, "scheduled"),
    ];
    const table = computeGroupStandings(matches);
    expect(table.length).toBe(4);
    expect(table.every((t) => t.points === 0)).toBe(true);
    expect(table.every((t) => t.played === 0)).toBe(true);
  });
});

describe("isMatchLive() — detección de partido en vivo", () => {
  it("status='live' siempre es live", () => {
    const m = makeMatch("A", "B", null, null, "live");
    expect(isMatchLive(m, new Date("2099-01-01"))).toBe(true);
  });

  it("status='finished' nunca es live", () => {
    const m = makeMatch("A", "B", 1, 0, "finished");
    expect(isMatchLive(m, new Date(m.kickoff_at))).toBe(false);
  });

  it("scheduled antes del kickoff no es live", () => {
    const m = makeMatch("A", "B", null, null, "scheduled", {
      kickoff_at: "2026-06-15T20:00:00Z",
    });
    expect(isMatchLive(m, new Date("2026-06-15T18:00:00Z"))).toBe(false);
  });

  it("scheduled dentro de la ventana de 2.5h tras el kickoff es live", () => {
    const m = makeMatch("A", "B", null, null, "scheduled", {
      kickoff_at: "2026-06-15T20:00:00Z",
    });
    expect(isMatchLive(m, new Date("2026-06-15T21:30:00Z"))).toBe(true);
  });

  it("scheduled más de 2.5h después del kickoff ya no es live", () => {
    const m = makeMatch("A", "B", null, null, "scheduled", {
      kickoff_at: "2026-06-15T20:00:00Z",
    });
    expect(isMatchLive(m, new Date("2026-06-15T23:00:00Z"))).toBe(false);
  });

  it("modo demo: la ventana horaria se ignora; solo status='live' cuenta", () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    const m = makeMatch("A", "B", null, null, "scheduled", {
      kickoff_at: "2026-06-15T20:00:00Z",
    });
    // En producción sería true (dentro de la ventana). En demo es false.
    expect(isMatchLive(m, new Date("2026-06-15T21:30:00Z"))).toBe(false);

    const mLive = makeMatch("A", "B", null, null, "live");
    expect(isMatchLive(mLive, new Date("2026-06-15T21:30:00Z"))).toBe(true);
  });
});
