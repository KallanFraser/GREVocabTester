// lib/hard-scheduler.js — the card scheduler for Test mode's Harder difficulty.
// Ported from Wortschatz. Pure: no React, no localStorage, no dataset imports.
// It schedules KEYS (headwords) and nothing else; grading and display stay
// with the caller.
//
// Unlike the Normal engine (a 5-word pool, 4 in a row to master, see
// lib/pool.js) it draws from the whole selection at once:
//   - every key starts unseen;
//   - correct on its first draw -> retired for the session, never drawn again;
//   - any miss -> needs HARD_RELEARN_CORRECT more correct (a later miss resets
//     it to that, never above);
//   - correct while it needs N -> N - 1, retired at 0;
//   - after any answer that leaves a key unretired, it sits out until at least
//     HARD_COOLDOWN_CARDS other cards have been shown. When every unretired key
//     is cooling down, the one whose cooldown ends soonest is drawn early.
//   - the same key is never shown twice in a row unless it is the only
//     unretired key left.
// The session is done when every key is retired.

// Harder's own constants. They live here rather than in a matching module so
// the scheduler has no dependencies; Normal's constants are untouched.
export const HARD_COOLDOWN_CARDS = 3; // other cards shown before an answered, unretired word may return
export const HARD_RELEARN_CORRECT = 2; // correct answers a missed word needs to retire; a miss resets to this

export const WORD_UNSEEN = "unseen";
export const WORD_LEARNING = "learning"; // needs `needs` more correct answers
export const WORD_RETIRED = "retired";

