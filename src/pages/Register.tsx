import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";

export default function Register() {
  const { session, loading } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsappOptin, setWhatsappOptin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<"approval" | "verify" | null>(null);

  if (!loading && session && !success) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!name.trim()) {
      setError("Ingresa tu nombre.");
      return;
    }
    setSubmitting(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: name.trim(),
          phone: phone.trim() || null,
          role: "player",
          whatsapp_group_optin: whatsappOptin,
        },
      },
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!data.session) {
      setSuccess("verify");
    } else {
      setSuccess("approval");
      await supabase.auth.signOut();
    }
  }

  if (success) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="card-elevated p-10 max-w-md text-center space-y-4 animate-slide-up">
          <div className="text-6xl">{success === "verify" ? "📧" : "⏳"}</div>
          <h2 className="font-display font-bold text-3xl text-slate-900">
            {success === "verify" ? "Revisa tu correo" : "Cuenta creada"}
          </h2>
          <p className="text-slate-600 leading-relaxed">
            {success === "verify" ? (
              <>
                Te enviamos un enlace de confirmación a{" "}
                <strong className="text-slate-900">{email}</strong>. Confirma tu
                cuenta y luego espera a que el administrador te apruebe.
              </>
            ) : (
              <>
                Tu cuenta está pendiente de aprobación por el administrador.
                Cuando te apruebe, podrás iniciar sesión y enviar tus
                marcadores.
              </>
            )}
          </p>
          <Link to="/login" className="btn-primary inline-flex">
            Ir al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex w-20 h-20 mb-5 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 items-center justify-center text-4xl shadow-lift">
            🏆
          </div>
          <h1 className="font-display font-extrabold text-4xl text-slate-900">
            Únete a la <span className="text-brand-600">polla</span>
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            Crea tu cuenta para predecir los partidos del Mundial.
          </p>
        </div>

        <PasosInscripcion />

        <form onSubmit={handleSubmit} className="card-elevated p-7 space-y-5">
          <div>
            <label className="label">Nombre completo</label>
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Juan Pérez"
            />
          </div>
          <div>
            <label className="label">Celular</label>
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="+57 300 000 0000"
            />
          </div>
          <div>
            <label className="label">Correo electrónico</label>
            <input
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
            <label className="label">Contraseña</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 cursor-pointer hover:bg-emerald-50 transition-colors">
            <input
              type="checkbox"
              checked={whatsappOptin}
              onChange={(e) => setWhatsappOptin(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-2 focus:ring-brand-200 cursor-pointer flex-shrink-0"
            />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                💬 Unirme al grupo de WhatsApp
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded">
                  Opcional
                </span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed mt-0.5">
                Recibirás info y comentarios sobre los partidos con los demás
                participantes. El admin te agregará al confirmar tu pago.
              </p>
            </div>
          </label>

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
            {submitting ? "Creando cuenta…" : "Crear cuenta"}
          </button>

          <div className="text-center text-sm text-slate-500 pt-1">
            ¿Ya tienes cuenta?{" "}
            <Link
              to="/login"
              className="text-brand-600 hover:text-brand-700 font-semibold"
            >
              Inicia sesión
            </Link>
          </div>
          <p className="text-center text-xs text-slate-400 leading-relaxed">
            Tu cuenta debe ser aprobada por el administrador antes de poder
            enviar marcadores.
          </p>
        </form>
      </div>
    </div>
  );
}

const NEQUI = "3234965340";

const PASOS: Array<{ title: string; detail: React.ReactNode }> = [
  {
    title: "Crea tu cuenta",
    detail: "Completa el formulario de abajo con tus datos.",
  },
  {
    title: "Confirma tu email",
    detail: (
      <>
        Te llegará un correo de confirmación. Revisa también las carpetas de{" "}
        <strong className="text-slate-700">Spam</strong> o{" "}
        <strong className="text-slate-700">Correo no deseado</strong>.
      </>
    ),
  },
  {
    title: "Haz el pago por Nequi",
    detail: (
      <>
        Realiza la consignación a Nequi{" "}
        <strong className="text-slate-900 font-mono">{NEQUI}</strong> y guarda
        el comprobante.
      </>
    ),
  },
  {
    title: "Envía el comprobante",
    detail: (
      <>
        Escribe al número de Nequi{" "}
        <strong className="text-slate-900 font-mono">{NEQUI}</strong> enviando
        el comprobante y solicitando la activación de tu cuenta.
      </>
    ),
  },
  {
    title: "¡Listo para jugar!",
    detail:
      "Una vez activada tu cuenta, podrás empezar a ingresar tus pronósticos.",
  },
];

function PasosInscripcion() {
  return (
    <div className="card p-5 sm:p-6 mb-5">
      <h2 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2 mb-4">
        <span>🎟️</span> Cómo inscribirte
      </h2>
      <ol className="space-y-3.5">
        {PASOS.map((paso, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-extrabold text-sm flex-shrink-0">
              {i + 1}
            </span>
            <div className="leading-snug pt-0.5">
              <div className="font-semibold text-slate-900 text-sm">
                {paso.title}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{paso.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
