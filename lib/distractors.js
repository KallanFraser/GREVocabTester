// Multiple-choice distractor selection.
//
// A distractor must never be a second correct answer. pickDistractors drops
// any candidate whose short definition is identical or nearly identical to the
// target's (isNearDuplicateDefinition), any candidate sharing the target's
// root (Belie / Belies), and the synonym pairs in CONFUSABLE_PAIRS whose
// definitions are worded apart but would each fit the other. Among what is
// left it prefers the target's part of speech and a similar length, so grammar
// and length do not give the answer away.
import { WORDS, getWord } from "./words.js";

export const NEAR_DUPLICATE_JACCARD = 0.5;

// Synonyms whose definitions were reworded to differ but still overlap in
// meaning. Never offer one as a distractor for the other.
export const CONFUSABLE_PAIRS = Object.freeze([
	["Brook", "Stand"],
	["Decorum", "Propriety"],
	["Deride", "Guy"],
	["Exculpate", "Exonerate"],
	["Fervent", "Fervid"],
	["Indigence", "Penury"],
	["Intractable", "Intractible"],
]);

const STOPWORDS = new Set(
	`a an the to or and of in on for with by from as at into onto not no be being been is are that which
	who whom one ones oneself someone something its it very often also usually especially more most than so`
		.split(/\s+/)
		.filter(Boolean),
);

const SUFFIXES = ["ness", "ment", "ity", "ion", "ive", "ful", "ing", "ous", "ed", "es", "s", "e", "y"];

// Light suffix stripping so "respectfully submissive" and "respectful
// submission" compare equal. Deliberately crude; it only feeds overlap checks.
function stem(token) {
	let s = token;
	if (s.length > 5 && s.endsWith("ly")) s = s.slice(0, -2);
	for (const suf of SUFFIXES) {
		if (s.endsWith(suf) && s.length - suf.length >= 4) return s.slice(0, -suf.length);
	}
	return s;
}

export function normalizeDefinition(text) {
	return String(text || "")
		.toLowerCase()
		.replace(/[’']/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

const contentCache = new Map();

function cachedContentWords(norm) {
	let out = contentCache.get(norm);
	if (!out) {
		out = new Set();
		for (const t of norm.split(" ")) {
			if (t && !STOPWORDS.has(t)) out.add(stem(t));
		}
		contentCache.set(norm, out);
	}
	return out;
}

// Stemmed, stopword-free tokens of a definition.
export function contentWords(text) {
	return new Set(cachedContentWords(normalizeDefinition(text)));
}

// True when two short definitions would read as the same answer: equal after
// normalization, or a Jaccard overlap >= 0.5 on stemmed content words.
export function isNearDuplicateDefinition(a, b) {
	const na = normalizeDefinition(a);
	const nb = normalizeDefinition(b);
	if (!na || !nb) return false;
	if (na === nb) return true;
	const A = cachedContentWords(na);
	const B = cachedContentWords(nb);
	if (!A.size || !B.size) return false;
	let shared = 0;
	for (const t of A) if (B.has(t)) shared++;
	return shared / (A.size + B.size - shared) >= NEAR_DUPLICATE_JACCARD;
}

function rootOf(word) {
	return stem(word.toLowerCase().replace(/[^a-z]/g, ""));
}

// Same word family: equal roots, one root a prefix of the other (5+ letters),
// or a shared prefix of 8+ letters (Anachronism / Anachronistic).
export function isSameRoot(a, b) {
	const x = rootOf(a);
	const y = rootOf(b);
	if (x === y) return true;
	const [s, l] = x.length <= y.length ? [x, y] : [y, x];
	if (s.length >= 5 && l.startsWith(s)) return true;
	let i = 0;
	while (i < s.length && s[i] === l[i]) i++;
	return i >= 8;
}

const confusable = new Map();
for (const [a, b] of CONFUSABLE_PAIRS) {
	for (const [x, y] of [[a, b], [b, a]]) {
		const key = x.toLowerCase();
		if (!confusable.has(key)) confusable.set(key, new Set());
		confusable.get(key).add(y.toLowerCase());
	}
}

export function isConfusable(a, b) {
	const set = confusable.get(a.toLowerCase());
	return !!set && set.has(b.toLowerCase());
}

// Would `a` be a second correct answer when the question is about `b`?
function clashes(a, b) {
	return (
		a.word.toLowerCase() === b.word.toLowerCase() ||
		isSameRoot(a.word, b.word) ||
		isConfusable(a.word, b.word) ||
		isNearDuplicateDefinition(a.definition, b.definition)
	);
}

// Uniform float in [0, 1) from crypto.getRandomValues.
export function cryptoRng() {
	const buf = new Uint32Array(1);
	globalThis.crypto.getRandomValues(buf);
	return buf[0] / 4294967296;
}

function toEntry(x) {
	if (typeof x === "string") return getWord(x);
	return x && typeof x.word === "string" ? getWord(x.word) : null;
}

// Pick up to k distractor entries for `target` (headword or entry).
//   direction "w2d": headword prompt, definitions as options (length = definition)
//   direction "d2w": definition prompt, headwords as options (length = headword)
//   rng:  () => float in [0, 1); defaults to crypto.getRandomValues
//   pool: optional headwords or entries to draw from (defaults to all words)
// Returns entries in pick order. Fewer than k come back only when the pool runs
// out of safe candidates. The caller shuffles the target in among them.
export function pickDistractors(target, k = 3, { direction = "w2d", rng = cryptoRng, pool } = {}) {
	const t = toEntry(target);
	if (!t || !(k > 0)) return [];
	const lengthOf = direction === "d2w" ? (e) => e.word.length : (e) => e.definition.length;
	const band = direction === "d2w" ? 2 : 6;
	const tLen = lengthOf(t);

	const seen = new Set();
	const candidates = [];
	for (const x of pool || WORDS) {
		const e = toEntry(x);
		if (!e || seen.has(e.word) || clashes(e, t)) continue;
		seen.add(e.word);
		candidates.push(e);
	}

	// Shuffle first so the stable sort below leaves ties in random order.
	for (let i = candidates.length - 1; i > 0; i--) {
		const j = Math.min(i, Math.floor(Math.max(0, rng()) * (i + 1)));
		[candidates[i], candidates[j]] = [candidates[j], candidates[i]];
	}
	const score = (e) => (e.pos === t.pos ? 0 : 1000) + Math.floor(Math.abs(lengthOf(e) - tLen) / band);
	const scored = candidates.map((e) => ({ e, s: score(e) }));
	scored.sort((a, b) => a.s - b.s);

	const picked = [];
	for (const { e } of scored) {
		if (picked.length >= k) break;
		if (picked.some((p) => clashes(e, p))) continue;
		picked.push(e);
	}
	return picked;
}
