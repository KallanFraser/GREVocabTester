/** @format */

import Link from "next/link";
import { MODES } from "./modes";
import home from "../../src/data/home.json";
import { POOL_SIZE, WORD_STREAK_TO_MASTER } from "../../lib/pool";
import { REVIEW_INTERVALS } from "../../lib/review";
import { TestScreen, PracticeScreen, LearnScreen, CardsScreen, ReviewScreen, ContextScreen } from "./ModeScreens";

// The mode bento. Each screen is a miniature of the mode built in markup, not
// a screenshot, so it cannot go stale; ModeScreens plays a short scripted demo
// in each. The number keys are handled by HomeShortcuts; the kbd hints only
// show them. Every number in the copy comes from the engine constants or
// home.json.

const LADDER = REVIEW_INTERVALS.slice(0, 5);
const CORE = Array.isArray(home?.tiers) ? home.tiers.find((t) => t.tier === 1) : null;
const CORE_PACKS = Number(CORE?.packs) || 0;
const CORE_LABEL = CORE_PACKS >= 3 ? `Core 3 of ${CORE_PACKS}` : "Core";
// Reveal stagger per tile, two rows of three.
const DELAYS = [0, 80, 160, 0, 80, 160];

const TILES = {
	test: {
		screen: <TestScreen label={CORE_LABEL} streakToMaster={WORD_STREAK_TO_MASTER} />,
		cta: "Start typing",
		body: (
			<>
				<p className="mode-sub">
					Type the definition from memory. You are graded on what you know, not on your spelling.
				</p>
				<dl className="levels">
					<div>
						<dt>Normal</dt>
						<dd>
							{POOL_SIZE} words in rotation. {WORD_STREAK_TO_MASTER} in a row masters a word and makes room for
							the next.
						</dd>
					</div>
					<div>
						<dt>Harder</dt>
						<dd>The whole pack in one session. Missed words sit out a few cards, then come back.</dd>
					</div>
				</dl>
			</>
		),
	},
	practice: {
		screen: <PracticeScreen label={"Argument & Rhetoric Verbs"} />,
		cta: "Start practicing",
		body: <p className="mode-sub">Multiple choice through a pack in order. The fastest first pass.</p>,
	},
	learn: {
		screen: <LearnScreen />,
		cta: "Start shuffling",
		body: <p className="mode-sub">Shuffled multiple choice, so you can&apos;t lean on the order.</p>,
	},
	cards: {
		screen: <CardsScreen />,
		cta: "Start flipping",
		body: <p className="mode-sub">Flip through with no grading. Filter to mastered or unmastered.</p>,
	},
	review: {
		screen: <ReviewScreen ladder={LADDER} />,
		cta: "Open Daily Review",
		body: (
			<p className="mode-sub">
				Every first-try correct answer pushes a word further out. A miss brings it back tomorrow.
			</p>
		),
	},
	context: {
		screen: <ContextScreen />,
		cta: "Fill the blanks",
		body: <p className="mode-sub">Fill the blank in a GRE-style sentence, the way the test uses the word.</p>,
	},
};

export default function ModeTiles() {
	return (
		<div className="bento" data-loop="">
			{MODES.map((mode, i) => {
				const tile = TILES[mode.id];
				if (!tile) return null;
				return (
					<Link
						key={mode.id}
						className={`mode spot${i === 0 ? " feat" : ""}`}
						href={mode.href}
						data-reveal=""
						style={{ "--d": `${DELAYS[i] || 0}ms` }}
					>
						{tile.screen}
						<div className="mode-body">
							<h3 className="mode-title">
								<kbd>{i + 1}</kbd> {mode.title}
							</h3>
							{tile.body}
							<span className="cta">
								{tile.cta} <span aria-hidden="true">&rarr;</span>
							</span>
						</div>
					</Link>
				);
			})}
		</div>
	);
}
