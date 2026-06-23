import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { usePendingCount } from "../lib/usePendingCount";
import type { Entry, Match, Phase, Prediction } from "../types/database";
import MatchCard from "../components/MatchCard";
import MatchListRow from "../components/MatchListRow";
import { formatColombiaShort, isLocked } from "../lib/time";
import { isDemoMode } from "../lib/demo";
import { KNOCKOUT_PHASES, phaseLabelShort } from "../lib/phases";

type Filter = "all" | "upcoming" | "locked" | "pending";
type ViewMode = "cards" | "list";
const VIEW_MODE_KEY = "dashboard.viewMode";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const pendingCount = usePendingCount();
  const isAdmin = profile?.role === "admin";
  const [matches, setMatches] = useState<Match[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Map<string, Prediction>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("upcoming");
  const [phase, setPhase] = useState<Phase | "all">("all");
  const [groupLetter, setGroupLetter] = useState<string | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "cards";
    return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) ?? "cards";
  });

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  // Cargar partidos + entries del usuario
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setLoading(true);
    Promise.all([
      supabase.from("matches").select("*").order("match_number", { ascending: true }),
      supabase
        .from("entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ]).then(([m, e]) => {
      if (!mounted) return;
      if (m.error) setError(m.error.message);
      else setMatches((m.data ?? []) as Match[]);
      if (!e.error) {
        const list = (e.data ?? []) as Entry[];
        setEntries(list);
        setActiveEntryId((curr) => curr ?? list[0]?.id ?? null);
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  // Cargar pronósticos cuando cambia la entry activa
  useEffect(() => {
    if (!activeEntryId) {
      setPredictions(new Map());
      return;
    }
    let mounted = true;
    supabase
      .from("predictions")
      .select("*")
      .eq("entry_id", activeEntryId)
      .then(({ data, error }) => {
        if (!mounted || error) return;
        const map = new Map<string, Prediction>();
        ((data ?? []) as Prediction[]).forEach((pr) =>
          map.set(pr.match_id, pr)
        );
        setPredictions(map);
      });
    return () => {
      mounted = false;
    };
  }, [activeEntryId]);

  const activeEntry = useMemo(
    () => entries.find((e) => e.id === activeEntryId) ?? null,
    [entries, activeEntryId]
  );

  const handleSaved = (p: Prediction) => {
    setPredictions((prev) => {
      const next = new Map(prev);
      next.set(p.match_id, p);
      return next;
    });
  };

  const groupLetters = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => m.group_letter && set.add(m.group_letter));
    return Array.from(set).sort();
  }, [matches]);

  const filtered = useMemo(() => {
    const now = new Date();
    return matches.filter((m) => {
      if (phase !== "all" && m.phase !== phase) return false;
      if (groupLetter !== "all" && m.group_letter !== groupLetter) return false;
      const locked = isLocked(m.kickoff_at, now);
      const hasPred = predictions.has(m.id);
      const placeholder = m.home_is_placeholder || m.away_is_placeholder;
      if (filter === "upcoming" && locked) return false;
      if (filter === "locked" && !locked) return false;
      if (filter === "pending" && (locked || hasPred || placeholder)) return false;
      return true;
    });
  }, [matches, predictions, filter, phase, groupLetter]);

  const stats = useMemo(() => {
    const now = new Date();
    const playable = matches.filter(
      (m) => !m.home_is_placeholder && !m.away_is_placeholder
    );
    const filled = playable.filter((m) => predictions.has(m.id)).length;
    const open = playable.filter((m) => !isLocked(m.kickoff_at, now)).length;
    const pending = playable.filter(
      (m) => !isLocked(m.kickoff_at, now) && !predictions.has(m.id)
    ).length;
    const next = matches
      .filter(
        (m) =>
          !isLocked(m.kickoff_at, now) &&
          !m.home_is_placeholder &&
          !m.away_is_placeholder
      )
      .sort((a, b) => +new Date(a.kickoff_at) - +new Date(b.kickoff_at))[0];
    return { filled, total: playable.length, open, pending, next };
  }, [matches, predictions]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {/* Hero */}
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900">
            Hola,{" "}
            <span className="text-brand-600">
              {profile?.display_name ?? profile?.email?.split("@")[0]}
            </span>{" "}
            👋
          </h1>
          {isAdmin && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-100 text-gold-700 ring-1 ring-gold-200 text-xs font-bold uppercase tracking-wide">
              ★ Administrador
            </span>
          )}
        </div>
        <p className="text-slate-500">
          Predice los marcadores. Tienes hasta{" "}
          <strong className="text-slate-700">2 horas</strong> antes del inicio
          de cada partido.
        </p>
      </header>

      {/* Banner admin con pendientes */}
      {isAdmin && (
        <div
          className={`mb-6 rounded-2xl p-4 sm:p-5 flex items-center gap-4 flex-wrap ${
            pendingCount > 0
              ? "bg-gradient-to-r from-gold-50 to-amber-50 border border-gold-200"
              : "bg-brand-50 border border-brand-200"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-xl grid place-items-center text-2xl flex-shrink-0 ${
              pendingCount > 0 ? "bg-gold-200" : "bg-brand-200"
            }`}
          >
            {pendingCount > 0 ? "🔔" : "✅"}
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="font-bold text-slate-900">
              {pendingCount > 0
                ? `Tienes ${pendingCount} ${
                    pendingCount === 1 ? "usuario" : "usuarios"
                  } esperando aprobación`
                : "No hay inscripciones pendientes"}
            </div>
            <div className="text-sm text-slate-600 mt-0.5">
              {pendingCount > 0
                ? "Revísalas en el panel de administración para que puedan empezar a jugar."
                : "Cuando alguien se inscriba, aparecerá aquí y en el panel admin."}
            </div>
          </div>
          <Link
            to="/admin"
            className={pendingCount > 0 ? "btn-gold" : "btn-secondary"}
          >
            {pendingCount > 0 ? "Ir al panel" : "Ver panel admin"}
          </Link>
        </div>
      )}

      {/* Selector de polla (solo si tiene >1 entry) */}
      {entries.length > 1 && (
        <div className="card p-3 mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-700 mr-1">
            🎟️ Polla:
          </span>
          {entries.map((e) => (
            <button
              key={e.id}
              onClick={() => setActiveEntryId(e.id)}
              className={
                activeEntryId === e.id ? "pill-active" : "pill-inactive"
              }
            >
              {e.name}
              {!e.paid && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                  Sin pagar
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Aviso si la polla actual no está pagada — está bloqueada (omitido en demo) */}
      {activeEntry && !activeEntry.paid && !isDemoMode() && (
        <div className="mb-4 rounded-2xl p-4 bg-rose-50 border border-rose-200 flex items-center gap-3 flex-wrap">
          <div className="text-2xl">🔒</div>
          <div className="flex-1 min-w-[220px]">
            <div className="font-bold text-rose-800">
              Polla pendiente de pago
            </div>
            <div className="text-sm text-rose-700/80">
              No puedes ingresar marcadores hasta que el administrador confirme
              el pago de esta polla.
            </div>
          </div>
        </div>
      )}

      {/* Sin entries */}
      {entries.length === 0 && !loading && (
        <div className="card p-12 text-center mb-6">
          <div className="text-4xl mb-2">🎟️</div>
          <p className="text-slate-700 font-semibold">
            Aún no tienes ninguna polla habilitada.
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Pídele al administrador que te active una para empezar a pronosticar.
          </p>
        </div>
      )}

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Pronósticos enviados"
          value={`${stats.filled}`}
          sub={`de ${stats.total}`}
          icon="🎯"
        />
        <StatCard
          label="Pendientes por enviar"
          value={String(stats.pending)}
          highlight={stats.pending > 0}
          icon="⏳"
        />
        <StatCard
          label="Aún editables"
          value={String(stats.open)}
          icon="✏️"
        />
        <StatCard
          label="Próximo partido"
          value={
            stats.next ? formatColombiaShort(stats.next.kickoff_at) : "—"
          }
          small
          icon="⚽"
        />
      </section>

      {/* Filters */}
      <section className="card p-3 sm:p-4 mb-6 sticky top-[68px] z-20">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            active={filter === "upcoming"}
            onClick={() => setFilter("upcoming")}
          >
            Próximos
          </FilterPill>
          <FilterPill
            active={filter === "pending"}
            onClick={() => setFilter("pending")}
          >
            Sin marcador
          </FilterPill>
          <FilterPill
            active={filter === "locked"}
            onClick={() => setFilter("locked")}
          >
            Bloqueados
          </FilterPill>
          <FilterPill
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Todos
          </FilterPill>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-slate-100 p-0.5" role="tablist" aria-label="Modo de vista">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                  viewMode === "cards"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                title="Vista de tarjetas"
                aria-pressed={viewMode === "cards"}
              >
                ▦ Tarjetas
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                  viewMode === "list"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                title="Vista de lista compacta"
                aria-pressed={viewMode === "list"}
              >
                ☰ Lista
              </button>
            </div>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value as Phase | "all")}
              className="input py-1.5 px-3 text-sm w-auto"
            >
              <option value="all">Todas las fases</option>
              <option value="group">Fase de grupos</option>
              {KNOCKOUT_PHASES.map((p) => (
                <option key={p} value={p}>
                  {phaseLabelShort(p)}
                </option>
              ))}
            </select>
            <select
              value={groupLetter}
              onChange={(e) => setGroupLetter(e.target.value)}
              className="input py-1.5 px-3 text-sm w-auto"
            >
              <option value="all">Todos los grupos</option>
              {groupLetters.map((g) => (
                <option key={g} value={g}>
                  Grupo {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Matches grid */}
      {loading ? (
        <div className="text-center text-slate-400 py-16">
          Cargando partidos…
        </div>
      ) : error ? (
        <div className="card p-6 text-rose-600 border-rose-200 bg-rose-50">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-2">🤔</div>
          <p className="text-slate-500">No hay partidos en esta vista.</p>
          <p className="text-slate-400 text-sm mt-1">
            Prueba cambiando el filtro a <strong>Todos</strong>.
          </p>
        </div>
      ) : !activeEntryId ? (
        <div className="card p-12 text-center text-slate-400">
          Selecciona una polla para empezar a pronosticar.
        </div>
      ) : viewMode === "list" ? (
        <div className="card overflow-hidden">
          {filtered.map((m) => (
            <MatchListRow
              key={m.id}
              match={m}
              entryId={activeEntryId}
              entryPaid={isDemoMode() || (activeEntry?.paid ?? false)}
              prediction={predictions.get(m.id) ?? null}
              onSaved={handleSaved}
            />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              entryId={activeEntryId}
              entryPaid={isDemoMode() || (activeEntry?.paid ?? false)}
              prediction={predictions.get(m.id) ?? null}
              onSaved={handleSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight = false,
  small = false,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  small?: boolean;
  icon?: string;
}) {
  return (
    <div
      className={`card p-4 transition-colors ${
        highlight ? "bg-gold-50 border-gold-200" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
          {label}
        </div>
        {icon && <div className="text-lg opacity-60">{icon}</div>}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <div
          className={`font-display font-extrabold tracking-tight ${
            small ? "text-base" : "text-2xl sm:text-3xl"
          } ${highlight ? "text-gold-700" : "text-slate-900"}`}
        >
          {value}
        </div>
        {sub && (
          <span className="text-xs text-slate-400 font-medium">{sub}</span>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={active ? "pill-active" : "pill-inactive"}
    >
      {children}
    </button>
  );
}
