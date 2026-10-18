// Unit tests for lib/words.js. Run with `npm test` (node:test, no deps).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

// lib/ imports JSON the way the Next bundler expects (no import attributes);
// plain Node insists on { type: "json" }, so add it to .json loads.
registerHooks({
	load(url, context, nextLoad) {
		if (!url.endsWith(".json")) return nextLoad(url, context);
		return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
	},
});

const { WORDS, WORD_COUNT, POS_VALUES, getWord, hasWord, wordsByTier, wordsByPos, resolveLegacyIndices } =
	await import("../lib/words.js");

const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const legacy = readJson("../src/data/legacy-index.json");
const packs = readJson("../public/data/wordpacks.json");

test("WORDS lists every entry with its headword, in file order", () => {
	const raw = readJson("../src/data/gre_combined.json");
	assert.equal(WORD_COUNT, Object.keys(raw).length);
	assert.deepEqual(
		WORDS.map((e) => e.word),
		Object.keys(raw),
	);
	const first = WORDS[0];
	assert.equal(first.word, "Abate");
	for (const f of ["definition", "fullDefinition", "example", "pos", "tier"]) assert.ok(f in first, f);
	assert.ok(Object.isFrozen(WORDS) && Object.isFrozen(first));
});

test("getWord is case-insensitive and trims", () => {
	assert.equal(getWord("mitigate").word, "Mitigate");
	assert.equal(getWord("  MITIGATE ").word, "Mitigate");
	assert.equal(getWord("Mitigate"), getWord("mitigate"));
	assert.equal(getWord("nope-not-a-word"), null);
	assert.equal(getWord(undefined), null);
	assert.equal(getWord(42), null);
	assert.ok(hasWord("zealot"));
	assert.ok(!hasWord(""));
});

test("typo headwords are fixed", () => {
	for (const w of ["Puerile", "Encomium", "Cavil"]) assert.ok(getWord(w), w);
	for (const w of ["Peurile", "Ecomium", "Cavo;"]) assert.equal(getWord(w), null, w);
});

test("tier and pos lookups partition the list", () => {
	const tiers = [1, 2, 3].map((t) => wordsByTier(t));
	assert.equal(tiers.reduce((n, l) => n + l.length, 0), WORD_COUNT);
	for (const [i, list] of tiers.entries()) {
		assert.ok(list.length > 0);
		assert.ok(list.every((e) => e.tier === i + 1));
	}
	assert.deepEqual(wordsByTier("1"), wordsByTier(1));
	assert.deepEqual(wordsByTier(9), []);

	const total = POS_VALUES.reduce((n, p) => n + wordsByPos(p).length, 0);
	assert.equal(total, WORD_COUNT);
	assert.ok(wordsByPos("verb").every((e) => e.pos === "verb"));
	assert.equal(wordsByPos("VERB"), wordsByPos("verb"));
	assert.deepEqual(wordsByPos("interjection"), []);
	assert.equal(getWord("Mitigate").pos, "verb");
	assert.equal(getWord("Penury").pos, "noun");
	assert.equal(getWord("Laconic").pos, "adjective");
	assert.equal(getWord("Inadvertently").pos, "adverb");
});

test("resolveLegacyIndices maps old positions through the frozen order", () => {
	assert.equal(legacy.length, 679);
	assert.deepEqual(resolveLegacyIndices([0, 678]), ["Abate", "Zealot"]);
	// Renamed headwords keep their old slot.
	assert.deepEqual(resolveLegacyIndices([110, 214, 471]), ["Cavil", "Encomium", "Puerile"]);
	// Strings, junk, out of range and repeats.
	assert.deepEqual(resolveLegacyIndices(["5", 5, -1, 679, 1.5, "x", null, ""]), ["Abridge"]);
	assert.deepEqual(resolveLegacyIndices("1,2"), []);
	assert.deepEqual(resolveLegacyIndices(undefined), []);
});

test("every pack's indices resolve to its words", () => {
	// Only the 12 classic packs carry legacy indices; generated packs are word-keyed.
	assert.equal(packs.filter((p) => p.indices).length, 12);
	for (const p of packs) {
		if (p.indices) assert.deepEqual(resolveLegacyIndices(p.indices), p.words, p.id);
		for (const w of p.words) assert.equal(getWord(w)?.word, w, `${p.id}: ${w}`);
	}
});

test("no randomness: two imports agree", async () => {
	const again = await import("../lib/words.js?again");
	assert.deepEqual(
		again.WORDS.map((e) => e.word),
		WORDS.map((e) => e.word),
	);
});
