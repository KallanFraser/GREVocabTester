// Warp: a starfield streaming out from the origin. Heat speeds it up, a correct
// answer boosts it, a miss stops the boost, and mastering jumps to hyperspace
// with some stars turning green.

import { OK_LIGHT } from "./util.js";

export default {
	kind: "2d",
	create({ ctx, env }) {
		let stars = [];
		let boost = 0;
		let green = 0;
		const mk = (z) => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z, g: Math.random() < 0.35 });

		return {
			resize() {
				stars = Array.from({ length: Math.round((env.W * env.H) / 4500) + 80 }, () => mk(0.05 + Math.random() * 0.95));
			},
			draw(t, dt, k) {
				const { W, H, OX, OY } = env;
				const v = (0.0011 + env.HEAT * 0.0024 + boost * 0.0008) * k;
				const fov = Math.max(W, H) * 0.42;
				const gOn = t < green;
				ctx.lineCap = "round";
				for (const s of stars) {
					s.z -= v;
					if (s.z <= 0.02) {
						Object.assign(s, mk(1));
						continue;
					}
					const sx = OX + (s.x / s.z) * fov;
					const sy = OY + (s.y / s.z) * fov;
					if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) {
						Object.assign(s, mk(1));
						continue;
					}
					const z2 = Math.min(1, s.z + v * (2 + boost * 1.4));
					const px = OX + (s.x / z2) * fov;
					const py = OY + (s.y / z2) * fov;
					const b = 1 - s.z;
					ctx.globalAlpha = Math.min(0.9, b * b * 0.85 + 0.04);
					ctx.strokeStyle = gOn && s.g ? OK_LIGHT : "#fff";
					ctx.lineWidth = 0.35 + b * 1.7;
					ctx.beginPath();
					ctx.moveTo(px, py);
					ctx.lineTo(sx, sy);
					ctx.stroke();
				}
				boost *= Math.pow(0.935, k);
			},
			on(type, now) {
				if (type === "ok") boost = Math.max(boost, 3.5);
				if (type === "bad") boost = 0;
				if (type === "master") {
					boost = 16;
					green = now + 1900;
				}
			},
		};
	},
};
