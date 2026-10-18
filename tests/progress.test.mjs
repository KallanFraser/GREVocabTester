// Unit tests for lib/progress.js, lib/settings.js and lib/storage.js.
// Run with `node --test tests/`.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Minimal localStorage with the Web Storage enumeration API.
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
		if (this.failWrites) throw new Error("QuotaExceededError");
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
const events = [];

const storageLib = await import("../lib/storage.js");
const settingsLib = await import("../lib/settings.js");
const P = await import("../lib/progress.js");
const { createHardScheduler, restoreHardScheduler, WORD_RETIRED } = await import("../lib/hard-scheduler.js");

// Installed after import on purpose: nothing may touch storage at import time.
function installWindow() {
	globalThis.window = {
		localStorage: storage,
		dispatchEvent: (e) => events.push(e.type),
	};
}

beforeEach(() => {
	installWindow();
	storage.clear();
	storage.failWrites = false;
	events.length = 0;
});

const W = "w2d";
const D = "d2w";
const PACK = ["Abate", "Bolster", "Cajole", "Deride", "Enervate"];

function master(dir, scope, key) {
	let r;
	for (let i = 0; i < P.WORD_STREAK_TO_MASTER; i++) r = P.recordAnswer(dir, scope, key, true);
	return r;
}

// ---------------------------------------------------------------------------
// storage.js and SSR safety
// ---------------------------------------------------------------------------

test("without a window everything reads empty and writes are no-ops", () => {
	delete globalThis.window;
	assert.equal(storageLib.hasStorage(), false);
	assert.equal(storageLib.get("gv_x", "fb"), "fb");
	assert.equal(storageLib.set("gv_x", 1), false);
	assert.deepEqual(storageLib.keys("gv_"), []);
	assert.doesNotThrow(() => storageLib.remove("gv_x"));
	assert.deepEqual(settingsLib.loadSettings(), { ...settingsLib.DEFAULT_SETTINGS });
	assert.deepEqual(P.loadProgress(W, "all"), { mastered: [], streaks: {} });
	assert.doesNotThrow(() => P.recordAnswer(W, "all", "Abate", true));
	assert.deepEqual(P.exportProgress().data, {});
	assert.doesNotThrow(() => P.resetAll());
	assert.throws(() => P.applyImport({ writes: [["gv_settings", {}]] }), /unavailable/);
});

test("storage survives a throwing localStorage", () => {
	globalThis.window = {
		get localStorage() {
			throw new Error("SecurityError");
		},
	};
	assert.equal(storageLib.hasStorage(), false);
	assert.equal(storageLib.get("gv_x", 5), 5);
	globalThis.window = {
		localStorage: {
			getItem() {
				throw new Error("x");
			},
			setItem() {
				throw new Error("x");
			},
			removeItem() {
				throw new Error("x");
			},
			get length() {
				throw new Error("x");
			},
		},
	};
	assert.equal(storageLib.get("gv_x", 5), 5);
	assert.equal(storageLib.set("gv_x", 1), false);
	assert.doesNotThrow(() => storageLib.remove("gv_x"));
	assert.deepEqual(storageLib.keys(), []);
});

test("storage get/set round-trips JSON and tolerates junk", () => {
	storageLib.set("gv_a", { x: [1, 2] });
	assert.deepEqual(storageLib.get("gv_a"), { x: [1, 2] });
	storage.setItem("gv_bad", "{not json");
	assert.equal(storageLib.get("gv_bad", "fb"), "fb");
	storage.setItem("other", "1");
	assert.deepEqual(storageLib.keys("gv_").sort(), ["gv_a", "gv_bad"]);
});

// ---------------------------------------------------------------------------
// settings.js
// ---------------------------------------------------------------------------

test("settings defaults", () => {
	assert.deepEqual(settingsLib.loadSettings(), {
		direction: "w2d",
		testDifficulty: "normal",
		advanceDelay: 1.5,
		feedbackSounds: true,
		playBackground: "warp",
		pagesBackground: "fireflies-red",
	});
	assert.deepEqual(settingsLib.ADVANCE_DELAY_OPTIONS, [0.5, 1.5, 3, 5, "manual"]);
	assert.deepEqual(settingsLib.DIRECTIONS, ["w2d", "d2w"]);
});

