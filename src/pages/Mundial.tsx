import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Match, MatchStatus } from "../types/database";
import StandingsTable from "../components/StandingsTable";
import LiveMatchCard from "../components/LiveMatchCard";
import Leaderboard from "../components/Leaderboard";
import KnockoutBracket from "../components/KnockoutBracket";
import { isMatchLive } from "../lib/standings";
import { isDemoMode } from "../lib/demo";
import { useAuth } from "../lib/AuthContext";
import { toast } from "../lib/notifications";

type Tab = "leaderboard" | "standings" | "bracket" | "live" | "results";

export default function Mundial() {
  const { profile } = useAuth();
  const canEditStatus = isDemoMode() && profile?.role === "admin";
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("leaderboard");
  const [now, setNow] = useState(new Date());

  const cycleStatus = useCallback(
    async (matchId: string, next: MatchStatus) => {
      const { error } = await supabase
        .from("matches")
        .update({ status: next })
        .eq("id", matchId);
      if (error) {
        toast.error(`No se pudo cambiar el estatus: ${error.message}`);
      } else {
        toast.success(`Estatus actualizado a "${next}"`);
      }
      // El realtime suscrito a UPDATE de matches refresca el estado local.
    },
    []
  );

  const buildCycleHandler = useCallback(
    (matchId: string) =>
      canEditStatus
        ? (next: MatchStatus) => cycleStatus(matchId, next)
        : undefined,
    [canEditStatus, cycleStatus]
  );

  // Cargar partidos + suscribirse a cambios en tiempo real
  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .order("match_number", { ascending: true });
      if (!mounted) return;
      if (error) setError(error.message);
      else setMatches((data ?? []) as Match[]);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("matches-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          const updated = payload.new as Match;
          setMatches((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Tick para actualizar "live" status sin reload
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const groupLetters = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => m.group_letter && set.add(m.group_letter));
    return Array.from(set).sort();
  }, [matches]);

  const liveMatches = useMemo(
    () => matches.filter((m) => isMatchLive(m, now)),
    [matches, now]
  );
  const recentlyFinished = useMemo(
    () =>
      matches
        .filter(
          (m) =>
            m.status === "finished" &&
            m.home_score !== null &&
            m.away_score !== null
        )
        .sort((a, b) => +new Date(b.kickoff_at) - +new Date(a.kickoff_at))
        .slice(0, 6),
    [matches]
  );
  const upcomingNext = useMemo(
    () =>
      matches
        .filter(
          (m) =>
            m.status !== "finished" &&
            !isMatchLive(m, now) &&
            !m.home_is_placeholder &&
            !m.away_is_placeholder &&
            new Date(m.kickoff_at).getTime() > now.getTime()
        )
        .sort((a, b) => +new Date(a.kickoff_at) - +new Date(b.kickoff_at))
        .slice(0, 6),
    [matches, now]
  );
  const allFinished = useMemo(
    () =>
      matches
        .filter(
          (m) =>
            m.status === "finished" &&
            m.home_score !== null &&
            m.away_score !== null
        )
        .sort((a, b) => +new Date(b.kickoff_at) - +new Date(a.kickoff_at)),
    [matches]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-slate-900">
          Mundial <span className="text-brand-600">2026</span>
        </h1>
        <p className="text-slate-500 mt-1.5">
          Sigue los partidos en vivo, los resultados y la tabla de posiciones.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-px overflow-x-auto">
        <TabBtn active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>
          🏆 Ranking jugadores
        </TabBtn>
        <TabBtn active={tab === "standings"} onClick={() => setTab("standings")}>
          📊 Tabla por grupos
        </TabBtn>
        <TabBtn active={tab === "bracket"} onClick={() => setTab("bracket")}>
          🏆 Fase final
        </TabBtn>
        <TabBtn active={tab === "live"} onClick={() => setTab("live")}>
          {liveMatches.length > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              En vivo ({liveMatches.length})
            </span>
          ) : (
            "📺 En vivo"
          )}
        </TabBtn>
        <TabBtn active={tab === "results"} onClick={() => setTab("results")}>
          ⚽ Resultados
        </TabBtn>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12">Cargando…</div>
      ) : error ? (
        <div className="card p-6 text-rose-600 border-rose-200 bg-rose-50">
          {error}
        </div>
      ) : tab === "leaderboard" ? (
        <Leaderboard matches={matches} />
      ) : tab === "standings" ? (
        <StandingsTab matches={matches} groupLetters={groupLetters} />
      ) : tab === "bracket" ? (
        <KnockoutBracket matches={matches} />
      ) : tab === "live" ? (
        <LiveTab
          live={liveMatches}
          recent={recentlyFinished}
          upcoming={upcomingNext}
          buildCycleHandler={buildCycleHandler}
        />
      ) : (
        <ResultsTab
          finished={allFinished}
          buildCycleHandler={buildCycleHandler}
        />
      )}
    </div>
  );
}

