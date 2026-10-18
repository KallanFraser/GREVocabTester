// lib/progress.js — learning progress, ported from Wortschatz and adapted for
// GRE headwords. All storage goes through lib/storage.js, so every function is
// SSR-safe (no storage reads as "nothing stored").
//
// Keys (every one gv_-prefixed; <dir> is 'w2d' or 'd2w', see lib/settings.js):
//   gv_progress_<dir>  Normal mode: { scopes: { <scopeId>: scope } }
//   gv_hard_<dir>      Harder mode: { scopes: { <scopeId>[#subset]: { run, count, runs } } }
//                      Never reads or writes gv_progress_* (Wortschatz L6).
//   gv_review_<dir>    Daily review schedule, shape in lib/review.js
//   gv_last_pack       { id, title, words }: the home page's "Continue" card
//
// A scope id is a built-in pack id ("argument-verbs"), a custom pack id
// ("custom-…", lib/packs.js) or ALL_SCOPE ("all") for the whole word list.
// Pack ids are stable; progress never refers to a pack by position.
//
// Normal scope shape:
//   {
//     mastered:    ["Abate", …],          // CURRENT-ROUND mastery
//     streaks:     { "Laconic": 2 },      // consecutive correct, current round;
//                                         // survives reloads and mode switches,
//                                         // cleared by a reset, re-test or new round
//     completions: { count, records: [{ at, accuracy, answered, size, backfilled }], credited },
//     round:       1,                     // from 1; + 1 each time a finished scope is reset
//     known:       ["Mitigate", …],       // mastered in an earlier round
//   }
// "best" (what a pack row shows) persists across rounds; see packSummary.
// Completion counts are per direction and per scope, like every other number
// here, so one rule covers every displayed figure (Wortschatz L5).

import * as storage from "./storage.js";
import { KEY_PREFIX } from "./storage.js";
import { DIRECTIONS, normalizeDirection, normalizeSettings, SETTINGS_EVENT, SETTINGS_KEY } from "./settings.js";
import { WORD_RETIRED } from "./hard-scheduler.js";
import { WORD_STREAK_TO_MASTER } from "./pool.js";
import {
	applyReviewResult,
	compareHeadwords,
	countReviewed,
	emptyReviewState,
	enrollWord,
	localDay,
	normalizeReviewState,
	reviewQueue,
	seedReviewState,
} from "./review.js";

// Re-exported so callers can read the Normal constants from one place.
// Unchanged from GRE's original Test mode: a pool of 5, 4 in a row to master.
export { POOL_SIZE, WORD_STREAK_TO_MASTER } from "./pool.js";

export const PROGRESS_PREFIX = "gv_progress_";
export const HARD_PREFIX = "gv_hard_";
export const REVIEW_PREFIX = "gv_review_";
export const LAST_PACK_KEY = "gv_last_pack";

export const ALL_SCOPE = "all";
export const MAX_COMPLETION_RECORDS = 50; // oldest records fall off; the count never does

// Keys the pre-overhaul app wrote. Reset all removes them too, so nothing it
// left behind (the like ledger, a stale pack handoff) can be migrated back in
// after a reset.
export const LEGACY_KEYS = ["wp_upvote_ledger_v2", "marketplaceWordpack"];
export const LEGACY_LIKE_PREFIX = "wp_likes:";

function isPlainObject(v) {
	return !!v && typeof v === "object" && !Array.isArray(v);
}

function union(a, b) {
	return [...new Set([...a, ...b])];
}

function strings(v) {
	return Array.isArray(v) ? v.filter((k) => typeof k === "string" && k) : [];
}

// The scope id for a pack id, or ALL_SCOPE for none.
export function scopeIdFor(packId) {
	return typeof packId === "string" && packId ? packId : ALL_SCOPE;
}

// ---------------------------------------------------------------------------
// Normal progress file: normalize / read / write
// ---------------------------------------------------------------------------

function emptyCompletions() {
	return { count: 0, records: [], credited: false };
}

