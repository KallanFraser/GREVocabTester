/** @format */
"use client";

import { useEffect, useState } from "react";

const GLYPHS = "abcdefghijklmnopqrstuvwxyz";
const STEPS = 18;
const STEP_MS = 34;
const HOLD_MS = 2800;

// The hero headline's last word. The server and the first client render both
// show `settle` ("word."), so hydration always matches; random letters are
// drawn only inside the effect, after mount. It then scrambles once through
// `words` and comes back to rest on `settle`. It never moves with reduced
// motion, waits while the tab is hidden, and clears every timer on unmount.
// The span is aria-hidden: the h1 carries the full sentence as its label.
export default function ScrambleWord({ words, settle = "word.", className }) {
	const list = Array.isArray(words) ? words.filter((w) => typeof w === "string" && w && w !== settle) : [];
	const [text, setText] = useState(settle);
	const key = list.join("|");

	useEffect(() => {
		if (!list.length) return undefined;
		if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
		let alive = true;
		let timer = 0;
		const sequence = [...list, settle];
		let index = 0;

		const scrambleTo = (to, done) => {
			let s = 0;
			const tick = () => {
				if (!alive) return;
				if (s > STEPS) {
					setText(to);
					done();
					return;
				}
				// Keep the trailing period fixed while the letters before it settle.
				const body = to.endsWith(".") ? to.slice(0, -1) : to;
				const k = Math.floor((body.length * s) / STEPS);
				let out = body.slice(0, k);
				for (let i = k; i < body.length; i++) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
				setText(out + (to.endsWith(".") ? "." : ""));
				s++;
				timer = setTimeout(tick, STEP_MS);
			};
			tick();
		};

		const next = () => {
			if (!alive || index >= sequence.length) return;
			if (document.hidden) {
				timer = setTimeout(next, HOLD_MS);
				return;
			}
			const to = sequence[index++];
			scrambleTo(to, () => {
				if (alive && index < sequence.length) timer = setTimeout(next, HOLD_MS);
			});
		};
		timer = setTimeout(next, HOLD_MS);

		return () => {
			alive = false;
			clearTimeout(timer);
			setText(settle);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, settle]);

	return (
		<span className={className} aria-hidden="true">
			{text}
		</span>
	);
}
