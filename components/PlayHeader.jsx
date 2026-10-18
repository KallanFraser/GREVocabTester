/** @format */
"use client";

// Header shared by every /play/* page, after Wortschatz's play header. Purely
// presentational: it reads no storage and holds no state; the mode passes in
// what to show and handles every change.
//
//   href               where the back link goes (default "/")
//   backLabel          text of the back link (default "Menu")
//   onBack(event)      optional; runs before navigation, may preventDefault
//   title              the mode name, for example "Test"
//   packName           optional pack name, shown under the title
//   progress           optional node for the middle slot, usually a .bar
//   direction          "w2d" | "d2w"; the toggle shows only with
//   onDirectionChange  (next) => void
//   ready              false keeps the middle and right sections hidden (not
//                      removed) until the mode has hydrated, so default values
//                      never flash; the layout does not shift
//   children           extra controls, placed after the direction toggle
// Styles: the "Play header" section of styles/ui.css (loaded by app/layout.jsx).

export const DIRECTIONS = ["w2d", "d2w"];

const DIRECTION_LABEL = {
	w2d: { long: "Word → Definition", short: "Word → Def" },
	d2w: { long: "Definition → Word", short: "Def → Word" },
};

export default function PlayHeader({
	href = "/",
	backLabel = "Menu",
	onBack,
	title,
	packName,
	progress,
	direction,
	onDirectionChange,
	ready = true,
	children,
}) {
	const hide = ready ? undefined : { visibility: "hidden" };
	const showDirection = typeof onDirectionChange === "function" && DIRECTIONS.includes(direction);

	return (
		<header className="play-head">
			<div className="ph-row">
				<div className="ph-left">
					<a className="btn-s ph-back" href={href} onClick={onBack}>
						{backLabel}
					</a>
					<div className="ph-heading">
						<span className="ph-title" title={typeof title === "string" ? title : undefined}>
							{title}
						</span>
						{packName && (
							<span className="ph-pack" title={typeof packName === "string" ? packName : undefined}>
								{packName}
							</span>
						)}
					</div>
				</div>

				<div className="ph-mid" style={hide}>
					{progress}
				</div>

				<div className="ph-right" style={hide}>
					{showDirection && (
						<span className="seg ph-dir" role="group" aria-label="Direction">
							{DIRECTIONS.map((d) => (
								<button
									key={d}
									type="button"
									aria-pressed={direction === d}
									aria-label={DIRECTION_LABEL[d].long}
									onClick={() => direction !== d && onDirectionChange(d)}
								>
									<span className="ph-long">{DIRECTION_LABEL[d].long}</span>
									<span className="ph-short" aria-hidden="true">
										{DIRECTION_LABEL[d].short}
									</span>
								</button>
							))}
						</span>
					)}
					{children}
				</div>
			</div>
		</header>
	);
}
