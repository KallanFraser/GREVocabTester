/** @format */
"use client";

// The compact /wordpacks list, ported from Wortschatz's PackList: one
// collapsible section per category, each header carrying its pack count, the
// best mastered / total across its rows and how many of its packs were
// completed at least once.
import { Fragment } from "react";
import PackRow from "./PackRow";
import { CATEGORY_PATH, pathTiers, rowAnchor, tierHeading } from "./packUtils";

// A pack with no stat yet counts as zeros of its own size, so totals never
// undercount.
function summarize(packs, stats) {
	const out = { best: 0, total: 0, completed: 0 };
	for (const p of packs) {
		const s = stats[p.id];
		const size = Array.isArray(p.words) ? p.words.length : 0;
		out.total += s && Number.isFinite(s.total) ? s.total : size;
		out.best += s && Number.isFinite(s.best) ? s.best : 0;
		if (s && s.completions > 0) out.completed += 1;
	}
	return out;
}

export default function PackList({ sections, stats, statsReady, favorites, isOpen, forceOpen, onToggle, rowProps }) {
	return (
		<div className="pl-cats">
			{sections.map((section) => {
				const open = forceOpen || isOpen(section.category);
					const isPath = section.category === CATEGORY_PATH;
				const bodyId = `${section.anchor}-body`;
				const g = summarize(section.packs, stats);
				const pct = g.total > 0 ? Math.round((g.best / g.total) * 100) : 0;
				return (
					<section className={`pl-cat${open ? " is-open" : ""}`} id={section.anchor} key={section.anchor}>
						<h2 className="pl-cat-head">
							<button
								type="button"
								className="pl-cat-toggle"
								aria-expanded={open}
								aria-controls={bodyId}
								// While a search or filter is active every matching section is
								// open; collapsing one would hide matches the learner asked for.
								disabled={forceOpen}
								onClick={() => onToggle(section.category)}
							>
								<span className="pl-cat-title">
									<span className="pl-chevron" aria-hidden="true" />
									<span className="pl-cat-name">{section.label}</span>
									<span className="pl-tag">{section.packs.length}</span>
								</span>
								<span className="pl-cat-bar" aria-hidden="true">
									<span className={`pl-bar${statsReady && g.total > 0 && g.best === g.total ? " is-done" : ""}`}>
										<i style={{ width: `${statsReady ? pct : 0}%` }} />
									</span>
								</span>
								<span className="pl-cat-agg">{statsReady ? `${g.best} / ${g.total} mastered` : `${g.total} words`}</span>
								{statsReady ? (
									<span className="pl-cat-pill" title="Packs completed at least once">
										{g.completed} / {section.packs.length} packs
									</span>
								) : (
									<span className="pl-cat-pill pl-cat-pill--idle" aria-hidden="true" />
								)}
							</button>
						</h2>
						{open && (
							<div className="pl-cat-body" id={bodyId}>
								{(isPath ? pathTiers(section.packs) : [{ tier: null, packs: section.packs }]).map((group) => (
									<Fragment key={group.tier === null ? "all" : `tier-${group.tier}`}>
										{isPath && <h3 className="pl-tier-head">{tierHeading(group.tier)}</h3>}
										<ul className="pl-rows">
											{group.packs.map((p) => (
												<PackRow
													key={p.id}
													pack={p}
													stat={stats[p.id]}
													ready={statsReady}
													anchor={rowAnchor(section.category, p.id)}
													favorite={favorites.has(p.id)}
													{...rowProps}
												/>
											))}
										</ul>
									</Fragment>
								))}
							</div>
						)}
					</section>
				);
			})}
		</div>
	);
}
