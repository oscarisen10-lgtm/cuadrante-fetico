import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Versión única de verdad: la de package.json. Se inyecta como __APP_VERSION__ para que
// la etiqueta de "Versión App" en Ajustes NUNCA se desincronice del número real (antes
// era un literal escrito a mano que había que acordarse de actualizar en cada release).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Seguridad (S-6): en el build de producción se eliminan console.log/info/debug
  // (no filtran detalles internos por consola). Se conservan warn y error para
  // diagnóstico de fallos. En `vite dev` no se minifica, así que siguen visibles.
  esbuild: {
    pure: ['console.log', 'console.info', 'console.debug'],
    // Conserva los nombres de funciones y clases al minificar. Cuesta unos pocos
    // KB y es lo que hace USABLES las trazas que llegan a Crashlytics: sin esto,
    // un error reportado desde producción se lee "n is not a function en t.x",
    // que no dice nada. Crashlytics NO desminifica JavaScript (solo símbolos
    // nativos y ProGuard), así que el nombre tiene que sobrevivir al build.
    keepNames: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-core': ['firebase/app', 'firebase/auth'],
          'firebase-db': ['firebase/firestore', 'firebase/storage'],
          'firebase-msg': ['firebase/messaging'],
          'vendor': ['react', 'react-dom'],
          'icons': ['lucide-react'],
        }
      }
    }
  }
})
