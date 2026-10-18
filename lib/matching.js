// lib/matching.js: answer grading for both directions. Ported from
// Wortschatz's inline Dice matcher so the string-similarity package can be
// dropped. Every threshold lives here.
//
//   w2d (word shown, type the definition): Dice >= 0.6 between the lowercased,
//        trimmed answer and the entry's `definition` (not fullDefinition) or
//        one of its optional `alts`, best score wins, with whitespace removed
//        before comparing (string-similarity's compareTwoStrings). A trailing
//        period is ignored on both sides, and a target of 4 characters or
//        fewer needs an exact match. A fuzzy match that adds a negation the
//        target lacks is rejected (addsNegation).
//   d2w (definition shown, type the headword): Wortschatz's word rule:
//        trailing punctuation dropped, case and spacing folded, then an exact
//        match for headwords of 4 characters or fewer, else Dice >= 0.6. With
//        the vocabulary known (gradeHeadwordWithNearDuplicates), a fuzzy match
//        loses to any closer headword that is not an accepted synonym.

import { isNearDuplicateDefinition, isSameMeaningGroup, negationDiffers } from "./distractors.js";

export const WORD_DICE_THRESHOLD = 0.6; // similarity floor for both directions
export const EXACT_MATCH_MAX_LEN = 4; // normalized headword <= this => exact match required (d2w)

// Sørensen–Dice coefficient over character bigrams, counting repeated bigrams
// (multiset intersection). Same algorithm as string-similarity, minus its
// whitespace stripping; see legacyCompare for that.
export function diceCoefficient(a, b) {
	if (a === b) return 1;
	if (a.length < 2 || b.length < 2) return 0;

	const bigrams = new Map();
	for (let i = 0; i < a.length - 1; i++) {
		const bg = a.slice(i, i + 2);
		bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
	}

	let intersection = 0;
	for (let i = 0; i < b.length - 1; i++) {
		const bg = b.slice(i, i + 2);
		const count = bigrams.get(bg) || 0;
		if (count > 0) {
			bigrams.set(bg, count - 1);
			intersection += 1;
		}
	}

	return (2 * intersection) / (a.length + b.length - 2);
}

// string-similarity's compareTwoStrings, byte for byte: all whitespace removed,
// then Dice. Two empty strings score 1.
export function legacyCompare(a, b) {
	return diceCoefficient(String(a).replace(/\s+/g, ""), String(b).replace(/\s+/g, ""));
}

function str(v) {
	return v == null ? "" : String(v);
}

// Generic normalization for a typed headword: trim, lowercase, collapse
// whitespace. (Wortschatz's umlaut and "to " rules are German/English-gloss
// specific and are not ported.)
export function normalize(s) {
	return str(s).trim().toLowerCase().replace(/\s+/g, " ");
}

// Trailing punctuation ("abate." / "abate!") is not part of a word answer.
export function stripTrailingPunctuation(s) {
	return str(s).replace(/[^\p{L}\p{N}\s]+$/u, "");
}

// Compare a normalized guess against a normalized expected headword.
function compareWord(guess, expected) {
	if (!expected) return { matched: false, exact: false };
	if (guess === expected) return { matched: true, exact: true };
	if (expected.length <= EXACT_MATCH_MAX_LEN) return { matched: false, exact: false };
	return { matched: diceCoefficient(guess, expected) >= WORD_DICE_THRESHOLD, exact: false };
}

// A typed or stored definition for comparison: trimmed, lowercased, spacing
// collapsed, trailing periods dropped ("to lessen." and "to lessen" are equal).
export function normalizeDefinitionAnswer(s) {
	return normalize(s).replace(/[\s.]+$/, "");
}

// Every accepted short definition of an entry: `definition` first, then the
// optional `alts` array. Empty and repeated ones are dropped.
export function definitionTargets(entry) {
	const out = [];
	const add = (v) => {
		const t = normalizeDefinitionAnswer(v);
		if (t && !out.includes(t)) out.push(t);
	};
	add(entry && entry.definition);
	if (entry && Array.isArray(entry.alts)) for (const a of entry.alts) if (typeof a === "string") add(a);
	return out;
}

