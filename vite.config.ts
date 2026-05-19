import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Aislar tests del .env real: el modo demo no debe estar activo por defecto
    // en la suite. Tests que necesiten demo=true usan vi.stubEnv explícitamente.
    env: {
      VITE_DEMO_MODE: 'false',
    },
  },
})
