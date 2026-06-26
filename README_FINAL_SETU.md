# SETU - Versión final Firebase + PWA

Esta versión conserva la conexión con Firebase y agrega configuración PWA completa con íconos, manifest, screenshots, service worker y shortcuts.

## Ejecutar en desarrollo

```powershell
npm install --legacy-peer-deps
npm start
```

Abre:

```text
http://localhost:4200
```

## Probar PWA localmente

```powershell
npm run build
cd dist/SETU-Proyect/browser
npx http-server -p 8080
```

Abre:

```text
http://127.0.0.1:8080
```

Luego revisa en Chrome DevTools:

- Application > Manifest
- Application > Service Workers
- Lighthouse

## Firebase Hosting

```powershell
npm run build
firebase deploy
```

El archivo `firebase.json` publica desde:

```text
dist/SETU-Proyect/browser
```

## Archivos PWA incluidos

- `public/manifest.webmanifest`
- `public/icons/icon-192x192.png`
- `public/icons/icon-512x512.png`
- `public/icons/maskable-icon-512x512.png`
- `public/screenshots/dashboard-desktop.png`
- `public/screenshots/dashboard-mobile.png`
- `ngsw-config.json`

## Conexión de datos

La aplicación mantiene Firebase como modo principal. El modo local queda disponible solo como apoyo de pruebas, pero la conexión esperada para producción es Firebase.
