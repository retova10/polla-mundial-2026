import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Match, MatchStatus } from "../types/database";
import { COUNTRIES, getFlagUrl, isSquareFlag } from "../data/countries";
import { formatColombiaShort, isLocked } from "../lib/time";
import { isMatchLive } from "../lib/standings";
import { toast } from "../lib/notifications";
import { phaseLabel } from "../lib/phases";
import { computeBracketUpdates, KNOCKOUT_SOURCES } from "../lib/bracket";

type Filter = "all" | "today" | "live" | "scheduled" | "finished" | "knockout";

const COUNTRY_NAMES = COUNTRIES.map((c) => c.name).sort((a, b) =>
  a.localeCompare(b)
);

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
    // Vista de fase final: todos los partidos del cuadro (con o sin equipos
    // definidos), para asignar/corregir equipos y cargar marcadores.
    if (filter === "knockout") {
      return matches
        .filter((m) => m.match_number in KNOCKOUT_SOURCES)
        .sort((a, b) => a.match_number - b.match_number);
    }
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

  /**
   * Propaga los clasificados al cuadro de eliminación: calcula qué equipos
   * ya se conocen (1º/2º de grupos terminados, ganadores/perdedores de llaves)
   * y los persiste. Devuelve cuántos partidos se actualizaron.
   */
  async function syncBracket(source: Match[], silent = false): Promise<number> {
    const updates = computeBracketUpdates(source);
    if (updates.length === 0) {
      if (!silent) toast.success("La fase final ya está al día");
      return 0;
    }
    const results = await Promise.all(
      updates.map(({ id, match_number: _n, ...fields }) =>
        supabase.from("matches").update(fields).eq("id", id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error(`Error al sincronizar la fase final: ${failed.error.message}`);
      return 0;
    }
    if (!silent)
      toast.success(
        `Fase final actualizada: ${updates.length} ${
          updates.length === 1 ? "partido" : "partidos"
        }`
      );
    return updates.length;
  }

  async function saveMatch(
    id: string,
    home_score: number | null,
    away_score: number | null,
    status: MatchStatus,
    home_penalties: number | null = null,
    away_penalties: number | null = null
  ) {
    const fields = { home_score, away_score, status, home_penalties, away_penalties };
    const { error } = await supabase.from("matches").update(fields).eq("id", id);
    if (error) {
      toast.error(`Error al guardar: ${error.message}`);
      return false;
    }
    toast.success("Marcador guardado");
    // Propaga clasificados con el marcador recién guardado (datos frescos en
    // memoria) antes de recargar, para que la fase final quede al día sola.
    const fresh = matches.map((m) => (m.id === id ? { ...m, ...fields } : m));
    await syncBracket(fresh, true);
    await load();
    setEditingId(null);
    return true;
  }

  // Guarda equipos + marcador de un partido de fase final en un solo write
  // (terceros, correcciones, o ganadores por penales que la app no deduce sola).
  async function saveKnockout(id: string, fields: Partial<Match>) {
    const { error } = await supabase.from("matches").update(fields).eq("id", id);
    if (error) {
      toast.error(`Error al guardar: ${error.message}`);
      return false;
    }
    toast.success("Guardado");
    const fresh = matches.map((m) => (m.id === id ? { ...m, ...fields } : m));
    await syncBracket(fresh, true);
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
        <FilterPill
          active={filter === "knockout"}
          onClick={() => setFilter("knockout")}
        >
          🏆 Fase final
        </FilterPill>
        <button
          onClick={() => syncBracket(matches)}
          className="ml-auto btn-secondary text-sm py-1.5 px-3"
          title="Propaga los clasificados al cuadro: 1º/2º de grupos terminados y ganadores de cada llave"
        >
          ↻ Actualizar clasificados
        </button>
      </section>

      {filter === "knockout" && (
        <div className="card p-3 text-xs text-slate-500 bg-slate-50/60">
          Los equipos de <strong>1º/2º de grupo</strong> y los{" "}
          <strong>ganadores de llave</strong> se llenan solos al cargar
          marcadores. Asigna a mano los <strong>mejores terceros</strong> y los
          ganadores que se definan por <strong>penales</strong>.
        </div>
      )}

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
          {filtered.map((m) =>
            filter === "knockout" ? (
              <KnockoutEditRow
                key={m.id}
                match={m}
                editing={editingId === m.id}
                onEdit={() => setEditingId(m.id)}
                onCancel={() => setEditingId(null)}
                onSave={saveKnockout}
              />
            ) : (
              <ScoreRow
                key={m.id}
                match={m}
                editing={editingId === m.id}
                onEdit={() => setEditingId(m.id)}
                onCancel={() => setEditingId(null)}
                onSave={saveMatch}
                now={now}
              />
            )
          )}
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
    status: MatchStatus,
    homePen?: number | null,
    awayPen?: number | null
  ) => Promise<boolean>;
  now: Date;
}) {
  const [home, setHome] = useState<string>(
    match.home_score?.toString() ?? ""
  );
  const [away, setAway] = useState<string>(
    match.away_score?.toString() ?? ""
  );
  const [homePen, setHomePen] = useState<string>(
    match.home_penalties?.toString() ?? ""
  );
  const [awayPen, setAwayPen] = useState<string>(
    match.away_penalties?.toString() ?? ""
  );
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [saving, setSaving] = useState(false);

  const live = isMatchLive(match, now);
  const locked = isLocked(match.kickoff_at, now);

  // Penales solo en eliminatorias empatadas (en grupos un empate es válido).
  const hNum = parseInt(home, 10);
  const aNum = parseInt(away, 10);
  const isKnockout = match.phase !== "group";
  const showPenalties =
    isKnockout &&
    home !== "" &&
    away !== "" &&
    !Number.isNaN(hNum) &&
    !Number.isNaN(aNum) &&
    hNum === aNum;

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
    // Penales solo si aplica (eliminatoria empatada); si no, se limpian.
    let hp: number | null = null;
    let ap: number | null = null;
    if (showPenalties) {
      hp = homePen === "" ? null : parseInt(homePen, 10);
      ap = awayPen === "" ? null : parseInt(awayPen, 10);
      if (
        (hp !== null && (Number.isNaN(hp) || hp < 0)) ||
        (ap !== null && (Number.isNaN(ap) || ap < 0))
      ) {
        toast.error("Penales inválidos");
        return;
      }
      if (hp !== null && ap !== null && hp === ap) {
        toast.error("Los penales no pueden quedar empatados");
        return;
      }
    }
    setSaving(true);
    await onSave(match.id, h, a, status, hp, ap);
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

      {showPenalties && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-amber-50 border border-amber-200 py-2">
          <span className="text-xs font-semibold text-amber-700">
            🥅 Penales
          </span>
          <input
            type="number"
            min={0}
            max={30}
            inputMode="numeric"
            value={homePen}
            onChange={(e) => setHomePen(e.target.value)}
            disabled={!editing}
            className="w-12 text-center text-lg font-extrabold rounded-lg border border-amber-300 bg-white px-1 py-1 text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-slate-50"
            placeholder="-"
          />
          <span className="text-amber-400 font-bold">:</span>
          <input
            type="number"
            min={0}
            max={30}
            inputMode="numeric"
            value={awayPen}
            onChange={(e) => setAwayPen(e.target.value)}
            disabled={!editing}
            className="w-12 text-center text-lg font-extrabold rounded-lg border border-amber-300 bg-white px-1 py-1 text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-slate-50"
            placeholder="-"
          />
          <span className="text-[11px] text-amber-600 ml-1">
            avanza quien gane los penales
          </span>
        </div>
      )}

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

