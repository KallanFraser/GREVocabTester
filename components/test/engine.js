// components/test/engine.js: Test mode's pure helpers: which words a run
// covers, one Normal answer, grading in either direction, and the labels the
// screen shows. No React and no randomness of its own (lib/pool.js draws, with
// an injectable rng), so tests can drive a whole run. The one storage touch is
// the Normal | Harder choice, through lib/settings.js.

import {
	DIFFICULTY_HARDER,
	DIFFICULTY_NORMAL,
	difficultyFromParam,
	loadSettings,
	normalizeDifficulty,
	saveSettings,
} from "../../lib/settings.js";
import { ALL_SCOPE, scopeIdFor, selectionTarget } from "../../lib/progress.js";
import { POOL_SIZE, WORD_STREAK_TO_MASTER, buildPool, drawPoolRefill, pickNext, replaceMastered } from "../../lib/pool.js";
import { gradeDefinition, gradeHeadwordWithNearDuplicates } from "../../lib/matching.js";

// ---------------------------------------------------------------------------
// Difficulty: gv_settings.testDifficulty = "normal" | "harder"
// ---------------------------------------------------------------------------
// Held in lib/settings.js, which migrates the old gv_test_difficulty key once.
// Coerced on read, so a corrupt value is Normal. A ?mode=normal|harder in the
// URL overrides it and is saved (resolveDifficulty).

export {
	DIFFICULTIES,
	DIFFICULTY_HARDER,
	DIFFICULTY_NORMAL,
	LEGACY_DIFFICULTY_KEY as DIFFICULTY_KEY,
	normalizeDifficulty,
} from "../../lib/settings.js";
export const DIFFICULTY_LABEL = { [DIFFICULTY_NORMAL]: "Normal", [DIFFICULTY_HARDER]: "Harder" };

export function loadDifficulty() {
	return loadSettings().testDifficulty;
}

export function saveDifficulty(d) {
	return saveSettings({ testDifficulty: normalizeDifficulty(d) }).testDifficulty;
}

// The difficulty a page load runs at: the query's `mode` when it is
// "normal" or "harder" (saved, so it sticks), else the stored one. `query` is
// a URLSearchParams, a query string, or null.
export function resolveDifficulty(query) {
	let mode = null;
	try {
		const p = query instanceof URLSearchParams ? query : new URLSearchParams(typeof query === "string" ? query : "");
		mode = difficultyFromParam(p.get("mode"));
	} catch {
		mode = null;
	}
	if (mode && mode !== loadDifficulty()) return saveDifficulty(mode);
	return mode || loadDifficulty();
}

// ---------------------------------------------------------------------------
// Which words a run covers
// ---------------------------------------------------------------------------
//
// A run is
//   {
//     packId,      // the pack's id, or null (all words, or an ad-hoc selection)
//     title,       // the pack or selection name, null for all words
//     parentKeys,  // what Choose Words offers: the pack's words, else every word
//     keys,        // what is being drilled: parentKeys or a subset of it
//     scopeId,     // where progress lives (lib/progress.js scopeIdFor)
//     subset,      // keys is a strict subset of parentKeys
//   }
// A subset always runs in its parent's scope, so its mastery counts toward the
// parent (Wortschatz L13); the parent is credited only once all of it is done.

// The full word list, as a run.
export function allWordsRun(allKeys) {
	const keys = Array.isArray(allKeys) ? allKeys : [];
	return { packId: null, title: null, parentKeys: keys, keys, scopeId: ALL_SCOPE, subset: false };
}

// A run from resolvePackContext's result (lib/packs.js). `canonical(word)`
// returns the vocabulary's own spelling of a headword, or null when it is not
// a word. Unknown words are dropped; a pack or selection with no real words
// left is the full list, so an empty or unknown pack never strands the page.
export function runFromContext(ctx, allKeys, canonical) {
	const all = allWordsRun(allKeys);
	if (!ctx || !Array.isArray(ctx.words)) return all;
	const seen = new Set();
	const words = [];
	for (const w of ctx.words) {
		const k = typeof canonical === "function" ? canonical(w) : w;
		if (typeof k === "string" && k && !seen.has(k)) {
			seen.add(k);
			words.push(k);
		}
	}
	if (!words.length) return all;
	if (typeof ctx.id === "string" && ctx.id) {
		return { packId: ctx.id, title: ctx.title || "Word pack", parentKeys: words, keys: words, scopeId: scopeIdFor(ctx.id), subset: false };
	}
	// A shared or legacy selection has no pack: it narrows the full list.
	const t = selectionTarget(null, all.parentKeys, words);
	const keys = t.subset ? all.parentKeys.filter((k) => seen.has(k)) : all.parentKeys;
	return { ...all, title: ctx.title || "Selection", keys, scopeId: t.scopeId, subset: t.subset };
}

