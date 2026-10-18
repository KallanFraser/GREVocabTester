// Fireflies: glowing specks wandering in the dark. A correct answer flares
// them; mastering draws every one to the origin, then scatters them green.
// makeFireflies() is shared with the red variant (fireflies-red.js).

import { CORAL_RGB, OK_RGB } from "./util.js";

function sprite(rgb) {
	const c = document.createElement("canvas");
	c.width = c.height = 64;
	const g = c.getContext("2d");
	if (!g) throw new Error("2d context unavailable");
	const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	gr.addColorStop(0, "rgba(255,255,255,1)");
	gr.addColorStop(0.16, `rgba(${rgb},.95)`);
	gr.addColorStop(0.45, `rgba(${rgb},.2)`);
	gr.addColorStop(1, `rgba(${rgb},0)`);
	g.fillStyle = gr;
	g.fillRect(0, 0, 64, 64);
	return c;
}

// palette: [[rgb, weight], ...]; density: px² per firefly; base: added count.
export function makeFireflies({ palette, density, base }) {
	return {
		kind: "2d",
		create({ ctx, env }) {
			const sprites = palette.map(([rgb]) => sprite(rgb));
			const green = sprite(OK_RGB);
			const total = palette.reduce((n, [, w]) => n + w, 0);
			const pick = () => {
				let r = Math.random() * total;
				for (let i = 0; i < palette.length; i++) {
					r -= palette[i][1];
					if (r <= 0) return i;
				}
				return palette.length - 1;
			};
			let flies = [];
			let attract = 0;
			let greenUntil = 0;
			let flare = 0;
			let released = true;

			return {
				resize() {
					const { W, H } = env;
					flies = Array.from({ length: Math.round((W * H) / density) + base }, () => ({
						x: Math.random() * W,
						y: Math.random() * H,
						a: Math.random() * 6.28,
						ph: Math.random() * 6.28,
						fr: 0.5 + Math.random(),
						s: 1.4 + Math.random() * 2.4,
						c: pick(),
						pvx: 0,
						pvy: 0,
						push: 0,
					}));
				},
				draw(t, dt, k) {
					const { W, H, OX, OY, HEAT } = env;
					ctx.globalCompositeOperation = "lighter";
					if (!released && t >= attract) {
						released = true;
						for (const f of flies) {
							const dx = f.x - OX;
							const dy = f.y - OY;
							const d = Math.hypot(dx, dy) + 1;
							f.pvx = (dx / d) * (4 + Math.random() * 5);
							f.pvy = (dy / d) * (4 + Math.random() * 5);
							f.push = 1;
						}
					}
					for (const f of flies) {
						f.a += Math.sin(t * 0.0006 + f.ph) * 0.045 * k;
						const sp = 0.3 + HEAT * 0.3;
						let vx = Math.cos(f.a) * sp;
						let vy = Math.sin(f.a) * sp;
						if (t < attract) {
							const dx = OX - f.x;
							const dy = OY - f.y;
							const d = Math.hypot(dx, dy) + 1;
							const pull = Math.min(5, d * 0.012);
							vx += (dx / d) * pull;
							vy += (dy / d) * pull;
						}
						if (f.push > 0.01) {
							vx += f.pvx * f.push;
							vy += f.pvy * f.push;
							f.push *= Math.pow(0.95, k);
						}
						f.x += vx * k;
						f.y += vy * k;
						if (f.x < -30) f.x = W + 30;
						if (f.x > W + 30) f.x = -30;
						if (f.y < -30) f.y = H + 30;
						if (f.y > H + 30) f.y = -30;
						const blink = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.0021 * f.fr + f.ph), 2);
						const a = Math.min(1, blink * (0.5 + HEAT * 0.35) + flare);
						const img = t < greenUntil ? green : sprites[f.c];
						const size = f.s * 8 * (1 + flare * 0.6);
						ctx.globalAlpha = a * 0.75;
						ctx.drawImage(img, f.x - size / 2, f.y - size / 2, size, size);
					}
					flare *= Math.pow(0.93, k);
				},
				on(type, now) {
					if (type === "ok") flare = 0.55;
					if (type === "master") {
						attract = now + 750;
						greenUntil = now + 2400;
						released = false;
						flare = 0.4;
					}
				},
			};
		},
	};
}

// Mostly warm yellow with a share of the theme coral.
export default makeFireflies({
	palette: [
		["255,210,120", 82],
		[CORAL_RGB, 18],
	],
	density: 20000,
	base: 24,
});