test("settings: every value is coerced on read", () => {
	storage.setItem(
		"gv_settings",
		JSON.stringify({ direction: "de-en", advanceDelay: 2, feedbackSounds: "no", playBackground: "nope", pagesBackground: 7, extra: 1 }),
	);
	assert.deepEqual(settingsLib.loadSettings(), { ...settingsLib.DEFAULT_SETTINGS });
	storage.setItem("gv_settings", "[]");
	assert.deepEqual(settingsLib.loadSettings(), { ...settingsLib.DEFAULT_SETTINGS });
});

test("settings: save merges a patch, coerces it, and fires the event", () => {
	settingsLib.saveSettings({ direction: "d2w", advanceDelay: "manual" });
	settingsLib.saveSettings({ feedbackSounds: false, playBackground: "plain" });
	settingsLib.saveSettings({ pagesBackground: "bogus" });
	assert.deepEqual(settingsLib.loadSettings(), {
		direction: "d2w",
		testDifficulty: "normal",
		advanceDelay: "manual",
		feedbackSounds: false,
		playBackground: "plain",
		pagesBackground: "fireflies-red",
	});
	assert.deepEqual(events, ["gv-settings-change", "gv-settings-change", "gv-settings-change"]);
});

// ---------------------------------------------------------------------------
// Normal progress
// ---------------------------------------------------------------------------

test("constants unchanged: pool 5, streak 4", () => {
	assert.equal(P.POOL_SIZE, 5);
	assert.equal(P.WORD_STREAK_TO_MASTER, 4);
	assert.equal(P.ALL_SCOPE, "all");
	assert.equal(P.scopeIdFor(null), "all");
	assert.equal(P.scopeIdFor("argument-verbs"), "argument-verbs");
});

test("streaks: 4 in a row masters, any miss resets to 0", () => {
	assert.deepEqual(P.recordAnswer(W, "all", "Abate", true), { streak: 1, masteredNow: false, mastered: [], saved: true });
	P.recordAnswer(W, "all", "Abate", true);
	P.recordAnswer(W, "all", "Abate", true);
	assert.equal(P.loadProgress(W, "all").streaks.Abate, 3);
	assert.equal(P.recordAnswer(W, "all", "Abate", false).streak, 0);
	assert.deepEqual(P.loadProgress(W, "all").streaks, {});
	const r = master(W, "all", "Abate");
	assert.equal(r.masteredNow, true);
	assert.deepEqual(r.mastered, ["Abate"]);
	assert.deepEqual(P.loadProgress(W, "all"), { mastered: ["Abate"], streaks: {} });
	// Already mastered: nothing changes.
	assert.equal(P.recordAnswer(W, "all", "Abate", false).masteredNow, false);
	assert.deepEqual(P.loadProgress(W, "all").mastered, ["Abate"]);
});

test("progress is per direction and per scope", () => {
	master(W, "argument-verbs", "Bolster");
	P.recordAnswer(W, "custom-abc", "Cajole", true);
	assert.deepEqual(P.loadProgress(W, "argument-verbs").mastered, ["Bolster"]);
	assert.deepEqual(P.loadProgress(W, "all").mastered, []);
	assert.deepEqual(P.loadProgress(D, "argument-verbs").mastered, []);
	assert.deepEqual(P.loadProgress(W, "custom-abc").streaks, { Cajole: 1 });
	assert.ok(storage.getItem("gv_progress_w2d"));
	assert.equal(storage.getItem("gv_progress_d2w"), null);
	// An unknown direction never creates a stray key.
	P.recordAnswer("de-en", "all", "Abate", true);
	assert.equal(storage.getItem("gv_progress_de-en"), null);
});

test("a newly mastered word is enrolled in that direction's daily review", () => {
	master(W, "all", "Abate");
	const review = JSON.parse(storage.getItem("gv_review_w2d"));
	assert.ok(review.words.Abate);
	assert.equal(storage.getItem("gv_review_d2w"), null);
});

test("clearScopeStreaks drops streaks only", () => {
	master(W, "p", "Abate");
	P.recordAnswer(W, "p", "Bolster", true);
	P.clearScopeStreaks(W, "p");
	assert.deepEqual(P.loadProgress(W, "p"), { mastered: ["Abate"], streaks: {} });
	assert.doesNotThrow(() => P.clearScopeStreaks(W, "missing"));
});

