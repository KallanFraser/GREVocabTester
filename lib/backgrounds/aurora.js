// Aurora: slow, heavily blurred colour fields drifting behind everything.
// CSS-only; styles/backgrounds.css. Answers get the shared flash.

import { el } from "./util.js";

export default {
	kind: "dom",
	flash: true,
	create({ layer }) {
		const root = el(layer, "bgx-fill bgx-aurora");
		for (const b of ["b1", "b2", "b3"]) el(root, `blob ${b}`);
		return {};
	},
};
