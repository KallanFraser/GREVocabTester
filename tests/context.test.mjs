// Unit tests for lib/context.js. Run with `npm test` (node:test, no deps).

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
const { isNearDuplicateDefinition, isSameRoot, isConfusable } = await import("../lib/distractors.js");
const { blankSentence, inflections, usableKeys, buildContextQuestion, OPTION_COUNT } = await import("../lib/context.js");

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

const blank = (word, example) => blankSentence({ word, example });

test("finds the headword itself", () => {
	assert.deepEqual(blank("Mitigate", "Trees can mitigate the heat."), {
		before: "Trees can ",
		after: " the heat.",
		form: "mitigate",
	});
});

test("matches -ed, -d and doubled consonants", () => {
	assert.equal(blank("Augment", "She augmented her income.").form, "augmented");
	assert.equal(blank("Absolve", "The court absolved him.").form, "absolved");
	assert.equal(blank("Abet", "He was abetted by friends.").form, "abetted");
	assert.equal(blank("Pacify", "The crowd was pacified.").form, "pacified");
});

test("matches -ing, with and without a dropped e", () => {
	assert.equal(blank("Carp", "Stop carping about it.").form, "carping");
	assert.equal(blank("Abate", "The storm is abating now.").form, "abating");
	assert.equal(blank("Abet", "Abetting a crime is a crime.").form, "Abetting");
});

test("matches -s and -es", () => {
	assert.equal(blank("Belie", "His smile belies his anger.").form, "belies");
	assert.equal(blank("Amass", "She amasses wealth.").form, "amasses");
	assert.equal(blank("Tyro", "The tyros watched.").form, "tyros");
});

test("matches -ly, -ily and -le to -ly", () => {
	assert.equal(blank("Candid", "She spoke candidly.").form, "candidly");
	assert.equal(blank("Hasty", "He left hastily.").form, "hastily");
	assert.equal(blank("Subtle", "It shifted subtly.").form, "subtly");
	assert.equal(blank("Laconic", "He replied laconically.").form, "laconically");
});

test("a capitalized first word keeps its case and leaves before empty", () => {
	const b = blank("Ephemeral", "Ephemeral fame fades fast.");
	assert.deepEqual(b, { before: "", after: " fame fades fast.", form: "Ephemeral" });
	assert.equal(blank("abate", "ABATED winds followed.").form, "ABATED");
});

test("whole words only, and surrounding quotes are dropped", () => {
	assert.equal(blank("Guy", "The guyline snapped."), null);
	assert.equal(blank("Stand", "Notwithstanding the cost, they built it."), null);
	assert.equal(blank("Rail", "They derailed the plan."), null);
	const q = blank("Guy", "“Don't guy the new recruit.”");
	assert.deepEqual(q, { before: "Don't ", after: " the new recruit.", form: "guy" });
});

test("returns null when no form is present or the entry is empty", () => {
	assert.equal(blank("Obdurate", "He would not change his mind."), null);
	assert.equal(blankSentence(null), null);
	assert.equal(blankSentence({ word: "Abate", example: "" }), null);
});

test("inflections start with the headword and have no duplicates", () => {
	const f = inflections("Abate");
	assert.equal(f[0], "abate");
	assert.equal(new Set(f).size, f.length);
});

test("current data: how many entries cannot be blanked", () => {
	const missing = WORDS.filter((e) => !blankSentence(e)).map((e) => e.word);
	console.log(`# blankSentence: ${missing.length} of ${WORDS.length} entries return null${missing.length ? `: ${missing.join(", ")}` : ""}`);
	assert.equal(usableKeys(WORDS.map((e) => e.word)).length, WORDS.length - missing.length);
	// Whatever form is found, the blanked pieces rebuild the sentence.
	for (const e of WORDS) {
		const b = blankSentence(e);
		if (b) assert.ok((b.before + b.form + b.after).length > 0);
	}
});

function assertSafe(q) {
	const t = getWord(q.key);
	assert.equal(q.options.length, OPTION_COUNT);
	assert.equal(new Set(q.options).size, OPTION_COUNT);
	assert.equal(q.options[q.correctIndex], t.word);
	const entries = q.options.map(getWord);
	for (let i = 0; i < entries.length; i++) {
		for (let j = i + 1; j < entries.length; j++) {
			const a = entries[i];
			const b = entries[j];
			assert.ok(!isNearDuplicateDefinition(a.definition, b.definition), `${a.word} / ${b.word} near-duplicate`);
			assert.ok(!isSameRoot(a.word, b.word), `${a.word} / ${b.word} same root`);
			assert.ok(!isConfusable(a.word, b.word), `${a.word} / ${b.word} confusable`);
		}
	}
	return entries;
}

test("every entry gets four safe options of its own part of speech", () => {
	const rng = seededRng(7);
	for (const e of WORDS) {
		if (!blankSentence(e)) continue;
		const q = buildContextQuestion(e.word, [], { rng });
		const entries = assertSafe(q);
		for (const o of entries) assert.equal(o.pos, e.pos, `${o.word} for ${e.word}`);
	}
});

test("a pack with fewer than four words is topped up from the full list", () => {
	const keys = ["Exculpate", "Exonerate"];
	const q = buildContextQuestion("Exculpate", keys, { rng: seededRng(3) });
	assertSafe(q);
	assert.ok(!q.options.includes("Exonerate"));
});

test("pack words are preferred as distractors", () => {
	const t = WORDS.find((e) => blankSentence(e));
	const same = WORDS.filter((e) => e.pos === t.pos && e.word !== t.word).slice(0, 40);
	const q = buildContextQuestion(t.word, [t.word, ...same.map((e) => e.word)], { rng: seededRng(11) });
	assertSafe(q);
	const scoped = new Set(same.map((e) => e.word));
	assert.ok(q.options.filter((w) => w !== t.word).every((w) => scoped.has(w)));
});

test("an unblankable word yields no question", () => {
	assert.equal(buildContextQuestion("Not a real headword", []), null);
});
