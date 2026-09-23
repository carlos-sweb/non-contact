import { redraw } from "mithril-lynx/mount-redraw";
import FlagCl from "circle-flags-mithril/flags-lynx/FlagCl.js";
import countries from "./countries.json";
import { flagFor } from "./flags-registry.js";

export type Theme = "dark" | "light";

export type Country = {
  isoCode: string;
  name: string;
  dialCode: string;
  maxNationalNumberLength: number;
};

export type FlagComponent = typeof FlagCl;

const THEME_KEY = "theme";
const COUNTRY_KEY = "country";
const HISTORY_KEY = "history";
const HISTORY_MAX = 50;

export type HistoryEntry = {
  id: string;
  isoCode: string;
  name: string;
  dialCode: string;
  nationalNumber: string;
  /** Digits only, country code + national — ready for wa.me */
  phone: string;
  at: number;
};

const DEFAULT_COUNTRY: Country =
  countries.find((c) => c.isoCode === "CL") ?? {
    isoCode: "CL",
    name: "Chile",
    dialCode: "+56",
    maxNationalNumberLength: 9,
  };

function readTheme(): Theme {
  try {
    const raw = NativeModules.NonContactStorageModule?.get(THEME_KEY);
    return raw === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function readCountry(): Country {
  try {
    const raw = NativeModules.NonContactStorageModule?.get(COUNTRY_KEY);
    if (!raw) return DEFAULT_COUNTRY;
    const parsed = JSON.parse(raw) as Partial<Country>;
    if (!parsed?.isoCode || !parsed?.dialCode) return DEFAULT_COUNTRY;
    const known = countries.find((c) => c.isoCode === parsed.isoCode);
    return known ?? {
      isoCode: parsed.isoCode,
      name: parsed.name ?? parsed.isoCode,
      dialCode: parsed.dialCode,
      maxNationalNumberLength: parsed.maxNationalNumberLength ?? 15,
    };
  } catch {
    return DEFAULT_COUNTRY;
  }
}

export function persistTheme(theme: Theme) {
  try {
    NativeModules.NonContactStorageModule?.set(THEME_KEY, theme);
  } catch {
    // Best-effort.
  }
}

export function persistCountry(country: Country) {
  try {
    NativeModules.NonContactStorageModule?.set(COUNTRY_KEY, JSON.stringify(country));
  } catch {
    // Best-effort.
  }
}

function readHistory(): HistoryEntry[] {
  try {
    const raw = NativeModules.NonContactStorageModule?.get(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.phone === "string" &&
        typeof e.nationalNumber === "string" &&
        typeof e.dialCode === "string",
    );
  } catch {
    return [];
  }
}

function persistHistory(entries: HistoryEntry[]) {
  try {
    NativeModules.NonContactStorageModule?.set(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Best-effort.
  }
}

export const state = {
  number: "",
  theme: readTheme() as Theme,
  country: readCountry() as Country,
  history: readHistory() as HistoryEntry[],
  /** Current dialer flag component; starts as Chile, swapped on country pick / lazy load. */
  flag: FlagCl as FlagComponent,
};

// Flat BEM + "--light" siblings (indicadores-app pattern).
export function withTheme(classNames: string): string {
  if (state.theme !== "light") return classNames;
  return classNames
    .split(" ")
    .flatMap((name) => [name, `${name}--light`])
    .join(" ");
}

/** One-shot enter class for a screen root — fade on mount, then drop so
 * later redraws (theme, search, selection) don't replay the animation. */
export function pageClass(base: string, enterDone: boolean): string {
  return withTheme(enterDone ? base : `${base} Page--enter`);
}



export function iconStroke(): string {
  return state.theme === "light" ? "#212121" : "#f5f5f5";
}

/** Valida que un string sea exclusivamente un número de teléfono.
 *  Formato aceptado: + opcional, solo dígitos, 5 a 15 caracteres.
 *  Retorna el número limpio (trimmed) o null si no es válido. */
export function isValidPhoneFromQR(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\+?\d{5,15}$/.test(trimmed)) return null;
  return trimmed;
}

// Precompute dial-code → country lookup, sorted by code length descending
// so "+1-268" matches before "+1".
const dialCodeIndex = (() => {
  const map = new Map<string, Country>();
  const sorted = [...countries].sort(
    (a, b) => b.dialCode.length - a.dialCode.length,
  );
  for (const c of sorted) {
    // Normalize: remove dashes so "+1-268" → "+1268"
    const normalized = c.dialCode.replace(/-/g, "");
    if (!map.has(normalized)) map.set(normalized, c);
  }
  return map;
})();

/**
 * Dado un número internacional (con "+"), busca el país cuyo prefijo
 * coincida y retorna el número nacional (sin prefijo) junto con el país.
 * Si el número no empieza con "+", se asume que ya es un número nacional
 * y se retorna tal cual, con country = null.
 * Si el prefijo no coincide con ningún país conocido, retorna el número
 * completo como nacional y country = null.
 */
export function resolvePhoneFromQR(raw: string): {
  nationalNumber: string;
  country: Country | null;
} {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("+")) {
    return { nationalNumber: trimmed, country: null };
  }

  // Try longest prefix match against known dial codes
  for (const [normalizedCode, country] of dialCodeIndex) {
    if (trimmed.startsWith(normalizedCode)) {
      const national = trimmed.slice(normalizedCode.length);
      if (national.length >= 4) {
        return { nationalNumber: national, country };
      }
      // National part too short — fall through to no-match
      break;
    }
  }

  // No known prefix matched — keep full number, don't change country
  return { nationalNumber: trimmed, country: null };
}

export function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  redraw();
  persistTheme(state.theme);
}

