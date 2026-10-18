// Constellation: every word is a star. Mastered words glow green and join into
// a constellation in the order they were mastered; the current word is ringed
// in coral. A correct answer sends a coral ring out from the current word,
// mastering sends green rings and draws the new link.

import { CORAL, OK, OK_LIGHT, OK_RGB, rng } from "./util.js";

const SLOTS = 40;

export default {
	kind: "2d",
	create({ ctx, env }) {
		let nodes = [];
		let by = {};
		let dust = [];
		let rings = [];
		let anim = 0;
		let won = new Set();
		let order = [];
		let current = null;
		let listKey = "";

		function layout() {
			const { W, H } = env;
			const r = rng(7);
			nodes = [];
			let guard = 0;
			while (nodes.length < SLOTS && guard++ < 5000) {
				const x = 0.03 + r() * 0.94;
				const y = 0.05 + r() * 0.9;
				// Keep the middle clear for the prompt.
				if (Math.abs(x - 0.5) < 0.29 && Math.abs(y - 0.52) < 0.4) continue;
				if (nodes.some((n) => Math.hypot((n.x - x) * W, (n.y - y) * H) < 74)) continue;
				nodes.push({ x, y, ph: r() * 6.28, sp: 0.5 + r() });
			}
			dust = Array.from({ length: Math.round((W * H) / 7000) }, () => ({
				x: Math.random(),
				y: Math.random(),
				a: 0.05 + Math.random() * 0.18,
				ph: Math.random() * 6.28,
				sp: 0.3 + Math.random(),
			}));
		}

		// Labels are assigned in list order, so the same list always lands on the
		// same stars. A different set of words starts a fresh constellation; the
		// same set with new mastery extends it and animates the new link.
		function assign(list, now) {
			const key = list.map((w) => w.word).join("\u0001");
			if (key !== listKey) {
				listKey = key;
				won = new Set();
				order = [];
				anim = 0;
			}
			by = {};
			nodes.forEach((n, i) => {
				n.word = list[i] ? list[i].word : undefined;
				if (n.word) by[n.word] = n;
			});
			for (const w of list) {
				if (w.mastered && !won.has(w.word)) {
					won.add(w.word);
					order.push(w.word);
					if (now) anim = now;
				}
			}
			const cur = list.find((w) => w.current);
			current = cur ? cur.word : null;
		}

		return {
			resize() {
				layout();
				assign(env.words(), 0);
			},
			words(list, now) {
				assign(list, now);
			},
			draw(t) {
				const { W, H, HEAT } = env;
				ctx.fillStyle = "#fff";
				for (const d of dust) {
					ctx.globalAlpha = d.a * (0.55 + 0.45 * Math.sin(t * 0.001 * d.sp + d.ph));
					ctx.fillRect(d.x * W, d.y * H, 1.2, 1.2);
				}
				const ord = order.map((w) => by[w]).filter(Boolean);
				ctx.globalAlpha = 1;
				ctx.lineWidth = 1.2;
				ctx.strokeStyle = `rgba(${OK_RGB},.4)`;
				for (let i = 1; i < ord.length; i++) {
					const a = ord[i - 1];
					const b = ord[i];
					const p = i === ord.length - 1 && anim ? Math.min(1, (t - anim) / 1000) : 1;
					const e = 1 - Math.pow(1 - p, 3);
					ctx.beginPath();
					ctx.moveTo(a.x * W, a.y * H);
					ctx.lineTo((a.x + (b.x - a.x) * e) * W, (a.y + (b.y - a.y) * e) * H);
					ctx.stroke();
				}
				ctx.font = "500 11px Inter, system-ui, sans-serif";
				for (const n of nodes) {
					const x = n.x * W;
					const y = n.y * H;
					const tw = 0.5 + 0.5 * Math.sin(t * 0.0012 * n.sp + n.ph);
					const m = n.word && won.has(n.word);
					if (m) {
						ctx.shadowColor = `rgba(${OK_RGB},.9)`;
						ctx.shadowBlur = 14;
						ctx.globalAlpha = 0.85 + 0.15 * tw;
						ctx.fillStyle = OK_LIGHT;
						ctx.beginPath();
						ctx.arc(x, y, 3.2, 0, 6.283);
						ctx.fill();
						ctx.shadowBlur = 0;
					} else {
						ctx.globalAlpha = 0.16 + 0.24 * tw;
						ctx.fillStyle = "#fff";
						ctx.beginPath();
						ctx.arc(x, y, 1.7, 0, 6.283);
						ctx.fill();
					}
					if (n.word) {
						ctx.globalAlpha = m ? 0.5 : 0.1;
						ctx.fillStyle = m ? OK_LIGHT : "#fff";
						ctx.fillText(n.word, x + 9, y + 4);
					}
					if (n.word && n.word === current && !m) {
						ctx.globalAlpha = 0.3 + HEAT * 0.5;
						ctx.strokeStyle = CORAL;
						ctx.lineWidth = 1.2;
						ctx.beginPath();
						ctx.arc(x, y, 6 + HEAT * 5 + Math.sin(t * 0.004) * 1.4, 0, 6.283);
						ctx.stroke();
					}
				}
				rings = rings.filter((r) => t - r.t0 < 1500);
				for (const r of rings) {
					const age = t - r.t0;
					if (age < 0) continue;
					ctx.globalAlpha = (1 - age / 1500) * r.a;
					ctx.strokeStyle = r.c;
					ctx.lineWidth = 1.5;
					ctx.beginPath();
					ctx.arc(r.x * W, r.y * H, 4 + age * r.v, 0, 6.283);
					ctx.stroke();
				}
			},
			on(type, now) {
				const n = current ? by[current] : null;
				if (!n) return;
				if (type === "master") {
					if (!won.has(current)) {
						won.add(current);
						order.push(current);
					}
					anim = now;
					rings.push(
						{ x: n.x, y: n.y, t0: now, v: 0.07, a: 1, c: OK },
						{ x: n.x, y: n.y, t0: now + 200, v: 0.05, a: 0.7, c: OK }
					);
				}
				if (type === "ok") rings.push({ x: n.x, y: n.y, t0: now, v: 0.025, a: 0.8, c: CORAL });
			},
		};
	},
};