test("corrupt progress storage loads as empty", () => {
	for (const raw of ["{not json", "42", "null", "[]", '{"scopes":7}', '{"scopes":{"p":"bad"}}']) {
		storage.setItem("gv_progress_w2d", raw);
		assert.deepEqual(P.loadProgress(W, "p"), { mastered: [], streaks: {} }, raw);
	}
	storage.setItem("gv_progress_w2d", JSON.stringify({ scopes: { p: { mastered: ["a", 3, "a"], streaks: { b: 9, c: -1, d: "x" } } } }));
	assert.deepEqual(P.loadProgress(W, "p"), { mastered: ["a"], streaks: { b: 3 } });
});

// ---------------------------------------------------------------------------
// Completions, rounds, best
// ---------------------------------------------------------------------------

test("markScopeComplete counts once per round and needs the scope fully mastered", () => {
	for (const k of PACK.slice(0, 4)) master(W, "p", k);
	assert.equal(P.markScopeComplete(W, "p", { keys: PACK }).counted, false, "not finished yet");
	master(W, "p", PACK[4]);
	const c = P.markScopeComplete(W, "p", { keys: PACK, accuracy: 0.8, answered: 25 });
	assert.equal(c.counted, true);
	assert.equal(c.count, 1);
	assert.equal(c.records[0].size, 5);
	assert.equal(c.records[0].accuracy, 0.8);
	assert.equal(typeof c.records[0].at, "string");
	assert.equal(P.markScopeComplete(W, "p", { keys: PACK }).counted, false, "idempotent");
	assert.equal(P.loadCompletions(W, "p").count, 1);
	assert.equal(P.loadCompletions(D, "p").count, 0, "per direction");
});

test("rounds: resetting a finished pack starts round 2 and keeps best and history", () => {
	for (const k of PACK) master(W, "p", k);
	P.markScopeComplete(W, "p", { keys: PACK, accuracy: 0.5, answered: 10 });
	let s = P.packSummary(W, "p", PACK);
	assert.equal(s.best, 5);
	assert.equal(s.round, 1);
	assert.equal(s.roundDone, true);
	assert.equal(s.lastRunPct, 50);

	P.clearScopeProgress(W, "p");
	s = P.packSummary(W, "p", PACK);
	assert.equal(s.round, 2);
	assert.equal(s.roundMastered, 0);
	assert.equal(s.best, 5, "best persists across rounds");
	assert.equal(s.completions, 1);
	assert.equal(s.finished, true);
	assert.deepEqual([...P.loadKnown(W, "p")].sort(), [...PACK].sort());

	// Finishing round 2 counts again.
	for (const k of PACK) master(W, "p", k);
	assert.equal(P.markScopeComplete(W, "p", { keys: PACK }).count, 2);
});

test("resetting an unfinished pack clears its round and removes the empty scope", () => {
	master(W, "p", "Abate");
	P.clearScopeProgress(W, "p");
	const s = P.packSummary(W, "p", PACK);
	assert.equal(s.best, 0);
	assert.equal(s.round, 1);
	assert.equal(JSON.parse(storage.getItem("gv_progress_w2d")).scopes.p, undefined);
});

test("best of a pack that grew after it was finished is capped at the credited size", () => {
	for (const k of PACK) master(W, "p", k);
	P.markScopeComplete(W, "p", { keys: PACK });
	const grown = [...PACK, "Fervid", "Garrulous"];
	const s = P.packSummary(W, "p", grown);
	assert.equal(s.total, 7);
	assert.equal(s.best, 5, "not 7 / 7");
	assert.equal(s.roundDone, false);
	assert.equal(P.packSummary(W, "p", PACK.slice(0, 3)).best, 3, "a shrunk pack caps at its size");
});

test("clearScopeKeys clears only the subset and starts a new round if it was finished", () => {
	for (const k of PACK) master(W, "p", k);
	P.markScopeComplete(W, "p", { keys: PACK });
	P.clearScopeKeys(W, "p", ["Abate", "Bolster"]);
	const s = P.packSummary(W, "p", PACK);
	assert.equal(s.round, 2);
	assert.equal(s.roundMastered, 3);
	assert.equal(s.best, 5);
	master(W, "p", "Abate");
	master(W, "p", "Bolster");
	assert.equal(P.markScopeComplete(W, "p", { keys: PACK }).count, 2);
});

