/** @format */
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const fmt = (n) => Math.round(n).toLocaleString("en-US");
const EASE = {
	quart: (p) => 1 - Math.pow(1 - p, 4),
	cubic: (p) => 1 - Math.pow(1 - p, 3),
};

// Runs before paint on the client, so a counter that is already on screen
// never paints its final value before counting. Plain useEffect on the server.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

// A number that counts up. The server HTML and the first client render show
// the final value, so hydration matches and the number is right without
// JavaScript. After mount, and only without reduced motion:
// - a counter already on screen counts up from `from` straight away;
// - a counter below the fold is set to `from` while out of sight and counts
//   up the first time it scrolls into view.
// Every frame and observer stops on unmount.
export default function CountUp({ value, from = 0, duration = 1600, ease = "quart", suffix = "", className }) {
	const target = Number.isFinite(value) ? value : 0;
	const [shown, setShown] = useState(target);
	const ref = useRef(null);

	useBeforePaint(() => {
		const el = ref.current;
		if (!el || target === from) return undefined;
		if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
		const curve = EASE[ease] || EASE.quart;
		let raf = 0;
		let io = null;

		const run = () => {
			const t0 = performance.now();
			const tick = (now) => {
				const p = Math.min(1, (now - t0) / duration);
				setShown(from + (target - from) * curve(p));
				if (p < 1) raf = requestAnimationFrame(tick);
			};
			raf = requestAnimationFrame(tick);
		};

		const r = el.getBoundingClientRect();
		const onScreen = r.top < window.innerHeight && r.bottom > 0;
		setShown(from);
		if (onScreen || typeof IntersectionObserver === "undefined") {
			run();
		} else {
			io = new IntersectionObserver(
				(entries) => {
					if (!entries.some((e) => e.isIntersecting)) return;
					io.disconnect();
					run();
				},
				{ threshold: 0.5 }
			);
			io.observe(el);
		}

		return () => {
			if (io) io.disconnect();
			cancelAnimationFrame(raf);
			setShown(target);
		};
	}, [target, from, duration, ease]);

	return (
		<span ref={ref} className={className}>
			{fmt(shown)}
			{suffix}
		</span>
	);
}