// Negation a typed definition can add to an otherwise close answer. Dice scores
// "unfavorable" 0.94 against "favorable", so a fuzzy pass must not hide it.
const NEGATING_WORDS = new Set(["not", "no", "never", "without", "lacking", "non"]);
const NEGATING_PREFIXES = ["non", "dis", "un", "in", "im", "il", "ir"];
// Words that make a target already negative ("not willing", "without care").
const TARGET_NEGATING_WORDS = new Set(["not", "no", "without", "lacking"]);
const NEGATED_STEM_MIN = 4; // letters left after the prefix for it to count
const SAME_TOKEN_DICE = 0.7; // two tokens this close are the same word, spelling aside
// A prefix negates only when the rest of the word is this close to a word on
// the other side on its own: "unfavorable" / "favorable" (1.0) negates,
// "impassioned" / "passionate" (0.71) does not.
const NEGATED_STEM_DICE = 0.85;
// Words that start with a negating prefix but do not negate their stem.
const NON_NEGATING_WORDS = new Set([
	"impassioned",
	"invaluable",
	"inflammable",
	"intense",
	"important",
	"immense",
	"inspired",
	"insightful",
	"integral",
	"distinguished",
]);

function tokens(s) {
	return str(s)
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);
}

function sameToken(a, b) {
	return a === b || (a.length >= NEGATED_STEM_MIN && b.length >= NEGATED_STEM_MIN && diceCoefficient(a, b) >= SAME_TOKEN_DICE);
}

// The stem `word` negates when it carries a negating prefix, is not on the
// allowlist, and the rest closely matches one of `others` on its own.
function negatedStem(word, others) {
	if (NON_NEGATING_WORDS.has(word)) return null;
	for (const p of NEGATING_PREFIXES) {
		if (!word.startsWith(p) || word.length - p.length < NEGATED_STEM_MIN) continue;
		const rest = word.slice(p.length);
		if (others.some((x) => x.length >= NEGATED_STEM_MIN && diceCoefficient(rest, x) >= NEGATED_STEM_DICE)) return p;
	}
	return null;
}

// True when `target` already expresses a negation: a negating word (not, no,
// without, lacking), or a prefixed word whose stem the guess spells out
// ("unwilling" against "not willing"). Then a negation in the guess agrees with
// the target instead of flipping it.
function targetIsNegated(t, g) {
	return t.some((x) => TARGET_NEGATING_WORDS.has(x) || negatedStem(x, g) !== null);
}

// True when `guess` carries a negation `target` lacks: a negating word (not,
// no, never, without, lacking, non) the target does not have, or a word that
// is a target word behind a negating prefix ("unfavorable" for "favorable",
// "dishonest" for "honest") while the target has no such prefixed word. A
// target that is itself negated skips the rule ("not willing" for "unwilling").
export function addsNegation(guess, target) {
	const g = tokens(guess);
	const t = tokens(target);
	if (targetIsNegated(t, g)) return false;
	for (const w of g) {
		if (NEGATING_WORDS.has(w) && !t.includes(w)) return true;
	}
	for (const w of g) {
		if (t.includes(w)) continue;
		const p = negatedStem(w, t);
		if (p === null) continue;
		// The target has the same prefixed word (a typo of "inform", "independent").
		const rest = w.slice(p.length);
		if (t.some((x) => x.startsWith(p) && sameToken(rest, x.slice(p.length)))) continue;
		return true;
	}
	return false;
}

// w2d: grade a typed definition against the entry's short `definition` and its
// optional `alts`, taking the best score. A target of EXACT_MATCH_MAX_LEN
// characters or fewer (after normalization) must be typed exactly, since Dice
// on two or three bigrams accepts unrelated words. A fuzzy match that adds a
// negation the target lacks (addsNegation) is not a match.
// Returns { correct, exact, score, display } where display is the definition.
export function gradeDefinition(entry, answer) {
	const definition = str(entry && entry.definition);
	const guess = normalizeDefinitionAnswer(answer);
	let best = { correct: false, exact: false, score: 0 };
	for (const target of definitionTargets(entry)) {
		const exact = guess === target;
		const score = guess ? legacyCompare(guess, target) : 0;
		const correct =
			exact || (target.length > EXACT_MATCH_MAX_LEN && score >= WORD_DICE_THRESHOLD && !addsNegation(guess, target));
		const r = { correct, exact, score: exact ? 1 : score };
		if (r.correct > best.correct || (r.correct === best.correct && r.score > best.score)) best = r;
	}
	return { ...best, display: definition };
}

