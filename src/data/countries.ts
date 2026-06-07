// 48 selecciones del Mundial 2026 (sorteo final FIFA, 5 dic 2025).
// Cada país tiene: nombre canónico en español, código ISO 3166-1 alfa-2
// (en minúsculas, para flagcdn.com), bombo FIFA y aliases.

export interface Country {
  name: string;       // nombre canónico en español
  code: string;       // ISO alpha-2 minúsculas (para flagcdn.com)
  fifa: string;       // código FIFA oficial de 3 letras (mayúsculas)
  pot: 1 | 2 | 3 | 4; // bombo del sorteo
  aliases?: string[]; // otras formas en que puede venir escrito
}

export const COUNTRIES: Country[] = [
  // Bombo 1: anfitriones + top FIFA
  { name: "México",            code: "mx",     fifa: "MEX", pot: 1, aliases: ["Mexico"] },
  { name: "Canadá",            code: "ca",     fifa: "CAN", pot: 1, aliases: ["Canada"] },
  { name: "Estados Unidos",    code: "us",     fifa: "USA", pot: 1, aliases: ["USA", "EE.UU.", "EEUU", "Estados Unidos de América"] },
  { name: "España",            code: "es",     fifa: "ESP", pot: 1, aliases: ["Spain"] },
  { name: "Argentina",         code: "ar",     fifa: "ARG", pot: 1 },
  { name: "Francia",           code: "fr",     fifa: "FRA", pot: 1, aliases: ["France"] },
  { name: "Inglaterra",        code: "gb-eng", fifa: "ENG", pot: 1, aliases: ["England"] },
  { name: "Brasil",            code: "br",     fifa: "BRA", pot: 1, aliases: ["Brazil"] },
  { name: "Portugal",          code: "pt",     fifa: "POR", pot: 1 },
  { name: "Países Bajos",      code: "nl",     fifa: "NED", pot: 1, aliases: ["Netherlands", "Holanda"] },
  { name: "Bélgica",           code: "be",     fifa: "BEL", pot: 1, aliases: ["Belgium"] },
  { name: "Alemania",          code: "de",     fifa: "GER", pot: 1, aliases: ["Germany"] },

  // Bombo 2
  { name: "Croacia",           code: "hr",     fifa: "CRO", pot: 2, aliases: ["Croatia"] },
  { name: "Marruecos",         code: "ma",     fifa: "MAR", pot: 2, aliases: ["Morocco"] },
  { name: "Colombia",          code: "co",     fifa: "COL", pot: 2 },
  { name: "Uruguay",           code: "uy",     fifa: "URU", pot: 2 },
  { name: "Suiza",             code: "ch",     fifa: "SUI", pot: 2, aliases: ["Switzerland"] },
  { name: "Japón",             code: "jp",     fifa: "JPN", pot: 2, aliases: ["Japan", "Japon"] },
  { name: "Senegal",           code: "sn",     fifa: "SEN", pot: 2 },
  { name: "Irán",              code: "ir",     fifa: "IRN", pot: 2, aliases: ["Iran"] },
  { name: "Corea del Sur",     code: "kr",     fifa: "KOR", pot: 2, aliases: ["South Korea", "Korea Republic", "República de Corea"] },
  { name: "Ecuador",           code: "ec",     fifa: "ECU", pot: 2 },
  { name: "Austria",           code: "at",     fifa: "AUT", pot: 2 },
  { name: "Australia",         code: "au",     fifa: "AUS", pot: 2 },

  // Bombo 3
  { name: "Noruega",           code: "no",     fifa: "NOR", pot: 3, aliases: ["Norway"] },
  { name: "Panamá",            code: "pa",     fifa: "PAN", pot: 3, aliases: ["Panama"] },
  { name: "Egipto",            code: "eg",     fifa: "EGY", pot: 3, aliases: ["Egypt"] },
  { name: "Argelia",           code: "dz",     fifa: "ALG", pot: 3, aliases: ["Algeria"] },
  { name: "Escocia",           code: "gb-sct", fifa: "SCO", pot: 3, aliases: ["Scotland"] },
  { name: "Paraguay",          code: "py",     fifa: "PAR", pot: 3 },
  { name: "Túnez",             code: "tn",     fifa: "TUN", pot: 3, aliases: ["Tunisia", "Tunez"] },
  { name: "Costa de Marfil",   code: "ci",     fifa: "CIV", pot: 3, aliases: ["Ivory Coast", "Côte d'Ivoire"] },
  { name: "Arabia Saudita",    code: "sa",     fifa: "KSA", pot: 3, aliases: ["Saudi Arabia"] },
  { name: "Sudáfrica",         code: "za",     fifa: "RSA", pot: 3, aliases: ["South Africa", "Sudafrica"] },
  { name: "Catar",             code: "qa",     fifa: "QAT", pot: 3, aliases: ["Qatar"] },
  { name: "Uzbekistán",        code: "uz",     fifa: "UZB", pot: 3, aliases: ["Uzbekistan"] },

  // Bombo 4
  { name: "Nueva Zelanda",     code: "nz",     fifa: "NZL", pot: 4, aliases: ["New Zealand"] },
  { name: "Curazao",           code: "cw",     fifa: "CUW", pot: 4, aliases: ["Curaçao", "Curacao"] },
  { name: "Cabo Verde",        code: "cv",     fifa: "CPV", pot: 4, aliases: ["Cape Verde"] },
  { name: "Jordania",          code: "jo",     fifa: "JOR", pot: 4, aliases: ["Jordan"] },
  { name: "Iraq",              code: "iq",     fifa: "IRQ", pot: 4, aliases: ["Irak"] },
  { name: "Ghana",             code: "gh",     fifa: "GHA", pot: 4 },
  { name: "Haití",             code: "ht",     fifa: "HAI", pot: 4, aliases: ["Haiti"] },
  { name: "Suecia",            code: "se",     fifa: "SWE", pot: 4, aliases: ["Sweden"] },
  { name: "Chequia",           code: "cz",     fifa: "CZE", pot: 4, aliases: ["Czech Republic", "Czechia", "República Checa", "Republica Checa"] },
  { name: "Bosnia y Herzegovina", code: "ba",  fifa: "BIH", pot: 4, aliases: ["Bosnia", "Bosnia & Herzegovina", "Bosnia and Herzegovina"] },
  { name: "Turquía",           code: "tr",     fifa: "TUR", pot: 4, aliases: ["Turkey", "Türkiye", "Turquia"] },
  { name: "RD Congo",          code: "cd",     fifa: "COD", pot: 4, aliases: ["DR Congo", "Congo", "República Democrática del Congo", "Republica Democratica del Congo", "Congo DR"] },
];

