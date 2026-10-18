/** @format */
"use client";

import { useEffect, useState } from "react";
import { loadLastPack, packSummary, scopeIdFor } from "../../lib/progress";
import { loadSettings } from "../../lib/settings";

// The last pack the learner opened (gv_last_pack), with its mastered count in
// the current direction. It reads localStorage, so it renders nothing on the
// server and on the first client render, and fills in after mount. With no
// pack opened yet it stays empty.
export default function ContinueCard() {
	const [info, setInfo] = useState(null);

	useEffect(() => {
		const pack = loadLastPack();
		if (!pack) return;
		const { direction } = loadSettings();
		// Best mastery, as on the Word Packs page: a finished pack stays N / N in later rounds.
		const summary = packSummary(direction, scopeIdFor(pack.id), pack.words);
		setInfo({ pack, count: summary.best, total: summary.total });
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
				<a className="btn btn-primary" href={`/play/test?pack=${encodeURIComponent(pack.id)}`}>
					Resume
				</a>
			</div>
		</div>
	);
}