function normalizeCompletionRecord(raw) {
	if (!isPlainObject(raw)) return null;
	const at = typeof raw.at === "string" && raw.at ? raw.at : null;
	const acc = Number(raw.accuracy);
	const answered = Number(raw.answered);
	const size = Number(raw.size);
	return {
		at,
		accuracy: raw.accuracy != null && Number.isFinite(acc) && acc >= 0 && acc <= 1 ? acc : null,
		answered: Number.isInteger(answered) && answered > 0 ? answered : null,
		size: Number.isInteger(size) && size > 0 ? size : null,
		backfilled: raw.backfilled === true || at === null,
	};
}

// Missing or malformed completion data reads as "never completed".
function normalizeCompletions(raw) {
	if (!isPlainObject(raw)) return emptyCompletions();
	const records = (Array.isArray(raw.records) ? raw.records : [])
		.map(normalizeCompletionRecord)
		.filter(Boolean)
		.slice(-MAX_COMPLETION_RECORDS);
	const n = Number(raw.count);
	// A count below the records kept would under-report a real history; a count
	// above it is legitimate (records are capped, the count is not).
	const count = Number.isInteger(n) && n >= 0 ? Math.max(n, records.length) : records.length;
	return { count, records, credited: raw.credited === true };
}

function normalizeStreaks(raw) {
	const out = {};
	if (!isPlainObject(raw)) return out;
	for (const [k, v] of Object.entries(raw)) {
		const n = Number(v);
		if (k && Number.isInteger(n) && n > 0) out[k] = Math.min(n, WORD_STREAK_TO_MASTER - 1);
	}
	return out;
}

function normalizeScope(raw) {
	const src = isPlainObject(raw) ? raw : {};
	const completions = normalizeCompletions(src.completions);
	const r = Number(src.round);
	return {
		mastered: [...new Set(strings(src.mastered))],
		streaks: normalizeStreaks(src.streaks),
		completions,
		round: Number.isInteger(r) && r >= 1 ? r : Math.max(1, completions.count + (completions.credited ? 0 : 1)),
		known: [...new Set(strings(src.known))],
	};
}

function normalizeFile(raw) {
	const scopes = {};
	if (isPlainObject(raw) && isPlainObject(raw.scopes)) {
		for (const [id, val] of Object.entries(raw.scopes)) if (id) scopes[id] = normalizeScope(val);
	}
	return { scopes };
}

function readProgressFile(direction) {
	return normalizeFile(storage.get(PROGRESS_PREFIX + normalizeDirection(direction), null));
}

function writeProgressFile(direction, file) {
	storage.set(PROGRESS_PREFIX + normalizeDirection(direction), file);
}

function readScope(direction, scopeId) {
	return normalizeScope(readProgressFile(direction).scopes[scopeId]);
}

// ---------------------------------------------------------------------------
// Normal progress (per direction, per scope)
// ---------------------------------------------------------------------------

// { mastered, streaks } for one scope. Missing scopes read as empty.
export function loadProgress(direction, scopeId = ALL_SCOPE) {
	const s = readScope(direction, scopeId);
	return { mastered: s.mastered, streaks: s.streaks };
}

// Write mastered and streaks into one scope, leaving everything else alone.
export function saveProgress(direction, scopeId, progress) {
	const file = readProgressFile(direction);
	const next = normalizeScope(file.scopes[scopeId]);
	next.mastered = [...new Set(strings(progress && progress.mastered))];
	next.streaks = normalizeStreaks(progress && progress.streaks);
	file.scopes[scopeId] = next;
	writeProgressFile(direction, file);
}