// The run after Choose Words: the picked keys, in parent order, in the parent's
// scope.
export function selectionRun(run, selection) {
	const sel = selection instanceof Set ? selection : new Set(selection || []);
	const keys = run.parentKeys.filter((k) => sel.has(k));
	const t = selectionTarget(run.packId, run.parentKeys, keys);
	return { ...run, keys: t.subset ? keys : run.parentKeys, scopeId: t.scopeId, subset: t.subset };
}

// Identifies what a URL opened, so a URL that only changes in form (a tidied
// legacy link) does not restart the session.
export function runSignature(run) {
	if (!run) return "";
	if (run.packId) return `pack:${run.packId}`;
	return run.subset ? `words:${run.keys.join(",")}` : "all";
}

// The fewest words Choose Words accepts: a full pool, or the whole list when
// it is smaller than that.
export function minSelection(parentKeys) {
	const n = Array.isArray(parentKeys) ? parentKeys.length : 0;
	return Math.max(1, Math.min(POOL_SIZE, n));
}

// ---------------------------------------------------------------------------
// One Normal answer
// ---------------------------------------------------------------------------
//
// `state` is { pool, streaks, mastered (Set), keys }. Returns the next state
// plus what the screen needs:
//   { pool, streaks, mastered, streak, masteredNow, added, nextKey }
// Correct adds one to the streak; WORD_STREAK_TO_MASTER in a row masters the
// word, which leaves the pool and is replaced by a random unmastered word
// (lib/pool.js). A miss resets the streak and the same word is asked again.
// `nextKey` is null once nothing is left to ask.
export function normalAnswer(state, key, correct, opts) {
	const pool = Array.isArray(state.pool) ? state.pool : [];
	const mastered = state.mastered instanceof Set ? state.mastered : new Set(state.mastered || []);
	const streaks = { ...(state.streaks || {}) };
	if (!correct) {
		delete streaks[key];
		return { pool, streaks, mastered, streak: 0, masteredNow: false, added: null, nextKey: key };
	}
	const streak = (streaks[key] || 0) + 1;
	if (streak < WORD_STREAK_TO_MASTER) {
		streaks[key] = streak;
		return { pool, streaks, mastered, streak, masteredNow: false, added: null, nextKey: pickNext(pool, key, opts) };
	}
	delete streaks[key];
	const nextMastered = new Set(mastered);
	nextMastered.add(key);
	const swapped = replaceMastered(pool, key, state.keys, nextMastered, opts);
	return {
		pool: swapped.pool,
		streaks,
		mastered: nextMastered,
		streak: WORD_STREAK_TO_MASTER,
		masteredNow: true,
		added: swapped.added,
		nextKey: pickNext(swapped.pool, key, opts),
	};
}

// The scope's saved streaks that still apply to this run: a word in `keys`,
// not mastered, with a streak above 0. Anything else (a word outside a subset,
// a stale entry) is left out, so it shows 0.
export function runStreaks(keys, streaks, mastered) {
	const m = mastered instanceof Set ? mastered : new Set(mastered || []);
	const inRun = new Set(keys || []);
	const out = {};
	for (const [k, v] of Object.entries(streaks || {})) {
		const n = Number(v);
		if (inRun.has(k) && !m.has(k) && Number.isInteger(n) && n > 0) out[k] = Math.min(n, WORD_STREAK_TO_MASTER - 1);
	}
	return out;
}

