import m from "mithril-runtime";
import { redraw } from "mithril-lynx/mount-redraw";
import route from "mithril-lynx/route";
import ArrowLeft from "lucide-mithril/icons-lynx/ArrowLeft.js";
import Trash2 from "lucide-mithril/icons-lynx/Trash2.js";
import {
  clearHistory,
  formatHistoryWhen,
  iconStroke,
  pageClass,
  removeHistory,
  state,
  withTheme,
  type HistoryEntry,
} from "./state.js";
import { FLAGS } from "./flags-registry.js";

const BACK_ICON_SIZE = 24;
const ROW_FLAG_SIZE = 36;
const ROW_ACTION_SIZE = 20;

type LocalState = { enterDone: boolean };

function openEntry(entry: HistoryEntry) {
  NativeModules.NonContactIntentModule?.openWhatsApp?.(entry.phone);
}

function HistoryRow(entry: HistoryEntry) {
  const Flag = FLAGS[entry.isoCode];
  return m("view", { class: withTheme("HistoryRow"), key: entry.id }, [
    m(
      "view",
      {
        class: withTheme("HistoryRow-main"),
        ontap: () => openEntry(entry),
      },
      [
        Flag
          ? m(Flag, { size: ROW_FLAG_SIZE })
          : m("view", { class: withTheme("HistoryRow-flagFallback") }),
        m("view", { class: withTheme("HistoryRow-meta") }, [
          m(
            "text",
            { class: withTheme("HistoryRow-number") },
            `${entry.dialCode} ${entry.nationalNumber}`,
          ),
          m(
            "text",
            { class: withTheme("HistoryRow-sub") },
            `${entry.name} · ${formatHistoryWhen(entry.at)}`,
          ),
        ]),
      ],
    ),
    m(
      "view",
      {
        class: withTheme("HistoryRow-delete"),
        ontap: () => {
          removeHistory(entry.id);
          redraw();
        },
      },
      [m(Trash2, { size: ROW_ACTION_SIZE, stroke: iconStroke() })],
    ),
  ]);
}

export const HistoryPage: m.Component = {
  oninit(vnode) {
    (vnode.state as LocalState).enterDone = false;
  },
  oncreate(vnode) {
    setTimeout(() => {
      (vnode.state as LocalState).enterDone = true;
      redraw();
    }, 320);
  },
  view(vnode) {
    const enterDone = (vnode.state as LocalState).enterDone;
    const entries = state.history;

    return m("view", { class: pageClass("Page Page--history", enterDone) }, [
      m("view", { class: withTheme("HistoryTopBar") }, [
        m(
          "view",
          {
            class: withTheme("BackButton"),
            ontap: () => route.back(),
          },
          [m(ArrowLeft, { size: BACK_ICON_SIZE, stroke: iconStroke() })],
        ),
        m("text", { class: withTheme("HistoryTitle") }, "Historial"),
        entries.length > 0
          ? m(
              "view",
              {
                class: withTheme("HistoryClear"),
                ontap: () => {
                  clearHistory();
                  redraw();
                },
              },
              [m("text", { class: withTheme("HistoryClear-label") }, "Borrar")],
            )
          : m("view", { class: "HistoryTopBar-spacer" }),
      ]),

      entries.length === 0
        ? m("view", { class: withTheme("HistoryEmpty") }, [
            m(
              "text",
              { class: withTheme("HistoryEmpty-text") },
              "Aún no hay números. Cuando envíes uno a WhatsApp, aparecerá aquí.",
            ),
          ])
        : m(
            "scroll-view",
            {
              class: withTheme("HistoryList"),
              "scroll-orientation": "vertical",
            },
            entries.map((entry) => HistoryRow(entry)),
          ),
    ]);
  },
};