// Record one Normal answer to `key`. Correct adds one to its streak and
// masters it at WORD_STREAK_TO_MASTER; a miss resets the streak to 0. A newly
// mastered word is enrolled in daily review. Returns
// { streak, masteredNow, mastered } where `mastered` is the scope's current
// round mastery after the answer.
export function recordAnswer(direction, scopeId, key, correct) {
	const file = readProgressFile(direction);
	const scope = normalizeScope(file.scopes[scopeId]);
	if (scope.mastered.includes(key)) {
		return { streak: WORD_STREAK_TO_MASTER, masteredNow: false, mastered: scope.mastered };
	}
	let streak = 0;
	let masteredNow = false;
	if (correct) {
		streak = (scope.streaks[key] || 0) + 1;
		if (streak >= WORD_STREAK_TO_MASTER) {
			streak = WORD_STREAK_TO_MASTER;
			masteredNow = true;
			scope.mastered = [...scope.mastered, key];
			delete scope.streaks[key];
		} else {
			scope.streaks[key] = streak;
		}
	} else {
		delete scope.streaks[key];
	}
	file.scopes[scopeId] = scope;
	writeProgressFile(direction, file);
	if (masteredNow) enrollReview(direction, key);
	return { streak, masteredNow, mastered: scope.mastered };
}

// Drop one scope's streaks, keeping mastery and completions. Test mode no
// longer calls this at run start: streaks last for the current round, and a
// reset or new round clears them through clearScopeProgress / clearScopeKeys.
export function clearScopeStreaks(direction, scopeId) {
	const file = readProgressFile(direction);
	if (!file.scopes[scopeId] || !Object.keys(file.scopes[scopeId].streaks).length) return;
	file.scopes[scopeId].streaks = {};
	writeProgressFile(direction, file);
}

// True when a scope holds anything worth offering a reset for.
export function hasProgress(progress) {
	if (!progress) return false;
	if (Array.isArray(progress.mastered) && progress.mastered.length > 0) return true;
	const streaks = isPlainObject(progress.streaks) ? progress.streaks : {};
	return Object.values(streaks).some((n) => Number(n) > 0);
}

// True when every key is in `mastered` (a Set or an array). The one test for
// "this scope is finished", so a finished Choose Words subset never credits its
// parent pack while other pack words remain.
export function allMastered(keys, mastered) {
	const m = mastered instanceof Set ? mastered : new Set(mastered || []);
	return Array.isArray(keys) && keys.length > 0 && keys.every((k) => m.has(k));
}

// ---------------------------------------------------------------------------
// Completions and rounds
// ---------------------------------------------------------------------------

// One scope's completion history: { count, records, credited, round, lastAt }.
export function loadCompletions(direction, scopeId = ALL_SCOPE) {
	const s = readScope(direction, scopeId);
	const c = s.completions;
	return {
		...c,
		records: c.records.slice(),
		round: s.round,
		lastAt: c.records.length ? c.records[c.records.length - 1].at : null,
	};
}

// Credit one completion of a scope, once per round. Idempotent: the first call
// flips `credited`, later calls (re-renders, reloads, reopening a finished
// pack) change nothing and return counted: false (Wortschatz L10).
//
// `info` is { keys, accuracy, answered }: `keys` is the scope's word list.
// When given, the scope must actually be fully mastered or nothing is
// credited; its length is stored as the record's `size`, which caps "best" if
// the pack later grows (Wortschatz L9). `accuracy` (0-1) and `answered` are
// the finishing session's first-try stats, optional.
export function markScopeComplete(direction, scopeId, info = {}) {
	const file = readProgressFile(direction);
	const scope = normalizeScope(file.scopes[scopeId]);
	const prev = scope.completions;
	const keys = Array.isArray(info.keys) ? info.keys : null;
	if (prev.credited || (keys && !allMastered(keys, scope.mastered))) {
		return { ...prev, records: prev.records.slice(), counted: false };
	}
	const acc = Number(info.accuracy);
	const answered = Number(info.answered);
	const hasSession = Number.isInteger(answered) && answered > 0 && info.accuracy != null && Number.isFinite(acc);
	const size = keys ? new Set(keys).size : Number.isInteger(info.total) && info.total > 0 ? info.total : null;
	const record = {
		at: new Date().toISOString(),
		accuracy: hasSession ? Math.min(1, Math.max(0, Math.round(acc * 1000) / 1000)) : null,
		answered: hasSession ? answered : null,
		size,
		backfilled: false,
	};
	scope.completions = {
		count: prev.count + 1,
		records: [...prev.records, record].slice(-MAX_COMPLETION_RECORDS),
		credited: true,
	};
	file.scopes[scopeId] = scope;
	writeProgressFile(direction, file);
	return { ...scope.completions, records: scope.completions.records.slice(), counted: true };
}

