// The background engine: mounts one background into a host element and owns
// everything shared: canvas sizing (DPR capped at 2), the single rAF loop,
// heat easing, the origin, pointer tracking, the grain overlay, the answer
// flash for DOM backgrounds, pausing while the tab is hidden, and reduced
// motion (one static frame, no reactions). Ported from Wortschatz.
//
// Every DOM, canvas and WebGL call that can throw is guarded. A background
// that throws while being created or drawn is torn down and reported through
// onFail(err); err.fallback names the background to use instead (liquid asks
// for fireflies), otherwise the caller falls back to plain.
//
// Client-only: call it from an effect, never during render.

import { busState, attachSink, onWords, normalizeWords } from "./state.js";
import warp from "./warp.js";
import constellation from "./constellation.js";
import liquid from "./liquid.js";
import fireflies from "./fireflies.js";
import firefliesRed from "./fireflies-red.js";
import halftone from "./halftone.js";
import grid from "./grid.js";
import rain from "./rain.js";
import aurora from "./aurora.js";
import ember from "./ember.js";
import plain from "./plain.js";

export const REGISTRY = {
	warp,
	constellation,
	liquid,
	fireflies,
	"fireflies-red": firefliesRed,
	halftone,
	grid,
	rain,
	aurora,
	ember,
	plain,
};

const MAX_DPR = 2;
const FLASH_CLASSES = ["pulse-ok", "pulse-bad", "pulse-master"];

