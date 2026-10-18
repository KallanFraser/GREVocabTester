// Unit tests for Test mode's pure engine (components/test/engine.js), plus the
// Wortschatz Test-mode tests that apply to GRE: run-streaks.test.mjs (a new
// Normal run starts every word at streak 0) and choose-words-subset.test.mjs
// (a Choose Words subset runs in its pack's scope and credits the pack only
// when every pack word is mastered; Harder subsets save in their own slot).
// Run with `node --test tests/`.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// lib/ imports JSON the way the Next bundler expects (no import attributes);
// plain Node insists on { type: "json" }, so add it to .json loads.
registerHooks({
	load(url, context, nextLoad) {
		if (!url.endsWith(".json")) return nextLoad(url, context);
		return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
	},
});

class MemoryStorage {
	constructor() {
		this.map = new Map();
	}
	get length() {
		return this.map.size;
	}
	key(i) {
		return [...this.map.keys()][i] ?? null;
	}
	getItem(k) {
		return this.map.has(k) ? this.map.get(k) : null;
	}
	setItem(k, v) {
		this.map.set(k, String(v));
	}
	removeItem(k) {
		this.map.delete(k);
	}
	clear() {
		this.map.clear();
	}
}
const storage = new MemoryStorage();
globalThis.window = { localStorage: storage };

const E = await import("../components/test/engine.js");
const P = await import("../lib/progress.js");
const { buildPool, seededRng } = await (async () => {
	const pool = await import("../lib/pool.js");
	const hs = await import("../lib/hard-scheduler.js");
	return { buildPool: pool.buildPool, seededRng: hs.seededRng };
})();
const { createHardScheduler, hardStateMatchesKeys } = await import("../lib/hard-scheduler.js");

beforeEach(() => storage.clear());

const ALL = ["Abate", "Aberrant", "Bolster", "Cogent", "Deride", "Exculpate", "Exonerate", "Mitigate"];
const canonical = (w) => ALL.find((k) => k.toLowerCase() === String(w).trim().toLowerCase()) || null;

// ---------------------------------------------------------------------------
// Difficulty storage
// ---------------------------------------------------------------------------

test("difficulty: Normal by default, persisted, coerced on read", () => {
	assert.equal(E.loadDifficulty(), "normal");
	E.saveDifficulty("harder");
	assert.equal(E.loadDifficulty(), "harder");
	storage.setItem(E.DIFFICULTY_KEY, JSON.stringify("impossible"));
	assert.equal(E.loadDifficulty(), "normal");
	storage.setItem(E.DIFFICULTY_KEY, "{not json");
	assert.equal(E.loadDifficulty(), "normal");
});

// ---------------------------------------------------------------------------
// Which words a run covers
// ---------------------------------------------------------------------------

test("no pack, or an unknown pack, runs every word in scope 'all'", () => {
	for (const ctx of [null, undefined, {}, { id: "x", words: [] }, { id: "x", words: ["Nope", "Zzz"] }]) {
		const run = E.runFromContext(ctx, ALL, canonical);
		assert.equal(run.packId, null);
		assert.equal(run.scopeId, "all");
		assert.equal(run.subset, false);
		assert.deepEqual(run.keys, ALL);
		assert.deepEqual(run.parentKeys, ALL);
	}
});

test("a pack runs its own words in its own scope; unknown words are dropped", () => {
	const run = E.runFromContext({ id: "verbs", title: "Verbs", words: ["bolster", "Deride", "Nope", "Deride"] }, ALL, canonical);
	assert.equal(run.packId, "verbs");
	assert.equal(run.scopeId, "verbs");
	assert.equal(run.title, "Verbs");
	assert.deepEqual(run.keys, ["Bolster", "Deride"]);
	assert.deepEqual(run.parentKeys, ["Bolster", "Deride"]);
	assert.equal(run.subset, false);
});

