import { useEffect, useMemo, useState } from "react";
import { supabase, fetchAllRows } from "../lib/supabase";
import type { Entry, Match, Prediction, Profile } from "../types/database";
import { computeEntryScore, SCORING } from "../lib/scoring";
import { isDemoMode } from "../lib/demo";

interface Row {
  entry: Entry;
  profile: Profile | null;
  points: number;
  exact: number;
  winner_score: number;
  winner_or_draw: number;
  score_only: number;
  predictions_count: number;
}

interface Props {
  matches: Match[];
}

export default function Leaderboard({ matches }: Props) {
  // Datos crudos: se descargan UNA sola vez (o cuando cambian pronósticos/
  // pollas). El ranking se recalcula localmente en el useMemo de abajo cada
  // vez que cambian los marcadores (`matches`), SIN volver a descargar la
  // tabla de pronósticos. Antes se re-bajaba todo en cada evento de realtime,
  // lo que disparaba el egress de la base de datos.
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [eRes, pRes, predRes] = await Promise.all([
        fetchAllRows<Entry>("entries"),
        fetchAllRows<Profile>("profiles"),
        // Solo las columnas que necesita el cálculo de puntaje: reduce el
        // tamaño de la descarga (antes traía todas con select *).
        fetchAllRows<Prediction>("predictions", {
          columns: "entry_id, match_id, home_score, away_score",
        }),
      ]);
      if (!mounted) return;
      if (eRes.error || pRes.error || predRes.error) {
        setError(
          eRes.error?.message ??
            pRes.error?.message ??
            predRes.error?.message ??
            "Error"
        );
        setLoading(false);
        return;
      }
      setEntries((eRes.data ?? []) as Entry[]);
      setProfiles((pRes.data ?? []) as Profile[]);
      setPredictions((predRes.data ?? []) as Prediction[]);
      setLoading(false);
    }
    load();

    // Realtime: recargar SOLO cuando cambian pronósticos o pollas, con
    // "debounce" para colapsar ráfagas (muchos guardados seguidos ⇒ 1 recarga).
    // Los marcadores NO disparan recarga aquí: el prop `matches` ya se actualiza
    // por realtime en la página Mundial y el ranking se recalcula en memoria.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoad = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 8000);
    };
    const channel = supabase
      .channel("leaderboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "predictions" },
        debouncedLoad
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entries" },
        debouncedLoad
      )
      .subscribe();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  const rows: Row[] = useMemo(() => {
    const profilesById = new Map<string, Profile>();
    profiles.forEach((p) => profilesById.set(p.id, p));

    const predsByEntry = new Map<string, Prediction[]>();
    predictions.forEach((p) => {
      const arr = predsByEntry.get(p.entry_id) ?? [];
      arr.push(p);
      predsByEntry.set(p.entry_id, arr);
    });

    return entries.map((entry) => {
      const preds = predsByEntry.get(entry.id) ?? [];
      const breakdown = computeEntryScore(preds, matches);
      return {
        entry,
        profile: profilesById.get(entry.user_id) ?? null,
        points: breakdown.points,
        exact: breakdown.exact,
        winner_score: breakdown.winner_score,
        winner_or_draw: breakdown.winner_or_draw,
        score_only: breakdown.score_only,
        predictions_count: breakdown.predictions_count,
      };
    });
  }, [entries, profiles, predictions, matches]);

  const demo = isDemoMode();
  const visible = useMemo(() => {
    return rows
      .filter((r) => demo || r.entry.paid)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.exact !== a.exact) return b.exact - a.exact;
        return (
          (a.profile?.display_name ?? a.profile?.email ?? "").localeCompare(
            b.profile?.display_name ?? b.profile?.email ?? ""
          )
        );
      });
  }, [rows, demo]);

  if (loading) {
    return <div className="text-center text-slate-400 py-12">Cargando ranking…</div>;
  }
  if (error) {
    return (
      <div className="card p-6 text-rose-600 border-rose-200 bg-rose-50">
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-3">🏁</div>
        <h3 className="font-bold text-slate-900 text-lg">
          Aún no hay pollas activas
        </h3>
        <p className="text-slate-500 mt-1">
          Cuando el admin habilite pollas a los jugadores, aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reglas */}
      <div className="card p-4 flex items-center gap-2 flex-wrap text-sm">
        <span className="badge-brand">🎯 Exacto: {SCORING.EXACT} pts</span>
        <span className="badge-blue">
          ⭐ Ganador + 1 marcador: {SCORING.WINNER_WITH_SCORE} pts
        </span>
        <span className="badge-slate">
          ✓ Solo ganador / Empate: {SCORING.WINNER_OR_DRAW} pts
        </span>
        <span className="badge-slate">· 1 marcador: {SCORING.SCORE_ONLY} pt</span>
      </div>

      {/* Podium de premiados (1° y 2°) */}
      {visible.length >= 2 && visible[0].points > 0 && (
        <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
          <PodiumCard row={visible[0]} position={1} />
          <PodiumCard row={visible[1]} position={2} />
        </div>
      )}

      {/* Tabla completa */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-display font-extrabold text-lg text-slate-900">
              🏆 Ranking general
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              El premio se reparte entre el <strong className="text-gold-700">1°</strong> y el{" "}
              <strong className="text-slate-700">2°</strong> puesto.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {visible.length} {visible.length === 1 ? "polla" : "pollas"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="py-2.5 pl-4 pr-2 text-left font-bold w-12">#</th>
                <th className="py-2.5 px-2 text-left font-bold">Jugador / Polla</th>
                <th className="py-2.5 px-2 text-center font-bold w-12" title="Marcadores exactos (4 pts)">🎯</th>
                <th className="py-2.5 px-2 text-center font-bold w-12" title="Ganador + 1 marcador (3 pts)">⭐</th>
                <th className="py-2.5 px-2 text-center font-bold w-12" title="Solo ganador / Empate (2 pts)">✓</th>
                <th className="py-2.5 px-2 text-center font-bold w-12" title="1 marcador acertado (1 pt)">·</th>
                <th className="py-2.5 px-2 text-center font-bold w-14" title="Pronósticos enviados">Env</th>
                <th className="py-2.5 px-2 text-center font-extrabold w-16 text-slate-700">Pts</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, idx) => (
                <RankRow key={r.entry.id} row={r} position={idx + 1} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PodiumCard({ row, position }: { row: Row; position: 1 | 2 }) {
  const colors = {
    1: { bg: "from-gold-100 to-gold-50", ring: "ring-gold-300", icon: "🥇", text: "text-gold-700", prize: "1° Premio" },
    2: { bg: "from-slate-100 to-slate-50", ring: "ring-slate-300", icon: "🥈", text: "text-slate-700", prize: "2° Premio" },
  }[position];
  const initial = (
    row.profile?.display_name ??
    row.profile?.email ??
    "?"
  )[0]?.toUpperCase();
  return (
    <div
      className={`relative bg-gradient-to-b ${colors.bg} ring-2 ${colors.ring} rounded-2xl p-4 text-center ${
        position === 1 ? "scale-105" : ""
      }`}
    >
      <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-white shadow-soft text-[10px] font-extrabold uppercase tracking-wider text-slate-700 ring-1 ring-slate-200">
        🏆 {colors.prize}
      </span>
      <div className="text-3xl mt-1">{colors.icon}</div>
      <div className="w-12 h-12 mx-auto rounded-full bg-white grid place-items-center text-lg font-extrabold text-slate-700 my-2 shadow-soft">
        {initial}
      </div>
      <div className="font-bold text-slate-900 truncate">
        {row.profile?.display_name ?? row.profile?.email ?? "—"}
      </div>
      <div className="text-xs text-slate-500 truncate">{row.entry.name}</div>
      <div className={`mt-2 font-display text-3xl font-extrabold ${colors.text}`}>
        {row.points}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        puntos
      </div>
    </div>
  );
}

function RankRow({ row, position }: { row: Row; position: number }) {
  const isPrize = position <= 2;
  const initial = (
    row.profile?.display_name ??
    row.profile?.email ??
    "?"
  )[0]?.toUpperCase();
  return (
    <tr
      className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${
        position === 1
          ? "bg-gold-50/40"
          : position === 2
          ? "bg-slate-50/40"
          : ""
      }`}
    >
      <td className="py-2.5 pl-4 pr-2">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-extrabold ${
            position === 1
              ? "bg-gold-500 text-white"
              : position === 2
              ? "bg-slate-400 text-white"
              : "bg-slate-200 text-slate-600"
          }`}
          title={isPrize ? `Premio · ${position}° puesto` : `Puesto ${position}`}
        >
          {isPrize ? ["🥇", "🥈"][position - 1] : position}
        </span>
      </td>
      <td className="py-2.5 px-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 grid place-items-center text-white font-bold text-xs flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 truncate">
              {row.profile?.display_name ?? row.profile?.email ?? "—"}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {row.entry.name}
            </div>
          </div>
        </div>
      </td>
      <td className="py-2.5 px-2 text-center text-slate-700 tabular-nums">
        {row.exact}
      </td>
      <td className="py-2.5 px-2 text-center text-slate-700 tabular-nums">
        {row.winner_score}
      </td>
      <td className="py-2.5 px-2 text-center text-slate-700 tabular-nums">
        {row.winner_or_draw}
      </td>
      <td className="py-2.5 px-2 text-center text-slate-700 tabular-nums">
        {row.score_only}
      </td>
      <td className="py-2.5 px-2 text-center text-slate-500 tabular-nums">
        {row.predictions_count}
      </td>
      <td className="py-2.5 px-2 text-center font-extrabold text-base text-slate-900 tabular-nums">
        {row.points}
      </td>
    </tr>
  );
}
