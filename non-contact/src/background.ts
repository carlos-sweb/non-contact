// src/background.ts
//
// Boots mithril-lynx/route (in-memory history — Lynx has no URL bar).
// Screens are imported statically: Lynx's loadLazyBundle() does not go
// through AssetTemplateProvider, so dynamic import() chunks are not
// loadable from APK assets today.

import m from "mithril-runtime";
import route from "mithril-lynx/route";
import { Dialer } from "./dialer.js";
import { CountriesPage } from "./countries-page.js";
import { HistoryPage } from "./history-page.js";

declare const module: {
	hot?: {
		accept(path: string, callback: () => void): void;
	};
};
declare function require(id: "./dialer.js"): typeof import("./dialer.js");
declare function require(id: "./countries-page.js"): typeof import("./countries-page.js");
declare function require(id: "./history-page.js"): typeof import("./history-page.js");
declare function require(id: string): string;

// Font: "JetBrains Mono" (src/assets/fonts/jetbrains-mono-400-normal-latin.ttf).
const FONT_FAMILY = "JetBrains Mono";
if (import.meta.env.DEV) {
	const jetBrainsMonoFont = require("./assets/fonts/jetbrains-mono-400-normal-latin.ttf");
	lynx.addFont(
		{ "font-family": FONT_FAMILY, src: `url("${jetBrainsMonoFont}")` },
		() => {},
	);
} else {
	lynx.addFont(
		{
			"font-family": FONT_FAMILY,
			src: 'url("asset:///fonts/jetbrains-mono-400-normal-latin.ttf")',
		},
		() => {},
	);
}

let currentDialer: m.Component = Dialer;
let currentCountries: m.Component = CountriesPage;
let currentHistory: m.Component = HistoryPage;

const DialerHost: m.Component = {
	view() {
		return m(currentDialer);
	},
};

const CountriesHost: m.Component = {
	view() {
		return m(currentCountries);
	},
};

const HistoryHost: m.Component = {
	view() {
		return m(currentHistory);
	},
};

route("/", {
	"/": DialerHost,
	"/countries": CountriesHost,
	"/history": HistoryHost,
});

// Android back button: MainActivity forwards it as the "mithrilLynx:back"
// global event while NonContactNavModule reports in-app history; at the
// first screen its callback is off and back closes the app as before.
route.listenBackButton({
	onCanGoBackChange: (canGoBack) => NativeModules.NonContactNavModule?.setCanGoBack(canGoBack),
});

if (module.hot) {
	module.hot.accept("./dialer.js", () => {
		currentDialer = require("./dialer.js").Dialer;
		const path = route.get() ?? "/";
		route.set(path, null, { replace: true });
	});

	module.hot.accept("./countries-page.js", () => {
		currentCountries = require("./countries-page.js").CountriesPage;
		if ((route.get() ?? "").startsWith("/countries")) {
			route.set("/countries", null, { replace: true });
		}
	});

	module.hot.accept("./history-page.js", () => {
		currentHistory = require("./history-page.js").HistoryPage;
		if ((route.get() ?? "").startsWith("/history")) {
			route.set("/history", null, { replace: true });
		}
	});
}
