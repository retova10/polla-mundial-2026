import { describe, it, expect, vi, afterEach } from "vitest";
import { isLocked, msUntilLock, formatCountdown } from "./time";

afterEach(() => {
  vi.unstubAllEnvs();
});

// Helper: kickoff arbitrario en UTC.
const KICKOFF = "2026-06-15T20:00:00Z";
const kickoffMs = new Date(KICKOFF).getTime();

// Atajos para construir "now" relativo al kickoff (positivo = ANTES del
// kickoff, p.ej. minutesBeforeKickoff(120) = exactamente 2h antes).
function minutesBeforeKickoff(min: number): Date {
  return new Date(kickoffMs - min * 60 * 1000);
}
function minutesAfterKickoff(min: number): Date {
  return new Date(kickoffMs + min * 60 * 1000);
}

describe("isLocked() — frontera del bloqueo 2h antes del kickoff", () => {
  it("3h antes → NO bloqueado (sobra tiempo)", () => {
    expect(isLocked(KICKOFF, minutesBeforeKickoff(180))).toBe(false);
  });

  it("2h 01m antes → NO bloqueado (un minuto antes de cerrar)", () => {
    expect(isLocked(KICKOFF, minutesBeforeKickoff(121))).toBe(false);
  });

  it("2h 00m exactos antes → BLOQUEADO (el operador es >=)", () => {
    expect(isLocked(KICKOFF, minutesBeforeKickoff(120))).toBe(true);
  });

  it("1h 59m antes → BLOQUEADO (ya pasó el lock)", () => {
    expect(isLocked(KICKOFF, minutesBeforeKickoff(119))).toBe(true);
  });

  it("1 segundo antes del lock_at → NO bloqueado", () => {
    const oneSecBeforeLock = new Date(
      kickoffMs - 2 * 60 * 60 * 1000 - 1000
    );
    expect(isLocked(KICKOFF, oneSecBeforeLock)).toBe(false);
  });

  it("1 segundo después del lock_at → BLOQUEADO", () => {
    const oneSecAfterLock = new Date(
      kickoffMs - 2 * 60 * 60 * 1000 + 1000
    );
    expect(isLocked(KICKOFF, oneSecAfterLock)).toBe(true);
  });

  it("durante el partido (kickoff+45min) → BLOQUEADO", () => {
    expect(isLocked(KICKOFF, minutesAfterKickoff(45))).toBe(true);
  });

  it("partido viejo (5h después del kickoff) → BLOQUEADO", () => {
    expect(isLocked(KICKOFF, minutesAfterKickoff(300))).toBe(true);
  });

  it("modo demo activo → siempre devuelve false, ignora la frontera", () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    expect(isLocked(KICKOFF, minutesBeforeKickoff(119))).toBe(false);
    expect(isLocked(KICKOFF, minutesAfterKickoff(45))).toBe(false);
    expect(isLocked(KICKOFF, minutesBeforeKickoff(0))).toBe(false);
  });
});

describe("msUntilLock() — milisegundos restantes hasta cerrarse", () => {
  it("3h antes → ~1h positivo (60min restantes)", () => {
    const ms = msUntilLock(KICKOFF, minutesBeforeKickoff(180));
    expect(ms).toBe(60 * 60 * 1000);
  });

  it("exactamente en lock_at (2h antes) → 0", () => {
    expect(msUntilLock(KICKOFF, minutesBeforeKickoff(120))).toBe(0);
  });

  it("dentro de la ventana (1h antes) → negativo", () => {
    expect(msUntilLock(KICKOFF, minutesBeforeKickoff(60))).toBeLessThan(0);
  });

  it("modo demo → Infinity (nunca se bloquea)", () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    expect(msUntilLock(KICKOFF, minutesBeforeKickoff(60))).toBe(
      Number.POSITIVE_INFINITY
    );
  });
});

describe("formatCountdown() — formato humano del tiempo restante", () => {
  it("ms <= 0 → 'Bloqueado'", () => {
    expect(formatCountdown(0)).toBe("Bloqueado");
    expect(formatCountdown(-1)).toBe("Bloqueado");
    expect(formatCountdown(-9999)).toBe("Bloqueado");
  });

  it("solo minutos cuando es < 1h", () => {
    expect(formatCountdown(5 * 60 * 1000)).toBe("5m");
    expect(formatCountdown(59 * 60 * 1000)).toBe("59m");
  });

  it("horas y minutos cuando es >= 1h y < 1día", () => {
    expect(formatCountdown(3 * 60 * 60 * 1000 + 15 * 60 * 1000)).toBe("3h 15m");
    expect(formatCountdown(23 * 60 * 60 * 1000)).toBe("23h 0m");
  });

  it("días y horas cuando es >= 1 día", () => {
    expect(
      formatCountdown(2 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000)
    ).toBe("2d 5h");
    expect(formatCountdown(7 * 24 * 60 * 60 * 1000)).toBe("7d 0h");
  });
});