test("selectionTarget runs a Choose Words subset in its parent's scope", () => {
	assert.deepEqual(P.selectionTarget("p", PACK, PACK.slice(0, 2)), { scopeId: "p", subset: true });
	assert.deepEqual(P.selectionTarget("p", PACK, [...PACK].reverse()), { scopeId: "p", subset: false });
	assert.deepEqual(P.selectionTarget(null, PACK, PACK.slice(1)), { scopeId: "all", subset: true });
	assert.equal(P.hardRunScope("p", true), "p#subset");
	assert.equal(P.hardRunScope("p", false), "p");
	assert.equal(P.allMastered(PACK, new Set(PACK)), true);
	assert.equal(P.allMastered(PACK, PACK.slice(1)), false);
	assert.equal(P.allMastered([], []), false);
});

// ---------------------------------------------------------------------------
// Harder
// ---------------------------------------------------------------------------

test("missing or corrupt gv_hard data loads as empty", () => {
	const empty = { run: null, count: 0, runs: [] };
	assert.deepEqual(P.loadHardProgress(W, "p"), empty);
	for (const raw of ["{not json", "42", "null", "[]", '{"scopes":7}', '{"scopes":{"p":"bad"}}']) {
		storage.setItem("gv_hard_w2d", raw);
		assert.deepEqual(P.loadHardProgress(W, "p"), empty, raw);
	}
	storage.setItem(
		"gv_hard_w2d",
		JSON.stringify({ scopes: { p: { run: "bad", count: "two", runs: [null, { firstTryPct: "x" }, { firstTryPct: 150 }] } } }),
	);
	const p = P.loadHardProgress(W, "p");
	assert.equal(p.run, null);
	assert.equal(p.count, 1);
	assert.equal(p.runs[0].firstTryPct, 100);
});

test("Harder: an in-progress run is saved and resumes", () => {
	const s = createHardScheduler(PACK, { seed: 4 });
	const k = s.next();
	s.recordResult(k, true);
	s.next(); // drawn, not answered
	P.saveHardRun(W, "p", s.serialize());
	const p = P.loadHardProgress(W, "p");
	assert.deepEqual(P.hardRetiredKeys(p), [k]);
	const r = restoreHardScheduler(p.run, PACK);
	assert.equal(r.stateOf(k).status, WORD_RETIRED);
	assert.equal(r.next(), s.next());
	assert.equal(P.loadHardProgress(D, "p").run, null, "per direction");
	assert.ok(storage.getItem("gv_hard_w2d"));
});

test("Harder: finished runs keep timestamp and first-try %, best and last", () => {
	P.saveHardRun(W, "p", createHardScheduler(PACK).serialize());
	P.recordHardRun(W, "p", { firstTryPct: 60, totalWords: 5, at: "2026-10-01T00:00:00.000Z" });
	P.recordHardRun(W, "p", { retiredFirstTry: 4, totalWords: 5 }); // 80%
	P.recordHardRun(W, "p", { firstTryPct: 40, totalWords: 5 });
	const p = P.loadHardProgress(W, "p");
	assert.equal(p.run, null, "a finished run clears the in-progress one");
	assert.equal(P.hardCompletionCount(p), 3);
	assert.equal(P.hardBestPct(p), 80);
	assert.equal(P.hardLastPct(p), 40);
	assert.equal(p.runs[0].at, "2026-10-01T00:00:00.000Z");
	assert.equal(typeof p.runs[1].at, "string");
	const summary = P.packSummary(W, "p", PACK);
	assert.deepEqual(summary.hard, { completions: 3, resumeRetired: null, bestPct: 80, lastPct: 40 });
	const none = P.loadHardProgress(W, "other");
	assert.equal(P.hardBestPct(none), null);
	assert.equal(P.hardLastPct(none), null);
});

test("Harder: restart keeps history; reset removes one scope only", () => {
	P.recordHardRun(W, "p", { firstTryPct: 70, totalWords: 5 });
	P.recordHardRun(W, "q", { firstTryPct: 70, totalWords: 5 });
	P.saveHardRun(W, "p", createHardScheduler(PACK).serialize());
	P.restartHardRun(W, "p");
	assert.equal(P.loadHardProgress(W, "p").run, null);
	assert.equal(P.hardCompletionCount(P.loadHardProgress(W, "p")), 1);
	P.resetHardScope(W, "p");
	assert.deepEqual(P.loadHardProgress(W, "p"), { run: null, count: 0, runs: [] });
	assert.equal(P.hardCompletionCount(P.loadHardProgress(W, "q")), 1);
});

