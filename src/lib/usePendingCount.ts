import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext";

/**
 * Hook que devuelve la cantidad de jugadores pendientes de aprobación.
 * Solo consulta si el usuario actual es admin. Refresca cada 60s.
 */
export function usePendingCount(): number {
  const { profile } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (profile?.role !== "admin") {
      setCount(0);
      return;
    }
    let mounted = true;

    async function fetchCount() {
      const { count: c, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_approved", false)
        .eq("role", "player");
      if (!mounted || error) return;
      setCount(c ?? 0);
    }

    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [profile?.role]);

  return count;
}
