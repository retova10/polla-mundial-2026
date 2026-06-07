import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { usePendingCount } from "../lib/usePendingCount";
import { isDemoMode } from "../lib/demo";

export default function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pendingCount = usePendingCount();
  const demo = isDemoMode();

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      {demo && (
        <div className="sticky top-0 z-40 bg-yellow-400 text-yellow-950 text-center text-xs sm:text-sm font-bold py-1.5 px-3 border-b border-yellow-500 shadow-sm">
          ⚠️ MODO DEMO ACTIVO · Lock, ventana "EN VIVO" y flag "Pagada" desactivados · NO USAR EN PRODUCCIÓN
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center shadow-soft text-white text-xl">
              🏆
            </div>
            <div className="hidden sm:block">
              <div className="font-display font-extrabold text-xl leading-none text-slate-900">
                Polla <span className="text-brand-600">Mundial</span> 2026
              </div>
              <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 mt-0.5">
                USA · Canadá · México 2026
              </div>
            </div>
          </Link>

          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "pill-active" : "pill-inactive"
              }
            >
              <span className="hidden sm:inline">Mis pronósticos</span>
              <span className="sm:hidden">Pronós.</span>
            </NavLink>
            <NavLink
              to="/mundial"
              className={({ isActive }) =>
                isActive ? "pill-active" : "pill-inactive"
              }
            >
              Mundial
            </NavLink>
            <NavLink
              to="/matrix"
              className={({ isActive }) =>
                isActive ? "pill-active" : "pill-inactive"
              }
              title={
                profile?.role === "admin"
                  ? "Matriz de pronósticos de todas las pollas"
                  : "Matriz: pronósticos de todos (visible al finalizar cada partido)"
              }
            >
              📊 Matriz
            </NavLink>
            <NavLink
              to="/reglas"
              className={({ isActive }) =>
                isActive ? "pill-active" : "pill-inactive"
              }
              title="Reglas y sistema de puntaje"
            >
              📖 Reglas
            </NavLink>
            {profile?.role === "admin" && (
              <>
                <NavLink
                  to="/admin/scores"
                  className={({ isActive }) =>
                    isActive ? "pill bg-rose-500 text-white" : "pill-inactive"
                  }
                  title="Ingresar marcadores reales"
                >
                  ⚽ Marcadores
                </NavLink>
                <NavLink
                  to="/admin/pollas"
                  className={({ isActive }) =>
                    isActive ? "pill bg-brand-600 text-white" : "pill-inactive"
                  }
                  title="Gestionar pollas y pagos"
                >
                  🎟️ Pollas
                </NavLink>
                <NavLink
                  to="/admin"
                  end
                  className={({ isActive }) =>
                    `relative ${
                      isActive
                        ? "pill bg-gold-500 text-white"
                        : "pill-inactive"
                    }`
                  }
                >
                  Admin
                  {pendingCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold leading-none">
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              </>
            )}
            <div className="flex items-center gap-2 ml-2 pl-2 sm:pl-3 border-l border-slate-200">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold text-slate-900 leading-tight">
                  {profile?.display_name ?? profile?.email}
                </div>
                <div className="text-[11px] leading-tight mt-0.5">
                  {profile?.role === "admin" ? (
                    <span className="inline-flex items-center gap-1 font-bold text-gold-600">
                      <span className="text-[10px]">★</span> Administrador
                    </span>
                  ) : (
                    <span className="text-slate-500">Jugador</span>
                  )}
                </div>
              </div>
              <div
                className={`relative w-9 h-9 rounded-full grid place-items-center text-white font-bold text-sm ${
                  profile?.role === "admin"
                    ? "bg-gradient-to-br from-gold-400 to-gold-600 ring-2 ring-gold-200"
                    : "bg-gradient-to-br from-brand-400 to-brand-600"
                }`}
              >
                {(profile?.display_name ?? profile?.email ?? "?")[0]?.toUpperCase()}
                {profile?.role === "admin" && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold-500 ring-2 ring-white grid place-items-center text-[10px]">
                    ★
                  </span>
                )}
              </div>
            </div>
            <button onClick={handleLogout} className="btn-ghost text-sm ml-1">
              Salir
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 mt-12 py-6 bg-white/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-center text-xs text-slate-500">
          Polla Mundial 2026 · Hora Colombia (UTC−5) · Marcadores se bloquean 2h antes del inicio.
        </div>
      </footer>
    </div>
  );
}
