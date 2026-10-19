/** @format */
"use client";

import { useEffect } from "react";

const inView = (el) => {
	const r = el.getBoundingClientRect();
	return r.top < window.innerHeight && r.bottom > 0;
};

// Scroll motion for the home page. The static HTML shows every section in its
// finished state. After mount:
// - [data-loop] blocks get data-playing while on screen, and the CSS pauses
//   their animations whenever it is missing (data-js marks that JavaScript is
//   running, so without it nothing is held paused).
// - Without reduced motion, [data-reveal] blocks that are below the fold get
//   data-pending (hidden, inner parts in their start state) until they scroll
//   in, then data-in (rise in). Blocks already on screen are never hidden, so
//   nothing visible flashes at hydration.
// - A pointer spotlight follows the cursor over .spot cards and the try card.
// Everything is undone on unmount, so a route change leaves nothing behind.
export default function HomeMotion({ rootId = "home-landing" }) {
	useEffect(() => {
		const root = document.getElementById(rootId);
		if (!root) return undefined;
		const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
		const hasIO = typeof IntersectionObserver !== "undefined";
		const loopEls = [...root.querySelectorAll("[data-loop]")];
		const revealEls = [...root.querySelectorAll("[data-reveal]")];
		let loops = null;
		let reveal = null;

		if (hasIO) {
			loopEls.forEach((el) => {
				if (inView(el)) el.setAttribute("data-playing", "");
			});
			root.setAttribute("data-js", "");
			loops = new IntersectionObserver((entries) => {
				for (const e of entries) {
					if (e.isIntersecting) e.target.setAttribute("data-playing", "");
					else e.target.removeAttribute("data-playing");
				}
			});
			loopEls.forEach((el) => loops.observe(el));
		}

		if (hasIO && !reduced) {
			reveal = new IntersectionObserver(
				(entries) => {
					for (const e of entries) {
						if (!e.isIntersecting) continue;
						e.target.removeAttribute("data-pending");
						e.target.setAttribute("data-in", "");
						reveal.unobserve(e.target);
					}
				},
				{ threshold: 0.18 }
			);
			revealEls.forEach((el) => {
				if (inView(el)) return;
				el.setAttribute("data-pending", "");
				reveal.observe(el);
			});
		}

		const fine = !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);
		const onMove = (e) => {
			const el = e.target && e.target.closest ? e.target.closest(".spot, .try") : null;
			if (!el || !root.contains(el)) return;
			const r = el.getBoundingClientRect();
			el.style.setProperty("--mx", `${Math.round(e.clientX - r.left)}px`);
			el.style.setProperty("--my", `${Math.round(e.clientY - r.top)}px`);
		};
		if (fine) root.addEventListener("pointermove", onMove, { passive: true });

		return () => {
			if (loops) loops.disconnect();
			if (reveal) reveal.disconnect();
			root.removeEventListener("pointermove", onMove);
			root.removeAttribute("data-js");
			loopEls.forEach((el) => el.removeAttribute("data-playing"));
			revealEls.forEach((el) => {
				el.removeAttribute("data-pending");
				el.removeAttribute("data-in");
			});
		};
	}, [rootId]);

	return null;
}