test("Harder functions never touch Normal progress", () => {
	master(W, "p", "Abate");
	P.recordAnswer(W, "p", "Bolster", true);
	const before = storage.getItem("gv_progress_w2d");
	const s = createHardScheduler(PACK, { seed: 5 });
	for (let i = 0; i < 6; i++) s.recordResult(s.next(), i % 2 === 0);
	P.saveHardRun(W, "p", s.serialize());
	P.recordHardRun(W, "p", { firstTryPct: 100, totalWords: 5 });
	P.restartHardRun(W, "p");
	P.resetHardScope(W, "p");
	assert.equal(storage.getItem("gv_progress_w2d"), before);
	assert.equal(storage.getItem("gv_progress_d2w"), null);
});

// ---------------------------------------------------------------------------
// Review storage
// ---------------------------------------------------------------------------

test("review: first load seeds existing mastery once; answers move the ladder", () => {
	storage.setItem("gv_progress_w2d", JSON.stringify({ scopes: { p: { mastered: ["Bolster", "Abate"], streaks: {} } } }));
	const st = P.loadReview(W);
	assert.equal(st.seeded, true);
	assert.deepEqual(Object.keys(st.words).sort(), ["Abate", "Bolster"]);
	P.recordReviewAnswer(W, "Abate", true);
	const after = JSON.parse(storage.getItem("gv_review_w2d"));
	assert.equal(after.words.Abate.interval, 3);
	assert.equal(after.day.reviewed, 1);
	const q = P.loadReviewQueue(W, 50);
	assert.ok(Array.isArray(q.keys));
	assert.equal(q.remaining, 49);
});

// ---------------------------------------------------------------------------
// Last pack
// ---------------------------------------------------------------------------

test("last pack: save, load, validation", () => {
	assert.equal(P.loadLastPack(), null);
	P.saveLastPack({ id: "argument-verbs", title: "Argument Verbs", words: ["Advocate", "Bolster", "Bolster"] });
	assert.deepEqual(P.loadLastPack(), { id: "argument-verbs", title: "Argument Verbs", words: ["Advocate", "Bolster"] });
	P.saveLastPack({ id: null, title: "Ad hoc", words: ["a"] });
	P.saveLastPack({ id: "x", title: "Empty", words: [] });
	assert.equal(P.loadLastPack().id, "argument-verbs", "invalid packs are not saved");
	storage.setItem("gv_last_pack", '{"id":5}');
	assert.equal(P.loadLastPack(), null);
	P.saveLastPack({ id: "custom-1", title: "Mine", words: ["Abate"] });
	P.clearLastPack();
	assert.equal(P.loadLastPack(), null);
});

// ---------------------------------------------------------------------------
// Export / import / reset all
// ---------------------------------------------------------------------------

function seedEverything() {
	settingsLib.saveSettings({ direction: "d2w" });
	master(W, "p", "Abate");
	master(D, "all", "Bolster");
	P.recordHardRun(W, "p", { firstTryPct: 90, totalWords: 5 });
	P.saveLastPack({ id: "p", title: "Pack", words: PACK });
	storage.setItem("gv_custom_packs", JSON.stringify([{ id: "custom-1", title: "Mine", words: PACK }]));
	storage.setItem("gv_favorites", JSON.stringify({ version: 1, ids: ["p"] }));
	storage.setItem("wp_upvote_ledger_v2", JSON.stringify({ p: true }));
	storage.setItem("wp_likes:p", "2");
	storage.setItem("marketplaceWordpack", "[1,2,3]");
	storage.setItem("unrelated", "keep");
}

