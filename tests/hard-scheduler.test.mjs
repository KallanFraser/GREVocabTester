// Unit tests for lib/hard-scheduler.js, ported from Wortschatz
// (tests/hard-scheduler.test.mjs plus the scheduler half of
// tests/hard-progress.test.mjs). Run with `node --test tests/`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
	createHardScheduler,
	restoreHardScheduler,
	hardStateMatchesKeys,
	HARD_COOLDOWN_CARDS,
	HARD_RELEARN_CORRECT,
	WORD_UNSEEN,
	WORD_LEARNING,
	WORD_RETIRED,
} from "../lib/hard-scheduler.js";

// rng = 0 always takes the first eligible key in selection order, which makes
// the draw sequence fully predictable.
const first = () => 0;

// Draw and answer until done. `answer(key, cardIndex)` returns true for correct.
function run(s, answer) {
	const shown = [];
	while (!s.isDone()) {
		assert.ok(shown.length < 10000, "session did not terminate");
		const key = s.next();
		s.recordResult(key, answer(key, shown.length));
		shown.push(key);
	}
	assert.equal(s.next(), null);
	return shown;
}

function unretiredCount(s, keys) {
	return keys.filter((k) => s.stateOf(k).status !== WORD_RETIRED).length;
}

// Answer a few cards deterministically: miss every second one.
function playSome(s, n) {
	for (let i = 0; i < n; i++) {
		const k = s.next();
		if (k === null) return;
		s.recordResult(k, i % 2 === 0);
	}
}

test("constants are the spec values", () => {
	assert.equal(HARD_COOLDOWN_CARDS, 3);
	assert.equal(HARD_RELEARN_CORRECT, 2);
});

test("correct on the first draw retires the word for good", () => {
	const s = createHardScheduler(["a", "b", "c"], { rng: first });
	assert.equal(s.stateOf("a").status, WORD_UNSEEN);
	assert.equal(s.stateOf("a").needs, null);
	const shown = run(s, () => true);
	assert.deepEqual(shown, ["a", "b", "c"]);
	for (const k of ["a", "b", "c"]) assert.equal(s.stateOf(k).status, WORD_RETIRED);
	assert.deepEqual(s.stats(), { totalWords: 3, retired: 3, retiredFirstTry: 3, missed: [], cardsShown: 3 });
});

test("a miss then two spaced correct answers retires the word", () => {
	const keys = ["a", "b", "c", "d", "e", "f", "g", "h"];
	const s = createHardScheduler(keys, { rng: first });
	const seen = [];
	const step = (correct) => {
		const k = s.next();
		s.recordResult(k, correct);
		seen.push(k);
		return k;
	};

	assert.equal(step(false), "a");
	assert.deepEqual(s.stateOf("a"), { status: WORD_LEARNING, needs: 2, misses: 1 });
	step(true);
	step(true);
	step(true); // b, c, d
	assert.equal(step(true), "a"); // back after exactly three other cards
	assert.deepEqual(s.stateOf("a"), { status: WORD_LEARNING, needs: 1, misses: 1 });
	step(true);
	step(true);
	step(true); // e, f, g
	assert.equal(step(true), "a");
	assert.equal(s.stateOf("a").status, WORD_RETIRED);
	run(s, () => true);

	assert.deepEqual(seen, ["a", "b", "c", "d", "a", "e", "f", "g", "a"]);
	const st = s.stats();
	assert.equal(st.retiredFirstTry, 7); // everything but a
	assert.deepEqual(st.missed, [{ key: "a", misses: 1 }]);
	assert.equal(st.cardsShown, 10);
});

test("repeated misses reset the requirement to 2 and never raise it", () => {
	const s = createHardScheduler(["a", "b", "c", "d", "e", "f"], { rng: first });
	// Script a: wrong, wrong, correct, wrong, correct, correct. Everything else is right.
	const script = [false, false, true, false, true, true];
	run(s, (k) => (k === "a" ? script.shift() : true));
	assert.equal(script.length, 0);
	assert.equal(s.stateOf("a").misses, 3);
	assert.equal(s.stateOf("a").status, WORD_RETIRED);

	// Step-by-step needs on a single-word selection, where a is drawn every time.
	const one = createHardScheduler(["a"], { rng: first });
	const needsAfter = [];
	for (const correct of [false, false, true, false, false, false]) {
		one.recordResult(one.next(), correct);
		needsAfter.push(one.stateOf("a").needs);
	}
	assert.deepEqual(needsAfter, [2, 2, 1, 2, 2, 2]);
	assert.equal(one.stateOf("a").misses, 5);
	assert.deepEqual(one.stats().missed, [{ key: "a", misses: 5 }]);
});

