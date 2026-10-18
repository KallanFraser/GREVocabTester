// lib/settings.js — user preferences in gv_settings.
//
// Every value is coerced on read, so a corrupt or outdated store can never
// pick a direction, timer or background that does not exist (Wortschatz L26).
// saveSettings is read-merge-write of a patch, so a component holding a stale
// copy cannot overwrite a setting it never changed (Wortschatz L25).

import { get, set } from "./storage.js";

export const SETTINGS_KEY = "gv_settings";

// Fired on window after every save, so long-lived components (the background
// layer in the root layout) pick up a change without a reload.
export const SETTINGS_EVENT = "gv-settings-change";

// The two study directions. 'w2d' shows the word and asks for its definition
// (the app's original behaviour); 'd2w' shows the definition and asks for the
// headword.
export const DIRECTION_W2D = "w2d";
export const DIRECTION_D2W = "d2w";
export const DIRECTIONS = [DIRECTION_W2D, DIRECTION_D2W];
export const DEFAULT_DIRECTION = DIRECTION_W2D;
export const DIRECTION_LABEL = {
	[DIRECTION_W2D]: "Word → Definition",
	[DIRECTION_D2W]: "Definition → Word",
};

export function isDirection(d) {
	return DIRECTIONS.includes(d);
}

export function normalizeDirection(d) {
	return isDirection(d) ? d : DEFAULT_DIRECTION;
}

// How long correct-answer feedback stays up before the next prompt, in
// seconds; "manual" waits for the learner. Same options as Wortschatz. 1.5s is
// the fixed delay Test mode used before this setting existed.
export const ADVANCE_DELAY_MANUAL = "manual";
export const ADVANCE_DELAY_OPTIONS = [0.5, 1.5, 3, 5, ADVANCE_DELAY_MANUAL];
export const DEFAULT_ADVANCE_DELAY = 1.5;
export const ADVANCE_DELAY_LABEL = {
	"0.5": "0.5s",
	"1.5": "1.5s",
	"3": "3s",
	"5": "5s",
	[ADVANCE_DELAY_MANUAL]: "Manual",
};

// Animated background ids, as in Wortschatz lib/backgrounds/ids.js. The
// background engine arrives in a later batch; until then this list is the
// source of truth for coercion and should move into lib/backgrounds/ids.js
// with it.
export const BACKGROUND_IDS = [
	"warp",
	"constellation",
	"liquid",
	"fireflies",
	"fireflies-red",
	"halftone",
	"grid",
	"rain",
	"aurora",
	"ember",
	"plain",
];
export const DEFAULT_PLAY_BACKGROUND = "warp";
export const DEFAULT_PAGES_BACKGROUND = "fireflies-red";

export function isBackgroundId(id) {
	return BACKGROUND_IDS.includes(id);
}

export const DEFAULT_SETTINGS = Object.freeze({
	direction: DEFAULT_DIRECTION,
	advanceDelay: DEFAULT_ADVANCE_DELAY,
	feedbackSounds: true,
	playBackground: DEFAULT_PLAY_BACKGROUND,
	pagesBackground: DEFAULT_PAGES_BACKGROUND,
});

function isPlainObject(v) {
	return !!v && typeof v === "object" && !Array.isArray(v);
}

// Coerce any value into a complete, valid settings object. Unknown fields
// are dropped.
export function normalizeSettings(raw) {
	const src = isPlainObject(raw) ? raw : {};
	return {
		direction: normalizeDirection(src.direction),
		advanceDelay: ADVANCE_DELAY_OPTIONS.includes(src.advanceDelay) ? src.advanceDelay : DEFAULT_ADVANCE_DELAY,
		feedbackSounds: typeof src.feedbackSounds === "boolean" ? src.feedbackSounds : DEFAULT_SETTINGS.feedbackSounds,
		playBackground: isBackgroundId(src.playBackground) ? src.playBackground : DEFAULT_PLAY_BACKGROUND,
		pagesBackground: isBackgroundId(src.pagesBackground) ? src.pagesBackground : DEFAULT_PAGES_BACKGROUND,
	};
}

// Safe to call during SSR (returns the defaults); call it from an effect in
// components so the server and first client render agree.
export function loadSettings() {
	return normalizeSettings(get(SETTINGS_KEY, null));
}

// Merge `patch` into the stored settings, coerce, write, and notify. Returns
// the settings now in effect.
export function saveSettings(patch) {
	const next = normalizeSettings({ ...loadSettings(), ...(isPlainObject(patch) ? patch : {}) });
	set(SETTINGS_KEY, next);
	try {
		if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof Event === "function") {
			window.dispatchEvent(new Event(SETTINGS_EVENT));
		}
	} catch {
		/* no listeners is fine */
	}
	return next;
}
