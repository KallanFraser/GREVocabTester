"use client";

// The app-wide animated background, mounted once in app/layout.jsx. It picks
// settings.playBackground on /play/* routes and settings.pagesBackground
// everywhere else (lib/settings.js), and tears the old one down (loop, canvas,
// listeners, bus subscription) whenever the route or the setting changes. The
// engine and every background live in lib/backgrounds/; components talk to it
// through lib/backgrounds/bus.js.
//
// Nothing renders on the server or on the first client render, so the static
// export has no window access during render and nothing to mismatch on
// hydration. A background that fails falls back (liquid to fireflies, anything
// else to plain), and an error boundary keeps a crash here from reaching the
// page.

import { Component, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import "../styles/backgrounds.css";
import { loadSettings, SETTINGS_EVENT, SETTINGS_KEY } from "../lib/settings";
import { isBackgroundId, isGameRoute } from "../lib/backgrounds/ids";
import { clearPageWords, writeWords } from "../lib/backgrounds/state";
import { loadPageWords } from "../lib/backgrounds/sources";
import { mountBackground } from "../lib/backgrounds/engine";

function readBgSettings() {
	try {
		const s = loadSettings();
		return { play: s.playBackground, pages: s.pagesBackground, direction: s.direction };
	} catch {
		return { play: "plain", pages: "plain", direction: undefined };
	}
}

// failed: { [id]: fallbackId }. Follows the chain (liquid, fireflies, plain)
// without looping.
export function resolveBackgroundId(id, failed) {
	const seen = new Set();
	let cur = isBackgroundId(id) ? id : "plain";
	while (failed[cur] && !seen.has(cur)) {
		seen.add(cur);
		cur = failed[cur];
	}
	return isBackgroundId(cur) && !seen.has(cur) ? cur : "plain";
}

function BackgroundInner() {
	const pathname = usePathname();
	const [settings, setSettings] = useState(null);
	const [failed, setFailed] = useState({});
	const hostRef = useRef(null);

	// Mount: read settings, then follow later changes (this tab and others).
	useEffect(() => {
		const sync = () => {
			const next = readBgSettings();
			setSettings((prev) =>
				prev && prev.play === next.play && prev.pages === next.pages && prev.direction === next.direction ? prev : next
			);
		};
		sync();
		const onStorage = (e) => {
			if (!e || e.key === null || e.key === SETTINGS_KEY) sync();
		};
		try {
			window.addEventListener(SETTINGS_EVENT, sync);
			window.addEventListener("storage", onStorage);
		} catch {
			/* settings still apply on the next load */
		}
		return () => {
			try {
				window.removeEventListener(SETTINGS_EVENT, sync);
				window.removeEventListener("storage", onStorage);
			} catch {
				/* nothing attached */
			}
		};
	}, []);

	const game = isGameRoute(pathname);
	const wanted = settings ? (game ? settings.play : settings.pages) : null;
	const id = wanted ? resolveBackgroundId(wanted, failed) : null;
	const direction = settings ? settings.direction : undefined;

	// Mount the engine for the current id; tear it down on change or unmount.
	useEffect(() => {
		const host = hostRef.current;
		if (!id || !host || id === "plain") return undefined;
		let handle = null;
		let alive = true;
		const onFail = (err) => {
			if (!alive) return;
			const next = isBackgroundId(err?.fallback) ? err.fallback : "plain";
			setFailed((f) => (f[id] ? f : { ...f, [id]: next }));
		};
		try {
			handle = mountBackground(host, id, { onFail });
		} catch (err) {
			onFail(err);
		}
		return () => {
			alive = false;
			try {
				handle?.destroy();
			} catch {
				/* already torn down */
			}
		};
	}, [id]);

	// Words for constellation and rain. A game page's mode publishes its own via
	// setBgWords; here only the other pages' source is filled in, after mount.
	useEffect(() => {
		if (!id) return undefined;
		if (game) {
			clearPageWords();
			return undefined;
		}
		if (id !== "constellation" && id !== "rain") {
			clearPageWords();
			return undefined;
		}
		let alive = true;
		loadPageWords(id, direction)
			.then((list) => {
				if (alive) writeWords(list, "page");
			})
			.catch(() => {
				/* no words: the background still runs */
			});
		return () => {
			alive = false;
		};
	}, [id, game, direction]);

	if (!settings) return null;
	return <div ref={hostRef} className="bgx" aria-hidden="true" data-bg={id} />;
}

class BackgroundBoundary extends Component {
	constructor(props) {
		super(props);
		this.state = { broken: false };
	}
	static getDerivedStateFromError() {
		return { broken: true };
	}
	componentDidCatch() {
		/* the page keeps working with the plain body colour */
	}
	render() {
		return this.state.broken ? null : this.props.children;
	}
}

export default function Background() {
	return (
		<BackgroundBoundary>
			<BackgroundInner />
		</BackgroundBoundary>
	);
}
