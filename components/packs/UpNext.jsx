/** @format */
"use client";

// The top of /wordpacks, ported from Wortschatz's UpNext: the "Up next" panel
// for the path pack in focus beside the learning path, one step per pack
// (tier, then order) filled from the bottom by its best mastered share and
// grouped under Core, Common and Advanced. The panel defaults to the first
// pack not yet completed; clicking a step focuses another for this visit only.
import { DRILL_MODES, isRetest, modeHref, nextRoundLabel, pathTiers, tierLabel } from "./packUtils";
import { FavoriteButton } from "./PackRow";

export default function UpNext({ path, stats, statsReady, selectedId, onSelect, directionLabel, favorites, onToggleFavorite, onOpen, onRetest }) {
	if (!path.length) return null;

	const isDone = (p) => !!(stats[p.id] && stats[p.id].finished);
	const doneCount = statsReady ? path.filter(isDone).length : 0;
	const allDone = statsReady && doneCount === path.length;
	const defaultPack = statsReady ? path.find((p) => !isDone(p)) || null : null;
	const selected = selectedId ? path.find((p) => p.id === selectedId) || null : null;
	const current = selected || defaultPack;
	const index = current ? path.indexOf(current) : -1;
	const stat = current && statsReady ? stats[current.id] || null : null;
	const count = current && Array.isArray(current.words) ? current.words.length : 0;
	const mastered = stat && Number.isFinite(stat.best) ? stat.best : 0;
	const pct = count > 0 ? Math.min(100, Math.round((mastered / count) * 100)) : 0;
	const totalWords = path.reduce((n, p) => n + (Array.isArray(p.words) ? p.words.length : 0), 0);
	const tiers = pathTiers(path);

	let kicker = "Up next";
	if (stat && stat.finished) kicker = "Completed";
	else if (current && selected && (!defaultPack || selected.id !== defaultPack.id)) kicker = "Selected pack";
	else if (stat && (stat.roundMastered > 0 || stat.hasProgress)) kicker = "Up next, in progress";

	const foot = allDone
		? "Every pack on the path is complete. Select any step to study it again."
		: "The path runs from Core to Advanced. Select any step to jump ahead.";

	return (
		<section className="un" id="pk-upnext" aria-label="Up next and learning path">
			<div className="un-main">
				{current ? (
					<>
						<p className="un-kicker">
							{kicker}
							<span className="un-kicker-sub">
								{Number.isFinite(current.tier) ? `${tierLabel(current.tier)} · ` : ""}Step {index + 1} of {path.length}
							</span>
						</p>
						<div className="un-titleline">
							<h2 className="un-title">{current.title}</h2>
							<FavoriteButton
								title={current.title}
								on={favorites.has(current.id)}
								onToggle={() => onToggleFavorite(current)}
							/>
						</div>
						{current.desc ? <p className="un-desc">{current.desc}</p> : null}
						<div className={`pl-bar un-bar${stat && stat.finished ? " is-done" : ""}`} aria-hidden="true">
							<i style={{ width: `${pct}%` }} />
						</div>
						<p className="un-count">
							{stat ? mastered : "–"} of {count} mastered
						</p>
						<div className="un-actions">
							{DRILL_MODES.map((m, i) => (
								<a
									key={m.id}
									className={i === 0 ? "pl-bp" : "pl-bs"}
									href={modeHref(m, current.id)}
									title={m.title}
									onClick={() => onOpen(current, m)}
								>
									{m.label}
								</a>
							))}
						</div>
						{(isRetest(stat) || (selected && defaultPack && selected.id !== defaultPack.id) || (selected && allDone)) && (
							<div className="un-links">
								{selected && defaultPack && selected.id !== defaultPack.id && (
									<button type="button" className="pl-link" onClick={() => onSelect(null)}>
										Back to up next: {defaultPack.title}
									</button>
								)}
								{selected && allDone && (
									<button type="button" className="pl-link" onClick={() => onSelect(null)}>
										Back to summary
									</button>
								)}
								{isRetest(stat) && (
									<button type="button" className="pl-link" onClick={() => onRetest(current)}>
										{nextRoundLabel(stat)}
									</button>
								)}
							</div>
						)}
					</>
				) : allDone ? (
					<>
						<p className="un-kicker">Path complete</p>
						<h2 className="un-title">Every pack on the learning path is complete</h2>
						<p className="un-desc">
							All {totalWords} words across {path.length} packs are mastered{directionLabel ? ` for ${directionLabel}` : ""}.
							Select any step on the path to study it again.
						</p>
					</>
				) : (
					// Progress has not been read yet: no pack is known to be next, so
					// the panel holds its place without guessing.
					<p className="un-desc un-pending">Loading your progress…</p>
				)}
			</div>

			<div className="un-pathcol">
				<div className="un-path-label">
					<span>Learning path</span>
					<span>{statsReady ? `${doneCount} of ${path.length} packs done` : `${path.length} packs`}</span>
				</div>
				{tiers.map((t) => (
					<div className="un-tier" key={String(t.tier)}>
						<p className="un-tier-name">{t.label}</p>
						<ol className="un-path">
							{t.packs.map((p, i) => {
								const s = statsReady ? stats[p.id] : null;
								const n = Array.isArray(p.words) ? p.words.length : 0;
								const b = s && Number.isFinite(s.best) ? s.best : 0;
								const fill = n > 0 ? Math.min(100, Math.round((b / n) * 100)) : 0;
								const isCurrent = !!(current && current.id === p.id);
								return (
									<li key={p.id}>
										<button
											type="button"
											className={`un-step${s && s.finished ? " is-done" : ""}${isCurrent ? " is-current" : ""}`}
											aria-pressed={isCurrent}
											aria-label={`${t.label} ${i + 1}: ${p.title}${s ? `, ${b} of ${n} mastered` : ""}`}
											title={p.title}
											onClick={() => onSelect(p.id)}
										>
											<span className="un-step-bar">
												<i style={{ height: `${fill}%` }} />
											</span>
											<span className="un-step-range" aria-hidden="true">
												{i + 1}
											</span>
										</button>
									</li>
								);
							})}
						</ol>
					</div>
				))}
				<p className="un-path-foot">{foot}</p>
			</div>
		</section>
	);
}
