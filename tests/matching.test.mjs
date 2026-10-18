// Unit tests for lib/matching.js. Run with `node --test tests/`.
//
// The w2d tests check the new matcher against the string-similarity package
// the original TestMode used, while that package is still installed; they
// are skipped once it is removed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";

// lib/matching.js -> lib/distractors.js -> lib/words.js imports JSON the way
// the Next bundler expects (no import attributes); plain Node insists on
// { type: "json" }, so add it to .json loads.
registerHooks({
	load(url, context, nextLoad) {
		if (!url.endsWith(".json")) return nextLoad(url, context);
		return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
	},
});

const {
	WORD_DICE_THRESHOLD,
	EXACT_MATCH_MAX_LEN,
	diceCoefficient,
	legacyCompare,
	normalize,
	stripTrailingPunctuation,
	gradeDefinition,
	gradeHeadword,
	gradeAnswer,
	gradeHeadwordWithNearDuplicates,
} = await import("../lib/matching.js");

const VOCAB = JSON.parse(readFileSync(new URL("../src/data/gre_combined.json", import.meta.url), "utf8"));
const KEYS = Object.keys(VOCAB);

let stringSimilarity = null;
try {
	stringSimilarity = createRequire(import.meta.url)("string-similarity");
} catch {
	stringSimilarity = null;
}

// The original TestMode isMatch, verbatim apart from the injected compare.
function originalIsMatch(compare, input, target, threshold = 0.6) {
	return compare(input.trim().toLowerCase(), target.trim().toLowerCase()) >= threshold;
}

// Deterministic answer variants for one definition: the right answer, typos,
// truncations, extra words, case and spacing changes, and other definitions.
function variants(def, i) {
	const other = VOCAB[KEYS[(i * 7 + 3) % KEYS.length]].definition;
	const words = def.split(" ");
	return [
		def,
		def.toUpperCase(),
		`  ${def}  `,
		def.replace(/\.$/, ""),
		def.replace(/\s+/g, ""),
		def.replace(/ /g, "  "),
		def.slice(0, Math.ceil(def.length / 2)),
		def.slice(0, Math.ceil(def.length * 0.7)),
		def.slice(Math.floor(def.length / 3)),
		words.slice(1).join(" "),
		words.slice(0, -1).join(" "),
		`${def} and more`,
		def.replace(/[aeiou]/, ""),
		def.replace(/[aeiou]/g, "e"),
		words.reverse().join(" "),
		other,
		"",
		"x",
		"to",
	];
}

test("constants", () => {
	assert.equal(WORD_DICE_THRESHOLD, 0.6);
	assert.equal(EXACT_MATCH_MAX_LEN, 4);
});

test("diceCoefficient basics", () => {
	assert.equal(diceCoefficient("night", "night"), 1);
	assert.equal(diceCoefficient("a", "ab"), 0);
	assert.equal(diceCoefficient("", ""), 1);
	assert.equal(diceCoefficient("night", "nacht"), 0.25);
	// Repeated bigrams are counted as a multiset.
	assert.equal(diceCoefficient("aaaa", "aa"), 0.5);
});

