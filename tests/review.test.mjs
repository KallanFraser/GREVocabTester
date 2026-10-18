// Unit tests for lib/review.js, ported from Wortschatz. Run with
// `node --test tests/`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
	REVIEW_INTERVALS,
	REVIEW_SEED_SPREAD_DAYS,
	DEFAULT_REVIEW_CAP,
	REVIEW_RETRY_GAP,
	localDay,
	parseDay,
	addDays,
	nextInterval,
	emptyReviewState,
	normalizeReviewState,
	enrollWord,
	seedReviewState,
	applyReviewResult,
	dueKeys,
	reviewedToday,
	countReviewed,
	reviewQueue,
	createReviewSession,
	wordReviewOpts,
	compareHeadwords,
} from "../lib/review.js";

const TODAY = "2026-10-09";

function stateWith(words, extra = {}) {
	return { ...emptyReviewState(), seeded: true, words, ...extra };
}

test("constants are the spec values", () => {
	assert.deepEqual(REVIEW_INTERVALS, [1, 3, 7, 14, 30, 60, 120]);
	assert.equal(REVIEW_SEED_SPREAD_DAYS, 14);
	assert.equal(DEFAULT_REVIEW_CAP, 50);
});

test("interval steps: correct moves up one step, the top step repeats", () => {
	let entry = { interval: 1, due: TODAY };
	const seen = [];
	for (let i = 0; i < 8; i++) {
		entry = applyReviewResult(entry, true, TODAY);
		seen.push(entry.interval);
	}
	assert.deepEqual(seen, [3, 7, 14, 30, 60, 120, 120, 120]);
	assert.deepEqual(applyReviewResult({ interval: 7, due: TODAY }, true, TODAY), { interval: 14, due: "2026-10-23" });
	assert.equal(nextInterval(999), 1, "an unknown interval restarts the ladder");
});

test("any miss resets to one day, from any step", () => {
	for (const interval of REVIEW_INTERVALS) {
		assert.deepEqual(applyReviewResult({ interval, due: TODAY }, false, TODAY), { interval: 1, due: "2026-10-10" });
	}
	assert.deepEqual(applyReviewResult(undefined, true, TODAY), { interval: 3, due: "2026-10-12" });
});

test("enrolling: first step, due tomorrow; an enrolled word keeps its schedule", () => {
	const s1 = enrollWord(emptyReviewState(), "Abate", TODAY);
	assert.deepEqual(s1.words.Abate, { interval: 1, due: "2026-10-10" });
	const s2 = stateWith({ Abate: { interval: 30, due: "2026-11-01" } });
	assert.equal(enrollWord(s2, "Abate", TODAY), s2);
});

test("seeding spreads existing mastery evenly over the next 14 days", () => {
	const keys = Array.from({ length: 70 }, (_, i) => `w${String(i).padStart(2, "0")}`);
	const s = seedReviewState(emptyReviewState(), keys, TODAY);
	assert.equal(s.seeded, true);
	assert.equal(Object.keys(s.words).length, 70);
	const perDay = {};
	for (const e of Object.values(s.words)) {
		assert.equal(e.interval, 1);
		perDay[e.due] = (perDay[e.due] || 0) + 1;
	}
	const days = Object.keys(perDay).sort();
	assert.equal(days.length, 14);
	assert.equal(days[0], TODAY);
	assert.equal(days[13], addDays(TODAY, 13));
	for (const d of days) assert.equal(perDay[d], 5, `${d} gets an even share`);
});

test("seeding: few words never pile up, existing entries are kept, empty input still marks seeded", () => {
	const s = seedReviewState(emptyReviewState(), ["a", "b", "c"], TODAY);
	assert.equal(new Set(Object.values(s.words).map((e) => e.due)).size, 3);
	const kept = seedReviewState(stateWith({ a: { interval: 60, due: "2027-01-01" } }), ["a", "b"], TODAY);
	assert.deepEqual(kept.words.a, { interval: 60, due: "2027-01-01" });
	assert.ok(kept.words.b);
	const none = seedReviewState(emptyReviewState(), [], TODAY);
	assert.equal(none.seeded, true);
	assert.deepEqual(none.words, {});
});

test("due counting: only due or overdue, most overdue first, unknown keys skipped", () => {
	const s = stateWith({
		future: { interval: 3, due: "2026-10-10" },
		today: { interval: 1, due: TODAY },
		old: { interval: 7, due: "2026-10-01" },
		gone: { interval: 1, due: "2026-09-01" },
	});
	const known = (k) => k !== "gone";
	assert.deepEqual(dueKeys(s, TODAY, { isKnown: known }), ["old", "today"]);
	assert.deepEqual(dueKeys(s, TODAY), ["gone", "old", "today"]);
	assert.deepEqual(dueKeys(s, "2026-10-10", { isKnown: known }), ["old", "today", "future"]);
});

