#!/usr/bin/env node
// build-packs.js — generates public/data/wordpacks.json and src/data/home.json.
// Never hand-edit either; edit src/data/packs-manual.json and rerun
// `npm run packs:build`.
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
// Path membership is stable: a word already in a path pack of its tier in the
// current wordpacks.json stays in that pack, so progress on a set never
// changes under the learner. New words, in a fixed hash order (packs mix
// letters rather than running A to Z), fill the tier's last pack, then new
// packs. A removed word just leaves its pack. Path ids stay the same.
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

function byHash(a, b) {
	return hash(a.toLowerCase()) - hash(b.toLowerCase()) || a.localeCompare(b);
}

// The path packs in the current wordpacks.json, by tier: [[words], …] in
// `order`. Missing or unreadable reads as none, so a first build chunks.
function readCurrentPath() {
	const byTier = new Map();
	let current = [];
	try {
		current = JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
	} catch {
		return byTier;
	}
	if (!Array.isArray(current)) return byTier;
	for (const p of current) {
		if (!p || p.category !== "path" || !Array.isArray(p.words) || !Number.isInteger(p.tier)) continue;
		if (!byTier.has(p.tier)) byTier.set(p.tier, []);
		byTier.get(p.tier).push(p);
	}
	for (const list of byTier.values()) list.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
	return new Map([...byTier].map(([tier, list]) => [tier, list.map((p) => p.words.slice())]));
}

// One tier's groups. A word already in a path pack of this tier stays in it
// (removed words drop out); new words, in hash order, fill the last pack up to
// PATH_PACK_SIZE, then open new packs of that size. A new pack too small to
// stand alone (under MIN_PACK_WORDS) joins the one before it instead. With no
// current packs the tier is chunked into packs of about PATH_PACK_SIZE.
function tierGroups(words, current) {
	if (!current || !current.length) {
		const sorted = words.slice().sort(byHash);
		return sorted.length ? chunk(sorted, Math.max(1, Math.round(sorted.length / PATH_PACK_SIZE))) : [];
	}
	const live = new Set(words);
	const placed = new Set();
	const groups = current.map((g) =>
		g.filter((w) => {
			if (!live.has(w) || placed.has(w)) return false;
			placed.add(w);
			return true;
		}),
	);
	const fresh = words.filter((w) => !placed.has(w)).sort(byHash);
	let last = groups[groups.length - 1];
	while (fresh.length && last.length < PATH_PACK_SIZE) last.push(fresh.shift());
	while (fresh.length) {
		const next = fresh.splice(0, PATH_PACK_SIZE);
		if (next.length < MIN_PACK_WORDS) last.push(...next);
		else groups.push((last = next));
	}
	return groups;
}

function buildPathPacks(vocab) {
	const current = readCurrentPath();
	const packs = [];
	for (const t of TIERS) {
		const words = Object.keys(vocab).filter((w) => vocab[w].tier === t.tier);
		const groups = tierGroups(words, current.get(t.tier));
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

// src/data/home.json: the counts and sample cards the home page shows.
// A sample word missing from the vocabulary is replaced by the nearest
// headword alphabetically that is not already a sample.
const HOME_PATH = path.join(ROOT, "src", "data", "home.json");
const HOME_SAMPLE = ["Laconic", "Placate", "Ephemeral", "Obdurate", "Garrulous"];

function homeSample(vocab) {
	const keys = Object.keys(vocab).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
	const chosen = [];
	for (const want of HOME_SAMPLE) {
		let word = Object.prototype.hasOwnProperty.call(vocab, want) && !chosen.includes(want) ? want : null;
		if (!word) {
			let at = keys.findIndex((k) => k.localeCompare(want, "en", { sensitivity: "base" }) > 0);
			if (at < 0) at = keys.length;
			for (let d = 0; !word && d <= keys.length; d++) {
				for (const i of [at - 1 - d, at + d]) {
					if (!word && i >= 0 && i < keys.length && !chosen.includes(keys[i])) word = keys[i];
				}
			}
		}
		if (word) chosen.push(word);
	}
	return chosen.map((w) => ({
		headword: w,
		definition: vocab[w].definition || "",
		pos: vocab[w].pos || "",
		example: vocab[w].example || "",
	}));
}

function buildHome(vocab, packs) {
	const count = (c) => packs.filter((p) => p.category === c).length;
	return {
		words: Object.keys(vocab).length,
		packs: { total: packs.length, path: count("path"), theme: count("theme"), classic: count("classic") },
		sample: homeSample(vocab),
	};
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
	// First position wins: a retired slot can repeat a headword (the old
	// "Intractible" slot now reads "Intractable") without moving its indices.
	const legacyPos = new Map();
	legacy.forEach((w, i) => {
		if (!legacyPos.has(w)) legacyPos.set(w, i);
	});

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
	const home = buildHome(vocab, packs);
	fs.writeFileSync(HOME_PATH, `${JSON.stringify(home, null, "\t")}\n`, "utf8");
	const { path: nPath, theme: nTheme, classic: nClassic } = home.packs;
	console.log(
		`build-packs: wrote ${packs.length} packs (${nPath} path, ${nTheme} theme, ${nClassic} classic) ` +
			`to ${path.relative(ROOT, OUT_PATH)}, and ${path.relative(ROOT, HOME_PATH)} ` +
			`(${home.words} words; sample ${home.sample.map((s) => s.headword).join(", ")}).`,
	);
}

main();
