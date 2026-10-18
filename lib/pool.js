// lib/pool.js: Test mode Normal difficulty's word pool. Ported from
// Wortschatz. Pure: no React, no localStorage, no dataset imports.
//
// The pool is POOL_SIZE unmastered headwords drawn at random, without
// replacement, from the scope. A word mastered (WORD_STREAK_TO_MASTER correct
// in a row) leaves the pool and one more random unmastered word not already in
// the pool takes its slot. The next card is a random pool member other than
// the one just shown.
//
// What this replaces in the original TestMode: the subset was drawn WITH
// replacement (so it could hold the same word twice, and with one distinct
// word the "not the current word" retry loop never ended), and the next card
// was picked from the pool as it was before the mastery swap.
//
// Never call these during render: every function draws randomness. Call them
// from event handlers and effects, and keep the result in state.

import { cryptoRng, seededRng } from "./hard-scheduler.js";

// Game constants, unchanged from GRE's original Test mode.
export const POOL_SIZE = 5; // active words in Normal
export const WORD_STREAK_TO_MASTER = 4; // consecutive correct answers to master a word

// `rng` (a function returning [0, 1)) or `seed` (an integer for seededRng);
// `rng` wins if both are given, and with neither the default is cryptoRng.
function resolveRng({ rng, seed } = {}) {
	return typeof rng === "function" ? rng : Number.isInteger(seed) ? seededRng(seed) : cryptoRng;
}

function pickIndex(random, length) {
	return Math.min(length - 1, Math.floor(random() * length));
}

function toSet(v) {
	return v instanceof Set ? v : new Set(v || []);
}

// Draw up to `count` keys at random, without repeats, from `candidates`.
function drawRandom(candidates, count, random) {
	const remaining = [...new Set(candidates)];
	const picked = [];
	while (picked.length < count && remaining.length) {
		const i = pickIndex(random, remaining.length);
		picked.push(remaining.splice(i, 1)[0]);
	}
	return picked;
}

// A fresh pool of up to POOL_SIZE distinct unmastered keys from scopeKeys, in
// random order. Fewer than POOL_SIZE when fewer remain; empty when the scope
// is fully mastered.
export function buildPool(scopeKeys, masteredSet, opts) {
	const random = resolveRng(opts);
	const mastered = toSet(masteredSet);
	const unmastered = (scopeKeys || []).filter((k) => !mastered.has(k));
	return drawRandom(unmastered, POOL_SIZE, random);
}

// One random key from scopeKeys that is not in `taken` (the pool's keys plus
// the mastered set), or null when none remain.
export function drawPoolRefill(scopeKeys, taken, opts) {
	const random = resolveRng(opts);
	const t = toSet(taken);
	const candidates = [...new Set(scopeKeys || [])].filter((k) => !t.has(k));
	if (!candidates.length) return null;
	return candidates[pickIndex(random, candidates.length)];
}

// The pool after `masteredKey` was mastered: its slot is refilled with a random
// unmastered key from scopeKeys that is not already in the pool, or removed
// when none is left. `masteredSet` should already include masteredKey (it is
// excluded either way). Returns { pool, added } with `added` the new key or
// null. The input pool is not modified.
export function replaceMastered(pool, masteredKey, scopeKeys, masteredSet, opts) {
	const current = Array.isArray(pool) ? pool : [];
	const taken = new Set([...current, ...toSet(masteredSet), masteredKey]);
	const added = drawPoolRefill(scopeKeys, taken, opts);
	const next = [];
	for (const k of current) {
		if (k === masteredKey) {
			if (added !== null) next.push(added);
		} else {
			next.push(k);
		}
	}
	return { pool: next, added };
}

// The next card: a random pool member other than `lastKey`. With only
// `lastKey` left it is shown again; with an empty pool, null. Always pass the
// pool AFTER any mastery swap (replaceMastered's result), never the old one.
export function pickNext(pool, lastKey, opts) {
	const live = [...new Set(Array.isArray(pool) ? pool : [])];
	if (!live.length) return null;
	const candidates = live.length > 1 ? live.filter((k) => k !== lastKey) : live;
	const random = resolveRng(opts);
	return candidates[pickIndex(random, candidates.length)];
}
