/** @format */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import "../../styles/globals.css";

const DATA_URL = "/data/wordpacks.json";

/** Local likes are stored per id in localStorage under key "wp_likes:{id}" */
const getLocalLikes = (id) => Number(localStorage.getItem(`wp_likes:${id}`) || 0);
const bumpLocalLike = (id) => {
	const cur = getLocalLikes(id);
	localStorage.setItem(`wp_likes:${id}`, String(cur + 1));
	return cur + 1;
};

export default function WordpacksPage() {
	const [packs, setPacks] = useState([]);
	const [query, setQuery] = useState("");

	useEffect(() => {
		let alive = true;
		fetch(DATA_URL, { cache: "no-store" })
			.then((r) => r.json())
			.then((data) => {
				if (!alive) return;
				setPacks(Array.isArray(data) ? data : []);
			})
			.catch(() => setPacks([]));
		return () => {
			alive = false;
		};
	}, []);

	const enriched = useMemo(() => {
		return packs
			.map((p) => {
				const local = typeof window !== "undefined" ? getLocalLikes(p.id) : 0;
				return { ...p, totalLikes: (p.likes || 0) + local };
			})
			.filter((p) => {
				const q = query.trim().toLowerCase();
				if (!q) return true;
				return p.title.toLowerCase().includes(q) || (p.desc || "").toLowerCase().includes(q);
			})
			.sort((a, b) => b.totalLikes - a.totalLikes);
	}, [packs, query]);

	const onLike = (id) => {
		bumpLocalLike(id);
		// trigger re-compute
		setPacks((prev) => [...prev]);
	};

	const copyIndices = async (indices) => {
		try {
			await navigator.clipboard.writeText(JSON.stringify(indices));
			alert("Copied indices to clipboard ✅");
		} catch {
			alert("Could not copy indices 😅");
		}
	};

	const saveForApp = (pack) => {
		localStorage.setItem("marketplaceWordpack", JSON.stringify(pack.indices));
		// jump straight into Normal Mode
		window.location.href = "/?mode=test&from=wordpacks";
	};

	return (
		<main id="wordpacks">
			<div className="mesh" aria-hidden="true" />
			<header className="wp-header">
				<h1>Popular wordpacks</h1>
				<p className="sub">Student-made subsets. Sorted by love.</p>
				<div className="search">
					<input
						type="text"
						placeholder="Search titles or descriptions…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						aria-label="Search wordpacks"
					/>
					<a className="back" href="/">
						← Back
					</a>
				</div>
			</header>

			<section className="grid">
				{enriched.map((p) => (
					<article className="card" key={p.id}>
						<div className="card__top">
							<h3 className="title">{p.title}</h3>
							<button className="like" title="Like this pack" onClick={() => onLike(p.id)}>
								❤️ {p.totalLikes}
							</button>
						</div>
						{p.desc && <p className="desc">{p.desc}</p>}

						<div className="meta">
							<span className="chip">{p.indices.length} words</span>
							<span className="chip chip--muted">id: {p.id}</span>
						</div>

						<div className="row">
							<button className="btn" onClick={() => saveForApp(p)}>
								Use this pack
							</button>
							<button className="btn btn--ghost" onClick={() => copyIndices(p.indices)}>
								Copy indices
							</button>
						</div>
					</article>
				))}

				{enriched.length === 0 && (
					<div className="empty">No packs found. Try clearing your search.</div>
				)}
			</section>
		</main>
	);
}
