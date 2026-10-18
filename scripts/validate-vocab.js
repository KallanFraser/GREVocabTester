#!/usr/bin/env node
// validate-vocab.js — integrity checks for src/data/gre_combined.json, the
// frozen legacy order (src/data/legacy-index.json) and public/data/wordpacks.json.
//
// Errors (exit 1): missing or empty fields, bad pos or tier, case-insensitive
// duplicate headwords (also raw duplicate keys JSON.parse would collapse),
// identical definitions, a legacy-index entry missing from the data, a pack
// word that does not exist, or pack indices that no longer resolve to the
// pack's words.
// Warnings: near-duplicate definitions (same rule the distractor picker uses)
// and examples that do not contain the headword or an inflection of it.
//
//   node scripts/validate-vocab.js
const fs = require("fs");
const path = require("path");
const { registerHooks } = require("module");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..");
const VOCAB_PATH = path.join(ROOT, "src", "data", "gre_combined.json");
const LEGACY_PATH = path.join(ROOT, "src", "data", "legacy-index.json");
const PACKS_PATH = path.join(ROOT, "public", "data", "wordpacks.json");

const FIELDS = ["definition", "fullDefinition", "example"];
const POS = ["noun", "verb", "adjective", "adverb"];
const TIERS = [1, 2, 3];
// The legacy table is a snapshot of the pre-overhaul key order; it never grows.
const LEGACY_LENGTH = 679;

// lib/ imports JSON without import attributes (the Next bundler handles it);
// plain Node needs { type: "json" }.
registerHooks({
	load(url, context, nextLoad) {
		if (!url.endsWith(".json")) return nextLoad(url, context);
		return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } });
	},
});

// Does the example contain the headword or an inflection of it? Accepts any
// token sharing all but the last three letters (min 3) with the headword.
function exampleUsesWord(word, example) {
	const w = word.toLowerCase().replace(/[^a-z]/g, "");
	const need = Math.min(w.length, Math.max(3, w.length - 3));
	return example
		.toLowerCase()
		.split(/[^a-z]+/)
		.some((t) => {
			let i = 0;
			while (i < t.length && i < w.length && t[i] === w[i]) i++;
			return i >= need;
		});
}

async function main() {
	const { isNearDuplicateDefinition, normalizeDefinition } = await import(
		pathToFileURL(path.join(ROOT, "lib", "distractors.js")).href
	);
	const errors = [];
	const warnings = [];

	const raw = fs.readFileSync(VOCAB_PATH, "utf8");
	const vocab = JSON.parse(raw);
	const keys = Object.keys(vocab);

	// Depth-1 key lines in the raw text; more than parsed keys means a
	// duplicate key was silently collapsed by JSON.parse.
	const rawKeyLines = raw.split(/\r?\n/).filter((l) => /^\t"(?:[^"\\]|\\.)*"\s*:/.test(l)).length;
	if (rawKeyLines !== keys.length) {
		errors.push(`raw file has ${rawKeyLines} top-level keys but JSON.parse sees ${keys.length} (duplicate key?)`);
	}

	const lower = new Map();
	for (const k of keys) {
		const e = vocab[k];
		if (k !== k.trim() || !/^[A-Za-z][A-Za-z'-]*$/.test(k)) errors.push(`${k}: malformed headword`);
		const lk = k.toLowerCase();
		if (lower.has(lk)) errors.push(`${k}: duplicate of ${lower.get(lk)} (case-insensitive)`);
		else lower.set(lk, k);
		if (!e || typeof e !== "object") {
			errors.push(`${k}: entry is not an object`);
			continue;
		}
		for (const f of FIELDS) {
			if (typeof e[f] !== "string" || !e[f].trim()) errors.push(`${k}: missing ${f}`);
		}
		if (!POS.includes(e.pos)) errors.push(`${k}: bad pos ${JSON.stringify(e.pos)}`);
		if (!TIERS.includes(e.tier)) errors.push(`${k}: bad tier ${JSON.stringify(e.tier)}`);
		if (typeof e.example === "string" && !exampleUsesWord(k, e.example)) {
			warnings.push(`${k}: example lacks the headword: "${e.example}"`);
		}
	}

	// Definition collisions.
	const defined = keys.filter((k) => typeof vocab[k].definition === "string");
	let near = 0;
	for (let i = 0; i < defined.length; i++) {
		const a = defined[i];
		for (let j = i + 1; j < defined.length; j++) {
			const b = defined[j];
			const da = vocab[a].definition;
			const db = vocab[b].definition;
			if (normalizeDefinition(da) === normalizeDefinition(db)) {
				errors.push(`${a} / ${b}: identical definition "${da}"`);
			} else if (isNearDuplicateDefinition(da, db)) {
				near++;
				warnings.push(`${a} / ${b}: near-duplicate definitions "${da}" / "${db}"`);
			}
		}
	}

	// Legacy order.
	const legacy = JSON.parse(fs.readFileSync(LEGACY_PATH, "utf8"));
	if (!Array.isArray(legacy) || legacy.length !== LEGACY_LENGTH) {
		errors.push(`legacy-index.json must be an array of ${LEGACY_LENGTH} headwords`);
	} else {
		legacy.forEach((w, i) => {
			if (!Object.prototype.hasOwnProperty.call(vocab, w)) errors.push(`legacy-index[${i}] "${w}" not in data`);
		});
	}

	// Packs: words are the source of truth; indices must still agree.
	const packs = JSON.parse(fs.readFileSync(PACKS_PATH, "utf8"));
	const ids = new Set();
	for (const p of packs) {
		const id = p && p.id;
		if (ids.has(id)) errors.push(`pack ${id}: duplicate id`);
		ids.add(id);
		if (!Array.isArray(p.words) || !p.words.length) {
			errors.push(`pack ${id}: missing words`);
			continue;
		}
		const seen = new Set();
		p.words.forEach((w, i) => {
			if (!Object.prototype.hasOwnProperty.call(vocab, w)) errors.push(`pack ${id}: word "${w}" does not exist`);
			if (seen.has(w)) errors.push(`pack ${id}: word "${w}" repeated`);
			seen.add(w);
			if (Array.isArray(p.indices) && Array.isArray(legacy) && legacy[p.indices[i]] !== w) {
				errors.push(`pack ${id}: indices[${i}]=${p.indices[i]} resolves to "${legacy[p.indices[i]]}", words has "${w}"`);
			}
		});
		if (Array.isArray(p.indices) && p.indices.length !== p.words.length) {
			errors.push(`pack ${id}: ${p.indices.length} indices vs ${p.words.length} words`);
		}
	}

	for (const w of warnings) console.warn(`warn  ${w}`);
	for (const e of errors) console.error(`ERROR ${e}`);
	console.log(
		`\n${keys.length} entries, ${packs.length} packs, ${legacy.length} legacy slots: ` +
			`${errors.length} error(s), ${warnings.length} warning(s) (${near} near-duplicate pairs).`,
	);
	if (errors.length) process.exit(1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
