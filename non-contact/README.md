# non-contact

A [Lynx](https://lynxjs.org) app built with [Mithril.js](https://mithril.js.org), via [`mithril-lynx`](https://github.com/carlos-sweb/mithril-lynx).

## Getting started

```bash
npm install
npm run dev      # scan the printed QR code with LynxExplorer, or open it in Lynx Go
npm run build    # production bundle, in dist/
```

## Learn more

- `src/main-thread.ts` starts the main-thread patch-replay runtime (`setupRenderer()`) — mithril-lynx has exactly one rendering mode, so no app code lives here.
- `src/background.ts` is where the app actually mounts (`renderApp()`), running the real Mithril view tree in the background thread.
- Everything about the framework — the three reload modes, routing, networking — is documented in [`mithril-lynx`'s own README](https://github.com/carlos-sweb/mithril-lynx#readme).

## Android (native APK)

The Android host lives in `../non-contact-android/` and packages the bundle this project produces.

```bash
npm run android          # build the bundle, copy it to assets, install and launch on the device
npm run android:apk      # build the debug APK only
npm run android:sync     # bundle -> assets only, no Gradle

# Signed release APK (generate the keystore once):
KEYSTORE_PASSWORD='...' npm run android:keystore
npm run android:release
```

- Application ID: `com.example.noncontact`
- Application class: `NonContact` · Activity: `MainActivity`
- Font `JetBrains Mono` via `lynx.addFont()`, split by build mode (`import.meta.env.DEV`):
  - **dev / Lynx Go**: `require()` the `.ttf` → inlined `data:` URI (otherwise Lynx Go has nothing to resolve).
  - **production / Android APK**: `asset:///fonts/…` resolved by `AssetFontFaceLoader` from the host's `assets/fonts/` (kept in sync by `npm run android`). Avoids baking a ~60 kB base64 font into the bundle — that was what made the APK slow again after #9431's `NoopGenericResourceFetcher` fix.
