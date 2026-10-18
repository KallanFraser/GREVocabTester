// Shared state behind lib/backgrounds/bus.js. The bus is the public API; this
// module is what the engine and components/Background.jsx read. Nothing here
// touches window or document, so it is safe to import anywhere.
//
// Ported from Wortschatz's lib/backgrounds/state.js with two changes:
// - word objects use `word` (the GRE headword) where Wortschatz uses `de`;
// - event sinks are a set, not a single slot. Wortschatz kept one sink, so a
//   second mount (a settings preview) replaced the main background's sink and
//   unmounting the preview left nothing attached (Wortschatz L20). Here each
//   mount adds and removes only its own sink, so no mount can disconnect
//   another. Settings previews do not attach a sink at all (engine `bus: false`).

const MAX_WORDS = 200;

export const busState = {
	heat: 0, // 0..1, the current word's streak
	origin: null, // { x, y } in viewport px, or null for the default centre
	words: [], // [{ word, mastered, current }]
	owner: null, // "app" (a mode called setBgWords) or "page" (Background's own source)
};

const sinks = new Set();

export function attachSink(fn) {
	if (typeof fn !== "function") return () => {};
	sinks.add(fn);
	return () => {
		sinks.delete(fn);
	};
}

export function emitEvent(type) {
	for (const fn of [...sinks]) {
		try {
			fn(type);
		} catch {
			/* a background must never break the caller */
		}
	}
}

const listeners = new Set();

export function onWords(fn) {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

// Accepts strings or { word, mastered, current } objects; anything else is
// dropped. Deduplicated, at most MAX_WORDS.
export function normalizeWords(list) {
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

export function writeWords(list, owner) {
	busState.words = normalizeWords(list);
	busState.owner = busState.words.length ? owner : null;
	for (const fn of [...listeners]) {
		try {
			fn(busState.words);
		} catch {
			/* see emitEvent */
		}
	}
}

// Background's own word source steps aside for a game page: it clears only what
// it wrote itself, never a list a mode published.
export function clearPageWords() {
	if (busState.owner === "page") writeWords([], null);
}
