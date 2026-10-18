/** @format */
"use client";

// Test mode's answer feedback motion, ported from Wortschatz. None of it
// belongs to the card being answered: the next card appears at the advance
// delay and these keep playing over it. The summary toast is a portal on
// <body>; the confetti canvas, the green copy of the word flying into the
// header bar and the pip pop with its "+1" live outside React's tree entirely.
// Each imperative helper returns a cancel function that stops its animation and
// removes its node; TestMode keeps those and calls them on unmount, on a
// session restart and before the next burst, so nothing is left on the page.
// Styles: styles/testmode.css (.tm-confetti, .tm-ghost, .tm-popfx, .tm-toast).

import { createPortal } from "react-dom";

const CONFETTI_COLORS = ["#5fd39a", "#5fd39a", "#8be0a7", "#ea5746", "#ececef"];
const CONFETTI_COUNT = 110;
// The longest piece of the pip pop (the "+1" float, styles/testmode.css).
const POP_MS = 1000;

function noop() {}

export function prefersReducedMotion() {
	try {
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
}

// A one-shot burst from viewport point (x, y) on its own fixed canvas. The rAF
// loop stops and the canvas is removed when the last particle fades, or at once
// on cancel.
export function burstConfetti(x, y) {
	if (typeof document === "undefined" || prefersReducedMotion()) return noop;
	let canvas;
	let ctx;
	try {
		canvas = document.createElement("canvas");
		canvas.className = "tm-confetti";
		canvas.setAttribute("aria-hidden", "true");
		ctx = canvas.getContext("2d");
		if (!ctx) return noop;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		canvas.width = window.innerWidth * dpr;
		canvas.height = window.innerHeight * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		document.body.appendChild(canvas);
	} catch {
		canvas?.remove();
		return noop;
	}

	// Cosmetic only, and run from an event handler, never during render.
	let parts = [];
	for (let i = 0; i < CONFETTI_COUNT; i++) {
		parts.push({
			x,
			y,
			vx: (Math.random() - 0.5) * 13,
			vy: -(3 + Math.random() * 9),
			w: 4 + Math.random() * 5,
			h: 2.5 + Math.random() * 3,
			r: Math.random() * 6.28,
			vr: (Math.random() - 0.5) * 0.35,
			c: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
			life: 0,
			max: 70 + Math.random() * 55,
		});
	}

	let raf = 0;
	let last = 0;
	let stopped = false;
	function stop() {
		if (stopped) return;
		stopped = true;
		cancelAnimationFrame(raf);
		canvas.remove();
	}
	function loop(ts) {
		if (stopped) return;
		try {
			const dt = last ? Math.min(50, ts - last) : 16;
			last = ts;
			const k = dt / 16;
			ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
			parts = parts.filter((p) => p.life < p.max);
			for (const p of parts) {
				p.life += k;
				p.vy += 0.22 * k;
				p.vx *= Math.pow(0.985, k);
				p.x += p.vx * k;
				p.y += p.vy * k;
				p.r += p.vr * k;
				ctx.save();
				ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
				ctx.translate(p.x, p.y);
				ctx.rotate(p.r);
				ctx.fillStyle = p.c;
				ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
				ctx.restore();
			}
		} catch {
			stop();
			return;
		}
		if (!parts.length) stop();
		else raf = requestAnimationFrame(loop);
	}
	raf = requestAnimationFrame(loop);
	return stop;
}

// A green copy of `wordEl` flies from where it sits to (targetX, targetY), the
// point on the header bar the new count reaches. `onArrive` runs once, when the
// flight lands or immediately if it cannot run; cancel removes the copy without
// calling it (the caller settles the bar itself).
export function flyToBar(wordEl, targetX, targetY, onArrive) {
	let done = false;
	const arrive = () => {
		if (done) return;
		done = true;
		onArrive?.();
	};
	let ghost = null;
	let anim = null;
	try {
		const r = wordEl.getBoundingClientRect();
		const cs = window.getComputedStyle(wordEl);
		ghost = document.createElement("div");
		ghost.className = "tm-ghost";
		ghost.setAttribute("aria-hidden", "true");
		ghost.textContent = wordEl.textContent;
		Object.assign(ghost.style, {
			left: `${r.left}px`,
			top: `${r.top}px`,
			width: `${r.width}px`,
			height: `${r.height}px`,
			fontSize: cs.fontSize,
			fontWeight: cs.fontWeight,
			letterSpacing: cs.letterSpacing,
			lineHeight: cs.lineHeight,
		});
		if (typeof ghost.animate !== "function") throw new Error("no WAAPI");
		document.body.appendChild(ghost);
		const tx = targetX - (r.left + r.width / 2);
		const ty = targetY - (r.top + r.height / 2);
		anim = ghost.animate(
			[
				{ transform: "translate(0,0) scale(1.08)", opacity: 1 },
				{ transform: "translate(0,-16px) scale(1.12)", opacity: 1, offset: 0.18 },
				{ transform: `translate(${tx}px,${ty}px) scale(.06)`, opacity: 0.4 },
			],
			{ duration: 900, easing: "cubic-bezier(.55,0,.3,1)", fill: "forwards" }
		);
		anim.onfinish = () => {
			ghost?.remove();
			ghost = null;
			arrive();
		};
	} catch {
		ghost?.remove();
		ghost = null;
		arrive();
		return noop;
	}
	return () => {
		done = true;
		try {
			anim?.cancel();
		} catch {
			/* already finished */
		}
		ghost?.remove();
		ghost = null;
	};
}

// The correct-answer pop: a green pip and a floating "+1" over `pipEl`, placed
// from its rect now, so the next card re-rendering that pip cannot cut it off.
// Removes itself after POP_MS and then calls `onEnd`. Returns its cancel
// function, or null when nothing was started (reduced motion, no pip).
export function popPip(pipEl, onEnd) {
	if (typeof document === "undefined" || !pipEl || prefersReducedMotion()) return null;
	let layer = null;
	try {
		const r = pipEl.getBoundingClientRect();
		layer = document.createElement("div");
		layer.className = "tm-popfx";
		layer.setAttribute("aria-hidden", "true");
		Object.assign(layer.style, {
			left: `${r.left}px`,
			top: `${r.top}px`,
			width: `${r.width}px`,
			height: `${r.height}px`,
		});
		const pip = document.createElement("i");
		const plus = document.createElement("span");
		plus.textContent = "+1";
		layer.append(pip, plus);
		document.body.appendChild(layer);
	} catch {
		layer?.remove();
		return null;
	}
	let timer = 0;
	function stop() {
		clearTimeout(timer);
		layer?.remove();
		layer = null;
	}
	timer = setTimeout(() => {
		stop();
		onEnd?.();
	}, POP_MS);
	return stop;
}

export const CHECK_ICON = (
	<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
		<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

// The summary toast for a word just mastered (Normal) or retired (Harder):
// fixed, centered, `top` px from the viewport top (just under the answer box),
// never in the layout and never in the way of a click. TestMode owns its timing
// (`fading`) and gives each toast its own key, so a new one replaces the last.
// Hidden from screen readers: the feedback area announces the same thing.
export function MasteryToast({ top, fading, ...card }) {
	if (typeof document === "undefined") return null;
	return createPortal(
		<div className={`tm-toast${fading ? " out" : ""}`} style={{ top: `${top}px` }} aria-hidden="true">
			<MasteryCard {...card} />
		</div>,
		document.body
	);
}

// The summary card: check, "word → meaning", "Mastered · x of N", "+1".
export function MasteryCard({ word, meaning, label, count, total }) {
	return (
		<div className="tm-mcard">
			<div className="tm-mcard-md">{CHECK_ICON}</div>
			<div className="tm-mcard-body">
				<div className="tm-mcard-word">
					<span>{word}</span>
					<span className="tm-mcard-arrow" aria-hidden="true">
						→
					</span>
					<span className="sr"> means </span>
					<span className="tm-mcard-meaning">{meaning}</span>
				</div>
				<div className="tm-mcard-sub">
					{label} · {count} of {total}
				</div>
			</div>
			<div className="tm-mcard-plus" aria-hidden="true">
				+1
			</div>
		</div>
	);
}
