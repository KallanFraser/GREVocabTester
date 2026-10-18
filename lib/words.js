// Read-only access to the vocabulary in src/data/gre_combined.json.
// Pure and SSR-safe: no window, no storage, no randomness. Entries are frozen
// objects shaped { word, definition, fullDefinition, example, pos, tier }, in
// file order.
import vocab from "../src/data/gre_combined.json";
import legacyIndex from "../src/data/legacy-index.json";

export const POS_VALUES = Object.freeze(["noun", "verb", "adjective", "adverb"]);
export const TIER_VALUES = Object.freeze([1, 2, 3]);

export const WORDS = Object.freeze(
	Object.keys(vocab).map((word) => Object.freeze({ word, ...vocab[word] })),
);

export const WORD_COUNT = WORDS.length;

const byLower = new Map(WORDS.map((e) => [e.word.toLowerCase(), e]));

function groupBy(field, values) {
	const out = new Map(values.map((v) => [v, []]));
	for (const e of WORDS) if (out.has(e[field])) out.get(e[field]).push(e);
	for (const [v, list] of out) out.set(v, Object.freeze(list));
	return out;
}

const byTier = groupBy("tier", TIER_VALUES);
const byPos = groupBy("pos", POS_VALUES);
const EMPTY = Object.freeze([]);

// Case-insensitive, whitespace-trimmed lookup. Returns null when unknown.
export function getWord(headword) {
	if (typeof headword !== "string") return null;
	return byLower.get(headword.trim().toLowerCase()) || null;
}

export function hasWord(headword) {
	return getWord(headword) !== null;
}

export function wordsByTier(tier) {
	return byTier.get(Number(tier)) || EMPTY;
}

export function wordsByPos(pos) {
	return byPos.get(typeof pos === "string" ? pos.toLowerCase() : pos) || EMPTY;
}

// Map old positional pack indices (`?pack=1,5,9`, `marketplaceWordpack`) to
// current headwords through the frozen pre-overhaul key order. Accepts numbers
// or numeric strings; skips anything out of range or not an integer, and drops
// repeats while keeping first-seen order.
export function resolveLegacyIndices(ints) {
	if (!Array.isArray(ints)) return [];
	const seen = new Set();
	const out = [];
	for (const raw of ints) {
		const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
		if (!Number.isInteger(n) || n < 0 || n >= legacyIndex.length) continue;
		const entry = getWord(legacyIndex[n]);
		if (!entry || seen.has(entry.word)) continue;
		seen.add(entry.word);
		out.push(entry.word);
	}
	return out;
}
