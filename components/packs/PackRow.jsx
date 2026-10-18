/** @format */
"use client";

// One row in the /wordpacks list, ported from Wortschatz's PackRow: completion
// medals, a favorite toggle and the title over a one-line description, size,
// a Normal rail, a Harder rail, then the six ways to start the pack. Every
// part has a fixed height, so every row is the same height whatever its title
// says. All progress comes from `stat` (packSummary in lib/progress.js) and
// every field of it is guarded: stats arrive after the first render
// (Wortschatz L1).
import { DRILL_MODES, isRetest, modeHref, nextRoundLabel, tierLabel, CATEGORY_CUSTOM, CATEGORY_PATH } from "./packUtils";

function pctOf(n, total) {
	return total > 0 ? Math.min(100, Math.round((n / total) * 100)) : 0;
}

function Medal({ label, count }) {
	const n = Number.isFinite(count) && count > 0 ? count : 0;
	const times = `${n} ${n === 1 ? "time" : "times"}`;
	return (
		<div
			className={`pl-medal${n > 0 ? " is-earned" : ""}`}
			role="group"
			aria-label={`${label}: completed ${times}`}
			title={`Completed ${times}`}
		>
			<span className="pl-medal-n">{n}×</span>
			<span className="pl-medal-l">{label}</span>
		</div>
	);
}

// A finished round is solid green; a pack finished before but part-way through
// a new round keeps a dim green track under the coral fill.
export function Bar({ pct, complete, banked }) {
	return (
		<div className={`pl-bar${complete ? " is-done" : banked ? " is-banked" : ""}`} aria-hidden="true">
			<i style={{ width: `${complete ? 100 : pct}%` }} />
		</div>
	);
}

function RedoIcon() {
	return (
		<svg className="pl-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
			<path
				d="M13 3.5V7H9.5 M12.7 7A5 5 0 1 0 13 9.4"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function HeartIcon({ filled }) {
	return (
		<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
			<path
				d="M8 13.6S2 10 2 6.1A3.1 3.1 0 0 1 8 4.6a3.1 3.1 0 0 1 6 1.5C14 10 8 13.6 8 13.6z"
				fill={filled ? "currentColor" : "none"}
				stroke="currentColor"
				strokeWidth="1.4"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export function FavoriteButton({ title, on, onToggle }) {
	return (
		<button
			type="button"
			className={`pl-fav${on ? " is-on" : ""}`}
			aria-pressed={!!on}
			aria-label={`${on ? "Remove" : "Add"} ${title} ${on ? "from" : "to"} favorites`}
			title={on ? "Remove from favorites" : "Add to favorites"}
			onClick={onToggle}
		>
			<HeartIcon filled={!!on} />
		</button>
	);
}

// `ready` is false until saved progress has been read. Before that the row
// shows zeros and a dash, so no medal is shown that storage has not confirmed.
export default function PackRow({ pack, stat, ready, anchor, favorite, onToggleFavorite, onOpen, onRetest, onEdit, onShare }) {
	const words = Array.isArray(pack.words) ? pack.words : [];
	const total = words.length;
	const known = !!(ready && stat);
	const hard = known && stat.hard ? stat.hard : null;
	const best = known && Number.isFinite(stat.best) ? stat.best : 0;
	const roundMastered = known && Number.isFinite(stat.roundMastered) ? stat.roundMastered : 0;
	const round = known && Number.isInteger(stat.round) ? stat.round : 1;
	const completions = known && Number.isFinite(stat.completions) ? stat.completions : 0;
	const finished = !!(known && stat.finished);
	const roundDone = known && isRetest(stat);
	const hardCompletions = hard && Number.isFinite(hard.completions) ? hard.completions : 0;
	const hardResume = hard && Number.isFinite(hard.resumeRetired) ? hard.resumeRetired : null;
	const hardResuming = hardResume !== null;
	const hardComplete = hardCompletions > 0 && !hardResuming;
	const isCustom = pack.category === CATEGORY_CUSTOM;

	return (
		<li className="pl-row" id={anchor}>
			<div className="pl-medals">
				<Medal label="Normal" count={completions} />
				<Medal label="Harder" count={hardCompletions} />
			</div>

			<div className="pl-name">
				<div className="pl-titleline">
					<FavoriteButton title={pack.title} on={favorite} onToggle={() => onToggleFavorite(pack)} />
					<span className="pl-title" title={pack.title}>
						{pack.title}
					</span>
					{isCustom && (
						<>
							<button type="button" className="pl-chip" onClick={() => onEdit(pack)} aria-label={`Edit ${pack.title}`}>
								Edit
							</button>
							<button
								type="button"
								className="pl-chip"
								onClick={() => onShare(pack)}
								aria-label={`Copy share link for ${pack.title}`}
								title="Copy share link"
							>
								Share
							</button>
						</>
					)}
				</div>
				<p className="pl-desc" title={pack.desc || undefined}>
					{pack.desc || (isCustom ? "Your pack" : " ")}
				</p>
			</div>

			<div className="pl-size">
				<span>
					{total} {total === 1 ? "word" : "words"}
				</span>
				{pack.category === CATEGORY_PATH && Number.isFinite(pack.tier) ? (
					<span className="pl-level">{tierLabel(pack.tier)}</span>
				) : null}
			</div>

			<div className="pl-rail pl-rail--normal">
				<span className="pl-rail-label">Normal</span>
				<Bar pct={pctOf(roundMastered, total)} complete={roundDone} banked={finished} />
				<div className="pl-rail-foot">
					<span className="pl-rail-main">
						<b>{known ? best : "–"}</b> / {total} mastered
					</span>
					{/* A finished round starts the next one: the pack is drilled again
					    but stays N / N and keeps its completion count. */}
					{roundDone ? (
						<button
							type="button"
							className="pl-rail-act"
							aria-label={`${nextRoundLabel(stat)} of ${pack.title} (Normal)`}
							title="Re-test this pack. Affects Normal progress only."
							onClick={() => onRetest(pack)}
						>
							<RedoIcon />
							{nextRoundLabel(stat)}
						</button>
					) : known && round > 1 ? (
						<span className="pl-rail-side">
							Round {round}: {roundMastered} / {total}
						</span>
					) : null}
				</div>
			</div>

			<div className="pl-rail pl-rail--hard">
				<span className="pl-rail-label">Harder</span>
				<Bar pct={hardResuming ? pctOf(hardResume, total) : 0} complete={hardComplete} banked={hardCompletions > 0} />
				<div className="pl-rail-foot">
					<span className="pl-rail-main">
						{!known
							? "–"
							: hardResuming
							? `Resume: ${hardResume} / ${total} retired`
							: hardCompletions > 0
							? "Last run finished"
							: "Not run yet"}
					</span>
				</div>
			</div>

			<div className="pl-actions">
				{DRILL_MODES.map((m, i) => (
					<a
						key={m.id}
						className={i === 0 ? "pl-bp" : "pl-bs"}
						href={modeHref(m, pack.id)}
						title={m.title}
						aria-label={`${m.label}: ${pack.title}`}
						onClick={() => onOpen(pack, m)}
					>
						{m.label}
					</a>
				))}
			</div>
		</li>
	);
}