test("export holds every gv_ key, versioned, and nothing else", () => {
	seedEverything();
	const dump = P.exportProgress();
	assert.equal(dump.app, "grevocabtester");
	assert.equal(dump.version, 1);
	assert.equal(typeof dump.exportedAt, "string");
	assert.deepEqual(Object.keys(dump.data).sort(), [
		"gv_custom_packs",
		"gv_favorites",
		"gv_hard_w2d",
		"gv_last_pack",
		"gv_progress_d2w",
		"gv_progress_w2d",
		"gv_review_d2w",
		"gv_review_w2d",
		"gv_settings",
	]);
	assert.deepEqual(dump.data.gv_progress_w2d.scopes.p.mastered, ["Abate"]);
	assert.equal(dump.data.gv_hard_w2d.scopes.p.count, 1);
});

test("reset all clears every gv_ key, including the last pack, and the legacy keys", () => {
	seedEverything();
	P.resetAll();
	assert.deepEqual(storageLib.keys("gv_"), []);
	assert.equal(P.loadLastPack(), null);
	assert.equal(storage.getItem("wp_upvote_ledger_v2"), null);
	assert.equal(storage.getItem("wp_likes:p"), null);
	assert.equal(storage.getItem("marketplaceWordpack"), null);
	assert.equal(storage.getItem("unrelated"), "keep");
	assert.deepEqual(settingsLib.loadSettings(), { ...settingsLib.DEFAULT_SETTINGS });
});

test("import restores an export after a reset", () => {
	seedEverything();
	const dump = JSON.parse(JSON.stringify(P.exportProgress()));
	P.resetAll();
	const written = P.importProgress(dump);
	assert.ok(written.includes("gv_progress_w2d"));
	assert.deepEqual(P.loadProgress(W, "p").mastered, ["Abate"]);
	assert.deepEqual(P.loadProgress(D, "all").mastered, ["Bolster"]);
	assert.equal(P.hardLastPct(P.loadHardProgress(W, "p")), 90);
	assert.equal(P.loadLastPack().id, "p");
	assert.equal(settingsLib.loadSettings().direction, "d2w");
	assert.deepEqual(JSON.parse(storage.getItem("gv_favorites")).ids, ["p"]);
	assert.ok(events.includes("gv-settings-change"));
});

test("import validates before writing anything", () => {
	seedEverything();
	const before = new Map(storage.map);
	const bad = [
		null,
		[],
		{ data: {} },
		{ version: 1, app: "wortschatz", data: { gv_settings: {} } },
		{ version: 0, data: { gv_settings: {} } },
		{ version: 2, data: { gv_settings: {} } },
		{ version: 1, data: [] },
		{ version: 1, data: {} },
		{ version: 1, data: { dv_settings: {} } },
		{ version: 1, data: { gv_settings: {}, gv_progress_w2d: { scopes: { p: { mastered: "x", streaks: {} } } } } },
		{ version: 1, data: { gv_progress_w2d: 5 } },
		{ version: 1, data: { gv_hard_w2d: 5 } },
		{ version: 1, data: { gv_settings: "dark" } },
	];
	for (const b of bad) assert.throws(() => P.importProgress(b), Error, JSON.stringify(b));
	assert.deepEqual(new Map(storage.map), before);
});

test("import normalizes values, skips unknown directions and non-gv keys", () => {
	const prepared = P.prepareImport({
		version: 1,
		data: {
			gv_settings: { direction: "nope", advanceDelay: 3 },
			gv_progress_w2d: { scopes: { p: { mastered: ["Abate", "Abate"], streaks: { Bolster: 2 } } } },
			"gv_progress_de-en": { scopes: {} },
			gv_last_pack: { id: 4 },
			other_key: 1,
		},
	});
	const writes = Object.fromEntries(prepared.writes);
	assert.deepEqual(writes.gv_settings.direction, "w2d");
	assert.equal(writes.gv_settings.advanceDelay, 3);
	assert.deepEqual(writes.gv_progress_w2d.scopes.p.mastered, ["Abate"]);
	assert.deepEqual(prepared.skipped.sort(), ["gv_last_pack", "gv_progress_de-en", "other_key"]);
	assert.deepEqual(prepared.summary, [{ direction: "w2d", file: 1, device: 0 }]);
});

test("a failed import write rolls back every key", () => {
	seedEverything();
	const before = new Map(storage.map);
	const prepared = P.prepareImport({ version: 1, data: { gv_settings: { direction: "w2d" }, gv_favorites: { ids: [] } } });
	let n = 0;
	const real = storage.setItem.bind(storage);
	storage.setItem = (k, v) => {
		if (++n === 2) throw new Error("QuotaExceededError");
		real(k, v);
	};
	try {
		assert.throws(() => P.applyImport(prepared), /Nothing was imported/);
	} finally {
		delete storage.setItem;
	}
	assert.deepEqual(new Map(storage.map), before);
});

