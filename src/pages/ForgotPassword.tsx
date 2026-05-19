import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` }
    );
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="card-elevated p-10 max-w-md text-center space-y-4 animate-slide-up">
          <div className="text-6xl">📧</div>
          <h2 className="font-display font-bold text-3xl text-slate-900">
            Correo enviado
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Si <strong className="text-slate-900">{email}</strong> está
            registrado, te llegará un enlace para restablecer tu contraseña.
            Revisa también la carpeta de spam.
          </p>
          <Link to="/login" className="btn-primary inline-flex">
            Volver al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-7">
          <div className="inline-flex w-16 h-16 mb-4 rounded-2xl bg-gold-100 items-center justify-center text-3xl">
            🔑
          </div>
          <h1 className="font-display font-bold text-3xl text-slate-900">
            ¿Olvidaste tu clave?
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            Te enviamos un enlace al correo para crear una nueva.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated p-7 space-y-5">
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
            {submitting ? "Enviando…" : "Enviar enlace"}
          </button>

          <div className="text-center text-sm pt-1">
            <Link
              to="/login"
              className="text-slate-600 hover:text-brand-600 font-medium"
            >
              ← Volver al login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
