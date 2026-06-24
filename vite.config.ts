import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
        }
      }
    }
  }
})
