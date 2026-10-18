// The background bus: how the rest of the app talks to the animated background.
// Every function is a safe no-op when no background is mounted (or on the
// server), so callers never need to check. Same API as Wortschatz's
// lib/backgrounds/bus.js, except that word objects use `word` (GRE headword)
// where Wortschatz uses `de`.
//
//   bgEvent(type)          "ok" | "bad" | "master" — an answer reaction.
//   setBgHeat(value)       0..1, the current word's streak.
//   setBgOrigin(x, y)      viewport px the effects radiate from. Non-numbers
//                          reset to the default: centre, 45% down.
//   getBgWords()           the current word list (read-only copy).
//   setBgWords(list)       strings or { word, mastered, current } objects,
//                          deduplicated, at most 200. `mastered` lights a word
//                          green, `current` is the word being asked.
//
// No background engine exists yet, so this module keeps the state itself and
// nothing consumes it. When the engine arrives it may move this state into a
// shared module (Wortschatz's state.js) and attach its event sink there, but
// these five exports and their behaviour must stay as they are.

const MAX_WORDS = 200;
const EVENTS = new Set(["ok", "bad", "master"]);

const busState = {
	heat: 0, // 0..1
	origin: null, // { x, y } in viewport px, or null for the default centre
	words: [], // [{ word, mastered, current }]
};

// The mounted background's event handler, or null. Nothing sets it yet.
let sink = null;

function normalizeWords(list) {
	if (!Array.isArray(list)) return [];
	const out = [];
	const seen = new Set();
	for (const item of list) {
		const w = typeof item === "string" ? { word: item } : item;
		if (!w || typeof w.word !== "string" || !w.word.trim() || seen.has(w.word)) continue;
		seen.add(w.word);
		out.push({ word: w.word, mastered: !!w.mastered, current: !!w.current });
		if (out.length >= MAX_WORDS) break;
	}
	return out;
}

export function bgEvent(type) {
	if (!EVENTS.has(type) || !sink) return;
	try {
		sink(type);
	} catch {
		/* a background must never break the caller */
	}
}

export function setBgHeat(value) {
	const n = Number(value);
	busState.heat = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

export function setBgOrigin(x, y) {
	const nx = Number(x);
	const ny = Number(y);
	busState.origin = Number.isFinite(nx) && Number.isFinite(ny) && x != null && y != null ? { x: nx, y: ny } : null;
}

export function getBgWords() {
	return busState.words.map((w) => ({ ...w }));
}

export function setBgWords(list) {
	busState.words = normalizeWords(list);
}
