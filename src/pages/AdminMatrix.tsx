import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type {
  Entry,
  Match,
  Phase,
  Prediction,
  Profile,
} from "../types/database";
import { getCountry, getFlagUrl, isSquareFlag } from "../data/countries";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { isLocked, toColombia } from "../lib/time";
import {
  categorize,
  computeEntryScore,
  pointsFor,
  type ScoreCategory,
} from "../lib/scoring";
import { useAuth } from "../lib/AuthContext";

function shortName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

function TeamMini({
  name,
  isPlaceholder,
}: {
  name: string;
  isPlaceholder: boolean;
}) {
  const flag = !isPlaceholder ? getFlagUrl(name, 20) : null;
  const c = !isPlaceholder ? getCountry(name) : null;
  const square = !isPlaceholder && isSquareFlag(name);
  // Si el equipo está en la tabla de países, usamos su código FIFA oficial.
  // Si no (placeholder o nombre desconocido), caemos al slug de 3 letras.
  const label = isPlaceholder
    ? name.slice(0, 4)
    : c
    ? c.fifa
    : shortName(name);
  return (
    <div
      className="inline-flex items-center gap-1"
      title={name}
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
        <span className="w-4 h-3 rounded-sm bg-slate-100 border border-slate-200 grid place-items-center text-[7px] font-mono text-slate-400">
          ?
        </span>
      )}
      <span
        className={`font-bold tabular-nums ${
          isPlaceholder ? "text-slate-400 font-mono text-[10px]" : "text-slate-800 text-[11px]"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default function AdminMatrix() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [matches, setMatches] = useState<Match[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase | "all">("all");
  const [groupLetter, setGroupLetter] = useState<string | "all">("all");
  const [paidFilter, setPaidFilter] = useState<"all" | "paid" | "unpaid">(
    "all"
  );
  const [search, setSearch] = useState("");
  const [showActual, setShowActual] = useState(true);
  // Reloj que se refresca solo para revelar automáticamente los pronósticos
  // en cuanto un partido cruza su bloqueo (2h antes del inicio).
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      supabase
        .from("matches")
        .select("*")
        .order("match_number", { ascending: true }),
      supabase
        .from("entries")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase.from("profiles").select("*"),
      supabase.from("predictions").select("*"),
    ]).then(([mRes, eRes, pRes, prRes]) => {
      if (!mounted) return;
      const err =
        mRes.error || eRes.error || pRes.error || prRes.error;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setMatches((mRes.data ?? []) as Match[]);
      setEntries((eRes.data ?? []) as Entry[]);
      setProfiles((pRes.data ?? []) as Profile[]);
      setPredictions((prRes.data ?? []) as Prediction[]);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const predIndex = useMemo(() => {
    const m = new Map<string, Map<string, Prediction>>();
    predictions.forEach((p) => {
      let inner = m.get(p.entry_id);
      if (!inner) {
        inner = new Map();
        m.set(p.entry_id, inner);
      }
      inner.set(p.match_id, p);
    });
    return m;
  }, [predictions]);

  const groupLetters = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => m.group_letter && set.add(m.group_letter));
    return Array.from(set).sort();
  }, [matches]);

  const visibleMatches = useMemo(
    () =>
      matches.filter((m) => {
        if (phase !== "all" && m.phase !== phase) return false;
        if (groupLetter !== "all" && m.group_letter !== groupLetter)
          return false;
        return true;
      }),
    [matches, phase, groupLetter]
  );

  const pollasWithScore = useMemo(() => {
    return entries.map((e) => {
      const inner = predIndex.get(e.id);
      const preds = inner ? Array.from(inner.values()) : [];
      const score = computeEntryScore(preds, matches);
      return {
        entry: e,
        profile: profileById.get(e.user_id) ?? null,
        score,
      };
    });
  }, [entries, predIndex, matches, profileById]);

  const visiblePollas = useMemo(() => {
    return pollasWithScore
      .filter(({ entry: e, profile: prof }) => {
        if (paidFilter === "paid" && !e.paid) return false;
        if (paidFilter === "unpaid" && e.paid) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const hay = `${prof?.display_name ?? ""} ${prof?.email ?? ""} ${
            e.name
          }`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (b.score.points !== a.score.points)
          return b.score.points - a.score.points;
        if (b.score.exact !== a.score.exact)
          return b.score.exact - a.score.exact;
        const an =
          a.profile?.display_name ?? a.profile?.email ?? "";
        const bn =
          b.profile?.display_name ?? b.profile?.email ?? "";
        return an.localeCompare(bn) || a.entry.name.localeCompare(b.entry.name);
      });
  }, [pollasWithScore, paidFilter, search]);

  function cellClasses(cat: ScoreCategory, hasPred: boolean): string {
    switch (cat) {
      case "exact":
        return "bg-brand-200 text-brand-900";
      case "winner_score":
        return "bg-brand-50 text-brand-700";
      case "winner_or_draw":
        return "bg-gold-100 text-gold-800";
      case "score_only":
        return "bg-amber-50 text-amber-700";
      case "wrong":
        return "bg-rose-50 text-rose-600";
      default:
        return hasPred ? "text-slate-700" : "text-slate-300";
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900">
          Matriz de <span className="text-brand-600">pronósticos</span>
        </h1>
        <p className="text-slate-500 mt-1.5">
          Una fila por polla, una columna por partido. Desplaza horizontalmente
          para ver todos los partidos.
          {!isAdmin && (
            <>
              {" "}
              <span className="text-slate-400">
                Los pronósticos de cada partido se revelan en cuanto se bloquea
                (2 horas antes del inicio).
              </span>
            </>
          )}
        </p>
      </header>

      <section className="card p-4 sm:p-5 sm:sticky sm:top-[68px] z-20">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugador o polla…"
            className="input py-1.5 px-3 text-sm w-56"
          />
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value as Phase | "all")}
            className="input py-1.5 px-3 text-sm w-auto"
          >
            <option value="all">Todas las fases</option>
            <option value="group">Fase de grupos</option>
            <option value="round_of_32">Octavos (R32)</option>
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
          {isAdmin && (
            <select
              value={paidFilter}
              onChange={(e) =>
                setPaidFilter(e.target.value as typeof paidFilter)
              }
              className="input py-1.5 px-3 text-sm w-auto"
            >
              <option value="all">Todas las pollas</option>
              <option value="paid">Solo pagadas</option>
              <option value="unpaid">Solo sin pagar</option>
            </select>
          )}

          <label className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={showActual}
              onChange={(e) => setShowActual(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            Mostrar marcador real
          </label>

          <div className="text-xs text-slate-500 w-full mt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-brand-200 border border-brand-300" />
              exacto · 4
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-brand-50 border border-brand-200" />
              ganador + 1 marcador · 3
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-gold-100 border border-gold-300" />
              ganador o empate · 2
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-50 border border-amber-200" />
              1 marcador · 1
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-rose-50 border border-rose-200" />
              fallado · 0
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-400">—</span>
              sin pronóstico
            </span>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="card p-12 text-center text-slate-400">Cargando…</div>
      ) : error ? (
        <div className="card p-6 bg-rose-50 border-rose-200 text-rose-700">
          {error}
        </div>
      ) : visiblePollas.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          No hay pollas que coincidan con el filtro.
        </div>
      ) : visibleMatches.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          No hay partidos que coincidan con el filtro.
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-260px)]">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th
                    className="sticky left-0 top-0 z-30 bg-slate-50 border-b border-r border-slate-200 px-2 sm:px-3 py-2 text-left text-slate-500 font-semibold uppercase tracking-wider text-[10px] w-[136px] min-w-[136px] sm:w-[220px] sm:min-w-[220px]"
                  >
                    Polla
                  </th>
                  <th
                    className="sticky left-[136px] sm:left-[220px] top-0 z-30 bg-slate-50 border-b border-r-2 border-slate-200 border-r-slate-300 px-1 sm:px-2 py-2 text-center text-slate-500 font-semibold uppercase tracking-wider text-[10px] w-[52px] min-w-[52px] sm:w-[72px] sm:min-w-[72px]"
                  >
                    Total
                  </th>
                  {visibleMatches.map((m, i) => {
                    const prev = visibleMatches[i - 1];
                    const groupBreak =
                      prev && prev.group_letter !== m.group_letter;
                    const phaseBreak = prev && prev.phase !== m.phase;
                    const breakLeft = groupBreak || phaseBreak;
                    return (
                      <th
                        key={m.id}
                        className={`sticky top-0 z-20 bg-slate-50 border-b border-slate-200 px-1.5 py-2 text-center font-normal min-w-[78px] ${
                          breakLeft ? "border-l-2 border-l-brand-300" : ""
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-mono text-slate-400">
                              #{m.match_number}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-wide text-brand-600">
                              {m.phase === "group"
                                ? `Grp ${m.group_letter}`
                                : m.phase === "round_of_32"
                                ? "R32"
                                : m.phase}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TeamMini
                              name={m.home_team}
                              isPlaceholder={m.home_is_placeholder}
                            />
                            <span className="text-slate-300 text-[9px]">vs</span>
                            <TeamMini
                              name={m.away_team}
                              isPlaceholder={m.away_is_placeholder}
                            />
                          </div>
                          <div className="text-[9px] text-slate-500 capitalize">
                            {format(toColombia(m.kickoff_at), "d MMM", {
                              locale: es,
                            })}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>

                {showActual && (
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-100 border-b border-r border-slate-200 px-2 sm:px-3 py-1.5 text-left text-[10px] uppercase tracking-wider font-bold text-slate-600 w-[136px] min-w-[136px] sm:w-[220px] sm:min-w-[220px]">
                      Marcador real
                    </th>
                    <th className="sticky left-[136px] sm:left-[220px] z-20 bg-slate-100 border-b border-r-2 border-slate-200 border-r-slate-300 px-1 sm:px-2 py-1.5 text-center text-[10px] font-bold text-slate-400 w-[52px] min-w-[52px] sm:w-[72px] sm:min-w-[72px]">
                      —
                    </th>
                    {visibleMatches.map((m, i) => {
                      const prev = visibleMatches[i - 1];
                      const breakLeft =
                        prev &&
                        (prev.group_letter !== m.group_letter ||
                          prev.phase !== m.phase);
                      const has =
                        m.home_score != null && m.away_score != null;
                      return (
                        <td
                          key={m.id}
                          className={`bg-slate-100 border-b border-slate-200 px-1 py-1.5 text-center font-extrabold tabular-nums ${
                            has ? "text-slate-900" : "text-slate-300"
                          } ${
                            breakLeft ? "border-l-2 border-l-brand-300" : ""
                          }`}
                        >
                          {has ? `${m.home_score}–${m.away_score}` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </thead>

              <tbody>
                {visiblePollas.map(({ entry: e, profile: prof, score }, rank) => {
                  const inner = predIndex.get(e.id);
                  const filled = inner?.size ?? 0;
                  const isLeader =
                    rank === 0 && score.points > 0;
                  return (
                    <tr key={e.id} className="group hover:bg-slate-50/60">
                      <th
                        className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/60 border-b border-r border-slate-200 px-2 sm:px-3 py-2 text-left align-middle w-[136px] min-w-[136px] sm:w-[220px] sm:min-w-[220px]"
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className="flex flex-col items-center justify-center w-5 sm:w-6 flex-shrink-0">
                            <span
                              className={`text-[10px] font-extrabold tabular-nums ${
                                isLeader ? "text-gold-600" : "text-slate-400"
                              }`}
                            >
                              {isLeader ? "🏆" : `#${rank + 1}`}
                            </span>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 hidden sm:grid place-items-center text-white font-bold text-[11px] flex-shrink-0">
                            {(prof?.display_name ?? prof?.email ?? "?")[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate">
                              {prof?.display_name ?? prof?.email ?? "(sin usuario)"}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-500 truncate">
                                {e.name}
                              </span>
                              {isAdmin && !e.paid && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">
                                  sin pagar
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 tabular-nums">
                              {filled}/{matches.length} ·{" "}
                              <span className="text-brand-600 font-semibold">
                                {score.exact}E
                              </span>{" "}
                              <span className="text-gold-600 font-semibold">
                                {score.winner_score}G
                              </span>
                            </div>
                          </div>
                        </div>
                      </th>
                      <th
                        className={`sticky left-[136px] sm:left-[220px] z-10 bg-white group-hover:bg-slate-50/60 border-b border-r-2 border-slate-200 border-r-slate-300 px-1 sm:px-2 py-2 text-center align-middle w-[52px] min-w-[52px] sm:w-[72px] sm:min-w-[72px] ${
                          isLeader ? "bg-gold-50 group-hover:bg-gold-50" : ""
                        }`}
                        title={`${score.exact} exactos · ${score.winner_score} ganador+marcador · ${score.winner_or_draw} ganador/empate · ${score.score_only} marcador · ${score.wrong} fallados`}
                      >
                        <div
                          className={`font-display font-extrabold text-lg leading-none tabular-nums ${
                            isLeader ? "text-gold-700" : "text-slate-900"
                          }`}
                        >
                          {score.points}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">
                          pts
                        </div>
                      </th>
                      {visibleMatches.map((m, i) => {
                        const prev = visibleMatches[i - 1];
                        const breakLeft =
                          prev &&
                          (prev.group_letter !== m.group_letter ||
                            prev.phase !== m.phase);
                        const pr = inner?.get(m.id) ?? null;
                        const cat = categorize(pr, m);
                        const pts = pointsFor(cat);
                        // Transparencia: los pronósticos de cada partido se
                        // revelan en cuanto el partido se BLOQUEA (2h antes del
                        // inicio) — ya no se pueden modificar — o cuando
                        // finaliza. Antes del bloqueo, los no-admins ven 🔒.
                        const revealed =
                          m.status === "finished" ||
                          isLocked(m.kickoff_at, now);
                        const redacted = !isAdmin && !revealed;
                        const cls = redacted
                          ? "bg-slate-50 text-slate-300"
                          : cellClasses(cat, !!pr);
                        return (
                          <td
                            key={m.id}
                            className={`border-b border-slate-100 px-1 py-1.5 text-center font-bold tabular-nums ${cls} ${
                              breakLeft ? "border-l-2 border-l-brand-300" : ""
                            }`}
                            title={
                              redacted
                                ? "Se revelará cuando el partido se bloquee (2h antes del inicio)"
                                : pr
                                ? cat === "pending"
                                  ? "Partido aún no finalizado"
                                  : `${pts} pt${pts === 1 ? "" : "s"}`
                                : "Sin pronóstico"
                            }
                          >
                            {redacted ? (
                              <span className="text-slate-300">🔒</span>
                            ) : pr ? (
                              <div className="flex flex-col items-center leading-none gap-0.5">
                                <span className="text-[12px]">
                                  {pr.home_score}–{pr.away_score}
                                </span>
                                {cat !== "pending" && (
                                  <span className="text-[9px] font-extrabold opacity-80">
                                    +{pts}
                                  </span>
                                )}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2 text-[11px] text-slate-500 border-t border-slate-200 bg-slate-50/60 flex flex-wrap gap-x-4 gap-y-1">
            <span>{visiblePollas.length} pollas · {visibleMatches.length} partidos</span>
            <span className="ml-auto">Hora Colombia (UTC−5)</span>
          </div>
        </div>
      )}
    </div>
  );
}
