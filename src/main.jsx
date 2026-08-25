import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SplashScreen } from '@capacitor/splash-screen'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary'

// Red de seguridad del splash nativo.
//
// capacitor.config.json usa `launchAutoHide: false` para que el splash NO se
// esconda solo a los 500 ms: así cubre el arranque entero y el usuario ya no ve
// la secuencia "splash → WebView en blanco → Sincronizando… → app" como si
// fueran tres pantallas distintas. Quien lo oculta es App.jsx, cuando la sesión
// ya está resuelta.
//
// El riesgo de ese cambio es el caso contrario: si App.jsx nunca llega a
// ejecutarse (error al evaluar el bundle, fallo de arranque de React), nadie
// llamaría a hide() y la app se quedaría clavada en el splash PARA SIEMPRE.
// Este temporizador vive fuera de React justo para eso: pase lo que pase, a los
// 12 s el splash se retira y el usuario ve la app o el error, nunca un logo
// congelado. Es deliberadamente más largo que el safety timeout de useAuth
// (10 s), para que en un arranque lento normal gane aquel y no este.
setTimeout(() => {
  SplashScreen.hide().catch(() => {});
}, 12000);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
