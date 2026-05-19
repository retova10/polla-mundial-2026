// Modo demo: desactiva el gating temporal (lock de pronósticos y badge "EN VIVO"
// por ventana horaria) para poder ensayar el cálculo de puntos y el orden de la
// tabla colocando marcadores manualmente desde AdminScores.
//
// Activación: definir VITE_DEMO_MODE=true en .env.local y reiniciar `npm run dev`.

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}
