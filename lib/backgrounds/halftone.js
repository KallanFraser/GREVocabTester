// Halftone: a field of dots that breathes slowly, swells around the pointer and
// with heat. Answers send coloured rings out from the origin through the dots.

import { CORAL_RGB, OK_RGB } from "./util.js";

export default {
	kind: "2d",
	create({ ctx, env }) {
		let rip = [];
		return {
			draw(t) {
				const { W, H, MX, MY, HEAT } = env;
				const sp = 26;
				const cols = Math.ceil(W / sp) + 2;
				const rows = Math.ceil(H / sp) + 1;
				const tinted = [];
				rip = rip.filter((r) => t - r.t0 < 2600);
				ctx.fillStyle = "rgba(255,255,255,.12)";
				ctx.beginPath();
				for (let j = 0; j < rows; j++) {
					for (let i = 0; i < cols; i++) {
						const x = i * sp + (j % 2 ? sp / 2 : 0) - sp / 2;
						const y = j * sp;
						const amb = 0.5 + 0.5 * Math.sin(x * 0.007 + t * 0.0004) * Math.sin(y * 0.009 - t * 0.0003);
						let rad = (0.6 + amb * 1.7) * (0.85 + HEAT * 0.5);
						const dm = (x - MX) * (x - MX) + (y - MY) * (y - MY);
						rad += 1.8 * Math.exp(-dm / 16200);
						let tint = 0;
						let col = "";
						for (const r of rip) {
							const age = t - r.t0;
							if (age < 0) continue;
							const dd = Math.hypot(x - r.x, y - r.y) - age * r.v;
							const kk = Math.exp(-(dd * dd) / (2 * r.w * r.w)) * (1 - age / 2600) * r.s;
							rad += kk * 3.6;
							if (kk > tint) {
								tint = kk;
								col = r.c;
							}
						}
						if (tint > 0.06) tinted.push([x, y, rad, tint, col]);
						else {
							ctx.moveTo(x + rad, y);
							ctx.arc(x, y, rad, 0, 6.283);
						}
					}
				}
				ctx.fill();
				for (const [x, y, rad, tint, col] of tinted) {
					ctx.fillStyle = `rgba(${col},${Math.min(0.9, 0.15 + tint * 0.7)})`;
					ctx.beginPath();
					ctx.arc(x, y, rad, 0, 6.283);
					ctx.fill();
				}
			},
			on(type, now) {
				const { OX, OY } = env;
				if (type === "ok") rip.push({ x: OX, y: OY, t0: now, v: 0.75, w: 38, s: 1, c: OK_RGB });
				if (type === "bad") rip.push({ x: OX, y: OY, t0: now, v: 0.5, w: 30, s: 0.8, c: CORAL_RGB });
				if (type === "master")
					[0, 180, 360].forEach((d) => rip.push({ x: OX, y: OY, t0: now + d, v: 0.9, w: 50, s: 1.4, c: OK_RGB }));
			},
		};
	},
};
