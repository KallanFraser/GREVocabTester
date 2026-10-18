// The background bus: how the rest of the app talks to the animated background.
// Every function is a safe no-op when no background is mounted (or on the
// server), so callers never need to check. Same API as Wortschatz's
// lib/backgrounds/bus.js, except that word objects use `word` (GRE headword)
// where Wortschatz uses `de`.
//
//   bgEvent(type)          "ok" | "bad" | "master": an answer reaction.
//   setBgHeat(value)       0..1, the current word's streak. Drives warp speed,
//                          liquid brightness, firefly speed, halftone size.
//   setBgOrigin(x, y)      viewport px the effects radiate from. Non-numbers
//                          reset to the default: centre, 45% down.
//   getBgWords()           the current word list (read-only copy).
//   setBgWords(list)       strings or { word, mastered, current } objects,
//                          deduplicated, at most 200. Used by constellation and
//                          word rain; `mastered` lights a word green, `current`
//                          is the word being asked.
//
// The state lives in ./state.js, which the engine (./engine.js) and
// components/Background.jsx read.

import { busState, emitEvent, writeWords } from "./state.js";

const EVENTS = new Set(["ok", "bad", "master"]);

export function bgEvent(type) {
	if (EVENTS.has(type)) emitEvent(type);
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
	writeWords(list, "app");
}