// Leave a finished round for the next: round + 1, its mastery carried into
// `known`, `credited` cleared so finishing again counts once more.
function startNextRound(scope) {
	scope.known = union(scope.known, scope.mastered);
	scope.round += 1;
	scope.completions = { ...scope.completions, credited: false };
}

// Reset one scope's CURRENT ROUND. Nothing here erases a finish:
//   - finished (credited): round + 1, mastery and streaks cleared, completions
//     kept, so the pack still shows its best ("Start round N");
//   - otherwise: mastery and streaks cleared; round, known and history stay.
// A scope with nothing left to keep is removed outright.
export function clearScopeProgress(direction, scopeId) {
	const file = readProgressFile(direction);
	const next = normalizeScope(file.scopes[scopeId]);
	if (next.completions.credited) startNextRound(next);
	next.mastered = [];
	next.streaks = {};
	if (next.completions.count > 0 || next.known.length > 0 || next.round > 1) file.scopes[scopeId] = next;
	else delete file.scopes[scopeId];
	writeProgressFile(direction, file);
}

// Clear current-round mastery for just `keys` in one scope: the reset for a
// Choose Words subset, which runs in its parent's scope. If the round was
// finished and a mastered key goes, a new round starts (as clearScopeProgress).
export function clearScopeKeys(direction, scopeId, keys) {
	const file = readProgressFile(direction);
	if (!file.scopes[scopeId]) return;
	const drop = new Set(keys || []);
	const next = file.scopes[scopeId];
	const mastered = next.mastered.filter((k) => !drop.has(k));
	if (mastered.length !== next.mastered.length && next.completions.credited) startNextRound(next);
	next.mastered = mastered;
	next.streaks = Object.fromEntries(Object.entries(next.streaks).filter(([k]) => !drop.has(k)));
	writeProgressFile(direction, file);
}

// Durable mastery: every key mastered in this or an earlier round, plus all of
// `keys` once the scope has been finished. "The learner knows this word"; a new
// round never removes anything from it. Test mode uses loadProgress().mastered.
export function loadKnown(direction, scopeId = ALL_SCOPE, keys) {
	const s = readScope(direction, scopeId);
	const out = new Set([...s.known, ...s.mastered]);
	if (s.completions.count > 0 && Array.isArray(keys)) for (const k of keys) out.add(k);
	return out;
}

// Where a Choose Words selection runs: in the scope it was made from (a pack,
// or ALL_SCOPE for the full list), so its mastery counts toward that parent
// (Wortschatz L13). `subset` is false when every parent word was picked.
export function selectionTarget(sourcePackId, parentKeys, selectedKeys) {
	const sel = new Set(selectedKeys || []);
	const parent = Array.isArray(parentKeys) ? parentKeys : [];
	return {
		scopeId: scopeIdFor(sourcePackId),
		subset: !(parent.length > 0 && parent.every((k) => sel.has(k))),
	};
}

// Harder saves a subset run in its own slot beside the parent's, so the two
// never resume into each other and a subset never counts as a full run.
export const SUBSET_HARD_SUFFIX = "#subset";
export function hardRunScope(scopeId, subset) {
	return subset ? `${scopeId}${SUBSET_HARD_SUFFIX}` : scopeId;
}

