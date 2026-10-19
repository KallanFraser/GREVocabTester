/** @format */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLastPack, packSummary, scopeIdFor } from "../../lib/progress";
import { findPack } from "../../lib/packs";
import { loadSettings } from "../../lib/settings";

// The last pack the learner opened (gv_last_pack), with its mastered count in
// the current direction. It reads localStorage, so it renders nothing on the
// server and on the first client render, and fills in after mount. With no
// pack opened yet it stays empty. The count is taken against the pack's
// current words (findPack), never the list saved in gv_last_pack, so a pack
// that changed since cannot show a stale total. A pack that no longer exists,
// or a pack list that fails to load, hides the card.
export default function ContinueCard() {
	const [info, setInfo] = useState(null);

	useEffect(() => {
		let alive = true;
		const last = loadLastPack();
		if (!last) return undefined;
		const { direction } = loadSettings();
		findPack(last.id)
			.then((pack) => {
				if (!alive || !pack || !Array.isArray(pack.words) || !pack.words.length) return;
				// Best mastery, as on the Word Packs page: a finished pack stays N / N in later rounds.
				const summary = packSummary(direction, scopeIdFor(pack.id), pack.words);
				setInfo({ pack: { id: pack.id, title: pack.title || last.title }, count: summary.best, total: summary.total });
			})
			.catch(() => {
				/* no pack list: no card */
			});
		return () => {
			alive = false;
		};
	}, []);

	if (!info) return null;
	const { pack, count, total } = info;
	const pct = total ? Math.round((count / total) * 100) : 0;

	return (
		<div className="wrap">
			<div className="continue">
				<div>
					<h2>Pick up where you left off</h2>
					<p>
						{pack.title || "Your last pack"}, {count} of {total} mastered
					</p>
					<div className="meter" aria-hidden="true">
						<i style={{ width: `${pct}%` }} />
					</div>
				</div>
				<Link className="btn btn-primary" href={`/play/test?pack=${encodeURIComponent(pack.id)}`}>
					Resume
				</Link>
			</div>
		</div>
	);
}