function prefersReducedMotion() {
	try {
		return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
}

// Options:
//   onFail(err)  called once if the background throws; it is already torn down.
//   contained    size to the host element instead of the viewport (previews).
//   words        a fixed word list for this mount, ignoring the shared bus words.
//   bus          false for a preview: no answer events, no bus words, no bus
//                heat or origin. A preview is its own instance and never touches
//                the main background's subscriptions.
export function mountBackground(host, id, { onFail, contained = false, words, bus = true } = {}) {
	const def = REGISTRY[id] || plain;
	const fixedWords = words ? normalizeWords(words) : bus ? null : [];
	const nodes = []; // everything appended to host, removed on destroy
	const cleanups = [];
	let reduced = false;
	let instance = null;
	let canvas = null;
	let ctx = null;
	let flashEl = null;
	let raf = 0;
	let lastTs = 0;
	let dead = false;
	let animated = false;

	const heatNow = () => (bus ? busState.heat : 0);
	const env = {
		W: 1,
		H: 1,
		DPR: 1,
		OX: 0,
		OY: 0,
		MX: 0,
		MY: 0,
		HEAT: heatNow(),
		reduced: false,
		words: () => fixedWords || busState.words,
	};

	function add(node) {
		host.appendChild(node);
		nodes.push(node);
		return node;
	}

	function destroy() {
		if (dead) return;
		dead = true;
		stop();
		for (const fn of cleanups.splice(0)) {
			try {
				fn();
			} catch {
				/* keep tearing down */
			}
		}
		try {
			instance?.destroy?.();
		} catch {
			/* keep tearing down */
		}
		instance = null;
		for (const n of nodes.splice(0)) {
			try {
				n.remove();
			} catch {
				/* already gone */
			}
		}
	}

	function fail(err) {
		if (dead) return;
		destroy();
		try {
			onFail?.(err);
		} catch {
			/* nothing left to fall back to */
		}
	}

	function updateOrigin() {
		const o = contained || !bus ? null : busState.origin;
		env.OX = o ? o.x : env.W / 2;
		env.OY = o ? o.y : env.H * 0.45;
		if (flashEl) {
			flashEl.style.setProperty("--ox", `${env.OX}px`);
			flashEl.style.setProperty("--oy", `${env.OY}px`);
		}
	}

	function frame(ts, dt, k) {
		env.HEAT += (heatNow() - env.HEAT) * Math.min(1, 0.06 * k);
		updateOrigin();
		if (!instance?.draw) return;
		if (ctx) {
			ctx.clearRect(0, 0, env.W, env.H);
			ctx.save();
			instance.draw(ts, dt, k);
			ctx.restore();
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = "source-over";
			ctx.shadowBlur = 0;
		} else {
			instance.draw(ts, dt, k);
		}
	}

	function drawStatic() {
		if (dead) return;
		try {
			env.HEAT = heatNow();
			frame(performance.now(), 16, 1);
		} catch (err) {
			fail(err);
		}
	}

	function loop(ts) {
		raf = 0;
		if (dead) return;
		const dt = lastTs ? Math.min(50, ts - lastTs) : 16;
		lastTs = ts;
		try {
			frame(ts, dt, dt / 16);
		} catch (err) {
			fail(err);
			return;
		}
		raf = requestAnimationFrame(loop);
	}

	function start() {
		if (dead || !animated || raf || document.hidden) return;
		lastTs = 0;
		raf = requestAnimationFrame(loop);
	}

	function stop() {
		if (raf) {
			try {
				cancelAnimationFrame(raf);
			} catch {
				/* nothing scheduled */
			}
		}
		raf = 0;
	}

	function measure() {
		env.W = Math.max(1, (contained ? host.clientWidth : window.innerWidth) || 1);
		env.H = Math.max(1, (contained ? host.clientHeight : window.innerHeight) || 1);
	}

	function resize() {
		if (dead) return;
		try {
			measure();
			env.DPR = Math.min(MAX_DPR, window.devicePixelRatio || 1);
			updateOrigin();
			if (canvas && ctx) {
				canvas.width = Math.round(env.W * env.DPR);
				canvas.height = Math.round(env.H * env.DPR);
				ctx.setTransform(env.DPR, 0, 0, env.DPR, 0, 0);
			}
			instance?.resize?.();
		} catch (err) {
			fail(err);
			return;
		}
		if (!animated) drawStatic();
	}

	try {
		if (!host || typeof window === "undefined" || typeof document === "undefined") {
			throw new Error("background host unavailable");
		}
		reduced = prefersReducedMotion();
		env.reduced = reduced;
		// Only canvas backgrounds animate in JS; DOM ones are CSS.
		animated =
			!reduced && (def.kind === "2d" || def.kind === "gl") && typeof window.requestAnimationFrame === "function";
		measure();
		env.MX = env.W / 2;
		env.MY = env.H / 2;
		const layer = add(document.createElement("div"));
		layer.className = "bgx-layer";

		if (def.kind === "2d" || def.kind === "gl") {
			canvas = add(document.createElement("canvas"));
			canvas.className = "bgx-canvas";
			if (def.kind === "2d") {
				ctx = canvas.getContext("2d");
				if (!ctx) throw new Error("2d canvas context unavailable");
			}
		}
		if (def.flash) {
			flashEl = add(document.createElement("div"));
			flashEl.className = "bgx-fill bgx-flash";
		}
		if (def.grain !== false) add(document.createElement("div")).className = "bgx-fill bgx-grain";

		updateOrigin();
		instance = def.create({ canvas, ctx, layer, env, fail }) || {};
	} catch (err) {
		fail(err);
		return { destroy };
	}
	if (dead) return { destroy }; // create() reported a failure through fail()

	// ---- listeners, each paired with its removal ----
	try {
		const listen = (target, type, fn, opts) => {
			target.addEventListener(type, fn, opts);
			cleanups.push(() => target.removeEventListener(type, fn, opts));
		};

		listen(window, "resize", resize, { passive: true });
		if (contained && typeof ResizeObserver !== "undefined") {
			const ro = new ResizeObserver(() => resize());
			ro.observe(host);
			cleanups.push(() => ro.disconnect());
		}
		listen(document, "visibilitychange", () => (document.hidden ? stop() : start()));
		listen(
			window,
			"pointermove",
			(e) => {
				let px = e.clientX;
				let py = e.clientY;
				if (contained) {
					const r = host.getBoundingClientRect();
					px -= r.left;
					py -= r.top;
				}
				env.MX = px;
				env.MY = py;
				try {
					instance?.pointer?.(px, py);
				} catch (err) {
					fail(err);
				}
			},
			{ passive: true }
		);

		if (bus && !fixedWords) {
			cleanups.push(
				onWords((list) => {
					if (dead) return;
					try {
						instance?.words?.(list, performance.now());
					} catch (err) {
						fail(err);
						return;
					}
					if (!animated) drawStatic();
				})
			);
		}

		if (bus) {
			cleanups.push(
				attachSink((type) => {
					if (dead || reduced) return;
					updateOrigin();
					try {
						instance?.on?.(type, performance.now());
					} catch (err) {
						fail(err);
						return;
					}
					if (flashEl) {
						flashEl.classList.remove(...FLASH_CLASSES);
						void flashEl.offsetWidth; // restart the animation
						flashEl.classList.add(`pulse-${type}`);
					}
				})
			);
		}
	} catch (err) {
		fail(err);
		return { destroy };
	}

	resize();
	start();
	return { destroy };
}
