/** @format */

// Harder mode's session-complete screen, ported from Wortschatz: a hero score,
// quiet secondary stats, either a missed-word list (hardest first) or a
// perfect-run block, and an actions row. Wortschatz's star glyph is replaced
// by a drawn check (no emoji in UI chrome). Styles: styles/testmode.css (.ss-*).
//
//   missed   [{ key, primary, secondary, misses }]; primary is the answer side

const VARIANT_CLASS = { primary: "btn-p", secondary: "btn-s", quiet: "btn-q" };

export default function SessionSummary({ title, hero, stats, missedTitle, missed, perfectTitle, perfectBody, actions }) {
	const pct = hero && hero.max ? Math.round((hero.value / hero.max) * 100) : null;
	const perfect = Array.isArray(missed) && missed.length === 0;

	return (
		<div className="ss">
			<h2>{title}</h2>

			{hero && (
				<div className="ss-hero">
					<div className="ss-hero-score">
						<span className="ss-hero-num">{hero.value}</span>
						<span className="ss-hero-sep">/</span>
						<span className="ss-hero-max">{hero.max}</span>
						{pct !== null && <span className="ss-hero-pct">{pct}%</span>}
					</div>
					{hero.label && <p className="ss-hero-label">{hero.label}</p>}
				</div>
			)}

			{stats?.length > 0 && (
				<div className="ss-stats">
					{stats.map((s) => (
						<div key={s.label}>
							<strong>{s.value}</strong>
							<span>{s.label}</span>
						</div>
					))}
				</div>
			)}

			{perfect ? (
				<div className="ss-perfect">
					<div className="ss-perfect-icon" aria-hidden="true">
						<svg viewBox="0 0 24 24" width="26" height="26">
							<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</div>
					{perfectTitle && <p className="ss-perfect-title">{perfectTitle}</p>}
					{perfectBody && <p className="ss-perfect-body">{perfectBody}</p>}
				</div>
			) : missed?.length > 0 ? (
				<div className="ss-missed">
					{missedTitle && <p className="ss-missed-label">{missedTitle}</p>}
					<ul className="ss-missed-list">
						{missed.map((m) => (
							<li key={m.key}>
								<div className="ss-missed-word">{m.primary}</div>
								<div className="ss-missed-gloss">{m.secondary}</div>
								<span className="ss-missed-badge" aria-label={`Missed ${m.misses} time${m.misses === 1 ? "" : "s"}`}>
									×{m.misses}
								</span>
							</li>
						))}
					</ul>
				</div>
			) : null}

			{actions?.length > 0 && (
				<div className="ss-acts">
					{actions.map((a) => (
						<button key={a.key || a.label} type="button" className={VARIANT_CLASS[a.variant] || "btn-s"} onClick={a.onClick}>
							{a.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