test("a shared selection narrows the full list in scope 'all'", () => {
	const run = E.runFromContext({ id: null, title: "Shared selection", words: ["Mitigate", "Abate"] }, ALL, canonical);
	assert.equal(run.packId, null);
	assert.equal(run.scopeId, "all");
	assert.equal(run.subset, true);
	assert.deepEqual(run.keys, ["Abate", "Mitigate"]); // list order
	assert.deepEqual(run.parentKeys, ALL);
	const whole = E.runFromContext({ id: null, words: ALL }, ALL, canonical);
	assert.equal(whole.subset, false);
});

test("Choose Words: a subset stays in its pack's scope; picking everything is the pack", () => {
	const pack = E.runFromContext({ id: "p", title: "P", words: ALL.slice(0, 6) }, ALL, canonical);
	const sub = E.selectionRun(pack, new Set(["Cogent", "Abate", "Deride", "Bolster", "Aberrant"]));
	assert.equal(sub.scopeId, "p");
	assert.equal(sub.subset, true);
	assert.deepEqual(sub.keys, ["Abate", "Aberrant", "Bolster", "Cogent", "Deride"]); // pack order
	assert.deepEqual(sub.parentKeys, pack.parentKeys);
	const full = E.selectionRun(sub, pack.parentKeys);
	assert.equal(full.subset, false);
	assert.deepEqual(full.keys, pack.parentKeys);
});

test("run signatures ignore URL form and tell different runs apart", () => {
	const a = E.runFromContext({ id: "p", words: ["Abate"] }, ALL, canonical);
	const b = E.runFromContext({ id: "p", words: ["Abate", "Cogent"] }, ALL, canonical);
	assert.equal(E.runSignature(a), E.runSignature(b));
	assert.equal(E.runSignature(E.allWordsRun(ALL)), "all");
	const s1 = E.runFromContext({ words: ["Mitigate", "Abate"] }, ALL, canonical);
	const s2 = E.runFromContext({ words: ["Abate", "Mitigate"] }, ALL, canonical);
	assert.equal(E.runSignature(s1), E.runSignature(s2));
	assert.notEqual(E.runSignature(s1), E.runSignature(a));
});

test("Choose Words minimum is a full pool, or the whole list when smaller", () => {
	assert.equal(E.minSelection(ALL), 5);
	assert.equal(E.minSelection(["a", "b", "c"]), 3);
	assert.equal(E.minSelection([]), 1);
});

// ---------------------------------------------------------------------------
// Normal answers
// ---------------------------------------------------------------------------

test("four in a row masters; a miss resets the streak and asks the same word", () => {
	const keys = ALL.slice(0, 6);
	const opts = { rng: seededRng(7) };
	let st = { pool: buildPool(keys, new Set(), opts), streaks: {}, mastered: new Set(), keys };
	const w = st.pool[0];
	for (let i = 1; i <= 3; i++) {
		const r = E.normalAnswer(st, w, true, opts);
		assert.equal(r.streak, i);
		assert.equal(r.masteredNow, false);
		assert.notEqual(r.nextKey, w, "never the same word twice while others are in the pool");
		st = { ...st, ...r };
	}
	const miss = E.normalAnswer(st, w, false, opts);
	assert.equal(miss.streak, 0);
	assert.equal(miss.nextKey, w);
	assert.equal(miss.streaks[w], undefined);
	st = { ...st, ...miss };
	for (let i = 0; i < 3; i++) st = { ...st, ...E.normalAnswer(st, w, true, opts) };
	const win = E.normalAnswer(st, w, true, opts);
	assert.equal(win.masteredNow, true);
	assert.ok(win.mastered.has(w));
	assert.ok(!win.pool.includes(w));
	assert.equal(win.pool.length, 5);
	assert.ok(win.added && !st.pool.includes(win.added));
	assert.equal(new Set(win.pool).size, win.pool.length);
});

