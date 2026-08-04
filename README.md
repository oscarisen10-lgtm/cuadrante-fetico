# Mi Cuadrante ANGED

App de registro horario y control de convenio para trabajadores de Supercor, S. Romero,
S. Express y ECI. React + Vite en web, empaquetada con Capacitor para iOS y Android.
Backend en Firebase (Auth, Firestore, Storage, Cloud Functions, FCM).

> Este README describía la plantilla genérica de Vite y documentaba unos
> `tsconfig.*.json` que ya no existen. El proyecto es **JavaScript/JSX**, no TypeScript.

## Comandos

```bash
npm run dev          # servidor de desarrollo (puerto 5173)
npm run build        # build de producción a dist/
npm run lint         # ESLint sobre src/, functions/, scripts/ y tests/
npm test             # tests unitarios (vitest)
npm run test:rules   # tests de reglas de Firestore (necesita el emulador y JAVA_HOME)
npm run icons        # regenera iconos/splash a partir de assets/ (bajo demanda)
```

Para `test:rules` hace falta Java 21; el proyecto trae uno en `jdk21/` (no versionado):

```bash
export JAVA_HOME="$PWD/jdk21/jdk-21.0.3+9" && export PATH="$JAVA_HOME/bin:$PATH"
```

## Estructura

```
src/
  components/     vistas y UI (calendar/ agrupa el calendario)
  hooks/          useAuth, useShifts, useTimer, useNews, useNotifications
  services/       acceso a Firebase y bus de avisos
  constants/      reglas de convenio por empresa/puesto, tiendas, licencias
  utils/          fechas, festivos, compresión de imágenes, haptics
functions/        Cloud Functions, un módulo por dominio (index.js solo reexporta)
tests/unit        lógica pura; tests/rules  reglas de seguridad de Firestore
docs/             notas operativas (p. ej. APP-CHECK.md)
```

## Configuración

El cliente lee la config de Firebase de un `.env` (no versionado) con variables
`VITE_*`. En CI, el build lo recrea desde el grupo de variables cifradas
`firebase_config` de Codemagic — nunca desde el repositorio.

## Notas

- **Versión**: `package.json` es el punto único de verdad. Vite la inyecta como
  `__APP_VERSION__` y `codemagic.yaml` la usa como *marketing version* de iOS.
- **Android** se compila a mano: tras `npm run build` hay que ejecutar
  `npx cap sync android` o el `.aab` sale con el código anterior.
- **App Check** está preparado pero **no activado**: ver `docs/APP-CHECK.md` antes
  de tocarlo (activarlo sin más dejaría fuera a los usuarios de iOS y Android).
