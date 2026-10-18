// Unit tests for lib/matching.js. Run with `node --test tests/`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

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
	normalize,
	stripTrailingPunctuation,
	gradeDefinition,
	gradeHeadword,
	gradeAnswer,
	gradeHeadwordWithNearDuplicates,
} = await import("../lib/matching.js");

const VOCAB = JSON.parse(readFileSync(new URL("../src/data/gre_combined.json", import.meta.url), "utf8"));
const KEYS = Object.keys(VOCAB);

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

test("w2d grades against `definition`, not fullDefinition or example", () => {
	const entry = VOCAB.Mitigate;
	assert.equal(gradeDefinition(entry, "to alleviate.").correct, true);
	assert.equal(gradeDefinition(entry, "to alleviate").correct, true);
	assert.equal(gradeDefinition(entry, entry.fullDefinition).correct, false);
	assert.equal(gradeDefinition(entry, entry.example).correct, false);
	const r = gradeDefinition(entry, "TO ALLEVIATE.");
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
	assert.equal(gradeAnswer("Mitigate", VOCAB.Mitigate, "to alleviate.", "w2d").correct, true);
	assert.equal(gradeAnswer("Mitigate", VOCAB.Mitigate, "mitigate", "w2d").correct, false);
	assert.equal(gradeAnswer("Mitigate", VOCAB.Mitigate, "mitigate", "d2w").correct, true);
	assert.equal(gradeAnswer("Mitigate", VOCAB.Mitigate, "to alleviate.", "d2w").correct, false);
});

// An injected near-duplicate rule, so these tests do not depend on the exact
// thresholds of lib/distractors.js.
const sameText = (a, b) => normalize(a) === normalize(b);

test("d2w near-duplicates: another headword with the same definition is accepted", () => {
	const vocab = {
		Exculpate: { definition: "to clear from blame.", pos: "verb" },
		Exonerate: { definition: "to clear from blame.", pos: "verb" },
		Exacerbate: { definition: "to make worse.", pos: "verb" },
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
		Fervent: { definition: "intensely passionate.", pos: "adjective" },
		Fervid: { definition: "intensely passionate.", pos: "adjective" },
		Ferventer: { definition: "intensely passionate.", pos: "adjective" },
		Target: { definition: "intensely passionate.", pos: "adjective" },
	};
	const r = gradeHeadwordWithNearDuplicates("Target", "fervent", vocab, { isNearDuplicate: sameText });
	assert.equal(r.acceptedKey, "Fervent");
});