test("a single-word list repeats the word, then finishes", () => {
	const keys = ["Abate"];
	let st = { pool: buildPool(keys, new Set()), streaks: {}, mastered: new Set(), keys };
	for (let i = 0; i < 3; i++) {
		const r = E.normalAnswer(st, "Abate", true);
		assert.equal(r.nextKey, "Abate");
		st = { ...st, ...r };
	}
	const done = E.normalAnswer(st, "Abate", true);
	assert.equal(done.masteredNow, true);
	assert.deepEqual(done.pool, []);
	assert.equal(done.nextKey, null);
});

test("a full Normal run terminates with every word mastered exactly once", () => {
	const keys = ALL;
	const opts = { rng: seededRng(42) };
	let st = { pool: buildPool(keys, new Set(), opts), streaks: {}, mastered: new Set(), keys };
	let cur = st.pool[0];
	let masteredCount = 0;
	for (let steps = 0; cur !== null; steps++) {
		assert.ok(steps < 1000, "run must terminate");
		const r = E.normalAnswer(st, cur, true, opts);
		if (r.masteredNow) masteredCount += 1;
		st = { ...st, ...r };
		cur = r.nextKey;
	}
	assert.equal(masteredCount, keys.length);
	assert.equal(E.countIn(keys, st.mastered), keys.length);
});

// ---------------------------------------------------------------------------
// Grading and display
// ---------------------------------------------------------------------------

const VOCAB = {
	Exculpate: { word: "Exculpate", definition: "to clear from blame.", pos: "verb" },
	Exonerate: { word: "Exonerate", definition: "to clear from blame.", pos: "verb" },
	Impermeable: { word: "Impermeable", definition: "not allowing passage.", pos: "adjective" },
	Permeable: { word: "Permeable", definition: "allowing passage.", pos: "adjective" },
	Mitigate: { word: "Mitigate", definition: "to lessen severity.", pos: "verb" },
};

test("w2d grades the typed definition", () => {
	const ok = E.gradeFor("Mitigate", VOCAB.Mitigate, "to lessen severity", "w2d", VOCAB);
	assert.equal(ok.correct, true);
	assert.equal(ok.alsoAccepted, null);
	assert.equal(ok.display, "to lessen severity.");
	assert.equal(E.gradeFor("Mitigate", VOCAB.Mitigate, "to make worse", "w2d", VOCAB).correct, false);
});

test("d2w accepts a near-duplicate headword and names the target", () => {
	const r = E.gradeFor("Exonerate", VOCAB.Exonerate, "exculpate", "d2w", VOCAB);
	assert.equal(r.correct, true);
	assert.equal(r.alsoAccepted, "Exonerate");
	const own = E.gradeFor("Exonerate", VOCAB.Exonerate, "Exonerate.", "d2w", VOCAB);
	assert.equal(own.correct, true);
	assert.equal(own.alsoAccepted, null);
	const antonym = E.gradeFor("Impermeable", VOCAB.Impermeable, "permeable", "d2w", VOCAB);
	assert.equal(antonym.correct, false);
});

test("the prompt and pool never show the answer side", () => {
	const e = VOCAB.Mitigate;
	assert.deepEqual(E.promptFor(e, "w2d"), { text: "Mitigate", hint: "verb", isWord: true });
	assert.deepEqual(E.promptFor(e, "d2w"), { text: "to lessen severity.", hint: "(verb)", isWord: false });
	assert.equal(E.poolLabel(e, "w2d"), "Mitigate");
	assert.equal(E.poolLabel(e, "d2w"), "to lessen severity.");
	assert.deepEqual(E.winNames(e), { word: "Mitigate", meaning: "to lessen severity." });
	const rows = E.missedRows([{ key: "Mitigate", misses: 2 }], (k) => VOCAB[k], "w2d");
	assert.deepEqual(rows, [{ key: "Mitigate", primary: "to lessen severity.", secondary: "Mitigate", misses: 2 }]);
	assert.equal(E.missedRows([{ key: "Mitigate", misses: 1 }], (k) => VOCAB[k], "d2w")[0].primary, "Mitigate");
});