// One scope's summary for the pack list, read-only. `keys` is the pack's word
// list (preferred) or just its size.
//
// Returns {
//   total,          // pack size
//   best,           // "x / N mastered": persists across rounds. Once finished it
//                   // is the size credited at the last finish, capped at N, so a
//                   // pack that grew afterwards does not claim words never
//                   // mastered; before that, the current round.
//   roundMastered,  // current-round mastery (Test mode's header)
//   roundDone,      // roundMastered === total (> 0)
//   round,          // current round, from 1
//   completions,    // times finished in Normal (this direction)
//   finished,       // completions > 0
//   lastRunPct,     // first-try % of the session that last finished it, or null
//   hasProgress,    // current round has mastery or streaks
//   hard: { completions, resumeRetired, bestPct, lastPct },
// }
export function packSummary(direction, scopeId, keys) {
	const s = readScope(direction, scopeId);
	const isList = Array.isArray(keys);
	const total = isList ? new Set(keys).size : Math.max(0, Number(keys) || 0);
	let roundMastered;
	if (isList) {
		const m = new Set(s.mastered);
		roundMastered = [...new Set(keys)].reduce((n, k) => n + (m.has(k) ? 1 : 0), 0);
	} else {
		roundMastered = Math.min(total, s.mastered.length);
	}
	const c = s.completions;
	const last = c.records.length ? c.records[c.records.length - 1] : null;
	let best = roundMastered;
	if (c.count > 0) {
		const credited = last && last.size ? last.size : total;
		best = Math.max(roundMastered, Math.min(total, credited));
	}
	const hard = loadHardProgress(direction, scopeId);
	let resumeRetired = null;
	if (hard.run) {
		const retired = hardRetiredKeys(hard);
		resumeRetired = isList ? retired.filter((k) => keys.includes(k)).length : retired.length;
	}
	return {
		total,
		best,
		roundMastered,
		roundDone: total > 0 && roundMastered === total,
		round: s.round,
		completions: c.count,
		finished: c.count > 0,
		lastRunPct: last && typeof last.accuracy === "number" ? Math.round(last.accuracy * 100) : null,
		hasProgress: hasProgress(s),
		hard: {
			completions: hardCompletionCount(hard),
			resumeRetired,
			bestPct: hardBestPct(hard),
			lastPct: hardLastPct(hard),
		},
	};
}

// ---------------------------------------------------------------------------
// Harder: gv_hard_<dir>
// ---------------------------------------------------------------------------
//
// { scopes: { <scopeId>: { run, count, runs } } }
// `run` is the in-progress session (hard-scheduler serialize() output) or
// null; `runs` is finished-run history, newest last, each
// { at, firstTryPct, totalWords }, capped at MAX_COMPLETION_RECORDS while
// `count` is not.

function normalizeHardRecord(raw) {
	if (!isPlainObject(raw)) return null;
	const pct = Number(raw.firstTryPct);
	if (raw.firstTryPct === null || raw.firstTryPct === undefined || !Number.isFinite(pct)) return null;
	const total = Number(raw.totalWords);
	return {
		at: typeof raw.at === "string" && raw.at ? raw.at : null,
		firstTryPct: Math.min(100, Math.max(0, pct)),
		totalWords: Number.isInteger(total) && total >= 0 ? total : null,
	};
}

function normalizeHardScope(raw) {
	const src = isPlainObject(raw) ? raw : {};
	const runs = (Array.isArray(src.runs) ? src.runs : []).map(normalizeHardRecord).filter(Boolean);
	const n = Number(src.count);
	return {
		run: isPlainObject(src.run) && isPlainObject(src.run.words) ? src.run : null,
		count: Number.isInteger(n) && n >= 0 ? Math.max(n, runs.length) : runs.length,
		runs: runs.slice(-MAX_COMPLETION_RECORDS),
	};
}

function normalizeHardFile(raw) {
	const scopes = {};
	if (isPlainObject(raw) && isPlainObject(raw.scopes)) {
		for (const [id, s] of Object.entries(raw.scopes)) if (id) scopes[id] = normalizeHardScope(s);
	}
	return { scopes };
}

function readHardFile(direction) {
	return normalizeHardFile(storage.get(HARD_PREFIX + normalizeDirection(direction), null));
}

function writeHardFile(direction, file) {
	storage.set(HARD_PREFIX + normalizeDirection(direction), file);
}

// One scope's Harder progress: { run, count, runs }. Never null.
export function loadHardProgress(direction, scopeId = ALL_SCOPE) {
	return normalizeHardScope(readHardFile(direction).scopes[scopeId]);
}

