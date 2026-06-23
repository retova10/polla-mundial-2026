import { useEffect, useMemo, useState } from "react";
import { fetchAllRows } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import type { Entry, Match, Prediction, Profile } from "../types/database";
import { getCountry, getFlagUrl, isSquareFlag } from "../data/countries";
import { categorize, pointsFor } from "../lib/scoring";
import { formatColombiaShort } from "../lib/time";

// Orden vertical de cada ronda para que las llaves del bracket queden
// alineadas: los dos partidos que alimentan al mismo cruce siguiente van
// adyacentes. Los números son los match_number oficiales FIFA del cuadro.
const ROUNDS: { key: string; label: string; numbers: number[] }[] = [
  {
    key: "round_of_32",
    label: "Dieciseisavos",
    numbers: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  },
  { key: "round_of_16", label: "Octavos", numbers: [89, 90, 93, 94, 91, 92, 95, 96] },
  { key: "quarterfinal", label: "Cuartos", numbers: [97, 98, 99, 100] },
  { key: "semifinal", label: "Semifinales", numbers: [101, 102] },
];

const FINAL_NUMBER = 104;
const THIRD_NUMBER = 103;

export interface EntryOption {
  id: string;
  label: string;
}

// ---------- piezas visuales ----------

function TeamRow({
  name,
  isPlaceholder,
  score,
  isWinner,
  decided,
}: {
  name: string;
  isPlaceholder: boolean;
  score: number | null;
  isWinner: boolean;
  decided: boolean;
}) {
  const country = !isPlaceholder ? getCountry(name) : null;
  const flag = country ? getFlagUrl(name, 20) : null;
  const square = !isPlaceholder && isSquareFlag(name);
  const label = country ? country.fifa : name;
  return (
    <div
      className={`flex items-center gap-1.5 min-w-0 ${
        decided && !isWinner ? "opacity-45" : ""
      }`}
    >
      {flag ? (
        <img
          src={flag}
          alt={name}
          className={`w-4 h-3 rounded-sm border border-slate-200 flex-shrink-0 ${
            square ? "object-contain bg-white" : "object-cover"
          }`}
          loading="lazy"
        />
      ) : (
        <span className="w-4 h-3 rounded-sm bg-slate-100 border border-slate-200 flex-shrink-0" />
      )}
      <span
        className={`truncate text-[11px] ${
          country
            ? `font-bold ${isWinner ? "text-slate-900" : "text-slate-700"}`
            : "font-mono text-slate-400 text-[10px]"
        }`}
        title={name}
      >
        {label}
      </span>
      {isWinner && decided && (
        <span className="text-[9px] text-brand-500 flex-shrink-0">●</span>
      )}
      <span className="ml-auto pl-1 font-extrabold tabular-nums text-slate-900 text-xs flex-shrink-0">
        {score ?? ""}
      </span>
    </div>
  );
}