// ---------------------------------------------------------------------------
// Ported: run-streaks.test.mjs
// ---------------------------------------------------------------------------

test("a new run drops stored streaks and keeps mastery and completions", () => {
	P.saveProgress("w2d", "p", { mastered: ["Abate"], streaks: {} });
	P.markScopeComplete("w2d", "p", { accuracy: 1, answered: 4 });
	P.saveProgress("w2d", "p", { mastered: ["Abate"], streaks: { Cogent: 3, Deride: 1 } });
	P.saveProgress("d2w", "p", { mastered: [], streaks: { Cogent: 2 } });
	const before = P.loadCompletions("w2d", "p");
	P.clearScopeStreaks("w2d", "p"); // what every Normal run start does
	assert.deepEqual(P.loadProgress("w2d", "p"), { mastered: ["Abate"], streaks: {} });
	assert.equal(P.loadCompletions("w2d", "p").count, before.count);
	assert.deepEqual(P.loadProgress("d2w", "p").streaks, { Cogent: 2 }, "the other direction is untouched");
	P.clearScopeStreaks("w2d", "none");
	assert.equal(P.packSummary("w2d", "none", 3).hasProgress, false);
});

// ---------------------------------------------------------------------------
// Ported: choose-words-subset.test.mjs
// ---------------------------------------------------------------------------

test("a finished subset does not credit its pack until every pack word is mastered", () => {
	const pack = E.runFromContext({ id: "p", title: "P", words: ALL }, ALL, canonical);
	const sub = E.selectionRun(pack, ALL.slice(0, 5));
	P.saveProgress("w2d", sub.scopeId, { mastered: sub.keys, streaks: {} });
	const early = P.markScopeComplete("w2d", sub.scopeId, { keys: sub.parentKeys });
	assert.equal(early.counted, false);
	P.saveProgress("w2d", sub.scopeId, { mastered: ALL, streaks: {} });
	assert.equal(P.markScopeComplete("w2d", sub.scopeId, { keys: sub.parentKeys }).counted, true);
	assert.equal(P.markScopeComplete("w2d", sub.scopeId, { keys: sub.parentKeys }).counted, false, "idempotent");
	assert.equal(P.packSummary("w2d", "p", ALL).completions, 1);
});

test("a subset reset clears only its words; the rest of the pack stays mastered", () => {
	P.saveProgress("w2d", "p", { mastered: ALL, streaks: {} });
	P.markScopeComplete("w2d", "p", { keys: ALL });
	P.clearScopeKeys("w2d", "p", ["Abate", "Bolster"]);
	const prog = P.loadProgress("w2d", "p");
	assert.deepEqual(prog.mastered, ALL.filter((k) => k !== "Abate" && k !== "Bolster"));
	const s = P.packSummary("w2d", "p", ALL);
	assert.equal(s.round, 2);
	assert.equal(s.best, ALL.length, "best persists across rounds");
});

test("Harder subsets save in their own slot and resume only the same words", () => {
	const keys = ALL.slice(0, 5);
	const sched = createHardScheduler(keys, { seed: 3 });
	sched.recordResult(sched.next(), true);
	P.saveHardRun("w2d", P.hardRunScope("p", true), sched.serialize());
	assert.equal(P.loadHardProgress("w2d", "p").run, null, "the full-pack slot is untouched");
	const saved = P.loadHardProgress("w2d", "p#subset").run;
	assert.ok(hardStateMatchesKeys(saved, [...keys].reverse()));
	assert.ok(!hardStateMatchesKeys(saved, ALL.slice(0, 6)));
	assert.equal(P.loadProgress("w2d", "p").mastered.length, 0, "Harder never writes Normal progress");
});

test("a word retired in Harder is enrolled in daily review", () => {
	P.enrollReview("w2d", "Cogent");
	const raw = JSON.parse(storage.getItem("gv_review_w2d"));
	assert.ok(raw.words.Cogent);
	assert.equal(storage.getItem("gv_progress_w2d"), null);
});
