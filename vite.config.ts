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
          // 3D: `three` (~600 KB) es estable y se comparte entre todos los minijuegos.
          // Aislarlo en su propio chunk hace que, cuando solo cambie el código de la app
          // entre despliegues, el usuario NO tenga que re-descargar three (queda en caché
          // por su hash). El motor de React (fiber + postprocessing) va en otro chunk.
          'three': ['three'],
          'r3f': ['@react-three/fiber', '@react-three/postprocessing'],
        }
      }
    }
  }
})