test("import takes only known gv_ keys, each through its normalizer, and lists the rest", () => {
	const prepared = P.prepareImport({
		version: 1,
		data: {
			gv_custom_packs: [{ id: "custom-a", title: " A ", words: ["Abate", 3, "Abate", "Guy"] }, "junk", { id: "x", words: ["Y"] }],
			gv_favorites: { version: 1, ids: ["p", 5, "p"] },
			gv_practice_pos: { p: 3, q: -1, r: "2", __proto__: 4 },
			gv_future_feature: { anything: true },
			gv_hard_w2d: { scopes: { p: { run: null, count: 2, runs: [] } } },
			gv_review_d2w: { seeded: true, words: { Abate: { interval: 3, due: "2026-10-20" } } },
			gv_settings: { direction: "d2w" },
			gv_last_pack: { id: "p", title: "P", words: ["Abate"] },
		},
	});
	const writes = Object.fromEntries(prepared.writes);
	assert.deepEqual(writes.gv_custom_packs.map((p) => [p.id, p.title, p.words]), [["custom-a", "A", ["Abate", "Guy"]]]);
	assert.deepEqual(writes.gv_favorites, { version: 1, ids: ["p"] });
	assert.deepEqual(writes.gv_practice_pos, { p: 3 });
	assert.deepEqual(prepared.skipped, ["gv_future_feature"]);
	assert.ok(!("gv_future_feature" in writes));
	assert.equal(writes.gv_hard_w2d.scopes.p.count, 2);
	assert.equal(writes.gv_review_d2w.words.Abate.interval, 3);
	// A known key with the wrong shape fails the whole import.
	assert.throws(() => P.prepareImport({ version: 1, data: { gv_custom_packs: { a: 1 } } }), /Invalid value/);
	assert.throws(() => P.prepareImport({ version: 1, data: { gv_favorites: [1] } }), /Invalid value/);
});

test("__proto__, constructor and prototype keys are never copied from stored or imported data", () => {
	const text =
		'{"version":1,"data":{' +
		'"__proto__":{"polluted":true},' +
		'"gv_progress_w2d":{"scopes":{"__proto__":{"mastered":["X"],"streaks":{}},"constructor":{"mastered":[],"streaks":{}},' +
		'"p":{"mastered":["Abate"],"streaks":{"__proto__":2,"prototype":1,"Bolster":2}}}},' +
		'"gv_hard_w2d":{"scopes":{"__proto__":{"run":null},"p":{"run":{"words":{"__proto__":{"status":"x"},"Abate":{"status":"active"}}}}}},' +
		'"gv_review_w2d":{"seeded":true,"words":{"__proto__":{"interval":1,"due":"2026-10-20"},"Abate":{"interval":1,"due":"2026-10-20"}}},' +
		'"gv_practice_pos":{"__proto__":1,"p":2}}}';
	const prepared = P.prepareImport(P.parseBackupText(text));
	const writes = Object.fromEntries(prepared.writes);
	assert.deepEqual(Object.keys(writes.gv_progress_w2d.scopes), ["p"]);
	assert.deepEqual(writes.gv_progress_w2d.scopes.p.streaks, { Bolster: 2 });
	assert.equal(Object.getPrototypeOf(writes.gv_progress_w2d.scopes.p.streaks), Object.prototype);
	assert.deepEqual(Object.keys(writes.gv_hard_w2d.scopes), ["p"]);
	assert.deepEqual(Object.keys(writes.gv_hard_w2d.scopes.p.run.words), ["Abate"]);
	assert.deepEqual(Object.keys(writes.gv_review_w2d.words), ["Abate"]);
	assert.equal(Object.getPrototypeOf(writes.gv_review_w2d.words), Object.prototype);
	assert.deepEqual(writes.gv_practice_pos, { p: 2 });
	assert.ok(prepared.skipped.includes("__proto__"));
	assert.equal({}.polluted, undefined);
	// The same holds for what is already in storage.
	storage.setItem("gv_progress_d2w", '{"scopes":{"__proto__":{"mastered":["X"],"streaks":{}},"p":{"mastered":[],"streaks":{"__proto__":2}}}}');
	assert.deepEqual(P.loadProgress(D, "p").streaks, {});
	assert.deepEqual(P.loadProgress(D, "__proto__").mastered, []);
});

