/** @format */

// scripts/sort-gre-combined.js
import fs from "fs";
import path from "path";

export function sortGreCombined() {
	// Path to your JSON (adjust if yours lives elsewhere)
	const filePath = path.resolve(process.cwd(), "src/data/gre_combined.json");

	// 1. Read & parse
	const raw = fs.readFileSync(filePath, "utf-8");
	const data = JSON.parse(raw);

	// 2. Build a new object with keys in alphabetical order
	const sorted = {};
	Object.keys(data)
		.sort((a, b) => a.localeCompare(b))
		.forEach((word) => {
			const { definition, example, fullDefinition } = data[word];
			sorted[word] = { definition, example, fullDefinition };
		});

	// 3. Write it back (2-space indent + trailing newline)
	fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + "\n", "utf-8");
	console.log("✅ gre_combined.json sorted A→Z");
}

// If you run `node scripts/sort-gre-combined.js` directly, invoke it:
if (import.meta.url === `file://${process.argv[1]}`) {
	sortGreCombined();
}