const flagCache = new Map<string, FlagComponent>([["CL", FlagCl]]);

/** Resolve a flag for the dialer from the shared registry. */
export function ensureFlag(isoCode: string): void {
  const iso = isoCode.toUpperCase();
  const cached = flagCache.get(iso);
  if (cached) {
    state.flag = cached;
    return;
  }
  const flag = flagFor(iso) as FlagComponent | undefined;
  if (!flag) return;
  flagCache.set(iso, flag);
  state.flag = flag;
}

export function rememberFlag(isoCode: string, component: FlagComponent) {
  flagCache.set(isoCode.toUpperCase(), component);
}

export function selectCountry(country: Country, flag?: FlagComponent) {
  state.country = country;
  // Drop surplus digits if the new country allows fewer national digits.
  const max = country.maxNationalNumberLength;
  if (state.number.length > max) {
    state.number = state.number.slice(0, max);
  }
  if (flag) {
    rememberFlag(country.isoCode, flag);
    state.flag = flag;
  } else {
    ensureFlag(country.isoCode);
  }
  persistCountry(country);
}

export function maxDigits(): number {
  return state.country.maxNationalNumberLength;
}

export function isNumberComplete(): boolean {
  return state.number.length === maxDigits();
}

/** Record a successful WhatsApp handoff; newest first, one row per phone. */
export function pushHistory(nationalNumber: string): HistoryEntry {
  const country = state.country;
  const phone = (country.dialCode + nationalNumber).replace(/\D/g, "");
  const entry: HistoryEntry = {
    id: `${phone}-${Date.now()}`,
    isoCode: country.isoCode,
    name: country.name,
    dialCode: country.dialCode,
    nationalNumber,
    phone,
    at: Date.now(),
  };
  const next = [entry, ...state.history.filter((e) => e.phone !== phone)].slice(0, HISTORY_MAX);
  state.history = next;
  persistHistory(next);
  return entry;
}

export function removeHistory(id: string) {
  state.history = state.history.filter((e) => e.id !== id);
  persistHistory(state.history);
}

export function clearHistory() {
  state.history = [];
  persistHistory([]);
}

export function formatHistoryWhen(at: number): string {
  const d = new Date(at);
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `Hoy ${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} ${hh}:${mm}`;
}

// Warm the dialer flag for a persisted non-default country.
if (state.country.isoCode !== "CL") {
  ensureFlag(state.country.isoCode);
}

export { countries };