// The opening pool of a Normal session. Words with a saved streak go in first,
// longest streak first, so a reload shows them where they were; the rest is a
// random draw (lib/pool.js). With no streaks this is buildPool. `opts` is
// lib/pool.js's { rng | seed }.
export function resumePool(keys, mastered, streaks, opts) {
	const live = runStreaks(keys, streaks, mastered);
	const order = new Map((keys || []).map((k, i) => [k, i]));
	const started = Object.keys(live)
		.sort((a, b) => live[b] - live[a] || order.get(a) - order.get(b))
		.slice(0, POOL_SIZE);
	if (!started.length) return buildPool(keys, mastered, opts);
	const m = mastered instanceof Set ? mastered : new Set(mastered || []);
	const pool = started.slice();
	while (pool.length < POOL_SIZE) {
		const k = drawPoolRefill(keys, new Set([...m, ...pool]), opts);
		if (k === null) break;
		pool.push(k);
	}
	return pool;
}

export function countIn(keys, set) {
	let n = 0;
	for (const k of keys || []) if (set.has(k)) n += 1;
	return n;
}

// ---------------------------------------------------------------------------
// Grading and display
// ---------------------------------------------------------------------------

// An empty or whitespace-only submit is "I don't know": it is graded as a miss
// (see gradeFor), never as a match.
export function isBlankAnswer(answer) {
	return typeof answer !== "string" || answer.trim() === "";
}

// The grade of a blank submit: always a miss, showing the expected answer.
export function blankMiss(key, entry, direction) {
	return {
		correct: false,
		exact: false,
		display: direction === "d2w" ? key : (entry && entry.definition) || "",
		alsoAccepted: null,
		acceptedKey: null,
	};
}

// Grade `answer` for headword `key` (entry = its vocabulary record) in
// `direction`. Returns { correct, exact, display, alsoAccepted, acceptedKey }
// where `display` is the expected answer, `alsoAccepted` names the target when
// a d2w answer was a different headword with a near-duplicate definition, and
// `acceptedKey` is that other headword (null otherwise).
export function gradeFor(key, entry, answer, direction, vocab) {
	if (isBlankAnswer(answer)) return blankMiss(key, entry, direction);
	if (direction === "d2w") {
		const r = gradeHeadwordWithNearDuplicates(key, answer, vocab);
		const other = r.correct && r.acceptedKey && r.acceptedKey !== key;
		return {
			correct: r.correct,
			exact: r.exact,
			display: key,
			alsoAccepted: other ? key : null,
			acceptedKey: other ? r.acceptedKey : null,
		};
	}
	// The raw vocabulary record may carry `alts` that the entry passed in lacks.
	const raw = vocab && Object.prototype.hasOwnProperty.call(vocab, key) ? vocab[key] : null;
	const withAlts = entry && !Array.isArray(entry.alts) && raw && Array.isArray(raw.alts) ? { ...entry, alts: raw.alts } : entry;
	const r = gradeDefinition(withAlts, answer);
	return { correct: r.correct, exact: r.exact, display: r.display, alsoAccepted: null };
}

// What the prompt shows: the word (w2d) or the short definition with its part
// of speech (d2w). `isWord` picks the large headword style.
export function promptFor(entry, direction) {
	if (!entry) return { text: "", hint: "", isWord: true };
	if (direction === "d2w") return { text: entry.definition || "", hint: entry.pos ? `(${entry.pos})` : "", isWord: false };
	return { text: entry.word || "", hint: entry.pos || "", isWord: true };
}

// A pool box names its word by the prompt side, so d2w never shows the answer.
export function poolLabel(entry, direction) {
	if (!entry) return "";
	return direction === "d2w" ? entry.definition || "" : entry.word || "";
}

// The pair on the mastery card. It shows after grading, so nothing is given
// away in either direction.
export function winNames(entry) {
	return { word: entry ? entry.word : "", meaning: entry ? entry.definition : "" };
}

// Harder's missed-word rows, the answer side first (Wortschatz's enFirst).
export function missedRows(missed, lookup, direction) {
	return (missed || []).map(({ key, misses }) => {
		const e = typeof lookup === "function" ? lookup(key) : null;
		const word = e ? e.word : key;
		const def = e ? e.definition : "";
		return direction === "d2w"
			? { key, primary: word, secondary: def, misses }
			: { key, primary: def || word, secondary: word, misses };
	});
}