function TabBtn({
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
      className={`px-4 py-2.5 rounded-t-xl font-semibold text-sm transition-colors -mb-px border-b-2 ${
        active
          ? "border-brand-500 text-brand-700 bg-white"
          : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function StandingsTab({
  matches,
  groupLetters,
}: {
  matches: Match[];
  groupLetters: string[];
}) {
  if (groupLetters.length === 0) {
    return (
      <div className="card p-12 text-center text-slate-400">
        Aún no hay datos de fase de grupos.
      </div>
    );
  }
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {groupLetters.map((letter) => (
        <StandingsTable
          key={letter}
          groupLetter={letter}
          matches={matches.filter(
            (m) => m.phase === "group" && m.group_letter === letter
          )}
        />
      ))}
    </div>
  );
}

function LiveTab({
  live,
  recent,
  upcoming,
  buildCycleHandler,
}: {
  live: Match[];
  recent: Match[];
  upcoming: Match[];
  buildCycleHandler: (matchId: string) => ((next: MatchStatus) => Promise<void>) | undefined;
}) {
  return (
    <div className="space-y-8">
      <Section
        title="En vivo"
        emoji="🔴"
        empty="No hay partidos jugándose en este momento."
      >
        {live.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {live.map((m) => (
              <LiveMatchCard
                key={m.id}
                match={m}
                variant="live"
                onCycleStatus={buildCycleHandler(m.id)}
              />
            ))}
          </div>
        ) : null}
      </Section>

      <Section
        title="Próximos partidos"
        emoji="⏭️"
        empty="No hay partidos próximos por jugar."
      >
        {upcoming.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {upcoming.map((m) => (
              <LiveMatchCard
                key={m.id}
                match={m}
                variant="upcoming"
                onCycleStatus={buildCycleHandler(m.id)}
              />
            ))}
          </div>
        ) : null}
      </Section>

      <Section
        title="Recién finalizados"
        emoji="🏁"
        empty="Aún no hay resultados."
      >
        {recent.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {recent.map((m) => (
              <LiveMatchCard
                key={m.id}
                match={m}
                variant="result"
                onCycleStatus={buildCycleHandler(m.id)}
              />
            ))}
          </div>
        ) : null}
      </Section>
    </div>
  );
}

function ResultsTab({
  finished,
  buildCycleHandler,
}: {
  finished: Match[];
  buildCycleHandler: (matchId: string) => ((next: MatchStatus) => Promise<void>) | undefined;
}) {
  if (finished.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-3">⚽</div>
        <h3 className="font-bold text-slate-900 text-lg">
          Todavía no hay resultados
        </h3>
        <p className="text-slate-500 mt-1">
          Cuando termine el primer partido y el admin ingrese el marcador,
          aparecerá aquí.
        </p>
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {finished.map((m) => (
        <LiveMatchCard
          key={m.id}
          match={m}
          variant="result"
          onCycleStatus={buildCycleHandler(m.id)}
        />
      ))}
    </div>
  );
}

function Section({
  title,
  emoji,
  empty,
  children,
}: {
  title: string;
  emoji: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasContent = !!children && Array.isArray((children as any).props?.children)
    ? true
    : !!children;
  return (
    <section>
      <h2 className="flex items-center gap-2 mb-3 font-display font-extrabold text-xl text-slate-900">
        <span>{emoji}</span>
        {title}
      </h2>
      {hasContent ? (
        children
      ) : (
        <div className="card p-8 text-center text-slate-400">{empty}</div>
      )}
    </section>
  );
}
