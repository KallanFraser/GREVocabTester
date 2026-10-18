#!/usr/bin/env node
// build-packs.js — generates public/data/wordpacks.json. Never hand-edit that
// file; edit src/data/packs-manual.json and rerun `npm run packs:build`.
//
// Output, in this order:
//   path     generated learning path: every headword in exactly one pack of
//            about PATH_PACK_SIZE words, grouped by tier (core, common,
//            advanced) and numbered by `order` within each tier
//   theme    hand-curated themed packs from packs-manual.json
//   classic  the 12 pre-overhaul packs from packs-manual.json; they keep their
//            ids and likes, and get `indices` (positions in the frozen
//            src/data/legacy-index.json) so old ?pack= links and
//            marketplaceWordpack handoffs still resolve
//
// Pack shape: { id, title, desc, category, tier?, order?, likes?, indices?, words }
// where words are headwords (keys of src/data/gre_combined.json).
//
// Path membership is a stable hash order within each tier, so packs mix
// letters rather than running A to Z. Adding or removing a word shifts the
// words of later packs in that tier; path ids stay the same.
//
// The build fails on: an unknown or repeated pack word, a duplicate id, a bad
// category, a pack under MIN_PACK_WORDS, an over-long title or desc, a theme
// outside THEME_MIN..THEME_MAX words, or a classic word missing from the
// legacy order.
//
//   node scripts/build-packs.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const VOCAB_PATH = path.join(ROOT, "src", "data", "gre_combined.json");
const LEGACY_PATH = path.join(ROOT, "src", "data", "legacy-index.json");
const MANUAL_PATH = path.join(ROOT, "src", "data", "packs-manual.json");
const OUT_PATH = path.join(ROOT, "public", "data", "wordpacks.json");

// Keep in step with lib/packs.js.
const CATEGORIES = ["path", "theme", "classic"];
const MIN_PACK_WORDS = 5;
const MAX_TITLE_LENGTH = 48;
const MAX_DESC_LENGTH = 100;

const PATH_PACK_SIZE = 25;
const THEME_MIN = 15;
const THEME_MAX = 30;
const TIERS = [
	{ tier: 1, slug: "core", label: "Core", blurb: "high-frequency words to learn first" },
	{ tier: 2, slug: "common", label: "Common", blurb: "frequently tested words" },
	{ tier: 3, slug: "advanced", label: "Advanced", blurb: "less common words for higher scores" },
];

const FIELD_ORDER = ["id", "title", "desc", "category", "tier", "order", "likes", "indices", "words"];

// FNV-1a, 32-bit. Gives each headword a fixed pseudo-random position.
function hash(str) {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h;
}

// Split `list` into `n` runs whose sizes differ by at most one.
function chunk(list, n) {
	const out = [];
	const base = Math.floor(list.length / n);
	const extra = list.length % n;
	let at = 0;
	for (let i = 0; i < n; i++) {
		const size = base + (i < extra ? 1 : 0);
		out.push(list.slice(at, at + size));
		at += size;
	}
	return out;
}

function buildPathPacks(vocab) {
	const packs = [];
	for (const t of TIERS) {
		const words = Object.keys(vocab)
			.filter((w) => vocab[w].tier === t.tier)
			.sort((a, b) => hash(a.toLowerCase()) - hash(b.toLowerCase()) || a.localeCompare(b));
		if (!words.length) continue;
		const groups = chunk(words, Math.max(1, Math.round(words.length / PATH_PACK_SIZE)));
		groups.forEach((group, i) => {
			const n = i + 1;
			packs.push({
				id: `path-${t.slug}-${String(n).padStart(2, "0")}`,
				title: `${t.label} Set ${n}`,
				desc: `${t.label} tier, set ${n} of ${groups.length}: ${group.length} ${t.blurb}.`,
				category: "path",
				tier: t.tier,
				order: n,
				words: group,
			});
		});
	}
	return packs;
}

