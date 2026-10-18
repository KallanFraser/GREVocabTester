// Spotlight grid: a dot grid lit by a spotlight that follows the pointer.
// Answers send a ripple out from the origin (green, coral on a miss, wider on
// master). DOM + CSS; styles in styles/backgrounds.css.

import { el } from "./util.js";

export default {
	kind: "dom",
	flash: true,
	create({ layer, env }) {
		const grid = el(layer, "bgx-fill bgx-grid");
		const timers = new Set();
		const setSpot = (x, y) => {
			grid.style.setProperty("--mx", `${x}px`);
			grid.style.setProperty("--my", `${y}px`);
		};
		return {
			resize() {
				setSpot(env.MX, env.MY);
			},
			pointer(x, y) {
				setSpot(x, y);
			},
			on(type) {
				const r = el(layer, `bgx-ripple${type === "bad" ? " bad" : type === "master" ? " big" : ""}`);
				r.style.left = `${env.OX}px`;
				r.style.top = `${env.OY}px`;
				const id = setTimeout(() => {
					timers.delete(id);
					r.remove();
				}, 2000);
				timers.add(id);
			},
			destroy() {
				for (const id of timers) clearTimeout(id);
				timers.clear();
			},
		};
	},
};
