/** @format */

// scripts/sort-gre-combined.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// emulate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sortGreCombined() {
	const filePath = path.resolve(__dirname, "../src/data/gre_combined.json");
	console.log(`📂  filePath: ${filePath}`);

	let raw;
	try {
		raw = await fs.readFile(filePath, "utf-8");
		console.log("✅  File read successfully.");
	} catch (err) {
		console.error("❌  Failed to read file:", err.message);
		process.exit(1);
	}

	let data;
	try {
		data = JSON.parse(raw);
		console.log("✅  JSON parsed successfully.");
	} catch (err) {
		console.error("❌  Invalid JSON:", err.message);
		process.exit(1);
	}

	const sorted = {};
	for (const key of Object.keys(data).sort((a, b) => a.localeCompare(b))) {
		sorted[key] = data[key];
	}
	console.log("✅  Keys sorted alphabetically.");

	try {
		await fs.writeFile(filePath, JSON.stringify(sorted, null, 2) + "\n", "utf-8");
		console.log("✅  File written. gre_combined.json is now A→Z.");
	} catch (err) {
		console.error("❌  Failed to write file:", err.message);
		process.exit(1);
	}
}

await sortGreCombined();
