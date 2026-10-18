// lib/matching.js — answer grading for both directions. Ported from
// Wortschatz's inline Dice matcher so the string-similarity package can be
// dropped. Every threshold lives here.
//
//   w2d (word shown, type the definition): graded EXACTLY as the original
//        TestMode did — Dice >= 0.6 between the lowercased, trimmed answer and
//        the entry's `definition` (not fullDefinition), with whitespace
//        removed before comparing, which is what string-similarity's
//        compareTwoStrings does internally. Nothing else is forgiven, so this
//        accepts exactly the answers it accepted before.
//   d2w (definition shown, type the headword): Wortschatz's word rule —
//        trailing punctuation dropped, case and spacing folded, then an exact
//        match for headwords of 4 characters or fewer, else Dice >= 0.6.

import { isNearDuplicateDefinition } from "./distractors.js";

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

// w2d: grade a typed definition against the entry's short `definition`.
// Returns { correct, exact, score, display } where display is the definition.
export function gradeDefinition(entry, answer) {
	const definition = str(entry && entry.definition);
	const guess = str(answer).trim().toLowerCase();
	const target = definition.trim().toLowerCase();
	const score = legacyCompare(guess, target);
	return {
		correct: score >= WORD_DICE_THRESHOLD,
		exact: guess === target,
		score,
		display: definition,
	};
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
// another headword whose short definition is a near-duplicate of `key`'s
// (Exculpate / Exonerate, both "to clear from blame."), the answer is accepted,
// since the prompt cannot tell the two apart. `vocab` is the gre_combined.json
// object. Returns gradeHeadword's result plus `acceptedKey`: the headword the
// answer was matched to (`key` itself, a near-duplicate, or null when wrong).
//
// `opts.isNearDuplicate(a, b)` overrides lib/distractors.js's
// isNearDuplicateDefinition (tests).
//
// A pair where only one definition is negated is never a synonym, whatever the
// overlap: Impermeable "not allowing passage." vs Permeable "allowing passage."
// share every content word but are antonyms.
const NEGATION = /\b(not|no|never|without|lacking|non)\b/i;

function negationDiffers(a, b) {
	return NEGATION.test(a) !== NEGATION.test(b);
}

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
	const target = words[key] && words[key].definition;
	const isNear = typeof opts.isNearDuplicate === "function" ? opts.isNearDuplicate : isNearDuplicateDefinition;
	const near = (a, b) => !!a && !!b && !negationDiffers(a, b) && isNear(a, b);

	const guess = normalize(stripTrailingPunctuation(str(answer).trim()));
	const typed = guess ? Object.keys(words).find((k) => k !== key && normalize(k) === guess) : undefined;
	if (typed !== undefined) {
		const def = words[typed] && words[typed].definition;
		return near(target, def) ? { correct: true, exact: false, display: own.display, acceptedKey: typed } : wrong;
	}
	if (own.correct) return { ...own, acceptedKey: key };
	if (!target) return wrong;

	// Exact matches were handled above; take the first fuzzy synonym.
	let fuzzy = null;
	for (const other of Object.keys(words)) {
		if (other === key) continue;
		if (!gradeHeadword(other, answer).correct) continue;
		if (near(target, words[other] && words[other].definition)) {
			fuzzy = other;
			break;
		}
	}
	if (fuzzy) return { correct: true, exact: false, display: own.display, acceptedKey: fuzzy };
	return wrong;
}
