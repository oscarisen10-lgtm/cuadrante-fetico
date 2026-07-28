# App Check — estado y cómo activarlo

**Estado a 28-jul-2026: PREPARADO, NO ACTIVADO.** Es el único punto de seguridad
que la auditoría dejó abierto a propósito, porque activarlo mal deja la app
inservible para todos los usuarios.

## Qué aporta

App Check hace que Firebase (Functions, Firestore, Storage) rechace peticiones que
no vengan de una instancia legítima de *esta* app. Hoy, cualquiera con una cuenta
válida puede llamar a las Cloud Functions con un script en vez de con la app.

Conviene entender el alcance real: **las funciones ya comprueban permisos** (admin
por custom-claim, delegado por tienda autorizada), así que sin App Check nadie
consigue datos que no le correspondan. Lo que App Check añade es evitar el *abuso*
—por ejemplo, quemar la cuota de Gemini o hacer scraping con una cuenta legítima—,
no un agujero de autorización.

## ⚠️ El problema con las apps nativas (léelo antes de nada)

Esta app es Capacitor: en iOS y Android el SDK de Firebase corre dentro de un
WebView, **no** como SDK nativo. Y ahí está el problema:

- La atestación nativa (App Attest/DeviceCheck en iOS, Play Integrity en Android)
  la hace el SDK **nativo**, al que el WebView no llega por sí solo.
- reCAPTCHA v3 (lo que usa `src/firebase.js` hoy) es un proveedor **solo web**.

Es decir: **activar el enforcement ahora bloquearía a todos los usuarios de iOS y
Android**, que son la mayoría. No es un simple cambio de flag.

Para cubrir el nativo hace falta un plugin de Capacitor que ejecute la atestación
nativa y pase el token al SDK de JavaScript mediante un *custom provider*. Antes de
comprometerse, hay que verificar que el plugin elegido siga mantenido y sea
compatible con Capacitor 8, que es la versión de este proyecto.

## Orden de activación (sin romper nada)

1. **Firebase Console → App Check → Apps.** Registrar:
   - App **web** con proveedor reCAPTCHA v3 → guardar la clave de sitio.
   - App **iOS** con App Attest y app **Android** con Play Integrity (solo sirven
     si se resuelve antes lo del punto anterior).
2. **Poner la clave en el cliente**: `VITE_APPCHECK_SITE_KEY` en el `.env` local y
   en el grupo `firebase_config` de Codemagic. Con la clave presente,
   `src/firebase.js` inicializa App Check solo en web (ver el bloque condicional
   de ese fichero); sin ella queda inerte, que es el estado actual.
3. **Publicar una release** con esa clave y esperar a que los usuarios actualicen.
4. **Mirar las métricas** en Console → App Check → durante días, no horas. La
   pantalla distingue peticiones verificadas de no verificadas. **No pasar al paso
   siguiente mientras haya tráfico legítimo sin verificar**: ese tráfico es
   exactamente el que se quedaría fuera.
5. **Activar el enforcement** cuando las métricas estén limpias:
   ```
   # functions/.env.mi-calendario-fe
   APPCHECK_ENFORCE=true
   ```
   y redesplegar (`firebase deploy --only functions`). El flag lo lee
   `functions/lib/firebase.js` y se aplica a todas las callables a la vez.
6. **Volver atrás** si algo falla: quitar la línea (o ponerla a `false`) y
   redesplegar. El efecto es inmediato y no hay que tocar los clientes.

## Cómo está montado en el código

- `functions/lib/firebase.js` exporta `ENFORCE_APP_CHECK`, leído de
  `process.env.APPCHECK_ENFORCE`. Todas las callables lo reciben en
  `enforceAppCheck`, así que **no hay que tocar función por función**.
- `src/firebase.js` importa `firebase/app-check` de forma **dinámica** y solo si
  hay clave: mientras no se configure, no engorda el bundle ni se ejecuta.

## Si se decide no activarlo

Es una decisión legítima para una app interna de plantilla conocida, con
autorización ya resuelta en reglas y backend. En ese caso conviene, como mínimo,
vigilar la factura de Gemini: la cuota de 10 preguntas/día por usuario
(`functions/asistente.js`) es hoy la protección real contra el abuso de la IA.