test("legacyCompare equals string-similarity's compareTwoStrings", { skip: !stringSimilarity && "string-similarity not installed" }, () => {
	const pairs = [
		["", ""],
		["a", "a"],
		["a", "b"],
		["ab", "ab"],
		["to lessen severity.", "to lessen severity"],
		["to lessen severity.", "tolessenseverity."],
		["  spaced   out ", "spaced out"],
		["aaaa", "aa"],
		["night", "nacht"],
	];
	KEYS.forEach((k, i) => {
		const def = VOCAB[k].definition.toLowerCase();
		for (const v of variants(VOCAB[k].definition, i)) pairs.push([v.toLowerCase(), def]);
	});
	for (const [a, b] of pairs) {
		assert.equal(legacyCompare(a, b), stringSimilarity.compareTwoStrings(a, b), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
	}
});

test("w2d accepts exactly what the original TestMode accepted, for every word", { skip: !stringSimilarity && "string-similarity not installed" }, () => {
	const original = (a, b) => stringSimilarity.compareTwoStrings(a, b);
	let accepted = 0;
	let rejected = 0;
	KEYS.forEach((k, i) => {
		const entry = VOCAB[k];
		for (const answer of variants(entry.definition, i)) {
			const want = originalIsMatch(original, answer, entry.definition);
			const got = gradeDefinition(entry, answer).correct;
			assert.equal(got, want, `${k}: ${JSON.stringify(answer)}`);
			if (want) accepted += 1;
			else rejected += 1;
		}
	});
	assert.ok(accepted > 0 && rejected > 0, "the variants exercise both outcomes");
});

test("w2d grades against `definition`, not fullDefinition or example", () => {
	const entry = VOCAB.Mitigate;
	assert.equal(gradeDefinition(entry, "to lessen severity.").correct, true);
	assert.equal(gradeDefinition(entry, "to lessen severity").correct, true);
	assert.equal(gradeDefinition(entry, entry.fullDefinition).correct, false);
	assert.equal(gradeDefinition(entry, entry.example).correct, false);
	const r = gradeDefinition(entry, "TO LESSEN SEVERITY.");
	assert.equal(r.correct, true);
	assert.equal(r.exact, true);
	assert.equal(r.display, entry.definition);
	assert.equal(gradeDefinition(entry, "").correct, false);
	assert.equal(gradeDefinition(entry, null).correct, false);
	assert.equal(gradeDefinition(undefined, "anything").correct, false);
});

test("normalize and trailing punctuation", () => {
	assert.equal(normalize("  Abate   Now "), "abate now");
	assert.equal(normalize(null), "");
	assert.equal(stripTrailingPunctuation("abate.!?"), "abate");
	assert.equal(stripTrailingPunctuation("a.b"), "a.b");
});

test("d2w: exact for headwords of 4 characters or fewer, Dice 0.6 above that", () => {
	assert.equal(gradeHeadword("Guy", "guy").correct, true);
	assert.equal(gradeHeadword("Guy", "Guy.").correct, true);
	assert.equal(gradeHeadword("Guy", "gu").correct, false);
	assert.equal(gradeHeadword("Guy", "guys").correct, false);
	assert.equal(gradeHeadword("Tyro", "tyro").correct, true);
	assert.equal(gradeHeadword("Tyro", "tyr0").correct, false);

	const exact = gradeHeadword("Mitigate", "  MITIGATE! ");
	assert.deepEqual(exact, { correct: true, exact: true, display: "Mitigate" });
	const near = gradeHeadword("Mitigate", "mitigat");
	assert.equal(near.correct, true);
	assert.equal(near.exact, false);
	assert.equal(gradeHeadword("Mitigate", "mandate").correct, false);
	assert.equal(gradeHeadword("Mitigate", "").correct, false);
	assert.equal(gradeHeadword("", "anything").correct, false);
	// A typed definition is not a headword.
	assert.equal(gradeHeadword("Mitigate", VOCAB.Mitigate.definition).correct, false);
});

test("gradeAnswer dispatches on direction", () => {
	assert.equal(gradeAnswer("Mitigate", VOCAB.Mitigate, "to lessen severity.", "w2d").correct, true);
	assert.equal(gradeAnswer("Mitigate", VOCAB.Mitigate, "mitigate", "w2d").correct, false);
	assert.equal(gradeAnswer("Mitigate", VOCAB.Mitigate, "mitigate", "d2w").correct, true);
	assert.equal(gradeAnswer("Mitigate", VOCAB.Mitigate, "to lessen severity.", "d2w").correct, false);
});

// An injected near-duplicate rule, so these tests do not depend on the exact
// thresholds of lib/distractors.js.
const sameText = (a, b) => normalize(a) === normalize(b);

test("d2w near-duplicates: another headword with the same definition is accepted", () => {
	const vocab = {
		Exculpate: { definition: "to clear from blame." },
		Exonerate: { definition: "to clear from blame." },
		Exacerbate: { definition: "to make worse." },
	};
	const opts = { isNearDuplicate: sameText };
	assert.deepEqual(gradeHeadwordWithNearDuplicates("Exculpate", "exculpate", vocab, opts), {
		correct: true,
		exact: true,
		display: "Exculpate",
		acceptedKey: "Exculpate",
	});
	const syn = gradeHeadwordWithNearDuplicates("Exculpate", "Exonerate", vocab, opts);
	assert.equal(syn.correct, true);
	assert.equal(syn.exact, false);
	assert.equal(syn.acceptedKey, "Exonerate");
	assert.equal(syn.display, "Exculpate");
	// A typo of the synonym passes the word rule, so it is accepted too.
	assert.equal(gradeHeadwordWithNearDuplicates("Exculpate", "exonerat", vocab, opts).acceptedKey, "Exonerate");
	// A different meaning is still wrong.
	const wrong = gradeHeadwordWithNearDuplicates("Exculpate", "Exacerbate", vocab, opts);
	assert.equal(wrong.correct, false);
	assert.equal(wrong.acceptedKey, null);
	// Unknown target or empty vocab: plain headword grading.
	assert.equal(gradeHeadwordWithNearDuplicates("Missing", "Exonerate", vocab, opts).correct, false);
	assert.equal(gradeHeadwordWithNearDuplicates("Exculpate", "exculpate", null, opts).correct, true);
});

test("d2w near-duplicates: an exact synonym match wins over a fuzzy one", () => {
	const vocab = {
		Fervent: { definition: "intensely passionate." },
		Fervid: { definition: "intensely passionate." },
		Ferventer: { definition: "intensely passionate." },
		Target: { definition: "intensely passionate." },
	};
	const r = gradeHeadwordWithNearDuplicates("Target", "fervent", vocab, { isNearDuplicate: sameText });
	assert.equal(r.acceptedKey, "Fervent");
});

test("d2w near-duplicates: a negated definition never accepts its antonym", () => {
	const vocab = {
		Impermeable: { definition: "not allowing passage." },
		Permeable: { definition: "allowing passage." },
	};
	// The plain word rule cannot tell them apart: Dice 0.89.
	assert.equal(gradeHeadword("Impermeable", "Permeable").correct, true);
	// With the vocabulary, an exact other headword is that word, not a typo.
	assert.equal(gradeHeadwordWithNearDuplicates("Impermeable", "Permeable", vocab, { isNearDuplicate: sameText }).correct, false);
	assert.equal(gradeHeadwordWithNearDuplicates("Impermeable", "Impermeabel", vocab, { isNearDuplicate: sameText }).correct, true);
	// And the negation guard holds even under a rule that calls them duplicates.
	const always = () => true;
	assert.equal(gradeHeadwordWithNearDuplicates("Impermeable", "Permeable", vocab, { isNearDuplicate: always }).correct, false);
	assert.equal(gradeHeadwordWithNearDuplicates("Permeable", "Impermeable", vocab, { isNearDuplicate: always }).correct, false);
});

test("d2w near-duplicates on the real data, through lib/distractors.js", async () => {
	const { isNearDuplicateDefinition } = await import("../lib/distractors.js");
	// Identical definitions must count under any reasonable rule.
	const same = { A1: { definition: "to clear from blame." }, B1: { definition: "to clear from blame." } };
	assert.equal(gradeHeadwordWithNearDuplicates("A1", "B1", same).acceptedKey, "B1");
	// A pair from the real list, if the data still has one.
	let pair = null;
	for (let i = 0; i < KEYS.length && !pair; i++) {
		for (let j = 0; j < KEYS.length && !pair; j++) {
			const a = VOCAB[KEYS[i]].definition;
			const b = VOCAB[KEYS[j]].definition;
			if (i !== j && isNearDuplicateDefinition(a, b) && !/\bnot\b/i.test(a + b)) pair = [KEYS[i], KEYS[j]];
		}
	}
	if (pair) {
		const r = gradeHeadwordWithNearDuplicates(pair[0], pair[1], VOCAB);
		assert.equal(r.correct, true, `${pair[0]} should accept ${pair[1]}`);
	}
	assert.equal(gradeHeadwordWithNearDuplicates("Mitigate", "Zealot", VOCAB).correct, false);
	if (VOCAB.Impermeable && VOCAB.Permeable) {
		assert.equal(gradeHeadwordWithNearDuplicates("Impermeable", "Permeable", VOCAB).correct, false);
	}
});
