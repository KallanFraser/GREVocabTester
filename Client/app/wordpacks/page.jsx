/** @format */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // ⬅️ add this
import "../../styles/wordpacks.css";

const LEDGER_KEY = "wp_upvote_ledger_v2";
const PACK_KEY = "marketplaceWordpack"; // ⬅️ same key TestMode reads

export default function WordpacksPage() {
	const router = useRouter(); // ⬅️ init router

	const [packs, setPacks] = useState([]);
	const [loading, setLoading] = useState(true);
	const [err, setErr] = useState(null);
	const [ledger, setLedger] = useState({});

	useEffect(() => {
		try {
			const raw = localStorage.getItem(LEDGER_KEY);
			setLedger(raw ? JSON.parse(raw) : {});
		} catch {
			setLedger({});
		}
	}, []);

	useEffect(() => {
		let alive = true;
		(async () => {
			try {
				setLoading(true);
				setErr(null);
				const res = await fetch("/data/wordpacks.json", { cache: "no-store" });
				if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
				const json = await res.json();
				if (!alive) return;

				const cleaned = (Array.isArray(json) ? json : []).map((p) => ({
					id: String(p.id),
					title: String(p.title ?? ""),
					desc: String(p.desc ?? ""),
					likes: Number(p.likes ?? 0),
					// ⬇️ ensure indices are valid integers within range-ish
					indices: Array.isArray(p.indices)
						? p.indices.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n) && n >= 0)
						: [],
					createdAt: p.createdAt ?? null,
				}));
				cleaned.sort((a, b) => b.likes - a.likes || a.title.localeCompare(b.title));
				setPacks(cleaned);
			} catch (e) {
				setErr(e?.message || "Failed to load packs");
			} finally {
				if (alive) setLoading(false);
			}
		})();
		return () => {
			alive = false;
		};
	}, []);

	const onUpvote = (id) => {
		if (ledger[id]) return; // one like per user (client-side)
		setPacks((prev) => prev.map((p) => (p.id === id ? { ...p, likes: (p.likes || 0) + 1 } : p)));
		const next = { ...ledger, [id]: true };
		setLedger(next);
		try {
			localStorage.setItem(LEDGER_KEY, JSON.stringify(next));
		} catch {}
		// TODO: POST to API if needed
	};

	// ⬇️ This is the key change: stash indices + route to TestMode
	const onOpenPack = (pack) => {
		try {
			// Let TestMode pre-check these words in the overlay & subset
			localStorage.setItem(PACK_KEY, JSON.stringify(pack.indices || []));
		} catch {}
		// Prefer lightweight query by id (TestMode will fetch /data/wordpacks.json)
		const url = `/play/test?id=${encodeURIComponent(pack.id)}`;
		try {
			router.push(url);
		} catch {
			// Fallback if router is unavailable for any reason
			window.location.href = url;
		}
	};

	return (
		<main id="wordpacks" className="wp-tight">
			<div className="mesh" />

			<header className="wp-header">
				<h1>Wordpacks</h1>
				<p className="sub">Pick a pack, start drilling. Upvote the ones you vibe with.</p>
			</header>

			{loading ? (
				<section className="grid">
					<div className="empty">Loading packs…</div>
				</section>
			) : err ? (
				<section className="grid">
					<div className="empty">Error: {err}</div>
				</section>
			) : (
				<section className="grid">
					{packs.length === 0 ? (
						<div className="empty">No packs yet.</div>
					) : (
						packs.map((p) => (
							<article
								className="card"
								key={p.id}
								onClick={() => onOpenPack(p)}
								role="button"
								tabIndex={0}
								onKeyDown={(e) => (e.key === "Enter" ? onOpenPack(p) : null)}
							>
								<div className="card__top">
									<h3 className="title">{p.title}</h3>
									<button
										className="like"
										onClick={(e) => {
											e.stopPropagation();
											onUpvote(p.id);
										}}
										title={ledger[p.id] ? "Liked" : "Like"}
										aria-pressed={!!ledger[p.id]}
										aria-label={`${ledger[p.id] ? "Liked" : "Like"} ${p.title}`}
									>
										❤️ {p.likes ?? 0}
									</button>
								</div>

								<p className="desc">{p.desc}</p>

								<div className="meta">
									<span className="chip">{p.indices?.length ?? 0} words</span>
									{p.createdAt ? (
										<span className="chip chip--muted">
											Added {new Date(p.createdAt).toLocaleDateString()}
										</span>
									) : null}
								</div>

								<div className="row">
									<button
										className="btn"
										onClick={(e) => {
											e.stopPropagation();
											onOpenPack(p);
										}}
									>
										Use this pack
									</button>
								</div>
							</article>
						))
					)}
				</section>
			)}
		</main>
	);
}