function validate(packs, vocab, legacyPos) {
	const errors = [];
	const ids = new Set();
	const pathCount = new Map();
	for (const p of packs) {
		const id = p.id;
		if (typeof id !== "string" || !id) errors.push(`pack with no id: ${JSON.stringify(p.title)}`);
		else if (ids.has(id)) errors.push(`${id}: duplicate pack id`);
		ids.add(id);
		if (!CATEGORIES.includes(p.category)) errors.push(`${id}: bad category ${JSON.stringify(p.category)}`);
		if (typeof p.title !== "string" || !p.title.trim() || p.title.length > MAX_TITLE_LENGTH) {
			errors.push(`${id}: title must be 1-${MAX_TITLE_LENGTH} chars`);
		}
		if (typeof p.desc !== "string" || p.desc.length > MAX_DESC_LENGTH) {
			errors.push(`${id}: desc must be at most ${MAX_DESC_LENGTH} chars (${String(p.desc).length})`);
		}
		const words = Array.isArray(p.words) ? p.words : [];
		if (words.length < MIN_PACK_WORDS) errors.push(`${id}: ${words.length} words, minimum ${MIN_PACK_WORDS}`);
		if (p.category === "theme" && (words.length < THEME_MIN || words.length > THEME_MAX)) {
			errors.push(`${id}: theme has ${words.length} words, expected ${THEME_MIN}-${THEME_MAX}`);
		}
		const seen = new Set();
		for (const w of words) {
			if (!Object.prototype.hasOwnProperty.call(vocab, w)) errors.push(`${id}: word "${w}" does not exist`);
			if (seen.has(w)) errors.push(`${id}: word "${w}" repeated`);
			seen.add(w);
			if (p.category === "classic" && !legacyPos.has(w)) errors.push(`${id}: classic word "${w}" is not in legacy-index.json`);
			if (p.category === "path") pathCount.set(w, (pathCount.get(w) || 0) + 1);
		}
	}
	for (const w of Object.keys(vocab)) {
		const n = pathCount.get(w) || 0;
		if (n !== 1) errors.push(`"${w}" is in ${n} path packs, expected exactly 1`);
	}
	return errors;
}

// One pack per line group; word and index arrays stay on a single line.
function serializePacks(packs) {
	const body = packs.map((p) => {
		const lines = FIELD_ORDER.filter((k) => p[k] !== undefined).map((k) => {
			const v = Array.isArray(p[k]) ? `[${p[k].map((x) => JSON.stringify(x)).join(", ")}]` : JSON.stringify(p[k]);
			return `\t\t${JSON.stringify(k)}: ${v}`;
		});
		return `\t{\n${lines.join(",\n")}\n\t}`;
	});
	return `[\n${body.join(",\n")}\n]\n`;
}

function main() {
	const vocab = JSON.parse(fs.readFileSync(VOCAB_PATH, "utf8"));
	const legacy = JSON.parse(fs.readFileSync(LEGACY_PATH, "utf8"));
	const manual = JSON.parse(fs.readFileSync(MANUAL_PATH, "utf8"));
	if (!Array.isArray(manual)) throw new Error("packs-manual.json must be an array");
	const legacyPos = new Map(legacy.map((w, i) => [w, i]));

	const themes = manual.filter((p) => p.category === "theme").sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
	const classics = manual
		.filter((p) => p.category === "classic")
		.map((p) => ({ ...p, indices: p.words.map((w) => legacyPos.get(w)) }));
	const others = manual.filter((p) => p.category !== "theme" && p.category !== "classic");

	const packs = [...buildPathPacks(vocab), ...themes, ...classics, ...others];
	const errors = validate(packs, vocab, legacyPos);
	if (errors.length) {
		for (const e of errors) console.error(`ERROR ${e}`);
		console.error(`\nbuild-packs: ${errors.length} error(s); ${path.relative(ROOT, OUT_PATH)} not written.`);
		process.exit(1);
	}

	fs.writeFileSync(OUT_PATH, serializePacks(packs), "utf8");
	const count = (c) => packs.filter((p) => p.category === c).length;
	console.log(
		`build-packs: wrote ${packs.length} packs (${count("path")} path, ${count("theme")} theme, ${count("classic")} classic) ` +
			`to ${path.relative(ROOT, OUT_PATH)}.`,
	);
}

main();
