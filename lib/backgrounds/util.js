// Small helpers shared by the background modules.

// Seeded PRNG (mulberry32), so layouts are stable across re-renders.
export function rng(seed) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function shuffled(list) {
	const a = [...list];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export function sample(list, n) {
	return shuffled(list).slice(0, n);
}

// A DOM element with a class, appended to `parent`.
export function el(parent, className, tag = "div") {
	const node = document.createElement(tag);
	node.className = className;
	parent.appendChild(node);
	return node;
}

// GRE theme colours as "r,g,b" strings and hex, from styles/globals.css
// (--coral #ea5746, --ok #5fd39a).
export const CORAL_RGB = "234,87,70";
export const OK_RGB = "95,211,154";
export const CORAL = "#ea5746";
export const OK = "#5fd39a";
export const OK_LIGHT = "#8fe6bb";