// Persist the in-progress run (scheduler.serialize()); null clears it.
export function saveHardRun(direction, scopeId, runState) {
	const file = readHardFile(direction);
	const scope = normalizeHardScope(file.scopes[scopeId]);
	scope.run = isPlainObject(runState) && isPlainObject(runState.words) ? runState : null;
	file.scopes[scopeId] = scope;
	writeHardFile(direction, file);
}

// A run just finished: append it to the history and clear the in-progress run.
// `firstTryPct` is 0-100; when absent it is computed from retiredFirstTry /
// totalWords (scheduler.stats()). Returns the new scope.
export function recordHardRun(direction, scopeId, { firstTryPct, retiredFirstTry, totalWords, at } = {}) {
	const file = readHardFile(direction);
	const scope = normalizeHardScope(file.scopes[scopeId]);
	let pct = Number(firstTryPct);
	if (firstTryPct === null || firstTryPct === undefined || !Number.isFinite(pct)) {
		pct = Number(totalWords) > 0 ? (Number(retiredFirstTry) / Number(totalWords)) * 100 : NaN;
	}
	const record = normalizeHardRecord({ at: at || new Date().toISOString(), firstTryPct: Math.round(pct), totalWords });
	const next = {
		run: null,
		count: scope.count + 1,
		runs: record ? [...scope.runs, record].slice(-MAX_COMPLETION_RECORDS) : scope.runs,
	};
	file.scopes[scopeId] = next;
	writeHardFile(direction, file);
	return next;
}

// Abandon the in-progress run; finished-run history is kept.
export function restartHardRun(direction, scopeId) {
	saveHardRun(direction, scopeId, null);
}

// Remove the scope outright: in-progress run and history. Other scopes stay.
export function resetHardScope(direction, scopeId) {
	const file = readHardFile(direction);
	if (!(scopeId in file.scopes)) return;
	delete file.scopes[scopeId];
	writeHardFile(direction, file);
}

export function hardRetiredKeys(progress) {
	const words = progress && progress.run && progress.run.words;
	if (!isPlainObject(words)) return [];
	return Object.keys(words).filter((k) => words[k] && words[k].status === WORD_RETIRED);
}

export function hardCompletionCount(progress) {
	return progress && Number.isInteger(progress.count) ? progress.count : 0;
}

// Best and last first-try percentage over the stored history, null if none.
export function hardBestPct(progress) {
	const runs = progress && Array.isArray(progress.runs) ? progress.runs : [];
	return runs.length ? Math.max(...runs.map((r) => r.firstTryPct)) : null;
}

export function hardLastPct(progress) {
	const runs = progress && Array.isArray(progress.runs) ? progress.runs : [];
	return runs.length ? runs[runs.length - 1].firstTryPct : null;
}

// ---------------------------------------------------------------------------
// Daily review: gv_review_<dir>
// ---------------------------------------------------------------------------
//
// `opts` is { isKnown(key), rank(key) } (lib/review.js wordReviewOpts).

function readReviewRaw(direction) {
	return storage.get(REVIEW_PREFIX + normalizeDirection(direction), null);
}

function writeReview(direction, state) {
	storage.set(REVIEW_PREFIX + normalizeDirection(direction), state);
}

// Every headword durably mastered in any scope of this direction, in a stable
// order (rank when given, else alphabetical).
function masteredWordKeys(direction, { isKnown, rank } = {}) {
	const keys = new Set();
	for (const s of Object.values(readProgressFile(direction).scopes)) {
		for (const k of [...s.known, ...s.mastered]) if (!isKnown || isKnown(k)) keys.add(k);
	}
	const r = (k) => {
		const v = typeof rank === "function" ? rank(k) : undefined;
		return Number.isFinite(v) ? v : Infinity;
	};
	return [...keys].sort((a, b) => (r(a) !== r(b) ? (r(a) < r(b) ? -1 : 1) : compareHeadwords(a, b)));
}

// Every headword the learner durably knows in one direction.
export function knownWordKeys(direction, isKnown) {
	return masteredWordKeys(direction, { isKnown });
}

