#!/usr/bin/env node
// vocab-stats.js — dataset overview for src/data/gre_combined.json.
// Prints the entry count, then counts by tier, by pos, tier x pos, and by
// first letter.
//
//   node scripts/vocab-stats.js
const fs = require("fs");
const path = require("path");

const VOCAB_PATH = path.join(__dirname, "..", "src", "data", "gre_combined.json");
const TIER_LABELS = { 1: "core", 2: "common", 3: "advanced" };
const POS = ["noun", "verb", "adjective", "adverb"];

function tally(list, keyOf) {
	const out = {};
	for (const x of list) {
		const k = keyOf(x);
		out[k] = (out[k] || 0) + 1;
	}
	return out;
}

function main() {
	const vocab = JSON.parse(fs.readFileSync(VOCAB_PATH, "utf8"));
	const entries = Object.keys(vocab).map((word) => ({ word, ...vocab[word] }));

	console.log(`Entries: ${entries.length}`);

	const byTier = tally(entries, (e) => e.tier ?? "(none)");
	console.log("\nBy tier:");
	for (const t of Object.keys(byTier).sort()) {
		console.log(`  ${String(t).padEnd(2)} ${(TIER_LABELS[t] || "").padEnd(9)} ${String(byTier[t]).padStart(4)}`);
	}

	const byPos = tally(entries, (e) => e.pos || "(none)");
	console.log("\nBy pos:");
	for (const p of Object.keys(byPos).sort()) console.log(`  ${p.padEnd(12)} ${String(byPos[p]).padStart(4)}`);

	console.log("\nTier x pos:");
	console.log(`  ${"".padEnd(5)}${POS.map((p) => p.padStart(10)).join("")}`);
	for (const t of Object.keys(byTier).sort()) {
		const row = POS.map((p) => String(entries.filter((e) => String(e.tier) === t && e.pos === p).length).padStart(10));
		console.log(`  ${String(t).padEnd(5)}${row.join("")}`);
	}

	const byLetter = tally(entries, (e) => e.word[0].toUpperCase());
	console.log("\nBy first letter:");
	for (const l of Object.keys(byLetter).sort()) console.log(`  ${l}  ${String(byLetter[l]).padStart(4)}`);
}

main();
