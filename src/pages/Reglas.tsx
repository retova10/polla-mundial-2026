import { SCORING, pointsFor } from "../lib/scoring";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  EXAMPLES,
  evalExample,
} from "../lib/rules";

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

      {/* Premios y empates */}
      <section className="card p-5 sm:p-6 mb-6">
        <h2 className="font-display font-bold text-xl text-slate-900 mb-3">
          Premios y empates
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          El total recaudado se reparte entre los{" "}
          <strong className="text-slate-800">dos primeros puestos</strong> del
          ranking general:
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <div className="rounded-xl bg-gradient-to-b from-gold-100 to-gold-50 ring-1 ring-gold-300 p-3 text-center">
            <div className="text-2xl">🥇</div>
            <div className="font-display font-extrabold text-2xl text-gold-700 mt-1">
              70%
            </div>
            <div className="text-[11px] uppercase tracking-wider text-gold-800 font-bold">
              1° puesto
            </div>
          </div>
          <div className="rounded-xl bg-gradient-to-b from-slate-100 to-slate-50 ring-1 ring-slate-300 p-3 text-center">
            <div className="text-2xl">🥈</div>
            <div className="font-display font-extrabold text-2xl text-slate-700 mt-1">
              30%
            </div>
            <div className="text-[11px] uppercase tracking-wider text-slate-700 font-bold">
              2° puesto
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-start gap-2.5">
          <span className="text-lg leading-none mt-0.5">🤝</span>
          <div className="text-sm text-blue-900 leading-relaxed">
            <strong className="font-bold">Empates en el podio:</strong> si dos o
            más jugadores terminan empatados en el{" "}
            <strong>primer o segundo lugar</strong>, el premio correspondiente a
            ese puesto se{" "}
            <strong>reparte en partes iguales</strong> entre todos los
            empatados.
            <span className="block text-xs text-blue-700/90 mt-1.5">
              Ejemplo: si dos personas empatan en el 1° puesto, se reparten el
              70% (35% cada una).
            </span>
          </div>
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