// The schedule for one direction. The first read ever seeds it with every word
// already mastered, spread over two weeks, and persists that once.
export function loadReview(direction, opts) {
	const today = localDay();
	if (!storage.hasStorage()) return emptyReviewState();
	let state = normalizeReviewState(readReviewRaw(direction), today);
	if (!state.seeded) {
		state = seedReviewState(state, masteredWordKeys(direction, opts), today);
		writeReview(direction, state);
	}
	return state;
}

// Today's session: { keys, due, remaining } (lib/review.js reviewQueue).
export function loadReviewQueue(direction, cap, opts) {
	return reviewQueue(loadReview(direction, opts), localDay(), cap, opts);
}

// A word was just mastered somewhere: put it on the ladder if it is not on it.
export function enrollReview(direction, key, opts) {
	if (!storage.hasStorage()) return;
	const state = loadReview(direction, opts);
	const next = enrollWord(state, key, localDay());
	if (next !== state) writeReview(direction, next);
}

// The FIRST answer to `key` in a review session: move it on the ladder and
// count it against today's cap. Retries after a miss are not recorded.
export function recordReviewAnswer(direction, key, correctFirstTry) {
	if (!storage.hasStorage()) return;
	const today = localDay();
	const state = normalizeReviewState(readReviewRaw(direction), today);
	const words = { ...state.words, [key]: applyReviewResult(state.words[key], correctFirstTry, today) };
	writeReview(direction, countReviewed({ ...state, words }, today));
}

// ---------------------------------------------------------------------------
// Last opened pack: gv_last_pack
// ---------------------------------------------------------------------------

function normalizeLastPack(raw) {
	if (!isPlainObject(raw)) return null;
	if (typeof raw.id !== "string" || !raw.id) return null;
	const words = [...new Set(strings(raw.words))];
	if (!words.length) return null;
	return { id: raw.id, title: typeof raw.title === "string" ? raw.title : "", words };
}

// { id, title, words } or null. Ad-hoc selections (no id) are never stored.
export function loadLastPack() {
	return normalizeLastPack(storage.get(LAST_PACK_KEY, null));
}

export function saveLastPack(pack) {
	const p = normalizeLastPack(pack);
	if (p) storage.set(LAST_PACK_KEY, p);
}

export function clearLastPack() {
	storage.remove(LAST_PACK_KEY);
}

// ---------------------------------------------------------------------------
// Export / import / reset all
// ---------------------------------------------------------------------------
//
// Backup file:
//   { app: "grevocabtester", version: 1, exportedAt, data: { <gv_ key>: value } }
// `data` holds every gv_ key in storage, parsed. Import writes the keys in the
// file and leaves any other key alone.

export const BACKUP_APP = "grevocabtester";
export const BACKUP_VERSION = 1;