const NORMALIZE = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .trim();

const LOOKUP: Map<string, Country> = (() => {
  const m = new Map<string, Country>();
  for (const c of COUNTRIES) {
    m.set(NORMALIZE(c.name), c);
    if (c.aliases) for (const a of c.aliases) m.set(NORMALIZE(a), c);
  }
  return m;
})();

export function getCountry(teamName: string): Country | null {
  if (!teamName) return null;
  return LOOKUP.get(NORMALIZE(teamName)) ?? null;
}

// Banderas cuadradas renderizadas como SVG inline en vez de PNG de flagcdn.
// flagcdn devuelve el PNG correcto, pero al escalar a tamaños pequeños
// (32×32 o menos), las franjas finas se diluyen y la franja roja inferior
// de Suiza llega a desaparecer. El SVG escala perfecto a cualquier tamaño.
//
// Suiza: proporciones según la Ley Federal sobre la protección de los
// escudos públicos y otros signos públicos.
const SQUARE_FLAG_SVGS: Record<string, string> = {
  ch:
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" fill="#DA291C"/>` +
    `<rect x="13" y="6" width="6" height="20" fill="#FFFFFF"/>` +
    `<rect x="6" y="13" width="20" height="6" fill="#FFFFFF"/>` +
    `</svg>`,
};

const SQUARE_FLAG_CODES = new Set(Object.keys(SQUARE_FLAG_SVGS));

/** URL de bandera. height en px (20, 24, 40, 60, 80). Para banderas
 *  cuadradas devuelve un data URL con SVG inline (resolución infinita). */
export function getFlagUrl(teamName: string, height: number = 40): string | null {
  const c = getCountry(teamName);
  if (!c) return null;
  const svg = SQUARE_FLAG_SVGS[c.code];
  if (svg) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
  return `https://flagcdn.com/h${height}/${c.code}.png`;
}

/** True si la bandera del equipo es cuadrada (Suiza). */
export function isSquareFlag(teamName: string): boolean {
  const c = getCountry(teamName);
  return c ? SQUARE_FLAG_CODES.has(c.code) : false;
}