// mulberry32: a small seeded PRNG so a session can be replayed exactly in tests.
export function seededRng(seed) {
	let a = seed >>> 0;
	return function rng() {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// Default randomness matches Learn mode: crypto.getRandomValues.
export function cryptoRng() {
	const c = globalThis.crypto;
	if (!c || typeof c.getRandomValues !== "function") return Math.random();
	const arr = new Uint32Array(1);
	c.getRandomValues(arr);
	return arr[0] / 4294967296;
}

function pickIndex(rng, length) {
	// Clamp: a caller-supplied rng that returns exactly 1 must not index past the end.
	return Math.min(length - 1, Math.floor(rng() * length));
}

export const HARD_STATE_VERSION = 1;

const STATUSES = [WORD_UNSEEN, WORD_LEARNING, WORD_RETIRED];

function isPlainObject(v) {
	return !!v && typeof v === "object" && !Array.isArray(v);
}

function nonNegInt(v, fallback) {
	return Number.isInteger(v) && v >= 0 ? v : fallback;
}

// One key's stored state, repaired. Anything unreadable is a fresh, unseen key.
function restoreWord(raw) {
	const fresh = { status: WORD_UNSEEN, needs: null, misses: 0, availableAt: 0 };
	if (!isPlainObject(raw) || !STATUSES.includes(raw.status)) return fresh;
	const misses = nonNegInt(raw.misses, 0);
	const availableAt = nonNegInt(raw.availableAt, 0);
	if (raw.status === WORD_UNSEEN) return { ...fresh, misses, availableAt };
	if (raw.status === WORD_LEARNING) {
		const n = raw.needs;
		const needs = Number.isInteger(n) && n >= 1 && n <= HARD_RELEARN_CORRECT ? n : HARD_RELEARN_CORRECT;
		return { status: WORD_LEARNING, needs, misses: Math.max(1, misses), availableAt };
	}
	return { status: WORD_RETIRED, needs: Number.isInteger(raw.needs) && raw.needs >= 0 ? 0 : null, misses, availableAt };
}

// `keys` is the whole test selection (headwords, in scope order). Duplicates
// collapse to one card. Options: `rng` (a function returning [0, 1)) or `seed`
// (an integer for seededRng); `rng` wins if both are given, and with neither
// the scheduler uses crypto.getRandomValues. `state` is the output of
// serialize() to resume from — see restoreHardScheduler.
export function createHardScheduler(keys, { rng, seed, state } = {}) {
	const random = typeof rng === "function" ? rng : Number.isInteger(seed) ? seededRng(seed) : cryptoRng;
	const order = [...new Set(keys || [])];
	const saved = isPlainObject(state) && isPlainObject(state.words) ? state : null;

	// key -> { status, needs, misses, availableAt }. `needs` is null until the
	// first miss. `availableAt` is the cardsShown count at which the key may be
	// drawn again; 0 means immediately.
	const words = new Map();
	for (const k of order) words.set(k, restoreWord(saved && Object.hasOwn(saved.words, k) ? saved.words[k] : null));

	let cardsShown = saved ? nonNegInt(saved.cardsShown, 0) : 0;
	let lastShown = saved && words.has(saved.lastShown) ? saved.lastShown : null;
	// drawn, not yet answered; a pending key that has since left the scope or
	// is retired is dropped, so next() draws afresh.
	let pending =
		saved && words.has(saved.pending) && words.get(saved.pending).status !== WORD_RETIRED ? saved.pending : null;
	const firstTry = new Set(
		saved && Array.isArray(saved.firstTry)
			? saved.firstTry.filter((k) => words.has(k) && words.get(k).status === WORD_RETIRED)
			: [],
	);

	function unretired() {
		return order.filter((k) => words.get(k).status !== WORD_RETIRED);
	}

	function isDone() {
		return unretired().length === 0;
	}

	// The key to show now, or null when the session is done. Calling it again
	// before recordResult returns the same card and does not count another one,
	// so a re-render can never skip a card.
	function next() {
		if (pending !== null) return pending;
		const live = unretired();
		if (!live.length) return null;

		const candidates = live.length > 1 ? live.filter((k) => k !== lastShown) : live;
		const eligible = candidates.filter((k) => words.get(k).availableAt <= cardsShown);

		let key;
		if (eligible.length) {
			key = eligible[pickIndex(random, eligible.length)];
		} else {
			// Everything is cooling down: the soonest to come off cooldown goes early.
			// availableAt values are distinct (one answer per card), so this is exact.
			key = candidates.reduce((best, k) => (words.get(k).availableAt < words.get(best).availableAt ? k : best));
		}

		cardsShown += 1;
		lastShown = key;
		pending = key;
		return key;
	}

	// Record the answer to the card next() returned. Any other key is a caller
	// bug (an answer for a card that is not on screen) and throws.
	function recordResult(key, correct) {
		if (pending === null || key !== pending) {
			throw new Error(`recordResult: "${key}" is not the card being shown`);
		}
		pending = null;
		const w = words.get(key);

		if (correct) {
			if (w.status === WORD_UNSEEN) {
				w.status = WORD_RETIRED;
				firstTry.add(key);
			} else {
				w.needs -= 1;
				if (w.needs <= 0) {
					w.needs = 0;
					w.status = WORD_RETIRED;
				}
			}
		} else {
			w.status = WORD_LEARNING;
			w.needs = HARD_RELEARN_CORRECT;
			w.misses += 1;
		}

		if (w.status !== WORD_RETIRED) w.availableAt = cardsShown + HARD_COOLDOWN_CARDS;
	}

	// One key's state, for display ("needs 2 more") and for tests.
	function stateOf(key) {
		const w = words.get(key);
		if (!w) return null;
		return { status: w.status, needs: w.needs, misses: w.misses };
	}

	// `missed` is every key missed at least once, most misses first, ties in
	// selection order.
	function stats() {
		const missed = order
			.filter((k) => words.get(k).misses > 0)
			.map((k) => ({ key: k, misses: words.get(k).misses }))
			.sort((a, b) => b.misses - a.misses);
		return {
			totalWords: order.length,
			retired: order.length - unretired().length,
			retiredFirstTry: firstTry.size,
			missed,
			cardsShown,
		};
	}

	// Plain JSON snapshot of the whole session, for resuming it later. A card
	// drawn but not yet answered is kept, so the resumed run shows that card
	// first. The rng is not part of it: draws after that are fresh.
	function serialize() {
		const out = {};
		for (const k of order) out[k] = { ...words.get(k) };
		return {
			v: HARD_STATE_VERSION,
			keys: [...order],
			words: out,
			cardsShown,
			lastShown,
			pending,
			firstTry: order.filter((k) => firstTry.has(k)),
		};
	}

	return { next, recordResult, isDone, stats, stateOf, serialize };
}

// Resume a session from serialize() output against the CURRENT selection.
// Keys no longer in `keys` are dropped; keys new to it start unseen. Missing
// or corrupt state yields a fresh scheduler rather than throwing. `opts` is
// the same { rng, seed } as createHardScheduler.
export function restoreHardScheduler(state, keys, opts = {}) {
	return createHardScheduler(keys, { ...opts, state });
}

// True when a saved run (serialize() output) covers exactly the words in
// `keys`, in any order. A save slot shared by different selections (a pack's
// Choose Words subsets) resumes only on a match; restoreHardScheduler alone
// would splice one selection's run into another.
export function hardStateMatchesKeys(state, keys) {
	if (!state || !Array.isArray(state.keys) || !Array.isArray(keys)) return false;
	const want = new Set(keys);
	const have = new Set(state.keys);
	if (want.size !== have.size) return false;
	for (const k of have) if (!want.has(k)) return false;
	return true;
}