export function exportProgress() {
	const data = {};
	for (const key of storage.keys(KEY_PREFIX).sort()) {
		const v = storage.get(key, undefined);
		if (v !== undefined) data[key] = v;
	}
	return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

function suffixDirection(key, prefix) {
	return key.startsWith(prefix) ? key.slice(prefix.length) : null;
}

function assertProgressShape(key, val) {
	if (!isPlainObject(val) || !isPlainObject(val.scopes)) throw new Error(`Invalid value for "${key}".`);
	for (const [id, scope] of Object.entries(val.scopes)) {
		if (!isPlainObject(scope) || !Array.isArray(scope.mastered) || !isPlainObject(scope.streaks)) {
			throw new Error(`Invalid progress for "${id}" in "${key}" (need a mastered array and a streaks object).`);
		}
	}
}

function countLearned(file) {
	const ids = new Set();
	for (const s of Object.values(file.scopes)) for (const id of [...s.mastered, ...s.known]) ids.add(id);
	return ids.size;
}

// Phase 1: validate and normalize, touching no storage. Returns
// { writes: [[key, value]], skipped: [key], summary: [{ direction, file, device }] }.
// Throws a human-readable Error on anything malformed, so nothing is written.
export function prepareImport(backup) {
	if (!isPlainObject(backup)) throw new Error("This file is not a GRE Vocab Tester backup.");
	if (backup.app !== undefined && backup.app !== BACKUP_APP) throw new Error("This file is not a GRE Vocab Tester backup.");
	if (!Number.isInteger(backup.version) || backup.version < 1) throw new Error("Invalid backup version.");
	if (backup.version > BACKUP_VERSION) {
		throw new Error(`This backup is version ${backup.version}; this app reads up to version ${BACKUP_VERSION}.`);
	}
	if (!isPlainObject(backup.data)) throw new Error("This backup holds no data.");

	const writes = [];
	const skipped = [];
	const summary = [];
	for (const [key, val] of Object.entries(backup.data)) {
		if (!key.startsWith(KEY_PREFIX) || val === undefined) {
			skipped.push(key);
			continue;
		}
		const pDir = suffixDirection(key, PROGRESS_PREFIX);
		const hDir = suffixDirection(key, HARD_PREFIX);
		const rDir = suffixDirection(key, REVIEW_PREFIX);
		if (pDir !== null) {
			if (!DIRECTIONS.includes(pDir)) {
				skipped.push(key);
				continue;
			}
			assertProgressShape(key, val);
			const file = normalizeFile(val);
			writes.push([key, file]);
			summary.push({ direction: pDir, file: countLearned(file), device: countLearned(readProgressFile(pDir)) });
		} else if (hDir !== null || rDir !== null) {
			if (!DIRECTIONS.includes(hDir ?? rDir)) {
				skipped.push(key);
				continue;
			}
			if (!isPlainObject(val)) throw new Error(`Invalid value for "${key}".`);
			writes.push([key, hDir !== null ? normalizeHardFile(val) : normalizeReviewState(val)]);
		} else if (key === SETTINGS_KEY) {
			if (!isPlainObject(val)) throw new Error(`Invalid value for "${key}".`);
			writes.push([key, normalizeSettings(val)]);
		} else if (key === LAST_PACK_KEY) {
			const p = normalizeLastPack(val);
			if (p) writes.push([key, p]);
			else skipped.push(key);
		} else {
			// Custom packs, favorites and anything newer: their readers repair them.
			writes.push([key, val]);
		}
	}
	if (!writes.length) throw new Error("This backup holds no GRE Vocab Tester data.");
	return { writes, skipped, summary };
}

// Phase 2: write a prepared import. Previous values are snapshotted and put
// back if any write fails (quota), so a failure never leaves a mix.
export function applyImport(prepared) {
	if (!storage.hasStorage()) throw new Error("Storage is unavailable in this browser.");
	const before = prepared.writes.map(([key]) => [key, storage.getRaw(key)]);
	for (const [key, value] of prepared.writes) {
		if (!storage.set(key, value)) {
			for (const [k, raw] of before) {
				if (raw === null) storage.remove(k);
				else storage.setRaw(k, raw);
			}
			throw new Error("Storage is full or blocked. Nothing was imported.");
		}
	}
	notifySettings();
	return prepared.writes.map(([key]) => key);
}

// Validate then apply in one step. Returns the keys written.
export function importProgress(backup) {
	return applyImport(prepareImport(backup));
}

function notifySettings() {
	try {
		if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof Event === "function") {
			window.dispatchEvent(new Event(SETTINGS_EVENT));
		}
	} catch {
		/* no listeners is fine */
	}
}

// Reset all: remove EVERY gv_ key (progress, Harder, review, settings, custom
// packs, favorites and the last pack — Wortschatz kept its last pack, L3) and
// the pre-overhaul keys, so a one-time migration cannot bring old likes or a
// stale pack handoff back afterwards.
export function resetAll() {
	for (const key of storage.keys(KEY_PREFIX)) storage.remove(key);
	for (const key of LEGACY_KEYS) storage.remove(key);
	for (const key of storage.keys(LEGACY_LIKE_PREFIX)) storage.remove(key);
	notifySettings();
}

// Ask the browser not to evict this origin's storage. Failure is ignored.
export function requestPersistentStorage() {
	try {
		if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
			navigator.storage.persist().catch(() => {});
		}
	} catch {
		/* ignore */
	}
}
