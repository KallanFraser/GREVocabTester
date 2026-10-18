// Background ids, labels, descriptions and route rules. Light on purpose: the
// settings page and components/Background.jsx import it, and nothing here may
// pull a renderer or the word list into every page.
//
// The id list and the two defaults live in lib/settings.js, which coerces the
// stored settings (playBackground, pagesBackground) against them; this module
// re-exports them so the background code has one place to read from.

import {
	BACKGROUND_IDS,
	DEFAULT_PAGES_BACKGROUND,
	DEFAULT_PLAY_BACKGROUND,
	isBackgroundId,
} from "../settings.js";

export { BACKGROUND_IDS, DEFAULT_PAGES_BACKGROUND, DEFAULT_PLAY_BACKGROUND, isBackgroundId };

export const BACKGROUND_LABEL = {
	warp: "Warp",
	constellation: "Constellation",
	liquid: "Liquid",
	fireflies: "Fireflies",
	"fireflies-red": "Red fireflies",
	halftone: "Halftone",
	grid: "Spotlight grid",
	rain: "Word rain",
	aurora: "Aurora",
	ember: "Ember",
	plain: "Plain",
};

// One line each, shown in the settings pickers.
export const BACKGROUND_DESC = {
	warp: "A starfield streaming out from the word. It speeds up as your streak grows and jumps to hyperspace when you master one.",
	constellation:
		"Every word in the set is a star. Mastered words light up green and join into your own constellation, and the current word is ringed in coral.",
	liquid: "Slow flowing ink in coral, indigo and teal. It brightens as your streak grows and flashes on every answer.",
	fireflies: "Warm glowing specks wandering in the dark. Mastering a word draws them all to it, and they scatter green.",
	"fireflies-red": "A warmer, red version of fireflies.",
	halftone: "A field of dots that breathes slowly and swells around your cursor. Answers send rings through the dots.",
	grid: "A dot grid lit by a spotlight that follows your cursor. Correct answers send a green ripple out from the word.",
	rain: "Vocabulary words drift past in large, faint type. Mastered words turn faintly green.",
	aurora: "Slow, heavily blurred colour fields drifting behind everything.",
	ember: "A still coral glow in one corner with a cool blue counterpart. No animation.",
	plain: "No background animation.",
};

// Play background: every route under /play/ (Test, Practice, Random Practice,
// Flashcards, Daily Review, In Context). Pages background: everything else.
export function isGameRoute(pathname) {
	return typeof pathname === "string" && /^\/play(\/|$)/.test(pathname);
}
