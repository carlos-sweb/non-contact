import m from "mithril-runtime";
import { redraw } from "mithril-lynx/mount-redraw";
import route from "mithril-lynx/route";
import Delete from "lucide-mithril/icons-lynx/Delete.js";
import Check from "lucide-mithril/icons-lynx/Check.js";
import X from "lucide-mithril/icons-lynx/X.js";
import Sun from "lucide-mithril/icons-lynx/Sun.js";
import Moon from "lucide-mithril/icons-lynx/Moon.js";
import ChevronRight from "lucide-mithril/icons-lynx/ChevronRight.js";
import History from "lucide-mithril/icons-lynx/History.js";
import ScanQrCode from "lucide-mithril/icons-lynx/ScanQrCode.js"
import {
  iconStroke,
  isNumberComplete,
  isValidPhoneFromQR,
  resolvePhoneFromQR,
  maxDigits,
  pageClass,
  pushHistory,
  selectCountry,
  state,
  toggleTheme,
  withTheme,
} from "./state.js";

const KEY_ICON_SIZE = 36;
const CLEAR_ICON_SIZE = 20;
const TOGGLE_ICON_SIZE = 20;
const FLAG_SIZE = 36;
const CHEVRON_SIZE = 18;

function clean() {
  state.number = "";
}

function appendDigit(digit: string) {
  if (state.number.length >= maxDigits()) return;
  state.number += digit;
}

function backspace() {
  state.number = state.number.slice(0, -1);
}

function confirm() {
  if (!isNumberComplete()) return;
  const national = state.number;
  pushHistory(national);
  const phone = (state.country.dialCode + national).replace(/\D/g, "");
  NativeModules.NonContactIntentModule?.openWhatsApp?.(phone);
}

function ScanQrCodeButton() {
  return m(
    "view",
    {
      class: withTheme("HeaderButton"),
      ontap: () => {
        NativeModules.NonContactScannerModule?.startScan?.();
      },
    },
    [m(ScanQrCode, { size: TOGGLE_ICON_SIZE, stroke: iconStroke() })],
  );
}

function HistoryButton() {
  return m(
    "view",
    {
      class: withTheme("HeaderButton"),
      ontap: () => route.set("/history"),
    },
    [m(History, { size: TOGGLE_ICON_SIZE, stroke: iconStroke() })],
  );
}

type KeyDef =
  | { type: "digit"; digit: string }
  | { type: "icon"; icon: any; ontap: () => void; tone?: "default" | "confirm" }
  | { type: "x"; icon: any; ontap: () => void }
  | { type: "empty" };

const digit = (d: string): KeyDef => ({ type: "digit", digit: d }),
icon = (ic: any, ontap: () => void, tone: "default" | "confirm" = "default"): KeyDef => ({
  type: "icon",
  icon: ic,
  ontap,
  tone,
});
const xIcon = (ic: any, ontap: () => void): KeyDef => ({ type: "x", icon: ic, ontap });
const empty: KeyDef = { type: "empty" };

const KEYPAD_ROWS: KeyDef[][] = [
  [digit("1"), digit("2"), digit("3"), icon(Delete, backspace)],
  [digit("4"), digit("5"), digit("6"), empty],
  [digit("7"), digit("8"), digit("9"), empty],
  [empty,digit("0"),empty,icon(Check,confirm,"confirm")],
];

function ThemeToggle() {
  const ToggleIcon = state.theme === "dark" ? Sun : Moon;
  return m(
    "view",
    { class: withTheme("HeaderButton"), ontap: toggleTheme },
    [m(ToggleIcon, { size: TOGGLE_ICON_SIZE, stroke: iconStroke() })],
  );
}

function CountryChip() {
  const Flag = state.flag;
  return m(
    "view",
    {
      class: withTheme("CountryChip"),
      ontap: () => route.set("/countries"),
    },
    [
      m(Flag, { size: FLAG_SIZE }),
      m("text", { class: withTheme("CountryChip-code") }, state.country.dialCode),
      m(ChevronRight, { size: CHEVRON_SIZE, stroke: iconStroke() }),
    ],
  );
}

