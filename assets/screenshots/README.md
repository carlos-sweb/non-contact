# Screenshots

Capturas reales desde un Samsung SM-A075M con non-contact **1.1.1**.
Barra de estado y barra de navegación del sistema recortadas.

| Archivo | Pantalla |
|---|---|
| `light/dialer.png` / `dark/dialer.png` | Dialer con `+56` y `912345678` |
| `light/countries.png` / `dark/countries.png` | País/código, búsqueda “Chile” |
| `light/history.png` / `dark/history.png` | Historial (vacío en este dispositivo) |
| `light/scanner.png` / `dark/scanner.png` | Escáner QR nativo |

**Nota escáner:** `adb screencap` no captura el preview de cámara (`PreviewView` / SurfaceView). La UI del escáner (marco, X, “Apunta al código QR”) es real; el área del preview es una composición ilustrativa: cartel “Se perdió mi perrito” con QR de ejemplo (`+56912345678`). Light/dark comparten la misma imagen (Activity nativa, sin tema Lynx).
