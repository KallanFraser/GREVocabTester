// Word rain: the words drift past in giant faint type, alternate rows in
// opposite directions. Mastered words turn faintly green. DOM + CSS marquee;
// styles in styles/backgrounds.css.

import { el, shuffled } from "./util.js";

const ROWS = 7;
const PER_ROW = 24;

export default {
	kind: "dom",
	flash: true,
	create({ layer, env }) {
		const root = el(layer, "bgx-fill bgx-rain");
		let current = null;

		function build(list) {
			root.textContent = "";
			current = list.find((w) => w.current)?.word ?? null;
			if (!list.length) return;
			for (let i = 0; i < ROWS; i++) {
				const row = el(root, `bgx-rain-row${i % 2 ? " rev" : ""}`);
				row.style.top = `${i * 15 - 3}%`;
				const track = el(row, "bgx-rain-track");
				track.style.animationDuration = `${90 + i * 17}s`;
				const words = shuffled(list).slice(0, PER_ROW);
				// Two copies, so the -50% marquee loops seamlessly.
				for (let copy = 0; copy < 2; copy++) {
					for (const w of words) {
						const s = el(track, w.mastered ? "won" : "", "span");
						s.textContent = w.word;
						s.dataset.word = w.word;
					}
				}
			}
		}

		// Rows are sized in CSS, so a resize (a phone's URL bar showing or hiding)
		// needs no rebuild; only a new word list does.
		build(env.words());

		return {
			words(list) {
				build(list);
			},
			on(type) {
				if (type !== "master" || !current) return;
				for (const s of root.querySelectorAll("span")) if (s.dataset.word === current) s.classList.add("won");
			},
		};
	},
};