// d2w: grade a typed headword against `key`.
// Returns { correct, exact, display } where display is the headword.
export function gradeHeadword(key, answer) {
	const expected = normalize(key);
	const guess = normalize(stripTrailingPunctuation(str(answer).trim()));
	const r = compareWord(guess, expected);
	return { correct: r.matched, exact: r.exact, display: str(key) };
}

// One entry point for both directions. `key` is the headword, `entry` its
// gre_combined.json value.
export function gradeAnswer(key, entry, answer, direction) {
	return direction === "d2w" ? gradeHeadword(key, answer) : gradeDefinition(entry, answer);
}

// d2w with synonym tolerance: if the typed headword is not `key` but is
// another headword of the same part of speech that shares a meaning group
// with `key` (src/data/meaning-groups.json, lib/distractors.js) or whose short
// definition is a near-duplicate of `key`'s (Exculpate / Exonerate, both "to
// clear from blame."), the answer is accepted, since the prompt cannot tell
// the two apart. `opts.isSameGroup(a, b)` overrides the group lookup (tests).
// `vocab` is the gre_combined.json
// object. Returns gradeHeadword's result plus `acceptedKey`: the headword the
// answer was matched to (`key` itself, a near-duplicate, or null when wrong).
//
// `opts.isNearDuplicate(a, b)` overrides lib/distractors.js's
// isNearDuplicateDefinition (tests). Its negation guard (lib/distractors.js
// negationDiffers) applies to an override too, so a negated definition never
// accepts its antonym.
//
// Knowing the vocabulary also closes a hole in the plain word rule: a typed
// answer that is exactly ANOTHER headword is that word, not a typo of the
// target, even when Dice would pass it ("Permeable" scores 0.89 against
// "Impermeable"). It is accepted only as a near-duplicate synonym.
export function gradeHeadwordWithNearDuplicates(key, answer, vocab, opts = {}) {
	const own = gradeHeadword(key, answer);
	if (own.exact) return { ...own, acceptedKey: key };
	const wrong = { correct: false, exact: false, display: own.display, acceptedKey: null };
	const words = vocab && typeof vocab === "object" ? vocab : {};
	const has = (k) => Object.prototype.hasOwnProperty.call(words, k) && !!words[k] && typeof words[k] === "object";
	const targetEntry = has(key) ? words[key] : null;
	const target = targetEntry && targetEntry.definition;
	const isNear = typeof opts.isNearDuplicate === "function" ? opts.isNearDuplicate : isNearDuplicateDefinition;
	const sameGroup = typeof opts.isSameGroup === "function" ? opts.isSameGroup : isSameMeaningGroup;
	const near = (a, b) => !!a && !!b && !negationDiffers(a, b) && isNear(a, b);
	// Another headword stands in for the target only when it is the same part
	// of speech and either shares a meaning group with it or has a near-duplicate
	// definition.
	const accepts = (other) => {
		if (!targetEntry || !has(other)) return false;
		const e = words[other];
		if (!targetEntry.pos || e.pos !== targetEntry.pos) return false;
		return sameGroup(key, other) || near(target, e.definition);
	};

	const guess = normalize(stripTrailingPunctuation(str(answer).trim()));
	const typed = guess ? Object.keys(words).find((k) => k !== key && normalize(k) === guess) : undefined;
	if (typed !== undefined) {
		return accepts(typed) ? { correct: true, exact: false, display: own.display, acceptedKey: typed } : wrong;
	}
	// A fuzzy match stands only when no other headword that is not an accepted
	// synonym scores higher: "Permeabl" passes Dice against Impermeable but is
	// closer to Permeable, so it is a misspelt Permeable, not Impermeable.
	const score = (k) => diceCoefficient(guess, normalize(k));
	const closerRival = (s) => Object.keys(words).some((k) => k !== key && score(k) > s && !accepts(k));

	if (own.correct) return closerRival(score(key)) ? wrong : { ...own, acceptedKey: key };
	if (!targetEntry) return wrong;

	// Exact matches were handled above; take the closest fuzzy synonym.
	let fuzzy = null;
	let fuzzyScore = -1;
	for (const other of Object.keys(words)) {
		if (other === key) continue;
		if (!gradeHeadword(other, answer).correct) continue;
		const s = score(other);
		if (s > fuzzyScore && accepts(other)) {
			fuzzy = other;
			fuzzyScore = s;
		}
	}
	if (fuzzy && !closerRival(fuzzyScore)) return { correct: true, exact: false, display: own.display, acceptedKey: fuzzy };
	return wrong;
}
