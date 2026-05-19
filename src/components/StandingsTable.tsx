import { computeGroupStandings, type TeamStats } from "../lib/standings";
import type { Match } from "../types/database";
import { getFlagUrl, isSquareFlag } from "../data/countries";

interface Props {
  groupLetter: string;
  matches: Match[];
}

export default function StandingsTable({ groupLetter, matches }: Props) {
  const standings = computeGroupStandings(matches);

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 bg-gradient-to-r from-brand-50 to-brand-100/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 grid place-items-center text-white font-extrabold text-sm">
            {groupLetter}
          </div>
          <h3 className="font-display font-extrabold text-lg text-slate-900">
            Grupo {groupLetter}
          </h3>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {standings.reduce((s, t) => s + t.played, 0) / 2} /{" "}
          {matches.filter((m) => !m.home_is_placeholder).length} partidos
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 border-b border-slate-200">
              <th className="py-2.5 pl-4 pr-2 text-left font-bold w-8">#</th>
              <th className="py-2.5 px-2 text-left font-bold">Equipo</th>
              <th className="py-2.5 px-2 text-center font-bold w-10" title="Partidos jugados">PJ</th>
              <th className="py-2.5 px-2 text-center font-bold w-10" title="Ganados">G</th>
              <th className="py-2.5 px-2 text-center font-bold w-10" title="Empatados">E</th>
              <th className="py-2.5 px-2 text-center font-bold w-10" title="Perdidos">P</th>
              <th className="py-2.5 px-2 text-center font-bold w-10" title="Goles a favor">GF</th>
              <th className="py-2.5 px-2 text-center font-bold w-10" title="Goles en contra">GC</th>
              <th className="py-2.5 px-2 text-center font-bold w-10" title="Diferencia de goles">DG</th>
              <th className="py-2.5 px-2 text-center font-extrabold w-12 text-slate-700" title="Puntos">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((t, idx) => (
              <StandingsRow key={t.team} stats={t} position={idx + 1} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-500"></span>
          Clasifican a octavos (1° y 2°)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gold-400"></span>
          Posibles mejores 3°
        </span>
      </div>
    </div>
  );
}

function StandingsRow({
  stats,
  position,
}: {
  stats: TeamStats;
  position: number;
}) {
  const flag = getFlagUrl(stats.team, 40);
  const square = isSquareFlag(stats.team);
  // Top 2 clasifican; el 3° puede ser uno de los 8 mejores 3° (formato 48 equipos)
  const isTop2 = position <= 2;
  const isThird = position === 3;

  return (
    <tr
      className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${
        isTop2 ? "bg-brand-50/40" : isThird ? "bg-gold-50/40" : ""
      }`}
    >
      <td className="py-2.5 pl-4 pr-2">
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-extrabold ${
            isTop2
              ? "bg-brand-500 text-white"
              : isThird
              ? "bg-gold-400 text-white"
              : "bg-slate-200 text-slate-600"
          }`}
        >
          {position}
        </span>
      </td>
      <td className="py-2.5 px-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-5 rounded overflow-hidden border border-slate-200 flex-shrink-0 ${
              square ? "bg-white" : "bg-slate-100"
            }`}
          >
            {flag && (
              <img
                src={flag}
                alt={stats.team}
                className={`w-full h-full ${square ? "object-contain" : "object-cover"}`}
                loading="lazy"
              />
            )}
          </div>
          <span className="font-bold text-slate-900 truncate">{stats.team}</span>
        </div>
      </td>
      <td className="py-2.5 px-2 text-center text-slate-700 tabular-nums">
        {stats.played}
      </td>
      <td className="py-2.5 px-2 text-center text-slate-700 tabular-nums">
        {stats.won}
      </td>
      <td className="py-2.5 px-2 text-center text-slate-700 tabular-nums">
        {stats.drawn}
      </td>
      <td className="py-2.5 px-2 text-center text-slate-700 tabular-nums">
        {stats.lost}
      </td>
      <td className="py-2.5 px-2 text-center text-slate-700 tabular-nums">
        {stats.goalsFor}
      </td>
      <td className="py-2.5 px-2 text-center text-slate-700 tabular-nums">
        {stats.goalsAgainst}
      </td>
      <td
        className={`py-2.5 px-2 text-center tabular-nums font-semibold ${
          stats.goalDifference > 0
            ? "text-brand-600"
            : stats.goalDifference < 0
            ? "text-rose-500"
            : "text-slate-500"
        }`}
      >
        {stats.goalDifference > 0 ? "+" : ""}
        {stats.goalDifference}
      </td>
      <td className="py-2.5 px-2 text-center font-extrabold text-base text-slate-900 tabular-nums">
        {stats.points}
      </td>
    </tr>
  );
}
