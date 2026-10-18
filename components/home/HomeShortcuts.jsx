/** @format */
"use client";

import { useEffect } from "react";
import { MODES } from "./modes";

// Number keys 1 to N open the modes, in MODES order. Ignored while a modifier
// is held, while focus is in a form field (so typing a digit into the try-it
// card or anywhere else never navigates), and for keys another handler has
// already claimed.
export default function HomeShortcuts() {
	useEffect(() => {
		const onKey = (e) => {
			if (e.defaultPrevented || e.repeat || e.isComposing) return;
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			const t = e.target;
			const tag = (t?.tagName || "").toLowerCase();
			if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
			if (!/^[1-9]$/.test(e.key)) return;
			const mode = MODES[Number(e.key) - 1];
			if (mode) window.location.href = mode.href;
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return null;
}
