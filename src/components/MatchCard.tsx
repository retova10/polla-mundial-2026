import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import type { Match, Prediction } from "../types/database";
import {
  formatColombiaDate,
  formatColombiaTime,
  formatCountdown,
  isLocked,
  msUntilLock,
} from "../lib/time";
import { getFlagUrl, isSquareFlag } from "../data/countries";

interface Props {
  match: Match;
  entryId: string;
  entryPaid: boolean;
  prediction: Prediction | null;
  onSaved: (p: Prediction) => void;
}

function TeamSide({
  name,
  isPlaceholder,
  align,
}: {
  name: string;
  isPlaceholder: boolean;
  align: "left" | "right";
}) {
  const flag = !isPlaceholder ? getFlagUrl(name, 60) : null;
  const square = !isPlaceholder && isSquareFlag(name);
  return (
    <div
      className={`flex ${
        align === "right" ? "flex-row-reverse text-right" : "text-left"
      } items-center gap-2.5 min-w-0`}
    >
      <div
        className={`w-10 h-7 sm:w-12 sm:h-8 flex-shrink-0 rounded-md overflow-hidden border border-slate-200 grid place-items-center ${
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
          <span className="text-[10px] font-mono text-slate-400">
            {isPlaceholder ? "?" : ""}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div
          className={`text-sm sm:text-base font-bold truncate ${
            isPlaceholder ? "font-mono text-slate-400" : "text-slate-900"
          }`}
        >
          {name}
        </div>
        {isPlaceholder && (
          <div className="text-[10px] text-slate-400 leading-none mt-0.5">
            Por definir
          </div>
        )}
      </div>
    </div>
  );
}

export default function MatchCard({ match, entryId, entryPaid, prediction, onSaved }: Props) {
  const { user } = useAuth();
  const [home, setHome] = useState(prediction?.home_score?.toString() ?? "");
  const [away, setAway] = useState(prediction?.away_score?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setHome(prediction?.home_score?.toString() ?? "");
    setAway(prediction?.away_score?.toString() ?? "");
  }, [prediction]);

  const placeholderMatch = match.home_is_placeholder || match.away_is_placeholder;
  const locked = useMemo(() => isLocked(match.kickoff_at, now), [match.kickoff_at, now]);
  const countdown = useMemo(
    () => formatCountdown(msUntilLock(match.kickoff_at, now)),
    [match.kickoff_at, now]
  );

  async function handleSave() {
    if (!user) return;
    setMsg(null);
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (Number.isNaN(h) || Number.isNaN(a) || h < 0 || a < 0) {
      setMsg({ type: "err", text: "Marcadores inválidos." });
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
    setMsg({ type: "ok", text: "Guardado ✓" });
    onSaved(data as Prediction);
    setTimeout(() => setMsg(null), 2500);
  }

  const phaseLabel =
    match.phase === "group"
      ? `Grupo ${match.group_letter}`
      : match.phase === "round_of_32"
      ? "Octavos"
      : match.phase;

  const inputsDisabled = locked || placeholderMatch || !entryPaid;

  return (
    <div className="card hover:shadow-lift transition-shadow p-4 sm:p-5 animate-fade-in">
      {/* Header: phase + lock state */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="badge-slate">#{match.match_number}</span>
          <span className="badge-brand">{phaseLabel}</span>
        </div>
        {!entryPaid ? (
          <span className="badge-rose">🔒 Sin pagar</span>
        ) : locked ? (
          <span className="badge-rose">🔒 Bloqueado</span>
        ) : placeholderMatch ? (
          <span className="badge-slate">Equipos por definir</span>
        ) : (
          <span className="badge-gold">⏱ {countdown}</span>
        )}
      </div>

      {/* Teams + score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 mb-3">
        <TeamSide
          name={match.home_team}
          isPlaceholder={match.home_is_placeholder}
          align="left"
        />

        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={30}
            inputMode="numeric"
            value={home}
            onChange={(e) => setHome(e.target.value)}
            disabled={inputsDisabled}
            className="w-12 sm:w-14 text-center text-2xl font-extrabold rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-slate-900 placeholder-slate-300 transition-colors focus:outline-none focus:ring-4 focus:ring-brand-100 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
            placeholder="-"
          />
          <span className="text-slate-300 font-bold text-lg">:</span>
          <input
            type="number"
            min={0}
            max={30}
            inputMode="numeric"
            value={away}
            onChange={(e) => setAway(e.target.value)}
            disabled={inputsDisabled}
            className="w-12 sm:w-14 text-center text-2xl font-extrabold rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-slate-900 placeholder-slate-300 transition-colors focus:outline-none focus:ring-4 focus:ring-brand-100 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
            placeholder="-"
          />
        </div>

        <TeamSide
          name={match.away_team}
          isPlaceholder={match.away_is_placeholder}
          align="right"
        />
      </div>

      {/* Date + venue */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 border-t border-slate-100 pt-3">
        <span className="capitalize text-slate-700 font-semibold">
          {formatColombiaDate(match.kickoff_at)}
        </span>
        <span className="text-slate-300">·</span>
        <span className="font-bold text-slate-900">
          {formatColombiaTime(match.kickoff_at)}
        </span>
        <span className="text-slate-400">(Colombia)</span>
        {match.venue && (
          <>
            <span className="text-slate-300">·</span>
            <span className="truncate">
              {match.venue}, {match.city}
            </span>
          </>
        )}
      </div>

      {/* Action */}
      <div className="mt-3 flex items-center justify-end gap-2">
        {msg && (
          <span
            className={`text-xs font-semibold ${
              msg.type === "ok" ? "text-brand-600" : "text-rose-600"
            }`}
          >
            {msg.text}
          </span>
        )}
        {prediction && !inputsDisabled && (
          <span className="text-xs text-slate-400">
            Tu pronóstico: {prediction.home_score}–{prediction.away_score}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving || inputsDisabled}
          className="btn-primary text-sm py-1.5 px-3"
        >
          {saving
            ? "Guardando…"
            : prediction
            ? "Actualizar"
            : "Guardar"}
        </button>
      </div>
    </div>
  );
}