function PredChip({ match, pred }: { match: Match; pred: Prediction | null }) {
  if (!pred) {
    return (
      <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-200 text-[9px] text-slate-300 text-center">
        sin pronóstico
      </div>
    );
  }
  const cat = categorize(pred, match);
  const finished = cat !== "pending";
  const pts = pointsFor(cat);
  const color =
    cat === "exact"
      ? "bg-brand-100 text-brand-800 ring-brand-200"
      : cat === "winner_score"
      ? "bg-brand-50 text-brand-700 ring-brand-100"
      : cat === "winner_or_draw"
      ? "bg-gold-50 text-gold-800 ring-gold-200"
      : cat === "score_only"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : cat === "wrong"
      ? "bg-rose-50 text-rose-600 ring-rose-200"
      : "bg-slate-50 text-slate-500 ring-slate-200";
  return (
    <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-200 flex items-center justify-between gap-1">
      <span className="text-[9px] text-slate-400 uppercase tracking-wide font-semibold">
        Pron.
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ring-1 ring-inset ${color}`}
      >
        {pred.home_score}–{pred.away_score}
        {finished && <span className="font-extrabold opacity-80">+{pts}</span>}
      </span>
    </div>
  );
}

function BracketCard({
  match,
  pred,
  highlight,
}: {
  match: Match;
  pred: Prediction | null;
  highlight?: "third";
}) {
  const decided =
    match.status === "finished" &&
    match.home_score !== null &&
    match.away_score !== null;
  const homeWins =
    decided && (match.home_score as number) > (match.away_score as number);
  const awayWins =
    decided && (match.away_score as number) > (match.home_score as number);

  const ring =
    highlight === "third"
      ? "ring-1 ring-amber-200 bg-gradient-to-b from-amber-50/60 to-white"
      : "ring-1 ring-slate-200 bg-white";

  return (
    <div className={`rounded-xl ${ring} shadow-soft px-2.5 py-2 w-[170px] flex-shrink-0`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[8px] font-mono text-slate-400">
          #{match.match_number}
        </span>
        {decided ? (
          <span className="text-[8px] font-bold uppercase tracking-wide text-brand-600">
            Final
          </span>
        ) : (
          <span className="text-[8px] text-slate-400">
            {formatColombiaShort(match.kickoff_at).split(",")[0]}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <TeamRow
          name={match.home_team}
          isPlaceholder={match.home_is_placeholder}
          score={decided ? match.home_score : null}
          isWinner={homeWins}
          decided={decided}
        />
        <TeamRow
          name={match.away_team}
          isPlaceholder={match.away_is_placeholder}
          score={decided ? match.away_score : null}
          isWinner={awayWins}
          decided={decided}
        />
      </div>
      <PredChip match={match} pred={pred} />
    </div>
  );
}

// Variante grande para la final del hero.
function FinalCard({ match, pred }: { match: Match; pred: Prediction | null }) {
  const decided =
    match.status === "finished" &&
    match.home_score !== null &&
    match.away_score !== null;
  const homeWins =
    decided && (match.home_score as number) > (match.away_score as number);
  const awayWins =
    decided && (match.away_score as number) > (match.home_score as number);

  function Side({
    name,
    isPlaceholder,
    isWinner,
  }: {
    name: string;
    isPlaceholder: boolean;
    isWinner: boolean;
  }) {
    const country = !isPlaceholder ? getCountry(name) : null;
    const flag = country ? getFlagUrl(name, 40) : null;
    const square = !isPlaceholder && isSquareFlag(name);
    return (
      <div
        className={`flex flex-col items-center gap-1 flex-1 min-w-0 ${
          decided && !isWinner ? "opacity-50" : ""
        }`}
      >
        <div className="w-10 h-7 rounded-md overflow-hidden border border-slate-200 grid place-items-center bg-slate-100">
          {flag ? (
            <img
              src={flag}
              alt={name}
              className={`w-full h-full ${
                square ? "object-contain bg-white" : "object-cover"
              }`}
            />
          ) : (
            <span className="text-[9px] font-mono text-slate-400">?</span>
          )}
        </div>
        <span
          className={`text-center text-xs leading-tight ${
            country
              ? "font-extrabold text-slate-900"
              : "font-mono text-slate-400 text-[10px]"
          }`}
        >
          {country ? country.fifa : name}
        </span>
      </div>
    );
  }

  const cat = categorize(pred, match);
  const pts = pointsFor(cat);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Side
          name={match.home_team}
          isPlaceholder={match.home_is_placeholder}
          isWinner={homeWins}
        />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-2xl font-display font-extrabold tabular-nums text-slate-900">
            {decided ? match.home_score : "–"}
          </span>
          <span className="text-slate-300 font-bold">:</span>
          <span className="text-2xl font-display font-extrabold tabular-nums text-slate-900">
            {decided ? match.away_score : "–"}
          </span>
        </div>
        <Side
          name={match.away_team}
          isPlaceholder={match.away_is_placeholder}
          isWinner={awayWins}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs border-t border-gold-200/70 pt-2">
        <span className="text-slate-400">
          {formatColombiaShort(match.kickoff_at)}
        </span>
        {pred ? (
          <span className="font-bold text-slate-700">
            Pronóstico: {pred.home_score}–{pred.away_score}
            {cat !== "pending" && <span className="ml-1 text-brand-600">+{pts}</span>}
          </span>
        ) : (
          <span className="text-slate-300">sin pronóstico</span>
        )}
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-3 h-3 rounded ring-1 ring-inset ${className}`} />
      {label}
    </span>
  );
}

// ---------- vista pura (testeable / previsualizable) ----------

