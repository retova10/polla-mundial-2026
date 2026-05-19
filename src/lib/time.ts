import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";
import { isDemoMode } from "./demo";

export const COLOMBIA_TZ = "America/Bogota";

export function toColombia(iso: string): Date {
  return toZonedTime(new Date(iso), COLOMBIA_TZ);
}

export function formatColombiaDate(iso: string): string {
  const d = toColombia(iso);
  return format(d, "EEEE d 'de' MMMM, yyyy", { locale: es });
}

export function formatColombiaTime(iso: string): string {
  const d = toColombia(iso);
  return format(d, "h:mm a", { locale: es });
}

export function formatColombiaShort(iso: string): string {
  const d = toColombia(iso);
  return format(d, "EEE d MMM, h:mm a", { locale: es });
}

/** Devuelve true si quedan menos de 2h (o ya pasó) hasta el kickoff. */
export function isLocked(kickoffIso: string, now: Date = new Date()): boolean {
  if (isDemoMode()) return false;
  const kickoff = new Date(kickoffIso).getTime();
  return now.getTime() >= kickoff - 2 * 60 * 60 * 1000;
}

/** Tiempo restante hasta el bloqueo, en milisegundos. Negativo si ya bloqueado. */
export function msUntilLock(kickoffIso: string, now: Date = new Date()): number {
  if (isDemoMode()) return Number.POSITIVE_INFINITY;
  const kickoff = new Date(kickoffIso).getTime();
  return kickoff - 2 * 60 * 60 * 1000 - now.getTime();
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Bloqueado";
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