// Selector de equipo para la fase final: "(Por definir)" o uno de los 48 países.
function TeamSelect({
  value,
  token,
  disabled,
  onChange,
}: {
  value: string; // "" = por definir
  token: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="input py-1 px-2 text-sm w-full disabled:bg-slate-50"
    >
      <option value="">— Por definir ({token}) —</option>
      {COUNTRY_NAMES.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

function KnockoutEditRow({
  match,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  match: Match;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (id: string, fields: Partial<Match>) => Promise<boolean>;
}) {
  const src = KNOCKOUT_SOURCES[match.match_number];
  // "" representa placeholder; si no, el nombre del país.
  const [home, setHome] = useState(match.home_is_placeholder ? "" : match.home_team);
  const [away, setAway] = useState(match.away_is_placeholder ? "" : match.away_team);
  const [hs, setHs] = useState(match.home_score?.toString() ?? "");
  const [as_, setAs] = useState(match.away_score?.toString() ?? "");
  const [homePen, setHomePen] = useState(match.home_penalties?.toString() ?? "");
  const [awayPen, setAwayPen] = useState(match.away_penalties?.toString() ?? "");
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [saving, setSaving] = useState(false);

  function reset() {
    setHome(match.home_is_placeholder ? "" : match.home_team);
    setAway(match.away_is_placeholder ? "" : match.away_team);
    setHs(match.home_score?.toString() ?? "");
    setAs(match.away_score?.toString() ?? "");
    setHomePen(match.home_penalties?.toString() ?? "");
    setAwayPen(match.away_penalties?.toString() ?? "");
    setStatus(match.status);
  }

  const teamsReady = home !== "" && away !== "";
  const hNum = parseInt(hs, 10);
  const aNum = parseInt(as_, 10);
  // Toda la fase final es eliminatoria: penales si hay empate con equipos listos.
  const showPenalties =
    teamsReady &&
    hs !== "" &&
    as_ !== "" &&
    !Number.isNaN(hNum) &&
    !Number.isNaN(aNum) &&
    hNum === aNum;

  async function handleSave() {
    const h = hs === "" ? null : parseInt(hs, 10);
    const a = as_ === "" ? null : parseInt(as_, 10);
    if ((h !== null && (Number.isNaN(h) || h < 0)) || (a !== null && (Number.isNaN(a) || a < 0))) {
      toast.error("Marcadores inválidos");
      return;
    }
    let hp: number | null = null;
    let ap: number | null = null;
    if (showPenalties) {
      hp = homePen === "" ? null : parseInt(homePen, 10);
      ap = awayPen === "" ? null : parseInt(awayPen, 10);
      if (
        (hp !== null && (Number.isNaN(hp) || hp < 0)) ||
        (ap !== null && (Number.isNaN(ap) || ap < 0))
      ) {
        toast.error("Penales inválidos");
        return;
      }
      if (hp !== null && ap !== null && hp === ap) {
        toast.error("Los penales no pueden quedar empatados");
        return;
      }
    }
    setSaving(true);
    await onSave(match.id, {
      home_team: home === "" ? src.home : home,
      home_is_placeholder: home === "",
      away_team: away === "" ? src.away : away,
      away_is_placeholder: away === "",
      home_score: teamsReady ? h : null,
      away_score: teamsReady ? a : null,
      home_penalties: teamsReady ? hp : null,
      away_penalties: teamsReady ? ap : null,
      status,
    });
    setSaving(false);
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge-slate">#{match.match_number}</span>
          <span className="badge-brand">{phaseLabel(match)}</span>
          {match.status === "finished" && <span className="badge-slate">Finalizado</span>}
          {(match.home_is_placeholder || match.away_is_placeholder) && (
            <span className="badge-gold">Equipos por definir</span>
          )}
        </div>
        <span className="text-slate-500">{formatColombiaShort(match.kickoff_at)}</span>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <div className="min-w-0">
          {editing ? (
            <TeamSelect value={home} token={src.home} disabled={saving} onChange={setHome} />
          ) : (
            <TeamLabel team={match.home_team} placeholder={match.home_is_placeholder} align="right" />
          )}
        </div>

        <div className="flex items-center gap-1.5 justify-center">
          <input
            type="number"
            min={0}
            max={30}
            inputMode="numeric"
            value={hs}
            onChange={(e) => setHs(e.target.value)}
            disabled={!editing || !teamsReady}
            className="w-12 text-center text-xl font-extrabold rounded-lg border border-slate-200 bg-white px-1 py-1.5 disabled:bg-slate-50"
            placeholder="-"
          />
          <span className="text-slate-300 font-bold">:</span>
          <input
            type="number"
            min={0}
            max={30}
            inputMode="numeric"
            value={as_}
            onChange={(e) => setAs(e.target.value)}
            disabled={!editing || !teamsReady}
            className="w-12 text-center text-xl font-extrabold rounded-lg border border-slate-200 bg-white px-1 py-1.5 disabled:bg-slate-50"
            placeholder="-"
          />
        </div>

        <div className="min-w-0">
          {editing ? (
            <TeamSelect value={away} token={src.away} disabled={saving} onChange={setAway} />
          ) : (
            <TeamLabel team={match.away_team} placeholder={match.away_is_placeholder} align="left" />
          )}
        </div>
      </div>

      {showPenalties && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-amber-50 border border-amber-200 py-2">
          <span className="text-xs font-semibold text-amber-700">🥅 Penales</span>
          <input
            type="number"
            min={0}
            max={30}
            inputMode="numeric"
            value={homePen}
            onChange={(e) => setHomePen(e.target.value)}
            disabled={!editing}
            className="w-12 text-center text-lg font-extrabold rounded-lg border border-amber-300 bg-white px-1 py-1 disabled:bg-slate-50"
            placeholder="-"
          />
          <span className="text-amber-400 font-bold">:</span>
          <input
            type="number"
            min={0}
            max={30}
            inputMode="numeric"
            value={awayPen}
            onChange={(e) => setAwayPen(e.target.value)}
            disabled={!editing}
            className="w-12 text-center text-lg font-extrabold rounded-lg border border-amber-300 bg-white px-1 py-1 disabled:bg-slate-50"
            placeholder="-"
          />
          <span className="text-[11px] text-amber-600 ml-1">avanza quien gane</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <label className="text-slate-500">Estado:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MatchStatus)}
            disabled={!editing || !teamsReady}
            className="input py-1 px-2 text-sm w-auto disabled:bg-slate-50"
          >
            <option value="scheduled">Por jugar</option>
            <option value="live">En vivo</option>
            <option value="finished">Finalizado</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => {
                  reset();
                  onCancel();
                }}
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
            <button onClick={onEdit} className="btn-secondary text-sm py-1.5 px-3">
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamLabel({
  team,
  placeholder,
  align,
}: {
  team: string;
  placeholder: boolean;
  align: "left" | "right";
}) {
  const flag = !placeholder ? getFlagUrl(team, 40) : null;
  const square = !placeholder && isSquareFlag(team);
  return (
    <div
      className={`flex items-center gap-2 min-w-0 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      {align === "left" && flag && (
        <Flag src={flag} alt={team} square={square} />
      )}
      <span
        className={`truncate font-bold ${
          placeholder ? "font-mono text-slate-400 text-sm" : "text-slate-900"
        }`}
      >
        {team}
      </span>
      {align === "right" && flag && (
        <Flag src={flag} alt={team} square={square} />
      )}
    </div>
  );
}

function Flag({ src, alt, square }: { src: string; alt: string; square: boolean }) {
  return (
    <div
      className={`w-8 h-6 rounded overflow-hidden border border-slate-200 flex-shrink-0 ${
        square ? "bg-white" : "bg-slate-100"
      }`}
    >
      <img
        src={src}
        alt={alt}
        className={`w-full h-full ${square ? "object-contain" : "object-cover"}`}
      />
    </div>
  );
}