export function BracketView({
  matches,
  predByMatch,
  entryOptions,
  selectedEntry,
  onSelectEntry,
}: {
  matches: Match[];
  predByMatch: Map<string, Prediction>;
  entryOptions: EntryOption[];
  selectedEntry: string;
  onSelectEntry: (id: string) => void;
}) {
  const matchByNumber = useMemo(() => {
    const m = new Map<number, Match>();
    matches.forEach((mt) => m.set(mt.match_number, mt));
    return m;
  }, [matches]);

  const hasKnockout = matches.some((m) => m.match_number >= 73);
  if (!hasKnockout) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-3">🗺️</div>
        <h3 className="font-bold text-slate-900 text-lg">
          La fase final aún no está disponible
        </h3>
        <p className="text-slate-500 mt-1">
          El cuadro de eliminación aparecerá aquí cuando se carguen los partidos.
        </p>
      </div>
    );
  }

  const finalMatch = matchByNumber.get(FINAL_NUMBER);
  const thirdMatch = matchByNumber.get(THIRD_NUMBER);

  return (
    <div className="space-y-5">
      {/* Selector de polla */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-slate-700">
          🏆 Cuadro de eliminación
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-slate-500 font-semibold">Pronósticos de:</span>
          <select
            value={selectedEntry}
            onChange={(e) => onSelectEntry(e.target.value)}
            className="input py-1.5 px-3 text-sm w-auto max-w-[260px]"
          >
            {entryOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Hero: Final + 3er puesto */}
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="card p-5 bg-gradient-to-br from-gold-50 via-white to-white ring-1 ring-gold-200 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-7xl opacity-10 select-none">
            🏆
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🏆</span>
            <h3 className="font-display font-extrabold text-lg text-slate-900">
              La Gran Final
            </h3>
          </div>
          {finalMatch ? (
            <FinalCard match={finalMatch} pred={predByMatch.get(finalMatch.id) ?? null} />
          ) : (
            <p className="text-slate-400 text-sm">Aún no disponible.</p>
          )}
        </div>

        <div className="card p-5 bg-gradient-to-br from-amber-50/60 via-white to-white ring-1 ring-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🥉</span>
            <h3 className="font-display font-extrabold text-lg text-slate-900">
              Tercer puesto
            </h3>
          </div>
          {thirdMatch ? (
            <BracketCard
              match={thirdMatch}
              pred={predByMatch.get(thirdMatch.id) ?? null}
              highlight="third"
            />
          ) : (
            <p className="text-slate-400 text-sm">Aún no disponible.</p>
          )}
        </div>
      </div>

      {/* Bracket por rondas */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60">
          <h3 className="font-display font-bold text-slate-900">Camino a la final</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Resultado real y, debajo, el pronóstico de la polla seleccionada.
            Desplázate horizontalmente para ver todas las rondas.
          </p>
        </div>
        <div className="overflow-x-auto p-4">
          <div className="flex gap-4 min-w-max">
            {ROUNDS.map((round) => {
              const cards = round.numbers
                .map((n) => matchByNumber.get(n))
                .filter((m): m is Match => !!m);
              if (cards.length === 0) return null;
              return (
                <div key={round.key} className="flex flex-col">
                  <div className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                    {round.label}
                    <span className="ml-1 text-slate-300">({cards.length})</span>
                  </div>
                  <div className="flex flex-col justify-around gap-3 flex-1">
                    {cards.map((m) => (
                      <BracketCard
                        key={m.id}
                        match={m}
                        pred={predByMatch.get(m.id) ?? null}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="card p-3 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-slate-600">Pronóstico:</span>
        <Legend className="bg-brand-100 ring-brand-200" label="exacto · 4" />
        <Legend className="bg-brand-50 ring-brand-100" label="ganador + marcador · 3" />
        <Legend className="bg-gold-50 ring-gold-200" label="ganador/empate · 2" />
        <Legend className="bg-amber-50 ring-amber-200" label="1 marcador · 1" />
        <Legend className="bg-rose-50 ring-rose-200" label="fallado · 0" />
      </div>
    </div>
  );
}

// ---------- contenedor con carga de datos ----------

export default function KnockoutBracket({ matches }: { matches: Match[] }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const [eRes, pRes, prRes] = await Promise.all([
        fetchAllRows<Entry>("entries", { orderBy: "created_at" }),
        fetchAllRows<Profile>("profiles"),
        fetchAllRows<Prediction>("predictions"),
      ]);
      if (!active) return;
      setEntries(eRes.data ?? []);
      setProfiles(pRes.data ?? []);
      setPredictions(prRes.data ?? []);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  // Por defecto, la primera polla del usuario actual.
  useEffect(() => {
    if (selectedEntry || entries.length === 0) return;
    const mine = entries.find((e) => e.user_id === user?.id);
    setSelectedEntry(mine?.id ?? entries[0].id);
  }, [entries, user, selectedEntry]);

  const predByMatch = useMemo(() => {
    const m = new Map<string, Prediction>();
    predictions
      .filter((p) => p.entry_id === selectedEntry)
      .forEach((p) => m.set(p.match_id, p));
    return m;
  }, [predictions, selectedEntry]);

  const entryOptions = useMemo<EntryOption[]>(
    () =>
      entries.map((e) => {
        const prof = profileById.get(e.user_id);
        const who = prof?.display_name ?? prof?.email ?? "—";
        return { id: e.id, label: `${who} · ${e.name}` };
      }),
    [entries, profileById]
  );

  if (loading) {
    return (
      <div className="card p-12 text-center text-slate-400">
        Cargando fase final…
      </div>
    );
  }

  return (
    <BracketView
      matches={matches}
      predByMatch={predByMatch}
      entryOptions={entryOptions}
      selectedEntry={selectedEntry}
      onSelectEntry={setSelectedEntry}
    />
  );
}
