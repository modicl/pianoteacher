import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// El iPad (Safari/Chrome en iOS usan WebKit) puede tener un iPadOS más viejo que el PC:
// se traduce la sintaxis moderna tanto al compilar como en el servidor de desarrollo.
const target = 'es2019'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  oxc: { target },
  build: { target },
  // visible desde otros equipos de la red (el iPad)
  // Safari guarda copias agresivamente: sin esto puede quedarse con un index.html viejo que apunta a archivos que ya no existen
  server: { host: true, headers: { 'Cache-Control': 'no-cache' } },
  preview: { host: true, headers: { 'Cache-Control': 'no-cache' } },
})
