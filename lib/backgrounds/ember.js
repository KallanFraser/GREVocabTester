// Ember: a static coral glow in one corner with a cool blue counterpart, after
// the glow the home page used to paint behind itself. No grain, no reactions.
// styles/backgrounds.css.

import { el } from "./util.js";

export default {
	kind: "dom",
	grain: false,
	create({ layer }) {
		el(layer, "bgx-fill bgx-ember");
		return {};
	},
};