test("cooldown: an unretired word waits for 3 other cards when anything else can be shown", () => {
	const keys = Array.from({ length: 12 }, (_, i) => `w${i}`);
	for (let seed = 1; seed <= 200; seed++) {
		const s = createHardScheduler(keys, { seed });
		let r = seed;
		const coin = () => ((r = (r * 1103515245 + 12345) >>> 0) % 100) < 40; // ~40% wrong
		const lastAt = new Map(); // key -> card index of its last unretired answer
		let card = 0;
		while (!s.isDone()) {
			const live = unretiredCount(s, keys);
			const k = s.next();
			if (lastAt.has(k) && live > HARD_COOLDOWN_CARDS) {
				// At most HARD_COOLDOWN_CARDS keys can be cooling down at once, so
				// with more unretired keys than that the early draw must never fire.
				assert.ok(
					card - lastAt.get(k) > HARD_COOLDOWN_CARDS,
					`seed ${seed}: ${k} reshown after ${card - lastAt.get(k) - 1} other cards`,
				);
			}
			s.recordResult(k, !coin());
			if (s.stateOf(k).status === WORD_RETIRED) lastAt.delete(k);
			else lastAt.set(k, card);
			card++;
			assert.ok(card < 10000);
		}
		assert.equal(s.stats().cardsShown, card);
	}
});

test("never the same word twice in a row unless it is the only unretired word", () => {
	const keys = ["a", "b", "c", "d", "e"];
	for (let seed = 1; seed <= 200; seed++) {
		const s = createHardScheduler(keys, { seed });
		let r = seed;
		const wrong = () => ((r = (r * 1103515245 + 12345) >>> 0) % 100) < 60;
		let prev = null;
		while (!s.isDone()) {
			const live = unretiredCount(s, keys);
			const k = s.next();
			if (k === prev) assert.equal(live, 1, `seed ${seed}: ${k} repeated with ${live} words left`);
			s.recordResult(k, !wrong());
			prev = k;
		}
	}
});

test("when every unretired word is cooling down, the soonest one is drawn early", () => {
	const s = createHardScheduler(["a", "b", "c"], { rng: first });
	const shown = [];
	for (let i = 0; i < 5; i++) {
		const k = s.next();
		s.recordResult(k, false);
		shown.push(k);
	}
	// a, b, c all missed; then nothing is eligible, so a (soonest) goes early,
	// then b — never the card just shown.
	assert.deepEqual(shown, ["a", "b", "c", "a", "b"]);
});

test("last remaining word is drawn straight away, even twice in a row", () => {
	const s = createHardScheduler(["a", "b"], { rng: first });
	const step = (correct) => {
		const k = s.next();
		s.recordResult(k, correct);
		return k;
	};
	assert.equal(step(false), "a");
	assert.equal(step(true), "b"); // b retires on its first draw
	assert.equal(step(false), "a"); // still cooling down, but the only word left
	assert.equal(step(true), "a"); // twice in a row: allowed, nothing else remains
	assert.equal(s.stateOf("a").needs, 1);
	assert.equal(step(true), "a");
	assert.ok(s.isDone());
	assert.deepEqual(s.stats(), {
		totalWords: 2,
		retired: 2,
		retiredFirstTry: 1,
		missed: [{ key: "a", misses: 2 }],
		cardsShown: 5,
	});
});

test("single-word selection", () => {
	const right = createHardScheduler(["Abate"]);
	assert.deepEqual(run(right, () => true), ["Abate"]);
	assert.equal(right.stats().retiredFirstTry, 1);

	const missed = createHardScheduler(["Abate"]);
	let n = 0;
	assert.deepEqual(run(missed, () => n++ > 0), ["Abate", "Abate", "Abate"]);
	assert.equal(missed.stats().retiredFirstTry, 0);
	assert.deepEqual(missed.stats().missed, [{ key: "Abate", misses: 1 }]);
});

test("empty selection is done immediately", () => {
	for (const keys of [[], undefined, null]) {
		const s = createHardScheduler(keys);
		assert.ok(s.isDone());
		assert.equal(s.next(), null);
		assert.deepEqual(s.stats(), { totalWords: 0, retired: 0, retiredFirstTry: 0, missed: [], cardsShown: 0 });
	}
});

test("next() is idempotent until the card is answered; wrong key throws", () => {
	const s = createHardScheduler(["a", "b"], { rng: first });
	assert.throws(() => s.recordResult("a", true), /not the card being shown/);
	assert.equal(s.next(), "a");
	assert.equal(s.next(), "a");
	assert.equal(s.stats().cardsShown, 1);
	assert.throws(() => s.recordResult("b", true), /not the card being shown/);
	s.recordResult("a", true);
	assert.throws(() => s.recordResult("a", true), /not the card being shown/);
});

test("duplicate keys collapse and stateOf rejects unknown keys", () => {
	const s = createHardScheduler(["a", "a", "b"]);
	assert.equal(s.stats().totalWords, 2);
	assert.equal(s.stateOf("zzz"), null);
});

