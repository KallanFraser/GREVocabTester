/** @format */
"use client";

import { useEffect, useRef } from "react";

// Headwords drifting upward behind the hero at different depths: nearer words
// are larger, brighter and faster, a few glow coral, and the field shifts a
// little with the pointer. A correct answer in the try card makes the glowing
// words flare (the "gv-home-flare" window event, detail 0 to 1). Nothing
// renders on the server: the canvas is empty until mount. The loop runs only
// while the hero is on screen and the tab is visible, draws one still frame
// under reduced motion, and stops on unmount. A resize that keeps the width
// (a mobile address bar showing or hiding) only rescales the words' positions,
// so they do not jump; a new width rebuilds the field.

export const FLARE_EVENT = "gv-home-flare";
const MAX_WORDS = 70;
const MAX_WORDS_SMALL = 24;

export default function HeroCanvas({ words }) {
	const ref = useRef(null);
	const key = Array.isArray(words) ? words.join("|") : "";

	useEffect(() => {
		const canvas = ref.current;
		const list = Array.isArray(words) ? words.filter((w) => typeof w === "string" && w).map((w) => w.toLowerCase()) : [];
		if (!canvas || !list.length) return undefined;
		let ctx = null;
		try {
			ctx = canvas.getContext("2d");
		} catch {
			ctx = null;
		}
		if (!ctx) return undefined;

		const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
		const reduced = mq("(prefers-reduced-motion: reduce)");
		const parallax = !reduced && mq("(hover: hover) and (pointer: fine)");
		const family = getComputedStyle(canvas).fontFamily || "system-ui, sans-serif";
		let W = 0;
		let H = 0;
		let parts = [];
		let raf = 0;
		let alive = true;
		let onScreen = true;
		let mx = 0;
		let my = 0;
		let tmx = 0;
		let tmy = 0;
		let flare = 0;

		const make = (init) => {
			const z = Math.random() * 0.9 + 0.1;
			return {
				t: list[(Math.random() * list.length) | 0],
				x: Math.random() * W,
				y: init ? Math.random() * H : H + 30,
				z,
				v: 0.08 + z * 0.28,
				lit: Math.random() < 0.12,
				ph: Math.random() * 6.28,
			};
		};

		const size = () => {
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			canvas.width = Math.max(1, Math.round(W * dpr));
			canvas.height = Math.max(1, Math.round(H * dpr));
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const resize = () => {
			const w = Math.max(1, Math.round(canvas.clientWidth));
			const h = Math.max(1, Math.round(canvas.clientHeight));
			if (w === W && h === H) return;
			if (w === W && H > 0) {
				const k = h / H;
				for (const p of parts) p.y *= k;
				H = h;
				size();
				return;
			}
			W = w;
			H = h;
			size();
			const cap = W < 640 ? MAX_WORDS_SMALL : MAX_WORDS;
			const n = Math.round(Math.min(cap, (W * H) / 22000));
			parts = Array.from({ length: n }, () => make(true));
		};

		const draw = (t) => {
			ctx.clearRect(0, 0, W, H);
			for (const p of parts) {
				const fs = 11 + p.z * 26;
				const px = p.x - mx * 60 * p.z;
				const py = p.y - my * 40 * p.z;
				ctx.font = `${p.z > 0.7 ? 700 : 500} ${fs}px ${family}`;
				if (p.lit) {
					const pulse = 0.5 + 0.5 * Math.sin(t / 900 + p.ph);
					ctx.shadowColor = "rgba(234,87,70,.9)";
					ctx.shadowBlur = 18 * pulse + flare * 30;
					ctx.fillStyle = `rgba(255,138,122,${0.18 + 0.35 * pulse * p.z + flare * 0.4})`;
				} else {
					ctx.shadowBlur = 0;
					ctx.fillStyle = `rgba(240,240,242,${0.03 + p.z * 0.11})`;
				}
				ctx.fillText(p.t, px, py);
			}
			ctx.shadowBlur = 0;
		};

		const running = () => alive && !reduced && onScreen && !document.hidden;

		const frame = (t) => {
			raf = 0;
			if (!running()) return;
			mx += (tmx - mx) * 0.04;
			my += (tmy - my) * 0.04;
			flare *= 0.96;
			for (let i = 0; i < parts.length; i++) {
				const p = parts[i];
				p.y -= p.v;
				p.x += Math.sin(t / 4000 + p.ph) * 0.08;
				if (p.y < -30) parts[i] = make(false);
			}
			draw(t);
			raf = requestAnimationFrame(frame);
		};

		const kick = () => {
			if (running() && !raf) raf = requestAnimationFrame(frame);
		};

		resize();
		draw(0);
		kick();

		const ro =
			typeof ResizeObserver !== "undefined"
				? new ResizeObserver(() => {
						resize();
						if (!running()) draw(0);
					})
				: null;
		if (ro) ro.observe(canvas);
		const io =
			typeof IntersectionObserver !== "undefined"
				? new IntersectionObserver((entries) => {
						onScreen = entries.some((e) => e.isIntersecting);
						kick();
					})
				: null;
		if (io) io.observe(canvas);
		const onVis = () => kick();
		const onPointer = (e) => {
			tmx = e.clientX / window.innerWidth - 0.5;
			tmy = e.clientY / window.innerHeight - 0.5;
		};
		const onFlare = (e) => {
			const v = Number(e && e.detail);
			if (Number.isFinite(v)) flare = Math.max(flare, Math.min(1, Math.max(0, v)));
		};
		document.addEventListener("visibilitychange", onVis);
		if (parallax) window.addEventListener("pointermove", onPointer, { passive: true });
		if (!reduced) window.addEventListener(FLARE_EVENT, onFlare);
		// The web font may land after the first frame; redraw the still frame once it does.
		if (reduced && document.fonts && document.fonts.ready) {
			document.fonts.ready.then(() => {
				if (alive) draw(0);
			});
		}

		return () => {
			alive = false;
			cancelAnimationFrame(raf);
			if (ro) ro.disconnect();
			if (io) io.disconnect();
			document.removeEventListener("visibilitychange", onVis);
			window.removeEventListener("pointermove", onPointer);
			window.removeEventListener(FLARE_EVENT, onFlare);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	return <canvas ref={ref} className="hero-canvas" aria-hidden="true" />;
}
