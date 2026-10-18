// Unit tests for lib/pool.js (Test mode Normal difficulty's word pool).
// Run with `node --test tests/`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
	buildPool,
	drawPoolRefill,
	replaceMastered,
	pickNext,
	POOL_SIZE,
	WORD_STREAK_TO_MASTER,
} from "../lib/pool.js";
import { seededRng } from "../lib/hard-scheduler.js";

const KEYS = Array.from({ length: 20 }, (_, i) => `w${i}`);

test("constants are unchanged from GRE's original Test mode", () => {
	assert.equal(POOL_SIZE, 5);
	assert.equal(WORD_STREAK_TO_MASTER, 4);
});

test("different seeds draw different initial pools", () => {
	assert.notDeepEqual(buildPool(KEYS, new Set(), { seed: 1 }), buildPool(KEYS, new Set(), { seed: 2 }));
});

test("initial pool never exceeds POOL_SIZE and has no duplicates", () => {
	for (let seed = 0; seed < 50; seed += 1) {
		const pool = buildPool(KEYS, new Set(), { seed });
		assert.equal(pool.length, POOL_SIZE);
		assert.equal(new Set(pool).size, pool.length);
	}
});

test("duplicate scope keys never put a word in the pool twice", () => {
	const scope = ["a", "a", "a", "b", "b", "c"];
	for (let seed = 0; seed < 50; seed += 1) {
		const pool = buildPool(scope, new Set(), { seed });
		assert.equal(pool.length, 3);
		assert.equal(new Set(pool).size, 3);
	}
});

test("initial pool draws only unmastered keys", () => {
	const mastered = new Set(["w0", "w1", "w2", "w3"]);
	for (let seed = 0; seed < 25; seed += 1) {
		for (const k of buildPool(KEYS, mastered, { seed })) assert.ok(!mastered.has(k), `${k} should not be mastered`);
	}
	// An array of mastered keys works too.
	for (const k of buildPool(KEYS, ["w0", "w1"], { seed: 3 })) assert.ok(k !== "w0" && k !== "w1");
});

test("a pool smaller than POOL_SIZE when few unmastered keys remain; empty when done", () => {
	const pool = buildPool(KEYS, new Set(KEYS.slice(3)), { seed: 7 });
	assert.equal(pool.length, 3);
	assert.equal(new Set(pool).size, 3);
	assert.deepEqual(buildPool(KEYS, new Set(KEYS), { seed: 1 }), []);
	assert.deepEqual(buildPool([], new Set(), { seed: 1 }), []);
	assert.deepEqual(buildPool(undefined, undefined, { seed: 1 }), []);
});

test("drawPoolRefill returns a key not already taken, or null", () => {
	const taken = new Set(["w0", "w1", "w2", "w3", "w4"]);
	for (let seed = 0; seed < 25; seed += 1) {
		const key = drawPoolRefill(KEYS, taken, { seed });
		assert.ok(key !== null && !taken.has(key) && KEYS.includes(key));
	}
	assert.equal(drawPoolRefill(KEYS, new Set(KEYS), { seed: 1 }), null);
});

test("a supplied rng function wins over seed", () => {
	let calls = 0;
	const rng = () => {
		calls += 1;
		return 0;
	};
	assert.deepEqual(buildPool(KEYS, new Set(), { rng, seed: 99 }), ["w0", "w1", "w2", "w3", "w4"]);
	assert.ok(calls > 0);
});

test("replaceMastered refills the slot from unmastered words outside the pool", () => {
	const pool = ["w0", "w1", "w2", "w3", "w4"];
	for (let seed = 0; seed < 50; seed += 1) {
		const mastered = new Set(["w2", "w10"]);
		const { pool: next, added } = replaceMastered(pool, "w2", KEYS, mastered, { seed });
		assert.ok(added !== null);
		assert.ok(!pool.includes(added), "never re-adds a word already in the pool");
		assert.ok(!mastered.has(added), "never re-adds a mastered word");
		assert.equal(next.length, POOL_SIZE);
		assert.equal(new Set(next).size, POOL_SIZE);
		assert.ok(!next.includes("w2"));
		assert.equal(next[2], added, "the new word takes the mastered word's slot");
	}
	assert.deepEqual(pool, ["w0", "w1", "w2", "w3", "w4"], "input pool is not modified");
});

test("replaceMastered excludes the mastered key even if the caller forgot to add it", () => {
	const scope = ["a", "b"];
	const { pool, added } = replaceMastered(["a", "b"], "a", scope, new Set(), { seed: 1 });
	assert.equal(added, null);
	assert.deepEqual(pool, ["b"]);
});

test("replaceMastered shrinks the pool when nothing is left, until it is empty", () => {
	let pool = ["a", "b", "c"];
	const mastered = new Set();
	for (const k of ["b", "a", "c"]) {
		mastered.add(k);
		({ pool } = replaceMastered(pool, k, ["a", "b", "c"], mastered, { seed: 4 }));
	}
	assert.deepEqual(pool, []);
});

test("pickNext never repeats the word just shown while another is available", () => {
	const rng = seededRng(5);
	const pool = ["a", "b", "c", "d", "e"];
	let last = null;
	for (let i = 0; i < 500; i += 1) {
		const k = pickNext(pool, last, { rng });
		assert.ok(pool.includes(k));
		assert.notEqual(k, last);
		last = k;
	}
});

test("pickNext with one word shows it again; empty pool gives null; duplicates cannot loop", () => {
	assert.equal(pickNext(["a"], "a", { seed: 1 }), "a");
	assert.equal(pickNext([], "a", { seed: 1 }), null);
	assert.equal(pickNext(undefined, null, { seed: 1 }), null);
	// The original TestMode could hold ["a","a","a","a","a"] and spin forever
	// looking for a word other than "a". Here it simply returns "a".
	assert.equal(pickNext(["a", "a", "a", "a", "a"], "a", { seed: 1 }), "a");
	assert.equal(pickNext(["a", "a", "b"], "a", { rng: () => 0.99 }), "b");
	// rng returning exactly 1 is clamped.
	assert.equal(pickNext(["a", "b", "c"], null, { rng: () => 1 }), "c");
});

test("a full Normal run over a scope terminates with every word mastered once", () => {
	const scope = Array.from({ length: 23 }, (_, i) => `k${i}`);
	const rng = seededRng(11);
	const mastered = new Set();
	const streaks = new Map();
	let pool = buildPool(scope, mastered, { rng });
	let last = null;
	let cards = 0;
	while (pool.length) {
		assert.ok(cards++ < 10000, "run did not terminate");
		assert.equal(new Set(pool).size, pool.length, "pool never holds duplicates");
		const k = pickNext(pool, last, { rng });
		const correct = rng() > 0.3;
		const s = correct ? (streaks.get(k) || 0) + 1 : 0;
		streaks.set(k, s);
		if (s >= WORD_STREAK_TO_MASTER) {
			assert.ok(!mastered.has(k), "a word is mastered only once");
			mastered.add(k);
			({ pool } = replaceMastered(pool, k, scope, mastered, { rng }));
		}
		last = k;
	}
	assert.equal(mastered.size, scope.length);
});
