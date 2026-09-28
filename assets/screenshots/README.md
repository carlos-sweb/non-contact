# Screenshots

Capturas reales desde un Samsung SM-A075M con non-contact **1.1.1**.
Barra de estado y barra de navegación del sistema recortadas.

| Archivo | Pantalla |
|---|---|
| `light/dialer.png` / `dark/dialer.png` | Dialer con `+56` y `912345678` |
| `light/countries.png` / `dark/countries.png` | País/código, búsqueda “Chile” |
| `light/history.png` / `dark/history.png` | Historial (vacío en este dispositivo) |
| `light/scanner.png` / `dark/scanner.png` | Escáner QR nativo |

**Nota escáner:** `adb screencap` no captura el preview de cámara (`PreviewView` / SurfaceView): el marco, la X y el texto “Apunta al código QR” sí son reales; el área del preview sale negra. Las dos carpetas de tema comparten la misma captura porque el escáner es una Activity nativa fuera del tema Lynx.
