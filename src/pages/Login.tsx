import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function Login() {
  const { session, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (err) {
      setError(
        err === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : err
      );
      return;
    }
    navigate("/");
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex w-20 h-20 mb-5 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 items-center justify-center text-4xl shadow-lift">
            🏆
          </div>
          <h1 className="font-display font-extrabold text-4xl text-slate-900">
            Polla <span className="text-brand-600">Mundial</span>
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm font-medium tracking-wide">
            USA · Canadá · México · 2026
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated p-7 space-y-5">
          <div>
            <label className="label" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? "Entrando…" : "Entrar"}
          </button>

          <div className="flex items-center justify-between text-sm pt-1">
            <Link
              to="/forgot-password"
              className="text-slate-600 hover:text-brand-600 font-medium"
            >
              ¿Olvidaste tu contraseña?
            </Link>
            <Link
              to="/register"
              className="text-brand-600 hover:text-brand-700 font-semibold"
            >
              Crear cuenta
            </Link>
          </div>
        </form>

        <InstruccionesPolla />
      </div>
    </div>
  );
}

function InstruccionesPolla() {
  return (
    <details className="group mt-5 card overflow-hidden">
      <summary className="cursor-pointer select-none flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📖</span>
          <div>
            <div className="font-display font-bold text-slate-900 text-sm">
              ¿Cómo funciona la polla?
            </div>
            <div className="text-xs text-slate-500">
              Reglas, puntos, premios y condiciones
            </div>
          </div>
        </div>
        <svg
          className="w-5 h-5 text-slate-400 transition-transform group-open:rotate-180 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </summary>

      <div className="border-t border-slate-200 px-5 py-4 space-y-5 text-sm text-slate-700 bg-slate-50/40">
        {/* 1. Inscripción y pago */}
        <section>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
            <span className="text-base">🎟️</span> Inscripción y pago
          </h3>
          <p className="leading-relaxed mb-3">
            El valor de la polla es de{" "}
            <strong className="text-slate-900">$50.000 COP</strong> por
            participación. Puedes registrar más de una polla con la misma
            cuenta — cada una se paga por separado.
          </p>
          <ol className="space-y-2 ml-1">
            <li className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-700 font-extrabold text-[11px] flex-shrink-0 mt-0.5">
                1
              </span>
              <span>
                Crea tu cuenta en{" "}
                <Link
                  to="/register"
                  className="text-brand-600 hover:text-brand-700 font-semibold underline"
                >
                  Registrarse
                </Link>
                .
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-700 font-extrabold text-[11px] flex-shrink-0 mt-0.5">
                2
              </span>
              <span>
                Realiza el pago de <strong>$50.000 COP</strong> a Nequi{" "}
                <strong className="text-slate-900 font-mono">3234965340</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-700 font-extrabold text-[11px] flex-shrink-0 mt-0.5">
                3
              </span>
              <span>
                Envía el comprobante por WhatsApp al{" "}
                <strong className="text-slate-900 font-mono">3234965340</strong>{" "}
                para que el administrador autorice tu cuenta.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-700 font-extrabold text-[11px] flex-shrink-0 mt-0.5">
                4
              </span>
              <span>
                Una vez confirmado el pago, quedas autorizado y puedes
                empezar a ingresar tus pronósticos.
              </span>
            </li>
          </ol>
        </section>

        {/* 2. Grupo de WhatsApp opcional */}
        <section>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
            <span className="text-base">💬</span> Grupo de WhatsApp{" "}
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              Opcional
            </span>
          </h3>
          <p className="leading-relaxed">
            Al confirmar tu pago, te preguntaremos si quieres unirte al{" "}
            <strong>grupo de WhatsApp de la polla</strong>, donde se comparte
            información, comentarios y resultados con los demás participantes.
            Es <strong>completamente opcional</strong> — puedes participar en
            la polla sin estar en el grupo.
          </p>
        </section>

        {/* 2. Sistema de puntos */}
        <section>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
            <span className="text-base">🎯</span> Sistema de puntos
          </h3>
          <p className="leading-relaxed mb-2">
            Después de cada partido finalizado, tu pronóstico se compara con
            el marcador real y obtienes:
          </p>
          <ul className="space-y-1.5 ml-1">
            <li className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-12 h-7 px-2 rounded-md flex-shrink-0 bg-brand-100 text-brand-700 font-extrabold text-xs ring-1 ring-brand-200">
                4 pts
              </span>
              <span className="leading-snug pt-1">
                <strong>Marcador exacto</strong> — aciertas los dos goles
                tal cual.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-12 h-7 px-2 rounded-md flex-shrink-0 bg-brand-50 text-brand-700 font-extrabold text-xs ring-1 ring-brand-200">
                3 pts
              </span>
              <span className="leading-snug pt-1">
                Aciertas el <strong>ganador</strong> (o el empate) y además
                uno de los dos marcadores.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-12 h-7 px-2 rounded-md flex-shrink-0 bg-gold-100 text-gold-800 font-extrabold text-xs ring-1 ring-gold-300">
                2 pts
              </span>
              <span className="leading-snug pt-1">
                Aciertas solo al <strong>ganador</strong>, o predices empate
                correctamente sin acertar el marcador.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-12 h-7 px-2 rounded-md flex-shrink-0 bg-amber-50 text-amber-700 font-extrabold text-xs ring-1 ring-amber-200">
                1 pt
              </span>
              <span className="leading-snug pt-1">
                Aciertas uno de los marcadores pero te equivocas con el
                ganador (p. ej. predijiste empate y hubo ganador).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-12 h-7 px-2 rounded-md flex-shrink-0 bg-rose-50 text-rose-700 font-extrabold text-xs ring-1 ring-rose-200">
                0 pts
              </span>
              <span className="leading-snug pt-1">
                Predices al equipo equivocado como ganador, o no aciertas
                nada.
              </span>
            </li>
          </ul>
        </section>

        {/* 3. Cierre de pronósticos */}
        <section>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
            <span className="text-base">🔒</span> Cierre de pronósticos
          </h3>
          <p className="leading-relaxed">
            Cada partido se <strong>bloquea automáticamente 2 horas antes</strong>{" "}
            del inicio (hora oficial FIFA). A partir de ese momento ya no
            puedes crear ni modificar tu pronóstico para ese partido. Antes
            de las 2h tienes libertad total para editar cuantas veces
            quieras. Todas las horas se muestran en{" "}
            <strong>hora de Colombia (UTC−5)</strong>.
          </p>
        </section>

        {/* 4. Premios */}
        <section>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
            <span className="text-base">🏆</span> Premios
          </h3>
          <p className="leading-relaxed mb-2">
            El total recaudado se reparte entre los dos primeros puestos del
            ranking general:
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2">
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
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Desempates: si dos pollas terminan con el mismo total de puntos,
            se favorece a quien tenga más marcadores exactos.
          </p>
        </section>

        {/* 5. Otros detalles */}
        <section>
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
            <span className="text-base">📌</span> Otros detalles
          </h3>
          <ul className="space-y-1.5 list-disc list-inside leading-relaxed text-slate-700 marker:text-slate-400">
            <li>
              Los pronósticos de los demás jugadores se{" "}
              <strong>revelan partido a partido</strong>, solo cuando cada
              partido termina. Antes están ocultos.
            </li>
            <li>
              Los partidos de octavos en adelante tienen equipos por definir
              hasta que termine la fase de grupos — no se pueden pronosticar
              mientras estén con marcador "por definir".
            </li>
            <li>
              El ranking se actualiza en tiempo real cuando el administrador
              ingresa el marcador final de un partido.
            </li>
          </ul>
        </section>
      </div>
    </details>
  );
}
