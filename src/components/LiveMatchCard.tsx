import { useState } from "react";
import type { Match, MatchStatus } from "../types/database";
import { getFlagUrl, isSquareFlag } from "../data/countries";
import {
  formatColombiaDate,
  formatColombiaTime,
} from "../lib/time";
import { isMatchLive } from "../lib/standings";
import { phaseLabel } from "../lib/phases";

interface Props {
  match: Match;
  variant?: "live" | "result" | "upcoming";
  /** Admin-only en modo demo: ciclo scheduled → live → finished → scheduled. */
  onCycleStatus?: (next: MatchStatus) => Promise<void>;
}

const STATUS_CYCLE: Record<MatchStatus, MatchStatus> = {
  scheduled: "live",
  live: "finished",
  finished: "scheduled",
};

const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "Por jugar",
  live: "En vivo",
  finished: "Finalizado",
};

function TeamSide({
  name,
  isPlaceholder,
  align,
}: {
  name: string;
  isPlaceholder: boolean;
  align: "left" | "right";
}) {
  const flag = !isPlaceholder ? getFlagUrl(name, 80) : null;
  const square = !isPlaceholder && isSquareFlag(name);
  return (
    <div
      className={`flex flex-col items-center gap-2 ${
        align === "right" ? "" : ""
      } min-w-0 flex-1`}
    >
      <div
        className={`w-14 h-10 sm:w-16 sm:h-11 rounded-lg overflow-hidden border-2 border-white shadow-soft grid place-items-center ${
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
          <span className="text-xs font-mono text-slate-400">?</span>
        )}
      </div>
      <div
        className={`text-xs sm:text-sm font-bold text-center leading-tight ${
          isPlaceholder ? "font-mono text-slate-400" : "text-slate-900"
        }`}
      >
        {name}
      </div>
    </div>
  );
}

export default function LiveMatchCard({ match, variant, onCycleStatus }: Props) {
  const live = variant === "live" || isMatchLive(match);
  const finished = variant === "result" || match.status === "finished";
  const placeholderMatch = match.home_is_placeholder || match.away_is_placeholder;
  const [cycling, setCycling] = useState(false);

  async function handleCycle() {
    if (!onCycleStatus || cycling) return;
    const next = STATUS_CYCLE[match.status];
    setCycling(true);
    try {
      await onCycleStatus(next);
    } finally {
      setCycling(false);
    }
  }

  return (
    <div
      className={`card hover:shadow-lift transition-all overflow-hidden ${
        live ? "ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-50" : ""
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-2 flex items-center justify-between text-xs font-bold ${
          live
            ? "bg-rose-500 text-white"
            : finished
            ? "bg-slate-100 text-slate-700"
            : "bg-slate-50 text-slate-600"
        }`}
      >
        <div className="flex items-center gap-2">
          {live && (
            <span className="flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              EN VIVO
            </span>
          )}
          {finished && <span>FINALIZADO</span>}
          {!live && !finished && <span>POR JUGAR</span>}
          <span className={live ? "text-white/80" : "text-slate-400"}>·</span>
          <span>{phaseLabel(match)}</span>
        </div>
        <span className={live ? "text-white/80" : "text-slate-400"}>
          #{match.match_number}
        </span>
      </div>

      {/* Main: teams + score */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
          <TeamSide
            name={match.home_team}
            isPlaceholder={match.home_is_placeholder}
            align="left"
          />

          <div className="flex items-center justify-center">
            {match.home_score !== null && match.away_score !== null ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div
                  className={`text-3xl sm:text-5xl font-display font-extrabold tabular-nums ${
                    live ? "text-rose-500" : "text-slate-900"
                  }`}
                >
                  {match.home_score}
                </div>
                <div className="text-2xl sm:text-3xl text-slate-300 font-bold">
                  :
                </div>
                <div
                  className={`text-3xl sm:text-5xl font-display font-extrabold tabular-nums ${
                    live ? "text-rose-500" : "text-slate-900"
                  }`}
                >
                  {match.away_score}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-base font-bold text-slate-900 tabular-nums">
                  {formatColombiaTime(match.kickoff_at)}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                  vs
                </div>
              </div>
            )}
          </div>

          <TeamSide
            name={match.away_team}
            isPlaceholder={match.away_is_placeholder}
            align="right"
          />
        </div>

        {/* Footer: date + venue */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
          <span className="capitalize text-slate-700 font-semibold">
            {formatColombiaDate(match.kickoff_at)}
          </span>
          {!live && match.home_score === null && (
            <>
              <span className="text-slate-300">·</span>
              <span className="font-bold text-slate-900">
                {formatColombiaTime(match.kickoff_at)}
              </span>
              <span className="text-slate-400">(Colombia)</span>
            </>
          )}
          {match.venue && (
            <>
              <span className="text-slate-300">·</span>
              <span className="truncate">
                {match.venue}, {match.city}
              </span>
            </>
          )}
          {placeholderMatch && (
            <>
              <span className="text-slate-300">·</span>
              <span className="badge-slate">Equipos por definir</span>
            </>
          )}
        </div>

        {/* Toggle admin-only (modo demo): cicla scheduled → live → finished */}
        {onCycleStatus && !placeholderMatch && (
          <div className="mt-3 pt-3 border-t border-dashed border-yellow-300 flex items-center justify-between gap-2 text-xs bg-yellow-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 px-4 sm:px-5 pb-3 rounded-b-2xl">
            <span className="font-semibold text-yellow-900">
              🔧 Admin · estatus actual:{" "}
              <span className="font-mono">{STATUS_LABEL[match.status]}</span>
            </span>
            <button
              type="button"
              onClick={handleCycle}
              disabled={cycling}
              className="px-2.5 py-1 rounded-md bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-bold transition-colors disabled:opacity-50"
              title={`Cambiar a: ${STATUS_LABEL[STATUS_CYCLE[match.status]]}`}
            >
              {cycling
                ? "…"
                : `→ ${STATUS_LABEL[STATUS_CYCLE[match.status]]}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
