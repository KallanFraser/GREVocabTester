// Red fireflies: the fireflies engine with a coral / deep red / warm orange
// palette (no yellow) and slightly fewer flies. Same reactions.

import { makeFireflies } from "./fireflies.js";
import { CORAL_RGB } from "./util.js";

export default makeFireflies({
	palette: [
		[CORAL_RGB, 55], // theme coral
		["180,40,35", 30], // deep red
		["240,130,80", 15], // warm orange
	],
	density: 24000,
	base: 20,
});
