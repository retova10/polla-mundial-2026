import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/login");
    }, 2500);
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="card-elevated p-10 max-w-md text-center space-y-4 animate-slide-up">
          <div className="text-6xl">✅</div>
          <h2 className="font-display font-bold text-3xl text-slate-900">
            Contraseña actualizada
          </h2>
          <p className="text-slate-600">
            Te llevamos al login para que entres con tu nueva contraseña…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-7">
          <div className="inline-flex w-16 h-16 mb-4 rounded-2xl bg-brand-100 items-center justify-center text-3xl">
            🔐
          </div>
          <h1 className="font-display font-bold text-3xl text-slate-900">
            Nueva contraseña
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated p-7 space-y-5">
          {!ready && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
              Validando enlace de recuperación…
            </div>
          )}

          <div>
            <label className="label">Nueva contraseña</label>
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
          <div>
            <label className="label">Confirmar contraseña</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input"
              placeholder="Repite la contraseña"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !ready}
            className="btn-primary w-full"
          >
            {submitting ? "Actualizando…" : "Actualizar contraseña"}
          </button>

          <div className="text-center text-sm pt-1">
            <Link
              to="/login"
              className="text-slate-600 hover:text-brand-600 font-medium"
            >
              Volver al login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
