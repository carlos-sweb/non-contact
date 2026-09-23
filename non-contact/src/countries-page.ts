import m from "mithril-runtime";
import { redraw } from "mithril-lynx/mount-redraw";
import route from "mithril-lynx/route";
import ArrowLeft from "lucide-mithril/icons-lynx/ArrowLeft.js";
import {
  countries,
  iconStroke,
  pageClass,
  selectCountry,
  state,
  withTheme,
  type Country,
} from "./state.js";
import { FLAGS, flagFor } from "./flags-registry.js";

export { FLAGS, flagFor };

const BACK_ICON_SIZE = 24;
const ROW_FLAG_SIZE = 36;

type LocalState = {
  query: string;
  draft: Country;
  enterDone: boolean;
};

function createLocal(): LocalState {
  return {
    query: "",
    draft: state.country,
    enterDone: false,
  };
}

function filtered(query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return countries as Country[];
  return (countries as Country[]).filter((c) => {
    return (
      c.name.toLowerCase().includes(q) ||
      c.dialCode.toLowerCase().includes(q) ||
      c.isoCode.toLowerCase().includes(q)
    );
  });
}

function confirmCountry(country: Country) {
  selectCountry(country, FLAGS[country.isoCode]);
  route.back();
}

function CountryRow(c: Country, selected: boolean, onPick: () => void) {
  const Flag = FLAGS[c.isoCode];
  return m(
    "view",
    {
      class: withTheme(selected ? "CountryRow CountryRow--selected" : "CountryRow"),
      key: c.isoCode,
      ontap: onPick,
    },
    [
      Flag ? m(Flag, { size: ROW_FLAG_SIZE }) : m("view", { class: withTheme("CountryRow-flagFallback") }),
      m("view", { class: withTheme("CountryRow-meta") }, [
        m("text", { class: withTheme("CountryRow-name") }, c.name),
        m("text", { class: withTheme("CountryRow-dial") }, c.dialCode),
      ]),
    ],
  );
}

export const CountriesPage: m.Component = {
  oninit(vnode) {
    (vnode.state as { local: LocalState }).local = createLocal();
  },
  oncreate(vnode) {
    setTimeout(() => {
      (vnode.state as { local: LocalState }).local.enterDone = true;
      redraw();
    }, 320);
  },
  view(vnode) {
    const local = (vnode.state as { local: LocalState }).local;
    const list = filtered(local.query);
    const selected = local.draft;
    const hasQuery = local.query.trim().length > 0;

    return m("view", { class: pageClass("Page Page--countries", local.enterDone) }, [
      m("view", { class: withTheme("CountriesTopBar") }, [
        m(
          "view",
          {
            class: withTheme("BackButton"),
            ontap: () => route.back(),
          },
          [m(ArrowLeft, { size: BACK_ICON_SIZE, stroke: iconStroke() })],
        ),
        m("text", { class: withTheme("CountriesTitle") }, "País / código"),
        m("view", { class: "CountriesTopBar-spacer" }),
      ]),

      m("view", { class: withTheme("SearchBox") }, [
        m("input", {
          class: withTheme("SearchInput"),
          id: "country-search",
          type: "text",
          placeholder: "Buscar país o código…",
          maxlength: 64,
          "confirm-type": "search",
          "placeholder-color": state.theme === "light" ? "#9ca3af" : "#6b7280",
          color: state.theme === "light" ? "#111827" : "#f5f5f5",
          oninput: (e: { detail?: { value?: string } }) => {
            local.query = e.detail?.value ?? "";
            redraw();
          },
        }),
      ]),

      list.length === 0
        ? m("view", { class: withTheme("CountryEmpty") }, [
            m(
              "text",
              { class: withTheme("CountryEmpty-text") },
              hasQuery
                ? `No hay coincidencias para “${local.query.trim()}”`
                : "No hay países para mostrar",
            ),
          ])
        : m(
            "scroll-view",
            {
              class: withTheme("CountryList"),
              "scroll-orientation": "vertical",
            },
            list.map((c) =>
              CountryRow(c, c.isoCode === selected.isoCode, () => {
                // Second tap on the highlighted row confirms (scroll-view can
                // steal touches from the footer on some devices).
                if (local.draft.isoCode === c.isoCode) {
                  confirmCountry(c);
                  return;
                }
                local.draft = c;
                redraw();
              }),
            ),
          ),

      m("view", { class: withTheme("CountriesFooter") }, [
        m(
          "view",
          {
            class: withTheme(
              selected.isoCode === state.country.isoCode
                ? "SelectButton SelectButton--muted"
                : "SelectButton",
            ),
            // Bind on both the chip and the label — scroll-view hit-testing
            // on some Android devices swallows taps that only land on text.
            ontap: () => confirmCountry(selected),
          },
          [
            m(
              "text",
              {
                class: withTheme("SelectButton-label"),
                ontap: () => confirmCountry(selected),
              },
              `Seleccionar ${selected.name} (${selected.dialCode})`,
            ),
          ],
        ),
      ]),
    ]);
  },
};
