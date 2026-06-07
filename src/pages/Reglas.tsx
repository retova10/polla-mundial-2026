import type { Match, Prediction } from "../types/database";
import {
  SCORING,
  categorize,
  pointsFor,
  type ScoreCategory,
} from "../lib/scoring";

// Metadatos de cada categoría de puntaje (color, etiqueta, descripción).
// El puntaje NO se escribe a mano: se deriva de SCORING para que esta página
// siempre coincida con la lógica real de la polla.
const CATEGORY_META: Record<
  Exclude<ScoreCategory, "pending">,
  { label: string; description: string; badge: string; ring: string }
> = {
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

// Orden de mayor a menor puntaje para la tabla.
const CATEGORY_ORDER: Array<Exclude<ScoreCategory, "pending">> = [
  "exact",
  "winner_score",
  "winner_or_draw",
  "score_only",
  "wrong",
];

interface Example {
  pred: [number, number];
  real: [number, number];
  note?: string;
}

// Construye objetos mínimos para alimentar categorize(): solo usa los
// marcadores y el status. Así el puntaje mostrado es el real, calculado.
function evalExample(ex: Example): { cat: ScoreCategory; points: number } {
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

// Ejemplos concretos, agrupados por categoría esperada.
const EXAMPLES: Record<Exclude<ScoreCategory, "pending">, Example[]> = {
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

function ScoreLine({ a, b }: { a: number; b: number }) {
  return (
    <span className="font-mono font-bold tabular-nums">
      {a} <span className="text-slate-400">–</span> {b}
    </span>
  );
}

export default function Reglas() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900">
          Reglas y <span className="text-brand-600">puntaje</span>
        </h1>
        <p className="text-slate-500 mt-1.5">
          Cómo se otorgan los puntos por cada pronóstico. Los ejemplos son el
          resultado real del cálculo de la polla.
        </p>
      </header>

      {/* Tabla resumen de puntajes */}
      <section className="card p-5 sm:p-6 mb-6">
        <h2 className="font-display font-bold text-xl text-slate-900 mb-4">
          Puntos por acierto
        </h2>
        <div className="space-y-2.5">
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat];
            const pts = pointsFor(cat);
            return (
              <div
                key={cat}
                className="flex items-start gap-3 sm:gap-4 rounded-xl border border-slate-200/80 p-3 sm:p-4"
              >
                <div
                  className={`shrink-0 w-12 h-12 grid place-items-center rounded-xl font-display font-extrabold text-xl ring-1 ring-inset ${meta.badge} ${meta.ring}`}
                >
                  {pts}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">
                    {meta.label}
                    <span className="ml-2 text-sm font-medium text-slate-400">
                      {pts === 1 ? "1 punto" : `${pts} puntos`}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {meta.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ejemplos por categoría */}
      <section className="card p-5 sm:p-6 mb-6">
        <h2 className="font-display font-bold text-xl text-slate-900 mb-1">
          Ejemplos
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          <span className="font-semibold text-slate-700">Tu pronóstico</span> vs.{" "}
          <span className="font-semibold text-slate-700">resultado real</span>.
        </p>
        <div className="space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`badge ${meta.badge} ${meta.ring}`}
                  >
                    {pointsFor(cat)} pts
                  </span>
                  <span className="font-semibold text-slate-800 text-sm">
                    {meta.label}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {EXAMPLES[cat].map((ex, i) => {
                    const { points } = evalExample(ex);
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-400">Predicción</span>
                          <ScoreLine a={ex.pred[0]} b={ex.pred[1]} />
                        </div>
                        <span className="text-slate-300">→</span>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-400">Real</span>
                          <ScoreLine a={ex.real[0]} b={ex.real[1]} />
                        </div>
                        <span className="ml-auto shrink-0 font-display font-extrabold text-brand-600 tabular-nums">
                          {points}
                          <span className="text-[11px] font-semibold text-slate-400 ml-0.5">
                            pts
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                {EXAMPLES[cat].some((e) => e.note) && (
                  <ul className="mt-1.5 space-y-0.5">
                    {EXAMPLES[cat].map(
                      (e, i) =>
                        e.note && (
                          <li
                            key={i}
                            className="text-xs text-slate-400 pl-1"
                          >
                            · {e.note}
                          </li>
                        )
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Notas / reglas generales */}
      <section className="card p-5 sm:p-6">
        <h2 className="font-display font-bold text-xl text-slate-900 mb-3">
          Reglas generales
        </h2>
        <ul className="space-y-2.5 text-sm text-slate-600">
          <li className="flex gap-2.5">
            <span className="text-brand-500 font-bold">⏱</span>
            <span>
              Los pronósticos de cada partido se{" "}
              <strong className="text-slate-800">bloquean 2 horas antes</strong>{" "}
              del inicio. Después de eso no se pueden modificar.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-brand-500 font-bold">🕐</span>
            <span>
              Todos los horarios se muestran en{" "}
              <strong className="text-slate-800">hora Colombia (UTC−5)</strong>.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-brand-500 font-bold">⚽</span>
            <span>
              El puntaje se calcula con el{" "}
              <strong className="text-slate-800">
                marcador del tiempo reglamentario
              </strong>
              ; tiempos extra y penales no cuentan para el pronóstico.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-brand-500 font-bold">📊</span>
            <span>
              La matriz con los pronósticos de todos los jugadores se hace
              visible{" "}
              <strong className="text-slate-800">
                al finalizar cada partido
              </strong>
              .
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="text-brand-500 font-bold">🏆</span>
            <span>
              Gana quien acumule{" "}
              <strong className="text-slate-800">más puntos</strong> al final
              del torneo. El máximo por partido es{" "}
              <strong className="text-slate-800">{SCORING.EXACT} puntos</strong>{" "}
              (marcador exacto).
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
