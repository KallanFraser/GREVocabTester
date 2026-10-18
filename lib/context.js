// In Context (/play/context): blank the headword out of its example sentence
// and build a four-option question around it. Pure apart from the default rng.
//
// blankSentence(entry) looks for the headword, or an inflection of it, in
// entry.example: case-insensitive, whole word only. Accepted forms, tried in
// this order on every word of the sentence:
//   1. the headword itself
//   2. a regular inflection: -s, -es, -ed, -d, -ing, -er, -est, -ly, -ally,
//      with a dropped final e (Abate / abating), y to i (Belie / belies is
//      plain -s; Pacify / pacified), -le to -ly (Subtle / subtly) and a
//      doubled final consonant (Abet / abetted)
//   3. a close derivation: the headword minus a final e or y (at least five
//      letters) followed by at most four more letters (Mitigate / mitigation)
// The first word that matches is blanked. Returns { before, after, form },
// where `form` is the matched text as written, or null when nothing matches.
// Surrounding quotes on the example are dropped first.
import { WORDS, getWord } from "./words.js";
import { pickDistractors, cryptoRng, isConfusable, isNearDuplicateDefinition, isSameRoot } from "./distractors.js";

export const OPTION_COUNT = 4;

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const DERIVED_MIN_STEM = 5;
const DERIVED_MAX_EXTRA = 4;
const TOKEN = /[A-Za-z]+(?:-[A-Za-z]+)*/g;

export function stripQuotes(s) {
	return String(s || "")
		.trim()
		.replace(/^["“”']+|["“”']+$/g, "");
}

// Every regular inflection of a lowercase headword, the headword first.
export function inflections(word) {
	const w = String(word || "").toLowerCase();
	if (!w) return [];
	const out = [w, `${w}s`, `${w}es`, `${w}ed`, `${w}d`, `${w}ing`, `${w}er`, `${w}est`, `${w}ly`];
	const last = w[w.length - 1];
	const prev = w[w.length - 2];
	if (last === "e") {
		const base = w.slice(0, -1);
		out.push(`${base}ing`, `${base}er`, `${base}est`);
		if (w.endsWith("le")) out.push(`${base}y`);
	}
	if (last === "y" && prev && !VOWELS.has(prev)) {
		const base = w.slice(0, -1);
		out.push(`${base}ies`, `${base}ied`, `${base}ier`, `${base}iest`, `${base}ily`);
	}
	if (w.endsWith("ic")) out.push(`${w}ally`);
	// A consonant-vowel-consonant ending doubles before -ed and -ing (abetted).
	const third = w[w.length - 3];
	if (w.length >= 3 && !VOWELS.has(last) && !"wxy".includes(last) && VOWELS.has(prev) && !VOWELS.has(third)) {
		out.push(`${w}${last}ed`, `${w}${last}ing`);
	}
	return [...new Set(out)];
}

function derivedMatch(word, token) {
	const w = word.toLowerCase();
	const stem = /[ey]$/.test(w) ? w.slice(0, -1) : w;
	return stem.length >= DERIVED_MIN_STEM && token.startsWith(stem) && token.length - w.length <= DERIVED_MAX_EXTRA;
}

export function blankSentence(entry) {
	const word = entry && typeof entry.word === "string" ? entry.word.trim() : "";
	const sentence = stripQuotes(entry && entry.example);
	if (!word || !sentence) return null;

	const tokens = [];
	for (const m of sentence.matchAll(TOKEN)) tokens.push({ text: m[0], lower: m[0].toLowerCase(), index: m.index });

	const forms = new Set(inflections(word));
	const hit = tokens.find((t) => forms.has(t.lower)) || tokens.find((t) => derivedMatch(word, t.lower));
	if (!hit) return null;
	return {
		before: sentence.slice(0, hit.index),
		after: sentence.slice(hit.index + hit.text.length),
		form: hit.text,
	};
}

// Headwords whose sentence can be blanked, in the order given.
export function usableKeys(keys) {
	const out = [];
	for (const k of keys) {
		const e = getWord(k);
		if (e && blankSentence(e)) out.push(e.word);
	}
	return out;
}

// Could `a` pass as a second correct answer next to `b`?
function clashes(a, b) {
	return (
		a.word === b.word ||
		isSameRoot(a.word, b.word) ||
		isConfusable(a.word, b.word) ||
		isNearDuplicateDefinition(a.definition, b.definition)
	);
}

function shuffle(list, rng) {
	const a = [...list];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.min(i, Math.floor(rng() * (i + 1)));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// One question: the blanked sentence plus four headword options. Distractors
// are picked in d2w style (headwords as options, matched on length) and must
// share the target's part of speech. They come from the scope first; a small
// pack is topped up from the full list, same part of speech before any other.
// pickDistractors already rejects anything that clashes with the target; the
// top-up also rejects anything clashing with an option already chosen.
export function buildContextQuestion(key, scopeKeys = [], { rng = cryptoRng } = {}) {
	const target = getWord(key);
	const blank = target ? blankSentence(target) : null;
	if (!blank) return null;
	const need = OPTION_COUNT - 1;
	const samePos = (e) => e && e.pos === target.pos;

	let picked = [];
	const fill = (candidates) => {
		if (picked.length >= need) return;
		const pool = candidates.filter((e) => e && e.word !== target.word && !picked.some((p) => clashes(e, p)));
		if (!pool.length) return;
		picked = picked.concat(pickDistractors(target, need - picked.length, { direction: "d2w", pool, rng }));
	};
	const scoped = scopeKeys.map(getWord).filter(Boolean);
	fill(scoped.filter(samePos));
	fill(WORDS.filter(samePos));
	fill(WORDS);

	const options = shuffle([target, ...picked], rng).map((e) => e.word);
	return { key: target.word, ...blank, options, correctIndex: options.indexOf(target.word) };
}
