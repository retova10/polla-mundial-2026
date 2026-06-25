import { format } from "date-fns";
import type { Match } from "../types/database";
import { getCountry, getFlagUrl, isSquareFlag } from "../data/countries";
import { toColombia } from "../lib/time";

interface Props {
  matches: Match[];
}

// Qué dos partidos alimentan cada cruce (por match_number oficial FIFA).
// Las hojas (dieciseisavos 73–88) no tienen feeders.
const FEEDS: Record<number, [number, number]> = {
  104: [101, 102],
  101: [97, 98],
  102: [99, 100],
  97: [89, 90],
  98: [93, 94],
  99: [91, 92],
  100: [95, 96],
  89: [74, 77],
  90: [73, 75],
  93: [83, 84],
  94: [81, 82],
  91: [76, 78],
  92: [79, 80],
  95: [86, 88],
  96: [85, 87],
};

const FINAL_NUMBER = 104;
const THIRD_NUMBER = 103;
const LEFT_SEMI = 101;
const RIGHT_SEMI = 102;

// Etiqueta compacta de un placeholder (cuando el equipo aún no se define).
//   "3A/3B/3C/3D/3F" → "3ABCDF" · "Ganador 73" → "G73" · "Perdedor 101" → "P101"
function shortToken(token: string): string {
  if (token.includes("/")) {
    // "3A/3B/3C/3D/3F" → "3ABCDF" (un solo "3" + las letras de grupo).
    return "3" + token.split("/").map((t) => t.replace(/[^A-L]/g, "")).join("");
  }
  const g = /^Ganador (\d+)$/.exec(token);
  if (g) return `G${g[1]}`;
  const p = /^Perdedor (\d+)$/.exec(token);
  if (p) return `P${p[1]}`;
  return token; // posición de grupo: 1F, 2C, …
}

function TeamLine({
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
  const label = country ? country.fifa : shortToken(name);
  return (
    <div
      className={`flex items-center gap-1.5 px-1.5 py-1 ${
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
        className={`truncate text-[11px] flex-1 ${
          country
            ? `font-bold ${isWinner ? "text-slate-900" : "text-slate-600"}`
            : "font-mono text-slate-400 text-[10px]"
        }`}
        title={name}
      >
        {label}
      </span>
      <span className="font-extrabold tabular-nums text-slate-900 text-xs w-3 text-center flex-shrink-0">
        {score ?? ""}
      </span>
    </div>
  );
}

function MatchCard({ match, highlight }: { match: Match; highlight?: "final" }) {
  const decided =
    match.status === "finished" &&
    match.home_score !== null &&
    match.away_score !== null;
  const homeWins = decided && (match.home_score as number) > (match.away_score as number);
  const awayWins = decided && (match.away_score as number) > (match.home_score as number);

  return (
    <div
      className={`kc-card rounded-lg shadow-soft overflow-hidden ${
        highlight === "final"
          ? "ring-2 ring-gold-300 bg-gradient-to-b from-gold-50/70 to-white"
          : "ring-1 ring-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between px-1.5 pt-1 pb-0.5">
        <span className="text-[8px] font-mono text-slate-300">
          P{match.match_number}
        </span>
        <span className="text-[8px] text-slate-400 tabular-nums">
          {format(toColombia(match.kickoff_at), "dd/MM HH:mm")}
        </span>
      </div>
      <div className="divide-y divide-slate-100 border-t border-slate-100">
        <TeamLine
          name={match.home_team}
          isPlaceholder={match.home_is_placeholder}
          score={decided ? match.home_score : null}
          isWinner={homeWins}
          decided={decided}
        />
        <TeamLine
          name={match.away_team}
          isPlaceholder={match.away_is_placeholder}
          score={decided ? match.away_score : null}
          isWinner={awayWins}
          decided={decided}
        />
      </div>
    </div>
  );
}

// Renderiza recursivamente una mitad del cuadro hacia un lado. En la mitad
// izquierda los feeders van a la izquierda de cada cruce; en la derecha, a la
// derecha (efecto espejo). Los conectores tipo llave los dibuja el CSS
// (.kc-node / .kc-child) apoyándose en que cada hijo ocupa flex:1.
function Branch({
  number,
  side,
  byNumber,
}: {
  number: number;
  side: "left" | "right";
  byNumber: Map<number, Match>;
}) {
  const match = byNumber.get(number);
  const feeds = FEEDS[number];

  const card = match ? (
    <MatchCard match={match} />
  ) : (
    <div className="kc-card rounded-lg ring-1 ring-slate-200 bg-slate-50 h-[44px]" />
  );

  if (!feeds) {
    // Hoja (dieciseisavos): solo la tarjeta.
    return <div className="kc-leaf">{card}</div>;
  }

  const children = (
    <div className="kc-children">
      <div className="kc-child">
        <Branch number={feeds[0]} side={side} byNumber={byNumber} />
      </div>
      <div className="kc-child">
        <Branch number={feeds[1]} side={side} byNumber={byNumber} />
      </div>
    </div>
  );

  return (
    <div className={`kc-node ${side === "right" ? "kc-node--right" : ""}`}>
      {children}
      <div className="kc-card-wrap">{card}</div>
    </div>
  );
}

export default function KnockoutBracket({ matches }: Props) {
  const byNumber = new Map<number, Match>();
  matches.forEach((m) => byNumber.set(m.match_number, m));

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

  const finalMatch = byNumber.get(FINAL_NUMBER);
  const thirdMatch = byNumber.get(THIRD_NUMBER);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="font-display font-extrabold text-lg text-slate-900 flex items-center gap-2">
          🏆 Cuadro de eliminación
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          El cuadro se llena con los equipos clasificados y los resultados.
          Desplázate horizontalmente para recorrer todo el bracket.
        </p>
      </div>

      <div className="card p-4 overflow-x-auto">
        <div className="kc-bracket">
          {/* Mitad izquierda */}
          <Branch number={LEFT_SEMI} side="left" byNumber={byNumber} />

          {/* Centro: Final + tercer puesto */}
          <div className="kc-center">
            <div className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Final
            </div>
            {finalMatch ? (
              <MatchCard match={finalMatch} highlight="final" />
            ) : null}
            <div className="text-center text-[10px] font-semibold uppercase tracking-wide text-amber-600 mt-4 mb-1">
              🥉 Tercer puesto
            </div>
            {thirdMatch ? <MatchCard match={thirdMatch} /> : null}
          </div>

          {/* Mitad derecha */}
          <Branch number={RIGHT_SEMI} side="right" byNumber={byNumber} />
        </div>
      </div>
    </div>
  );
}
