// Unit tests for lib/distractors.js. Run with `npm test` (node:test, no deps).

import { test } from "node:test";
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

const { WORDS, getWord } = await import("../lib/words.js");
const { pickDistractors, isNearDuplicateDefinition, isSameRoot, isConfusable, cryptoRng, CONFUSABLE_PAIRS } =
	await import("../lib/distractors.js");

// Mulberry32: small deterministic rng for repeatable picks.
function seededRng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

test("isNearDuplicateDefinition: normalized equality", () => {
	assert.ok(isNearDuplicateDefinition("to tolerate or endure.", "To tolerate or endure"));
	assert.ok(isNearDuplicateDefinition("after one’s death.", "after ones death"));
	assert.ok(!isNearDuplicateDefinition("", ""));
	assert.ok(!isNearDuplicateDefinition("wordy.", undefined));
});

test("isNearDuplicateDefinition: a definition and its negation are never near-duplicates", () => {
	assert.ok(!isNearDuplicateDefinition("allowing passage.", "not allowing passage."));
	assert.ok(!isNearDuplicateDefinition("not allowing passage.", "allowing passage."));
	assert.ok(!isNearDuplicateDefinition("full of hope.", "without hope."));
	assert.ok(!isNearDuplicateDefinition("Never yielding", "yielding"));
	// Negated on both sides is still compared on overlap.
	assert.ok(isNearDuplicateDefinition("not allowing passage.", "not allowing passage"));
	assert.ok(isNearDuplicateDefinition("not easily calmed.", "not calmed easily."));
	// "non" counts only as a whole word.
	assert.ok(isNearDuplicateDefinition("nonchalant manner.", "nonchalant manner"));
});

test("isNearDuplicateDefinition: Jaccard >= 0.5 on content words", () => {
	assert.ok(isNearDuplicateDefinition("to calm or pacify.", "to calm; pacify."));
	assert.ok(isNearDuplicateDefinition("a scarcity or lack.", "scarcity; lack."));
	assert.ok(isNearDuplicateDefinition("respectful submission.", "respectfully submissive."));
	// {clear, blame} vs {clear, blame, suspicion} = 2/3
	assert.ok(isNearDuplicateDefinition("to clear from blame.", "to clear from blame or suspicion."));
	// {lessen, severity} vs {lessen, pain, trouble} = 1/4
	assert.ok(!isNearDuplicateDefinition("to lessen severity.", "to lessen pain or trouble."));
	assert.ok(!isNearDuplicateDefinition("wordy.", "cowardly."));
	// Stopwords alone never match.
	assert.ok(!isNearDuplicateDefinition("to the", "of a"));
});

test("isSameRoot catches word families only", () => {
	for (const [a, b] of [
		["Belie", "Belies"],
		["Sporadic", "Sporadically"],
		["Pellucid", "Pellucidity"],
		["Anachronism", "Anachronistic"],
		["Qualify", "Qualified"],
	]) {
		assert.ok(isSameRoot(a, b), `${a}/${b}`);
	}
	assert.ok(!isSameRoot("Disparage", "Disparate"));
	assert.ok(!isSameRoot("Tractable", "Intractable"));
});

test("confusable pairs are symmetric and refer to real words", () => {
	for (const [a, b] of CONFUSABLE_PAIRS) {
		assert.ok(getWord(a) && getWord(b), `${a}/${b}`);
		assert.ok(isConfusable(a, b) && isConfusable(b.toLowerCase(), a));
	}
	assert.ok(!isConfusable("Abate", "Zealot"));
});

test("no option is a second correct answer, in either direction", () => {
	const rng = seededRng(7);
	for (const direction of ["w2d", "d2w"]) {
		for (const t of WORDS) {
			const picks = pickDistractors(t.word, 3, { direction, rng });
			assert.equal(picks.length, 3, `${direction} ${t.word}`);
			const all = [t, ...picks];
			for (let i = 0; i < all.length; i++) {
				for (let j = i + 1; j < all.length; j++) {
					const [a, b] = [all[i], all[j]];
					assert.notEqual(a.word.toLowerCase(), b.word.toLowerCase());
					assert.ok(!isNearDuplicateDefinition(a.definition, b.definition), `${a.word}/${b.word}`);
					assert.ok(!isConfusable(a.word, b.word), `${a.word}/${b.word}`);
					assert.ok(!isSameRoot(a.word, b.word), `${a.word}/${b.word}`);
				}
			}
		}
	}
});

test("identical-definition partners are never offered", () => {
	const rng = seededRng(1);
	for (const [a, b] of CONFUSABLE_PAIRS) {
		for (let n = 0; n < 50; n++) {
			const words = pickDistractors(a, 3, { rng }).map((e) => e.word);
			assert.ok(!words.includes(b), `${a} offered ${b}`);
		}
	}
	// Synonyms with near-identical definitions.
	for (let n = 0; n < 50; n++) {
		assert.ok(!pickDistractors("Appease", 3, { rng }).some((e) => e.word === "Placate"));
		assert.ok(!pickDistractors("Dearth", 3, { rng, direction: "d2w" }).some((e) => e.word === "Paucity"));
	}
});

test("prefers the same part of speech and a similar length", () => {
	const rng = seededRng(3);
	for (const w of ["Mitigate", "Laconic", "Penury"]) {
		const t = getWord(w);
		const picks = pickDistractors(w, 3, { rng });
		assert.ok(picks.every((e) => e.pos === t.pos), w);
		assert.ok(picks.every((e) => Math.abs(e.definition.length - t.definition.length) < 12), w);
	}
	// Only 7 adverbs: the rest are filled from other parts of speech.
	const adv = pickDistractors("Inadvertently", 3, { rng });
	assert.equal(adv.length, 3);
	assert.equal(adv[0].pos, "adverb");
	// d2w compares headword length.
	const d2w = pickDistractors("Abate", 3, { rng, direction: "d2w" });
	assert.ok(d2w.every((e) => e.pos === "verb" && Math.abs(e.word.length - 5) <= 1));
});

