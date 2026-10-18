// Where constellation and word rain get their words on pages that are not game
// modes. Game modes publish their own scope through setBgWords() (bus.js).
//
// components/Background.jsx calls loadPageWords() after mount, and only for
// constellation and rain. The word list (lib/words.js, which bundles
// src/data/gre_combined.json) and lib/progress.js are loaded with dynamic
// import(), so they land in their own chunk and the home page does not pull
// the whole vocabulary up front for a background that does not need it.

import { sample } from "./util.js";

const PAGE_WORDS = 40;
const MIN_KNOWN = 12;
const FILL_TO = 24;

let headwordsPromise = null;

function allHeadwords() {
	if (!headwordsPromise) {
		headwordsPromise = import("../words.js")
			.then((m) => (Array.isArray(m.WORDS) ? m.WORDS.map((e) => e && e.word).filter((w) => typeof w === "string" && w) : []))
			.catch(() => {
				headwordsPromise = null; // try again on the next page
				return [];
			});
	}
	return headwordsPromise;
}

async function knownHeadwords(direction, valid) {
	try {
		const progress = await import("../progress.js");
		const keys = progress.knownWordKeys(direction, (k) => valid.has(k));
		return Array.isArray(keys) ? keys : [];
	} catch {
		return [];
	}
}

// Constellation: up to PAGE_WORDS of the learner's mastered words in this
// direction. A learner with fewer than MIN_KNOWN gets the sky topped up with a
// random sample of other words (unlit), as in Wortschatz, so it is never empty.
// Rain: a random sample of the word list, mastered ones marked.
export async function loadPageWords(bgId, direction) {
	if (bgId !== "constellation" && bgId !== "rain") return [];
	const words = await allHeadwords();
	if (!words.length) return [];
	const valid = new Set(words);
	const known = new Set(await knownHeadwords(direction, valid));
	if (bgId === "rain") return sample(words, PAGE_WORDS).map((word) => ({ word, mastered: known.has(word) }));
	const picked = sample([...known], PAGE_WORDS).map((word) => ({ word, mastered: true }));
	if (picked.length < MIN_KNOWN) {
		const rest = sample(
			words.filter((w) => !known.has(w)),
			Math.max(0, FILL_TO - picked.length)
		);
		for (const word of rest) picked.push({ word, mastered: false });
	}
	return picked;
}
