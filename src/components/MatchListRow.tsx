import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import type { Match, Prediction } from "../types/database";
import {
  formatColombiaTime,
  formatCountdown,
  isLocked,
  msUntilLock,
  toColombia,
} from "../lib/time";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getFlagUrl, isSquareFlag } from "../data/countries";

interface Props {
  match: Match;
  entryId: string;
  entryPaid: boolean;
  prediction: Prediction | null;
  onSaved: (p: Prediction) => void;
}

function MiniTeam({
  name,
  isPlaceholder,
  align,
}: {
  name: string;
  isPlaceholder: boolean;
  align: "left" | "right";
}) {
  const flag = !isPlaceholder ? getFlagUrl(name, 40) : null;
  const square = !isPlaceholder && isSquareFlag(name);
  return (
    <div
      className={`flex items-center gap-2 min-w-0 ${
        align === "right" ? "flex-row-reverse text-right" : "text-left"
      }`}
    >
      <div
        className={`w-7 h-5 flex-shrink-0 rounded overflow-hidden border border-slate-200 grid place-items-center ${
          square ? "bg-white" : "bg-slate-100"
        }`}
      >
        {flag ? (
          <img
            src={flag}
            alt={name}
            className={`w-full h-full ${square ? "object-contain" : "object-cover"}`}
            loading="lazy"
          />
        ) : (
          <span className="text-[9px] font-mono text-slate-400">?</span>
        )}
      </div>
      <span
        className={`text-sm font-semibold truncate ${
          isPlaceholder ? "font-mono text-slate-400" : "text-slate-900"
        }`}
        title={name}
      >
        {name}
      </span>
    </div>
  );
}

export default function MatchListRow({
  match,
  entryId,
  entryPaid,
  prediction,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [home, setHome] = useState(prediction?.home_score?.toString() ?? "");
  const [away, setAway] = useState(prediction?.away_score?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setHome(prediction?.home_score?.toString() ?? "");
    setAway(prediction?.away_score?.toString() ?? "");
  }, [prediction]);

  const placeholderMatch =
    match.home_is_placeholder || match.away_is_placeholder;
  const locked = useMemo(
    () => isLocked(match.kickoff_at, now),
    [match.kickoff_at, now]
  );
  const countdown = useMemo(
    () => formatCountdown(msUntilLock(match.kickoff_at, now)),
    [match.kickoff_at, now]
  );

  const dirty =
    home !== (prediction?.home_score?.toString() ?? "") ||
    away !== (prediction?.away_score?.toString() ?? "");

  async function handleSave() {
    if (!user) return;
    setMsg(null);
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (Number.isNaN(h) || Number.isNaN(a) || h < 0 || a < 0) {
      setMsg({ type: "err", text: "Inválido" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("predictions")
      .upsert(
        {
          user_id: user.id,
          entry_id: entryId,
          match_id: match.id,
          home_score: h,
          away_score: a,
        },
        { onConflict: "entry_id,match_id" }
      )
      .select()
      .single();
    setSaving(false);
    if (error) {
      setMsg({ type: "err", text: error.message });
      return;
    }
    setMsg({ type: "ok", text: "✓" });
    onSaved(data as Prediction);
    setTimeout(() => setMsg(null), 2000);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!inputsDisabled && dirty) handleSave();
    }
  }

  const phaseLabel =
    match.phase === "group"
      ? `Grupo ${match.group_letter}`
      : match.phase === "round_of_32"
      ? "R32"
      : match.phase;

  const inputsDisabled = locked || placeholderMatch || !entryPaid;

  const dayLabel = format(toColombia(match.kickoff_at), "EEE d MMM", {
    locale: es,
  });

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
      {/* Meta: # + phase + date/time */}
      <div className="flex flex-col gap-0.5 min-w-[92px] sm:min-w-[140px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-400">
            #{match.match_number}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-brand-600">
            {phaseLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="capitalize font-semibold text-slate-700">
            {dayLabel}
          </span>
          <span className="text-slate-300">·</span>
          <span className="font-bold text-slate-900">
            {formatColombiaTime(match.kickoff_at)}
          </span>
        </div>
      </div>

      {/* Home team */}
      <MiniTeam
        name={match.home_team}
        isPlaceholder={match.home_is_placeholder}
        align="right"
      />

      {/* Score inputs */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={30}
          inputMode="numeric"
          value={home}
          onChange={(e) => setHome(e.target.value)}
          onKeyDown={handleKey}
          disabled={inputsDisabled}
          className="w-10 sm:w-12 text-center text-base font-extrabold rounded-md border border-slate-200 bg-white px-1 py-1 text-slate-900 placeholder-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
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
          onKeyDown={handleKey}
          disabled={inputsDisabled}
          className="w-10 sm:w-12 text-center text-base font-extrabold rounded-md border border-slate-200 bg-white px-1 py-1 text-slate-900 placeholder-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
          placeholder="-"
        />
      </div>

      {/* Away team */}
      <MiniTeam
        name={match.away_team}
        isPlaceholder={match.away_is_placeholder}
        align="left"
      />

      {/* Status / Save */}
      <div className="flex items-center justify-end gap-2 min-w-[80px] sm:min-w-[110px]">
        {msg ? (
          <span
            className={`text-xs font-bold ${
              msg.type === "ok" ? "text-brand-600" : "text-rose-600"
            }`}
          >
            {msg.text}
          </span>
        ) : !entryPaid ? (
          <span className="text-[10px] font-bold text-rose-600">🔒 Sin pagar</span>
        ) : locked ? (
          <span className="text-[10px] font-bold text-rose-600">🔒</span>
        ) : placeholderMatch ? (
          <span className="text-[10px] text-slate-400">Por definir</span>
        ) : (
          <span className="text-[10px] text-slate-400">⏱ {countdown}</span>
        )}
        <button
          onClick={handleSave}
          disabled={saving || inputsDisabled || !dirty}
          className="btn-primary text-xs py-1 px-2 disabled:opacity-40"
          title={dirty ? "Guardar (Enter)" : "Sin cambios"}
        >
          {saving ? "…" : prediction ? "↻" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
