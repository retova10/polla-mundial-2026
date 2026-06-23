import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Match, MatchStatus } from "../types/database";
import { getFlagUrl, isSquareFlag } from "../data/countries";
import { formatColombiaShort, isLocked } from "../lib/time";
import { isMatchLive } from "../lib/standings";
import { toast } from "../lib/notifications";
import { phaseLabel } from "../lib/phases";

type Filter = "all" | "today" | "live" | "scheduled" | "finished";

export default function AdminScores() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("today");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("kickoff_at", { ascending: true });
    if (error) setError(error.message);
    else setMatches((data ?? []) as Match[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return matches.filter((m) => {
      if (m.home_is_placeholder || m.away_is_placeholder) return false;
      const k = new Date(m.kickoff_at);
      switch (filter) {
        case "today":
          return k >= today && k < tomorrow;
        case "live":
          return isMatchLive(m, now);
        case "scheduled":
          return m.status === "scheduled" && !isMatchLive(m, now);
        case "finished":
          return m.status === "finished";
        default:
          return true;
      }
    });
  }, [matches, filter, now]);

  async function saveMatch(
    id: string,
    home_score: number | null,
    away_score: number | null,
    status: MatchStatus
  ) {
    const { error } = await supabase
      .from("matches")
      .update({ home_score, away_score, status })
      .eq("id", id);
    if (error) {
      toast.error(`Error al guardar: ${error.message}`);
      return false;
    }
    toast.success("Marcador guardado");
    await load();
    setEditingId(null);
    return true;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900">
          Marcadores <span className="text-brand-600">en vivo</span>
        </h1>
        <p className="text-slate-500 mt-1.5">
          Actualiza el marcador y estado de cada partido. Los cambios se
          propagan a todos los jugadores en tiempo real.
        </p>
      </header>

      <section className="card p-3 flex flex-wrap gap-2">
        <FilterPill active={filter === "today"} onClick={() => setFilter("today")}>
          Hoy
        </FilterPill>
        <FilterPill active={filter === "live"} onClick={() => setFilter("live")}>
          🔴 En vivo
        </FilterPill>
        <FilterPill
          active={filter === "scheduled"}
          onClick={() => setFilter("scheduled")}
        >
          Por jugar
        </FilterPill>
        <FilterPill
          active={filter === "finished"}
          onClick={() => setFilter("finished")}
        >
          Finalizados
        </FilterPill>
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          Todos
        </FilterPill>
      </section>

      {loading ? (
        <div className="text-center text-slate-400 py-10">Cargando partidos…</div>
      ) : error ? (
        <div className="card p-6 text-rose-600 border-rose-200 bg-rose-50">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-2">🤷</div>
          <p className="text-slate-500">No hay partidos en esta vista.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <ScoreRow
              key={m.id}
              match={m}
              editing={editingId === m.id}
              onEdit={() => setEditingId(m.id)}
              onCancel={() => setEditingId(null)}
              onSave={saveMatch}
              now={now}
            />
          ))}
        </div>
      )}
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
    <button onClick={onClick} className={active ? "pill-active" : "pill-inactive"}>
      {children}
    </button>
  );
}

function ScoreRow({
  match,
  editing,
  onEdit,
  onCancel,
  onSave,
  now,
}: {
  match: Match;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (
    id: string,
    home: number | null,
    away: number | null,
    status: MatchStatus
  ) => Promise<boolean>;
  now: Date;
}) {
  const [home, setHome] = useState<string>(
    match.home_score?.toString() ?? ""
  );
  const [away, setAway] = useState<string>(
    match.away_score?.toString() ?? ""
  );
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [saving, setSaving] = useState(false);

  const live = isMatchLive(match, now);
  const locked = isLocked(match.kickoff_at, now);

  async function handleSave() {
    const h = home === "" ? null : parseInt(home, 10);
    const a = away === "" ? null : parseInt(away, 10);
    if (
      (h !== null && (Number.isNaN(h) || h < 0)) ||
      (a !== null && (Number.isNaN(a) || a < 0))
    ) {
      toast.error("Marcadores inválidos");
      return;
    }
    setSaving(true);
    await onSave(match.id, h, a, status);
    setSaving(false);
  }

  const homeFlag = getFlagUrl(match.home_team, 40);
  const awayFlag = getFlagUrl(match.away_team, 40);
  const homeSquare = isSquareFlag(match.home_team);
  const awaySquare = isSquareFlag(match.away_team);

  return (
    <div
      className={`card p-4 transition-all ${
        live ? "ring-2 ring-rose-300" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="badge-slate">#{match.match_number}</span>
          <span className="badge-brand">{phaseLabel(match)}</span>
          {live && (
            <span className="badge-rose flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              EN VIVO
            </span>
          )}
          {match.status === "finished" && (
            <span className="badge-slate">Finalizado</span>
          )}
        </div>
        <span className="text-xs text-slate-500">
          {formatColombiaShort(match.kickoff_at)} (Colombia)
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <span className="font-bold text-slate-900 text-right truncate">
            {match.home_team}
          </span>
          <div
            className={`w-8 h-6 rounded overflow-hidden border border-slate-200 flex-shrink-0 ${
              homeSquare ? "bg-white" : "bg-slate-100"
            }`}
          >
            {homeFlag && (
              <img
                src={homeFlag}
                alt={match.home_team}
                className={`w-full h-full ${homeSquare ? "object-contain" : "object-cover"}`}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={30}
            inputMode="numeric"
            value={home}
            onChange={(e) => setHome(e.target.value)}
            disabled={!editing}
            className="w-12 sm:w-14 text-center text-xl sm:text-2xl font-extrabold rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-brand-100 focus:border-brand-500 disabled:bg-slate-50"
            placeholder="-"
          />
          <span className="text-slate-300 font-bold">:</span>
          <input
            type="number"
            min={0}
            max={30}
            inputMode="numeric"
            value={away}
            onChange={(e) => setAway(e.target.value)}
            disabled={!editing}
            className="w-12 sm:w-14 text-center text-xl sm:text-2xl font-extrabold rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-brand-100 focus:border-brand-500 disabled:bg-slate-50"
            placeholder="-"
          />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-8 h-6 rounded overflow-hidden border border-slate-200 flex-shrink-0 ${
              awaySquare ? "bg-white" : "bg-slate-100"
            }`}
          >
            {awayFlag && (
              <img
                src={awayFlag}
                alt={match.away_team}
                className={`w-full h-full ${awaySquare ? "object-contain" : "object-cover"}`}
              />
            )}
          </div>
          <span className="font-bold text-slate-900 truncate">
            {match.away_team}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <label className="text-slate-500">Estado:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MatchStatus)}
            disabled={!editing}
            className="input py-1 px-2 text-sm w-auto disabled:bg-slate-50"
          >
            <option value="scheduled">Por jugar</option>
            <option value="live">En vivo</option>
            <option value="finished">Finalizado</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          {!locked && match.status === "scheduled" && !editing && (
            <span className="text-xs text-slate-400">
              Aún sin empezar — los jugadores siguen pronosticando
            </span>
          )}
          {editing ? (
            <>
              <button
                onClick={onCancel}
                disabled={saving}
                className="btn-ghost text-sm py-1.5 px-3"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm py-1.5 px-3"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </>
          ) : (
            <button
              onClick={onEdit}
              className="btn-secondary text-sm py-1.5 px-3"
            >
              Editar marcador
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
