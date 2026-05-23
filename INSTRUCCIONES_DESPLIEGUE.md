# Flujo de Trabajo de Actualizaciones y Despliegues

Este documento sirve como recordatorio permanente de cómo se deben gestionar las actualizaciones de la aplicación en las distintas plataformas.

## 🍏 Apple App Store (iOS)
Para lanzar una actualización en iOS, el flujo es el siguiente:
1. **GitHub:** Subir todos los cambios realizados en el código a la rama principal (hacer `commit` y `push`).
2. **Codemagic:** El usuario se encarga de lanzar la *build* desde Codemagic, que cogerá los últimos cambios de GitHub.
3. **Apple Developer:** El usuario lanza y gestiona la actualización desde la consola de Apple.

## 🤖 Google Play Store (Android)
Para lanzar una actualización en Android, el flujo es el siguiente:
1. **Generación Local:** Se debe generar el archivo `.aab` (Android App Bundle) directamente en local usando Android Studio o mediante el comando de compilación (`gradlew bundleRelease` usando el JDK incluido).
2. **Google Play Console:** El asistente proporciona la ruta del archivo `.aab` generado (ej. `android/app/build/outputs/bundle/release/app-release.aab`) y el usuario se encarga de subirla manualmente a la consola de Google.
