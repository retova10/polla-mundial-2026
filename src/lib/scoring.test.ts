import { describe, it, expect } from "vitest";
import {
  categorize,
  pointsFor,
  computeEntryScore,
  SCORING,
} from "./scoring";
import type { Match, Prediction, MatchStatus } from "../types/database";

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    match_number: 1,
    phase: "group",
    group_letter: "A",
    home_team: "Colombia",
    away_team: "Brasil",
    home_is_placeholder: false,
    away_is_placeholder: false,
    kickoff_at: "2026-06-15T20:00:00Z",
    venue: "Estadio",
    city: "Bogotá",
    country: "COL",
    home_score: 2,
    away_score: 1,
    home_penalties: null,
    away_penalties: null,
    status: "finished" as MatchStatus,
    ...overrides,
  };
}

function makePred(
  home: number,
  away: number,
  overrides: Partial<Prediction> = {}
): Prediction {
  return {
    id: "p1",
    user_id: "u1",
    entry_id: "e1",
    match_id: "m1",
    home_score: home,
    away_score: away,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("categorize() — reglas de scoring", () => {
  describe("partido no finalizado", () => {
    it("devuelve 'pending' si el match no está finalizado", () => {
      const m = makeMatch({ status: "scheduled", home_score: null, away_score: null });
      expect(categorize(makePred(2, 1), m)).toBe("pending");
    });

    it("devuelve 'pending' si home_score es null aunque status='finished'", () => {
      const m = makeMatch({ home_score: null });
      expect(categorize(makePred(2, 1), m)).toBe("pending");
    });

    it("devuelve 'pending' si no hay predicción", () => {
      expect(categorize(null, makeMatch())).toBe("pending");
      expect(categorize(undefined, makeMatch())).toBe("pending");
    });
  });

  describe("4 pts — marcador exacto", () => {
    it("acierta exactamente el resultado con victoria local", () => {
      const m = makeMatch({ home_score: 2, away_score: 1 });
      expect(categorize(makePred(2, 1), m)).toBe("exact");
    });

    it("acierta exactamente un empate", () => {
      const m = makeMatch({ home_score: 0, away_score: 0 });
      expect(categorize(makePred(0, 0), m)).toBe("exact");
    });

    it("acierta exactamente victoria visitante con goleada", () => {
      const m = makeMatch({ home_score: 1, away_score: 5 });
      expect(categorize(makePred(1, 5), m)).toBe("exact");
    });
  });

  describe("3 pts — ganador correcto + un marcador", () => {
    it("predijo 2-0, real 2-1 → acertó home_score y al ganador local", () => {
      const m = makeMatch({ home_score: 2, away_score: 1 });
      expect(categorize(makePred(2, 0), m)).toBe("winner_score");
    });

    it("predijo 3-1, real 2-1 → acertó away_score y al ganador local", () => {
      const m = makeMatch({ home_score: 2, away_score: 1 });
      expect(categorize(makePred(3, 1), m)).toBe("winner_score");
    });

    it("predijo 0-2, real 1-2 → acertó away_score y al ganador visitante", () => {
      const m = makeMatch({ home_score: 1, away_score: 2 });
      expect(categorize(makePred(0, 2), m)).toBe("winner_score");
    });
  });

  describe("2 pts — ganador correcto sin marcadores", () => {
    it("predijo 3-0, real 2-1 → solo acertó al ganador local", () => {
      const m = makeMatch({ home_score: 2, away_score: 1 });
      expect(categorize(makePred(3, 0), m)).toBe("winner_or_draw");
    });

    it("predijo 0-3, real 1-2 → solo acertó al ganador visitante", () => {
      const m = makeMatch({ home_score: 1, away_score: 2 });
      expect(categorize(makePred(0, 3), m)).toBe("winner_or_draw");
    });

    it("predijo 1-1, real 2-2 → empate correcto sin acertar marcador", () => {
      const m = makeMatch({ home_score: 2, away_score: 2 });
      expect(categorize(makePred(1, 1), m)).toBe("winner_or_draw");
    });

    it("predijo 3-3, real 0-0 → ambos empates, ningún marcador acertado", () => {
      const m = makeMatch({ home_score: 0, away_score: 0 });
      expect(categorize(makePred(3, 3), m)).toBe("winner_or_draw");
    });
  });

  describe("1 pt — un marcador acertado, ganador equivocado", () => {
    it("predijo empate 2-2, real 2-1 → acertó home_score pero predijo empate", () => {
      const m = makeMatch({ home_score: 2, away_score: 1 });
      expect(categorize(makePred(2, 2), m)).toBe("score_only");
    });

    it("predijo empate 1-1, real 2-1 → acertó away_score pero predijo empate", () => {
      const m = makeMatch({ home_score: 2, away_score: 1 });
      expect(categorize(makePred(1, 1), m)).toBe("score_only");
    });

    it("predijo ganador local 2-0, real empate 2-2 → acertó home_score", () => {
      const m = makeMatch({ home_score: 2, away_score: 2 });
      expect(categorize(makePred(2, 0), m)).toBe("score_only");
    });

    it("predijo ganador visitante 0-3, real empate 3-3 → acertó away_score", () => {
      const m = makeMatch({ home_score: 3, away_score: 3 });
      expect(categorize(makePred(0, 3), m)).toBe("score_only");
    });

    it("predijo ganador contrario 1-2, real 1-0 → acertó home_score (CIV vs ECU)", () => {
      const m = makeMatch({ home_score: 1, away_score: 0 });
      expect(categorize(makePred(1, 2), m)).toBe("score_only");
    });

    it("predijo ganador contrario 2-1, real 0-1 → acertó away_score (HAI vs SCO)", () => {
      const m = makeMatch({ home_score: 0, away_score: 1 });
      expect(categorize(makePred(2, 1), m)).toBe("score_only");
    });

    it("predijo ganador contrario 2-3, real 2-1 → acertó home_score", () => {
      const m = makeMatch({ home_score: 2, away_score: 1 });
      expect(categorize(makePred(2, 3), m)).toBe("score_only");
    });
  });

  describe("0 pts — ganador contrario sin acertar ningún marcador", () => {
    it("predijo 1-2, real 2-1 → ganador contrario, ningún score", () => {
      const m = makeMatch({ home_score: 2, away_score: 1 });
      expect(categorize(makePred(1, 2), m)).toBe("wrong");
    });

    it("predijo 0-3, real 2-1 → ganador contrario aunque sin scores comunes", () => {
      const m = makeMatch({ home_score: 2, away_score: 1 });
      expect(categorize(makePred(0, 3), m)).toBe("wrong");
    });

    it("predijo 3-0 (ganador local), real 0-3 → ganador contrario", () => {
      const m = makeMatch({ home_score: 0, away_score: 3 });
      expect(categorize(makePred(3, 0), m)).toBe("wrong");
    });

    it("predijo empate 0-0, real 2-1 → ningún marcador acertado", () => {
      const m = makeMatch({ home_score: 2, away_score: 1 });
      expect(categorize(makePred(0, 0), m)).toBe("wrong");
    });
  });
});

describe("pointsFor() — mapeo de categoría a puntos", () => {
  it("mapea cada categoría al puntaje correcto según SCORING", () => {
    expect(pointsFor("exact")).toBe(SCORING.EXACT);
    expect(pointsFor("winner_score")).toBe(SCORING.WINNER_WITH_SCORE);
    expect(pointsFor("winner_or_draw")).toBe(SCORING.WINNER_OR_DRAW);
    expect(pointsFor("score_only")).toBe(SCORING.SCORE_ONLY);
    expect(pointsFor("wrong")).toBe(0);
    expect(pointsFor("pending")).toBe(0);
  });

  it("los valores oficiales son 4/3/2/1/0", () => {
    expect(SCORING.EXACT).toBe(4);
    expect(SCORING.WINNER_WITH_SCORE).toBe(3);
    expect(SCORING.WINNER_OR_DRAW).toBe(2);
    expect(SCORING.SCORE_ONLY).toBe(1);
    expect(SCORING.WRONG).toBe(0);
  });
});

describe("computeEntryScore() — agregación sobre múltiples partidos", () => {
  it("suma correctamente puntos de un mix de resultados", () => {
    const matches: Match[] = [
      makeMatch({ id: "m1", home_score: 2, away_score: 1 }), // exact
      makeMatch({ id: "m2", home_score: 0, away_score: 0 }), // winner_or_draw
      makeMatch({ id: "m3", home_score: 3, away_score: 1 }), // winner_score
      makeMatch({ id: "m4", home_score: 1, away_score: 2 }), // wrong
      makeMatch({ id: "m5", home_score: 2, away_score: 2 }), // score_only
    ];
    const predictions: Prediction[] = [
      makePred(2, 1, { id: "p1", match_id: "m1" }),
      makePred(1, 1, { id: "p2", match_id: "m2" }),
      makePred(3, 0, { id: "p3", match_id: "m3" }),
      makePred(2, 0, { id: "p4", match_id: "m4" }),
      makePred(2, 0, { id: "p5", match_id: "m5" }),
    ];

    const score = computeEntryScore(predictions, matches);

    expect(score.exact).toBe(1);
    expect(score.winner_or_draw).toBe(1);
    expect(score.winner_score).toBe(1);
    expect(score.score_only).toBe(1);
    expect(score.wrong).toBe(1);
    expect(score.predictions_count).toBe(5);
    // 4 + 2 + 3 + 0 + 1 = 10
    expect(score.points).toBe(10);
  });

  it("ignora predicciones sin partido asociado en la lista", () => {
    const matches: Match[] = [makeMatch({ id: "m1", home_score: 1, away_score: 0 })];
    const predictions: Prediction[] = [
      makePred(1, 0, { id: "p1", match_id: "m1" }),
      makePred(2, 0, { id: "p2", match_id: "m-inexistente" }),
    ];
    const score = computeEntryScore(predictions, matches);
    expect(score.points).toBe(4);
    expect(score.exact).toBe(1);
    expect(score.predictions_count).toBe(2);
  });

  it("partidos no finalizados no suman ni restan puntos", () => {
    const matches: Match[] = [
      makeMatch({ id: "m1", status: "scheduled", home_score: null, away_score: null }),
      makeMatch({ id: "m2", home_score: 1, away_score: 0 }),
    ];
    const predictions: Prediction[] = [
      makePred(2, 1, { id: "p1", match_id: "m1" }),
      makePred(1, 0, { id: "p2", match_id: "m2" }),
    ];
    const score = computeEntryScore(predictions, matches);
    expect(score.points).toBe(4);
    expect(score.exact).toBe(1);
    expect(score.wrong).toBe(0);
  });

  it("entry sin predicciones devuelve cero", () => {
    const score = computeEntryScore([], [makeMatch()]);
    expect(score.points).toBe(0);
    expect(score.predictions_count).toBe(0);
  });
});