test("parseBackupText: 2 MB limit for pasted text, clear JSON errors", () => {
	assert.equal(P.MAX_IMPORT_BYTES, 2 * 1024 * 1024);
	assert.deepEqual(P.parseBackupText('{"version":1}'), { version: 1 });
	assert.throws(() => P.parseBackupText("{not json"), /not valid JSON/);
	assert.throws(() => P.parseBackupText("   "), /nothing to import/);
	assert.throws(() => P.parseBackupText(null), /nothing to import/);
	const big = JSON.stringify({ version: 1, data: { gv_x: "a".repeat(P.MAX_IMPORT_BYTES) } });
	assert.throws(() => P.parseBackupText(big), /larger than 2 MB/);
	// Multi-byte characters count by bytes, not string length.
	const wide = "é".repeat(P.MAX_IMPORT_BYTES / 2 + 10);
	assert.throws(() => P.parseBackupText(`"${wide}"`), /larger than 2 MB/);
});

test("a failed import removes touched keys and restores snapshots, including keys that did not exist", () => {
	seedEverything();
	storage.removeItem("gv_practice_pos");
	const before = new Map(storage.map);
	const prepared = P.prepareImport({
		version: 1,
		data: { gv_practice_pos: { p: 1 }, gv_settings: { direction: "w2d" }, gv_favorites: { ids: [] } },
	});
	let n = 0;
	const real = storage.setItem.bind(storage);
	storage.setItem = (k, v) => {
		if (++n === 3) throw new Error("QuotaExceededError");
		real(k, v);
	};
	try {
		assert.throws(() => P.applyImport(prepared), /Nothing was imported, and your existing progress is unchanged/);
	} finally {
		delete storage.setItem;
	}
	assert.deepEqual(new Map(storage.map), before);
	assert.equal(storage.getItem("gv_practice_pos"), null);
});

test("a failed import says so when a restore also fails", () => {
	seedEverything();
	const prepared = P.prepareImport({ version: 1, data: { gv_settings: { direction: "w2d" }, gv_favorites: { ids: [] } } });
	let n = 0;
	const real = storage.setItem.bind(storage);
	storage.setItem = (k, v) => {
		if (++n >= 2) throw new Error("QuotaExceededError");
		real(k, v);
	};
	let caught = null;
	try {
		P.applyImport(prepared);
	} catch (e) {
		caught = e;
	} finally {
		delete storage.setItem;
	}
	assert.ok(caught);
	assert.match(caught.message, /could not be put back/);
	// Both touched keys held data before, and neither could be written back.
	assert.deepEqual(caught.restoreFailed, ["gv_settings", "gv_favorites"]);
});

test("a write that silently does not stick counts as a failure", () => {
	const prepared = P.prepareImport({ version: 1, data: { gv_settings: { direction: "d2w" } } });
	const real = storage.setItem.bind(storage);
	storage.setItem = (k, v) => real(k, k === "gv_settings" ? "{}" : v);
	try {
		assert.throws(() => P.applyImport(prepared), /Storage is full or blocked/);
	} finally {
		delete storage.setItem;
	}
});

test("failed progress and Harder saves are reported, not thrown", () => {
	P.resetSaveFailed();
	assert.equal(P.saveHasFailed(), false);
	assert.equal(P.recordAnswer(W, "p", "Abate", true).saved, true);
	storage.failWrites = true;
	assert.equal(P.recordAnswer(W, "p", "Abate", true).saved, false);
	assert.equal(P.saveHasFailed(), true);
	assert.ok(events.includes(P.SAVE_FAILED_EVENT));
	assert.equal(P.saveProgress(W, "p", { mastered: [], streaks: {} }), false);
	assert.equal(P.saveHardRun(W, "p", { words: {} }), false);
	assert.equal(P.recordHardRun(W, "p", { firstTryPct: 50, totalWords: 5 }).saved, false);
	storage.failWrites = false;
	assert.equal(P.saveHardRun(W, "p", { words: {} }), true);
	P.resetSaveFailed();
});