test("GRE has no rank: due ties break alphabetically by headword, case-insensitive", () => {
	const vocab = { Zealot: { definition: "z" }, abate: { definition: "a" }, Mitigate: { definition: "m" } };
	const s = stateWith({
		Zealot: { interval: 1, due: TODAY },
		Mitigate: { interval: 1, due: TODAY },
		abate: { interval: 1, due: TODAY },
		Gone: { interval: 1, due: TODAY },
	});
	assert.deepEqual(dueKeys(s, TODAY, wordReviewOpts(vocab)), ["abate", "Mitigate", "Zealot"]);
	assert.equal(wordReviewOpts(vocab).isKnown("constructor"), false);
	assert.equal(wordReviewOpts(vocab).rank("Zealot"), undefined);
	assert.ok(compareHeadwords("Abate", "abate") !== 0, "the order is total");
});

test("a numeric rank, if one is ever added, wins over alphabetical", () => {
	const words = { b: { rank: 1 }, a: { rank: 2 }, c: {} };
	const s = stateWith({ a: { interval: 1, due: TODAY }, b: { interval: 1, due: TODAY }, c: { interval: 1, due: TODAY } });
	assert.deepEqual(dueKeys(s, TODAY, wordReviewOpts(words)), ["b", "a", "c"]);
});

test("cap: a session takes at most what is left of the daily cap", () => {
	const words = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`w${i}`, { interval: 1, due: TODAY }]));
	let s = stateWith(words);
	let q = reviewQueue(s, TODAY, 50);
	assert.equal(q.due, 80);
	assert.equal(q.keys.length, 50);
	for (let i = 0; i < 45; i++) s = countReviewed(s, TODAY);
	assert.equal(reviewedToday(s, TODAY), 45);
	q = reviewQueue(s, TODAY, 50);
	assert.equal(q.keys.length, 5);
	for (let i = 0; i < 10; i++) s = countReviewed(s, TODAY);
	assert.equal(reviewQueue(s, TODAY, 50).keys.length, 0, "never negative");
	assert.equal(reviewedToday(s, "2026-10-10"), 0);
	assert.equal(reviewQueue(s, "2026-10-10", 50).keys.length, 50);
	assert.equal(reviewQueue(stateWith(words), TODAY, "lots").keys.length, DEFAULT_REVIEW_CAP);
});

test("corrupt or missing state normalizes instead of throwing", () => {
	for (const raw of [null, undefined, 42, "x", [], { words: "nope" }]) {
		assert.deepEqual(normalizeReviewState(raw, TODAY).words, {});
	}
	assert.equal(normalizeReviewState(null, TODAY).seeded, false);
	const s = normalizeReviewState(
		{
			seeded: true,
			words: {
				ok: { interval: 7, due: "2026-10-12" },
				badInterval: { interval: 5, due: "2026-10-12" },
				badDue: { interval: 3, due: "2026-02-31" },
				junk: 7,
			},
			day: { date: "garbage", reviewed: -3 },
		},
		TODAY,
	);
	assert.deepEqual(s.words.ok, { interval: 7, due: "2026-10-12" });
	assert.deepEqual(s.words.badInterval, { interval: 1, due: "2026-10-12" });
	assert.deepEqual(s.words.badDue, { interval: 3, due: TODAY });
	assert.equal(s.words.junk, undefined);
	assert.deepEqual(s.day, { date: "", reviewed: 0 });
});

test("dates use the local day boundary and survive DST", () => {
	assert.equal(localDay(new Date(2026, 9, 9, 23, 30)), "2026-10-09");
	assert.equal(localDay(new Date(2026, 9, 10, 0, 5)), "2026-10-10");
	assert.equal(addDays("2026-03-28", 1), "2026-03-29");
	assert.equal(addDays("2026-03-28", 2), "2026-03-30");
	assert.equal(addDays("2026-10-24", 2), "2026-10-26");
	assert.equal(addDays("2026-12-31", 1), "2027-01-01");
	assert.equal(parseDay("2026-02-30"), null);
	assert.equal(addDays("not-a-day", 3), "not-a-day");
});

test("session: a miss comes back later and must be answered correctly", () => {
	const s = createReviewSession(["a", "b", "c", "d", "e"]);
	assert.equal(s.next(), "a");
	assert.deepEqual(s.record("a", false), { firstAnswer: true });
	const order = [];
	while (!s.isDone()) {
		const k = s.next();
		order.push(k);
		assert.equal(s.record(k, true).firstAnswer, k !== "a");
	}
	assert.deepEqual(order, ["b", "c", "d", "a", "e"]);
	assert.equal(order.indexOf("a"), REVIEW_RETRY_GAP);
	assert.deepEqual(s.stats(), { total: 5, reviewed: 5, done: 5, correctFirstTry: 4, missed: [{ key: "a", misses: 1 }] });
});

test("session: the last word missed repeats until correct; empty session is done", () => {
	const s = createReviewSession(["only"]);
	s.record("only", false);
	s.record("only", false);
	assert.equal(s.next(), "only");
	s.record("only", true);
	assert.equal(s.isDone(), true);
	assert.deepEqual(s.stats().missed, [{ key: "only", misses: 2 }]);
	assert.equal(createReviewSession([]).isDone(), true);
	assert.throws(() => createReviewSession(["x", "y"]).record("y", true));
});
