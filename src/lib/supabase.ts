import { createClient, type PostgrestError } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env. " +
      "Copia .env.example a .env y completa con los valores de tu proyecto Supabase."
  );
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Trae TODAS las filas de una tabla paginando en lotes. PostgREST limita cada
// respuesta a "Max rows" (1000 por defecto), así que `select("*")` se trunca
// silenciosamente en tablas grandes —p. ej. `predictions`, que crece con
// pollas × partidos— y deja huecos en la matriz. Aquí pedimos rangos sucesivos
// hasta que un lote venga incompleto (señal de que ya no hay más).
export async function fetchAllRows<T>(
  table: string,
  options: {
    columns?: string;
    orderBy?: string;
    ascending?: boolean;
    pageSize?: number;
  } = {}
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  const {
    columns = "*",
    orderBy = "id",
    ascending = true,
    pageSize = 1000,
  } = options;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      // Orden estable por una columna única: garantiza que los rangos no se
      // solapen ni dejen huecos entre lotes.
      .order(orderBy, { ascending })
      .range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const batch = (data ?? []) as T[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return { data: all, error: null };
}