test("d2w near-duplicates: a negated definition never accepts its antonym", () => {
	const vocab = {
		Impermeable: { definition: "not allowing passage.", pos: "adjective" },
		Permeable: { definition: "allowing passage.", pos: "adjective" },
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

test("d2w near-duplicates: the default rule rejects a negated antonym, keeps real synonyms", () => {
	const vocab = {
		Impermeable: { definition: "not allowing passage.", pos: "adjective" },
		Permeable: { definition: "allowing passage.", pos: "adjective" },
		Exculpate: { definition: "to clear from blame.", pos: "verb" },
		Exonerate: { definition: "to clear from blame.", pos: "verb" },
	};
	assert.equal(gradeHeadwordWithNearDuplicates("Impermeable", "Permeable", vocab).correct, false);
	assert.equal(gradeHeadwordWithNearDuplicates("Permeable", "Impermeable", vocab).correct, false);
	assert.equal(gradeHeadwordWithNearDuplicates("Exculpate", "Exonerate", vocab).acceptedKey, "Exonerate");
});

test("d2w near-duplicates on the real data, through lib/distractors.js", async () => {
	const { isNearDuplicateDefinition } = await import("../lib/distractors.js");
	// Identical definitions must count under any reasonable rule.
	const same = { A1: { definition: "to clear from blame.", pos: "verb" }, B1: { definition: "to clear from blame.", pos: "verb" } };
	assert.equal(gradeHeadwordWithNearDuplicates("A1", "B1", same).acceptedKey, "B1");
	// A pair from the real list, if the data still has one.
	let pair = null;
	for (let i = 0; i < KEYS.length && !pair; i++) {
		for (let j = 0; j < KEYS.length && !pair; j++) {
			const a = VOCAB[KEYS[i]].definition;
			const b = VOCAB[KEYS[j]].definition;
			if (i !== j && VOCAB[KEYS[i]].pos === VOCAB[KEYS[j]].pos && isNearDuplicateDefinition(a, b) && !/\bnot\b/i.test(a + b)) pair = [KEYS[i], KEYS[j]];
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

test("d2w: a fuzzy match loses to a closer headword that is not an accepted synonym", () => {
	const vocab = {
		Impermeable: { definition: "impenetrable", pos: "adjective" },
		Permeable: { definition: "penetrable", pos: "adjective" },
		Exculpate: { definition: "to clear from blame", pos: "verb" },
		Exonerate: { definition: "to clear from blame", pos: "verb" },
	};
	// "permeabl" passes Dice against Impermeable but is closer to Permeable.
	assert.ok(gradeHeadword("Impermeable", "Permeabl").correct, "plain rule alone would pass it");
	assert.equal(gradeHeadwordWithNearDuplicates("Impermeable", "Permeabl", vocab).correct, false);
	assert.equal(gradeHeadwordWithNearDuplicates("Impermeable", "permeabl", vocab).acceptedKey, null);
	// A misspelling of the target itself still passes.
	assert.equal(gradeHeadwordWithNearDuplicates("Impermeable", "Impermeabel", vocab).acceptedKey, "Impermeable");
	assert.equal(gradeHeadwordWithNearDuplicates("Permeable", "Permeabel", vocab).acceptedKey, "Permeable");
	// A closer headword that is an accepted synonym does not block the answer.
	assert.equal(gradeHeadwordWithNearDuplicates("Exculpate", "exonerat", vocab).acceptedKey, "Exonerate");
	// Same on the real data.
	if (VOCAB.Impermeable && VOCAB.Permeable) {
		assert.equal(gradeHeadwordWithNearDuplicates("Impermeable", "Permeabl", VOCAB).correct, false);
		assert.equal(gradeHeadwordWithNearDuplicates("Impermeable", "Impermeabl", VOCAB).correct, true);
	}
});

test("w2d: a fuzzy answer that adds a negation the target lacks is wrong", () => {
	const auspicious = { definition: "promising", alts: ["favorable", "propitious", "fortunate"] };
	assert.equal(gradeDefinition(auspicious, "favorable").correct, true);
	assert.equal(gradeDefinition(auspicious, "favourable").correct, true);
	assert.equal(gradeDefinition(auspicious, "unfavorable").correct, false);
	assert.equal(gradeDefinition(auspicious, "not favorable").correct, false);
	assert.equal(gradeDefinition(auspicious, "non-favorable").correct, false);
	assert.equal(gradeDefinition(auspicious, "unfortunate").correct, false);
	assert.equal(gradeDefinition({ definition: "honest and fair" }, "dishonest and fair").correct, false);
	// A target that already carries the prefix, or the negation, still accepts typos.
	assert.equal(gradeDefinition({ definition: "independent" }, "independant").correct, true);
	assert.equal(gradeDefinition({ definition: "to inform" }, "to informm").correct, true);
	assert.equal(gradeDefinition({ definition: "not favorable" }, "not favourable").correct, true);
	assert.equal(gradeDefinition({ definition: "unfavorable" }, "unfavourable").correct, true);
	if (VOCAB.Auspicious) assert.equal(gradeAnswer("Auspicious", VOCAB.Auspicious, "unfavorable", "w2d").correct, false);
});

test("w2d: best score across definition and alts; short targets need an exact match; trailing periods ignored", () => {
	const entry = { definition: "to lessen in intensity.", alts: ["subside", "wane", "die down."] };
	assert.equal(gradeDefinition(entry, "to lessen in intensity").correct, true);
	assert.equal(gradeDefinition(entry, "to lessen in intensity...").correct, true);
	assert.equal(gradeDefinition(entry, "Subside.").correct, true);
	assert.equal(gradeDefinition(entry, "Subside.").exact, true);
	assert.equal(gradeDefinition(entry, "subsid").correct, true, "fuzzy match on a longer alt");
	assert.equal(gradeDefinition(entry, "die down").correct, true);
	// "wane" is 4 characters: exact only.
	assert.equal(gradeDefinition(entry, "wane").correct, true);
	assert.equal(gradeDefinition(entry, "WANE.").correct, true);
	assert.equal(gradeDefinition(entry, "wan").correct, false);
	assert.equal(gradeDefinition(entry, "wanes").correct, false);
	assert.equal(gradeDefinition(entry, "").correct, false);
	assert.equal(gradeDefinition(entry, "   ").correct, false);
	// display is always the main definition.
	assert.equal(gradeDefinition(entry, "subside").display, "to lessen in intensity.");
	// A short main definition is exact-only too.
	assert.equal(gradeDefinition({ definition: "sad." }, "sad").correct, true);
	assert.equal(gradeDefinition({ definition: "sad." }, "sap").correct, false);
	// Malformed alts are ignored.
	assert.equal(gradeDefinition({ definition: "to lessen.", alts: "reduce" }, "reduce").correct, false);
	assert.equal(gradeDefinition({ definition: "to lessen.", alts: [null, 4] }, "to lessen").correct, true);
});

test("d2w: another headword needs the same pos and a shared meaning group or a near-duplicate definition", async () => {
	const { setMeaningGroups, meaningGroupsReady } = await import("../lib/distractors.js");
	await meaningGroupsReady;
	const vocab = {
		Laconic: { definition: "using few words", pos: "adjective" },
		Terse: { definition: "brief and abrupt", pos: "adjective" },
		Taciturn: { definition: "reserved in speech", pos: "adjective" },
		Brevity: { definition: "using few words", pos: "noun" },
		Curt: { definition: "rudely brief", pos: "adjective" },
	};
	setMeaningGroups({ groups: { brief: ["Laconic", "Terse", "Curt"], quiet: ["Taciturn"] } });
	try {
		const r = gradeHeadwordWithNearDuplicates("Laconic", "terse", vocab);
		assert.equal(r.correct, true);
		assert.equal(r.acceptedKey, "Terse");
		// A typo of a group member is accepted as that member.
		assert.equal(gradeHeadwordWithNearDuplicates("Laconic", "tersse", vocab).acceptedKey, "Terse");
		// Not in the group and a different definition: wrong.
		assert.equal(gradeHeadwordWithNearDuplicates("Laconic", "Taciturn", vocab).correct, false);
		// Identical definition but a different part of speech: wrong.
		assert.equal(gradeHeadwordWithNearDuplicates("Laconic", "Brevity", vocab).correct, false);
		// Same group but different pos: wrong.
		setMeaningGroups({ groups: { brief: ["Laconic", "Brevity"] } });
		assert.equal(gradeHeadwordWithNearDuplicates("Laconic", "Brevity", vocab).correct, false);
		// Injectable group rule.
		assert.equal(gradeHeadwordWithNearDuplicates("Laconic", "Curt", vocab, { isSameGroup: () => true }).correct, true);
		assert.equal(gradeHeadwordWithNearDuplicates("Laconic", "Curt", vocab, { isSameGroup: () => false }).correct, false);
		// The target itself is always right.
		assert.equal(gradeHeadwordWithNearDuplicates("Laconic", "laconic.", vocab).correct, true);
	} finally {
		setMeaningGroups(null);
	}
	// A missing groups file means no groups: only near-duplicates count.
	assert.equal(gradeHeadwordWithNearDuplicates("Laconic", "Terse", vocab).correct, false);
});