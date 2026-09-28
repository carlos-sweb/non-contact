# non-contact (UI)

App Android para **abrir un chat de WhatsApp sin guardar el contacto**.

- Producto y descarga: [README del repo](https://github.com/carlos-sweb/non-contact#readme) · [APK latest](https://github.com/carlos-sweb/non-contact/releases/latest/download/app-release.apk)
- Stack: [Lynx](https://lynxjs.org) + [Mithril](https://mithril.js.org) vía [`mithril-lynx`](https://github.com/carlos-sweb/mithril-lynx)

## Desarrollo

```bash
npm install
npm run dev      # QR con LynxExplorer / Lynx Go
npm run build    # bundle en dist/
```

- `src/main-thread.ts` — runtime main-thread (`setupRenderer()`).
- `src/background.ts` — montaje de la app (`renderApp()`), rutas y vistas.
- Docs del framework: [mithril-lynx README](https://github.com/carlos-sweb/mithril-lynx#readme).

## Android (APK)

El host nativo está en `../non-contact-android/` (`com.example.noncontact`).

```bash
npm run android          # build + sync + install + launch
npm run android:apk      # assembleDebug
npm run android:sync     # bundle → assets
npm run android:release  # assembleRelease (con keystore.properties)
```

Fuente JetBrains Mono: en **dev** (Lynx Go) se inlinea como `data:` URI; en **prod** (APK) se resuelve con `asset:///fonts/…` vía `AssetFontFaceLoader` en el host.