test("randomness is injectable: same seed replays, rng is actually used", () => {
	const keys = Array.from({ length: 20 }, (_, i) => `w${i}`);
	const play = (opts) => {
		const s = createHardScheduler(keys, opts);
		let i = 0;
		return run(s, () => i++ % 3 !== 0);
	};
	assert.deepEqual(play({ seed: 42 }), play({ seed: 42 }));
	assert.notDeepEqual(play({ seed: 42 }), play({ seed: 43 }));

	// rng that always returns the top of its range takes the last eligible key.
	const s = createHardScheduler(["a", "b", "c"], { rng: () => 0.999999 });
	assert.equal(s.next(), "c");
	// and a misbehaving rng returning exactly 1 is clamped, not out of bounds.
	const t = createHardScheduler(["a", "b", "c"], { rng: () => 1 });
	assert.equal(t.next(), "c");
});

// ---------------------------------------------------------------------------
// serialize / resume
// ---------------------------------------------------------------------------

const KEYS = ["Abate", "Bolster", "Cajole", "Deride", "Enervate", "Fervid"];

test("serialize/restore round trip keeps the next card and every word state", () => {
	const s = createHardScheduler(KEYS, { seed: 7 });
	playSome(s, 5);
	const shown = s.next(); // drawn, not answered
	const snap = JSON.parse(JSON.stringify(s.serialize()));

	const r = restoreHardScheduler(snap, KEYS, { seed: 99 });
	assert.equal(r.next(), shown);
	for (const k of KEYS) assert.deepEqual(r.stateOf(k), s.stateOf(k));
	assert.deepEqual(r.stats(), s.stats());
	assert.deepEqual(r.serialize(), s.serialize());

	// And the restored run plays on to completion.
	r.recordResult(shown, true);
	let guard = 0;
	while (!r.isDone() && guard++ < 200) r.recordResult(r.next(), true);
	assert.ok(r.isDone());
});

test("restore against a changed word list drops removed keys and adds new ones unseen", () => {
	const s = createHardScheduler(["a", "b", "c"], { seed: 1 });
	const firstKey = s.next();
	s.recordResult(firstKey, false);
	const second = s.next();
	s.recordResult(second, true); // retired first try
	const snap = s.serialize();

	const removed = ["a", "b", "c"].find((k) => k !== firstKey && k !== second);
	const r = restoreHardScheduler(snap, [firstKey, second, "z"], { seed: 2 });
	assert.equal(r.stateOf(removed), null);
	assert.deepEqual(r.stateOf("z"), { status: WORD_UNSEEN, needs: null, misses: 0 });
	assert.equal(r.stateOf(firstKey).status, WORD_LEARNING);
	assert.equal(r.stateOf(second).status, WORD_RETIRED);
	assert.equal(r.stats().totalWords, 3);
	assert.equal(r.stats().retiredFirstTry, 1);
	assert.ok(!Object.hasOwn(r.serialize().words, removed));
});

test("a pending card that left the scope is dropped instead of crashing", () => {
	const s = createHardScheduler(["a", "b"], { seed: 3 });
	const shown = s.next();
	const other = shown === "a" ? "b" : "a";
	const r = restoreHardScheduler(s.serialize(), [other, "c"], { seed: 3 });
	const k = r.next();
	assert.ok(k === other || k === "c");
	assert.doesNotThrow(() => r.recordResult(k, true));
});

test("corrupt or missing scheduler state restores as a fresh run", () => {
	for (const bad of [null, undefined, 42, "x", [], {}, { words: [] }, { words: null }]) {
		const r = restoreHardScheduler(bad, KEYS, { seed: 1 });
		for (const k of KEYS) assert.equal(r.stateOf(k).status, WORD_UNSEEN);
		assert.equal(r.stats().cardsShown, 0);
	}
	// Garbage inside an otherwise valid snapshot is repaired word by word.
	const r = restoreHardScheduler(
		{
			words: {
				a: { status: "bogus" },
				b: { status: WORD_LEARNING, needs: 99, misses: -1, availableAt: "soon" },
				c: "nope",
			},
			cardsShown: -5,
			lastShown: "missing",
			pending: "missing",
			firstTry: "not-an-array",
		},
		["a", "b", "c"],
		{ seed: 1 },
	);
	assert.equal(r.stateOf("a").status, WORD_UNSEEN);
	assert.deepEqual(r.stateOf("b"), { status: WORD_LEARNING, needs: HARD_RELEARN_CORRECT, misses: 1 });
	assert.equal(r.stateOf("c").status, WORD_UNSEEN);
	assert.equal(r.stats().cardsShown, 0);
	assert.ok(["a", "b", "c"].includes(r.next()));
});

test("hardStateMatchesKeys requires the exact same key set", () => {
	const snap = createHardScheduler(["a", "b", "c"]).serialize();
	assert.equal(hardStateMatchesKeys(snap, ["c", "b", "a"]), true);
	assert.equal(hardStateMatchesKeys(snap, ["a", "b"]), false);
	assert.equal(hardStateMatchesKeys(snap, ["a", "b", "c", "d"]), false);
	assert.equal(hardStateMatchesKeys(snap, ["a", "b", "z"]), false);
	assert.equal(hardStateMatchesKeys(null, ["a"]), false);
	assert.equal(hardStateMatchesKeys(snap, null), false);
});