test("rng is injectable: same seed, same picks; different seeds differ", () => {
	const words = (seed) => pickDistractors("Mitigate", 3, { rng: seededRng(seed) }).map((e) => e.word);
	assert.deepEqual(words(11), words(11));
	const seen = new Set([1, 2, 3, 4, 5, 6].map((s) => words(s).join()));
	assert.ok(seen.size > 1);
});

test("defaults to crypto.getRandomValues", () => {
	for (let i = 0; i < 100; i++) {
		const x = cryptoRng();
		assert.ok(x >= 0 && x < 1);
	}
	assert.equal(pickDistractors("Mitigate").length, 3);
	assert.equal(pickDistractors(getWord("Mitigate"), 2).length, 2);
});

test("meaning groups ready: resolves once loaded, falls back after the timeout, never rejects", async () => {
	const D = await import("../lib/distractors.js");
	assert.equal(D.MEANING_GROUPS_TIMEOUT_MS, 2000);
	assert.equal(await D.meaningGroupsReady, true, "the local file loads well inside 2 seconds");
	assert.equal(D.meaningGroupsLoaded(), true);
	assert.equal(await D.waitForMeaningGroups(), true, "already loaded resolves at once");
	// A load that never finishes resolves false after the timeout.
	const never = new Promise(() => {});
	const t0 = Date.now();
	assert.equal(await D.waitForMeaningGroups(30, never), false);
	assert.ok(Date.now() - t0 >= 25);
	// A load that fails still means ready (with no groups), never a rejection.
	assert.equal(await D.waitForMeaningGroups(1000, Promise.reject(new Error("missing"))), true);
	// A slow load that beats the timeout resolves true.
	assert.equal(await D.waitForMeaningGroups(1000, new Promise((r) => setTimeout(r, 10))), true);
});

test("pool, k and bad targets", async () => {
	const { isSameMeaningGroup, meaningGroupsReady } = await import("../lib/distractors.js");
	await meaningGroupsReady;
	const pool = ["Abate", "Mitigate", "Alleviate", "Zealot", "zealot", "Laconic", "not-a-word"];
	const picks = pickDistractors("Mitigate", 10, { pool, rng: seededRng(5) }).map((e) => e.word);
	// Alleviate ("to ease or reduce pain or trouble.") does not overlap enough
	// to be excluded as a near-duplicate, but src/data/meaning-groups.json may
	// put it in Mitigate's group, which does exclude it.
	const expected = ["Abate", "Alleviate", "Laconic", "Zealot"].filter((w) => !isSameMeaningGroup(w, "Mitigate"));
	assert.deepEqual([...picks].sort(), expected);
	const verbs = expected.filter((w) => getWord(w).pos === "verb").length;
	assert.deepEqual(
		picks.slice(0, verbs).map((w) => getWord(w).pos),
		Array(verbs).fill("verb"),
		"same pos comes first",
	);
	assert.deepEqual(pickDistractors("not-a-word"), []);
	assert.deepEqual(pickDistractors("Mitigate", 0), []);
});

test("meaning groups: no option from the target's group, and no two options from one group", async () => {
	const { setMeaningGroups, isSameMeaningGroup, meaningGroupsReady, clashes } = await import("../lib/distractors.js");
	await meaningGroupsReady;
	const target = getWord("Abate");
	// Five words that are fine distractors for Abate and for each other today.
	const free = [];
	for (const e of WORDS) {
		if (free.length >= 5) break;
		if (e.pos !== target.pos || clashes(e, target) || free.some((f) => clashes(e, f))) continue;
		free.push(e);
	}
	assert.equal(free.length, 5);
	const [x, y, z, a, b] = free.map((e) => e.word);
	setMeaningGroups({ groups: { lessen: [target.word, x], pair: [y, z], __proto__: [a, b] } });
	try {
		assert.equal(isSameMeaningGroup(target.word, x), true);
		assert.equal(isSameMeaningGroup(x.toLowerCase(), ` ${target.word} `), true);
		assert.equal(isSameMeaningGroup(y, z), true);
		assert.equal(isSameMeaningGroup(target.word, y), false);
		for (let seed = 0; seed < 40; seed++) {
			let s = seed + 1;
			const rng = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
			const picked = pickDistractors(target, 3, { pool: [x, y, z, a, b], rng }).map((e) => e.word);
			assert.ok(!picked.includes(x), `group member ${x} offered for ${target.word}`);
			assert.ok(!(picked.includes(y) && picked.includes(z)), "two options from one group");
			assert.equal(picked.length, 3);
		}
		// Existing rules still apply alongside groups.
		assert.equal(isNearDuplicateDefinition("to clear from blame.", "to clear of blame."), true);
		assert.equal(isNearDuplicateDefinition("not allowing passage.", "allowing passage."), false);
	} finally {
		setMeaningGroups(null);
	}
	assert.equal(isSameMeaningGroup(target.word, x), false);
	// Malformed files mean no groups, never a crash.
	for (const bad of [undefined, 7, "x", [], { groups: [] }, { groups: { g: "Abate" } }]) {
		setMeaningGroups(bad);
		assert.equal(isSameMeaningGroup(target.word, x), false);
	}
});