function renderKey(def: KeyDef) {
  const stroke = iconStroke();
  switch (def.type) {
    case "digit":
      return m(
        "view",
        { class: withTheme("kn_key btn_action"), ontap: () => appendDigit(def.digit) },
        m("text", { class: withTheme("kn_digit") }, def.digit),
      );
    case "icon": {
      if (def.tone === "confirm") {
        const ready = isNumberComplete();
        return m(
          "view",
          {
            class: withTheme(
              ready ? "kn_key kn_key--confirm btn_action" : "kn_key kn_key--confirm kn_key--confirmOff",
            ),
            ontap: ready ? def.ontap : undefined,
          },
          m(def.icon, {
            size: KEY_ICON_SIZE,
            stroke: ready ? "#ffffff" : state.theme === "light" ? "#9ca3af" : "#6b7280",
          }),
        );
      }
      return m(
        "view",
        { class: withTheme("kn_key btn_action"), ontap: def.ontap },
        m(def.icon, { size: KEY_ICON_SIZE, stroke }),
      );
    }
    case "x":
      return m(
        "view",
        { class: withTheme("btn_x"), ontap: def.ontap },
        m(def.icon, { size: CLEAR_ICON_SIZE, stroke }),
      );
    case "empty":
      return m("view", { class: withTheme("kn_key kn_key--ghost") });
  }
}

type DialerState = { enterDone: boolean; scanError: string | null };

export const Dialer: m.Component = {
  oninit(vnode) {
    (vnode.state as DialerState).enterDone = false;
    (vnode.state as DialerState).scanError = null;
  },
  oncreate(vnode) {
    setTimeout(() => {
      (vnode.state as DialerState).enterDone = true;
      redraw();
    }, 320);

    // Listen for scan results from NonContactScannerModule via GlobalEventEmitter
    const emitter = lynx.getJSModule("GlobalEventEmitter");
    const st = vnode.state as DialerState;
    const onScanResult = (data: any) => {
      if (data && typeof data.phone === "string") {
        const validated = isValidPhoneFromQR(data.phone);
        if (validated) {
          const resolved = resolvePhoneFromQR(validated);
          // If QR prefix matches a different country, switch to it
          if (resolved.country && resolved.country.isoCode !== state.country.isoCode) {
            selectCountry(resolved.country);
          }
          state.number = resolved.nationalNumber;
          st.scanError = null;
          redraw();
        }
      } else if (data && typeof data.error === "string") {
        st.scanError = data.error;
        redraw();
        // Auto-clear error after 3 seconds
        setTimeout(() => {
          st.scanError = null;
          redraw();
        }, 3000);
      }
    };
    emitter.addListener("scanResult", onScanResult);
    // Store for cleanup
    (vnode.state as any).__scanHandler = onScanResult;
  },
  onremove(vnode) {
    const emitter = lynx.getJSModule("GlobalEventEmitter");
    const handler = (vnode.state as any).__scanHandler;
    if (handler) {
      emitter.removeListener("scanResult", handler);
    }
  },
  view(vnode) {
    const enterDone = (vnode.state as DialerState).enterDone;
    const scanError = (vnode.state as DialerState).scanError;
    const hasNumber = state.number.length > 0;
    const max = maxDigits();
    const hint = `Número local · ${max} dígitos`;

    return m("view", { class: pageClass("Page Page--dialer", enterDone) }, [
      m("view", { class: withTheme("DialerHeader") }, [
        HistoryButton(),
        m("view.HeaderButton__space"),
        ScanQrCodeButton(),                 
        ThemeToggle(),        
      ]),

      m("view", { class: withTheme("DialerHero") }, [
        CountryChip(),
        m("view", { class: withTheme("NumberStage") }, [
          hasNumber
            ? m("view", { class: withTheme("number_row") }, [
                m("text", { class: withTheme("TextNumber") }, state.number),
                renderKey(xIcon(X, clean)),
              ])
            : scanError
              ? m("text", { class: withTheme("NumberHint NumberHint--error") }, scanError)
              : m("text", { class: withTheme("NumberHint") }, hint),
        ]),        
            m(
              "text",
              {
                class: withTheme(
                  isNumberComplete() ? "DigitCount DigitCount--ready" : "DigitCount",
                ),
              },
              `${state.number.length}/${max}`,
            ),
      ]),

      m(
        "view",
        { class: withTheme("kn") },
        [
          ...KEYPAD_ROWS.map((row) =>
            m("view", { class: withTheme("kn_row") }, row.map(renderKey)),
          ),
          m("text", { class: withTheme("VersionLabel") }, "v1.0"),
        ],
      ),
    ]);
  },
};
