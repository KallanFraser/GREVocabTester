/** @format */

import { MODES } from "./modes";
import { POOL_SIZE, WORD_STREAK_TO_MASTER } from "../../lib/pool";
import { HARD_RELEARN_CORRECT } from "../../lib/hard-scheduler";
import { REVIEW_INTERVALS } from "../../lib/review";

// The mode tiles. Each screen is a CSS miniature of the mode, not a
// screenshot, so it cannot go stale. The sample words in the screens are
// decorative and hidden from assistive tech; the text beside each one says
// what the mode does. Every number in the copy comes from the engine
// constants, so the copy cannot drift from the code.

const FIRST_STEP = REVIEW_INTERVALS[0];
const LADDER = REVIEW_INTERVALS.slice(0, 5);
const days = (n) => `${n} day${n === 1 ? "" : "s"}`;

function TestScreen() {
	return (
		<div className="screen" aria-hidden="true">
			<div className="scr-top">
				<span>Core, set 3</span>
				<span className="scr-seg">
					<span className="on">Normal</span>
					<span>Harder</span>
				</span>
			</div>
			<div className="scr-center">
				<div className="t-word">Alacrity</div>
				<div className="t-input">
					eager readiness
					<span className="caret" />
				</div>
				<div className="t-verdict">Correct</div>
				<div className="t-streak">
					<i className="on" />
					<i className="on" />
					<i className="on" />
					<i />
				</div>
			</div>
		</div>
	);
}

function PracticeScreen() {
	return (
		<div className="screen" aria-hidden="true">
			<div className="scr-top">
				<span>Argument &amp; Rhetoric Verbs</span>
				<span>In order</span>
			</div>
			<div className="scr-progress">
				<i style={{ width: "48%" }} />
			</div>
			<div className="scr-center">
				<div className="mc-q">Mitigate</div>
				<div className="mc-opts">
					<div className="mc-opt">
						<b>1</b>to deeply respect
					</div>
					<div className="mc-opt ok">
						<b>2</b>to lessen severity
					</div>
					<div className="mc-opt">
						<b>3</b>to speak ambiguously to mislead
					</div>
					<div className="mc-opt">
						<b>4</b>to clear from blame
					</div>
				</div>
			</div>
		</div>
	);
}

function LearnScreen() {
	return (
		<div className="screen" aria-hidden="true">
			<div className="scr-top">
				<span>Full word list</span>
				<span>Shuffled</span>
			</div>
			<div className="stack">
				<div className="stack-card">
					<div className="mc-q">Enervate</div>
					<div className="mc-opts two">
						<div className="mc-opt bad">to deeply respect</div>
						<div className="mc-opt ok">to weaken; drain energy</div>
						<div className="mc-opt">wastefully extravagant</div>
						<div className="mc-opt">to lessen severity</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function CardsScreen() {
	return (
		<div className="screen" aria-hidden="true">
			<div className="scr-top">
				<div className="fc-filters">
					<span className="on">All</span>
					<span>Mastered</span>
					<span>Unmastered</span>
				</div>
			</div>
			<div className="fc-scene">
				<div className="fc-card">
					<div className="fc-face">
						<span className="w">Prodigal</span>
						<small>Hover to flip</small>
					</div>
					<div className="fc-face fc-back">
						<span className="w">wastefully extravagant</span>
						<small>His prodigal spending left him deep in debt by year&apos;s end.</small>
					</div>
				</div>
			</div>
		</div>
	);
}

function ReviewScreen() {
	return (
		<div className="screen" aria-hidden="true">
			<div className="scr-top">
				<span>Due today</span>
				<span className="scr-pill">Daily Review</span>
			</div>
			<div className="scr-center">
				<div className="t-word t-word--sm">Venerate</div>
				<div className="t-input">to deeply respect</div>
				<div className="rv-ladder">
					{LADDER.map((n, i) => (
						<span key={n} className={i < 3 ? (i === 2 ? "on now" : "on") : undefined}>
							{n}d
						</span>
					))}
				</div>
				<div className="t-verdict">Next review in {days(LADDER[2] ?? FIRST_STEP)}</div>
			</div>
		</div>
	);
}

function ContextScreen() {
	return (
		<div className="screen" aria-hidden="true">
			<div className="scr-top">
				<span>In Context</span>
				<span className="scr-pill">Sentence</span>
			</div>
			<div className="scr-center">
				<p className="cx-sentence">
					Asked about higher taxes, the governor chose to <span className="cx-blank">equivocate</span> instead of
					saying yes or no.
				</p>
				<div className="t-verdict">Correct</div>
			</div>
		</div>
	);
}

const TILES = {
	test: {
		Screen: TestScreen,
		cta: "Start typing",
		body: (
			<>
				<p className="mode-sub">
					Type the definition from memory. Small typos and slightly different wording still count, so you are
					graded on what you know rather than on your spelling.
				</p>
				<dl className="mode-levels">
					<div>
						<dt>Normal</dt>
						<dd>
							{POOL_SIZE} words in rotation. {WORD_STREAK_TO_MASTER} correct answers in a row masters a word,
							one miss resets its streak, and each mastered word makes room for a new one.
						</dd>
					</div>
					<div>
						<dt>Harder</dt>
						<dd>
							Every word in the pack in one session. A word you know on the first try is retired at once. A
							missed word sits out for a few cards, then comes back until you answer it correctly{" "}
							{HARD_RELEARN_CORRECT} more times.
						</dd>
					</div>
				</dl>
			</>
		),
	},
	practice: {
		Screen: PracticeScreen,
		cta: "Start practicing",
		body: (
			<p className="mode-sub">
				Multiple choice through the list in order. The quickest first pass through a pack, and your place in each
				pack is kept.
			</p>
		),
	},
	learn: {
		Screen: LearnScreen,
		cta: "Start shuffling",
		body: (
			<p className="mode-sub">
				Multiple choice in shuffled order, so you cannot lean on the sequence. Every word comes up once before the
				deck reshuffles.
			</p>
		),
	},
	cards: {
		Screen: CardsScreen,
		cta: "Start flipping",
		body: (
			<p className="mode-sub">
				Flip through a pack or the full list with no typing and no grading. Filter to the words you have mastered
				or have not yet.
			</p>
		),
	},
	review: {
		Screen: ReviewScreen,
		cta: "Open Daily Review",
		body: (
			<p className="mode-sub">
				Every word you master joins a review schedule. Each first-try correct answer pushes its next review further
				out ({LADDER.join(", ")} days and beyond), and a miss brings it back in {days(FIRST_STEP)}.
			</p>
		),
	},
	context: {
		Screen: ContextScreen,
		cta: "Fill the blanks",
		body: (
			<p className="mode-sub">
				Fill the blank in a GRE-style sentence with the word that completes it, so you practice each word the way
				the test uses it.
			</p>
		),
	},
};

export default function ModeTiles() {
	return (
		<div className="modes">
			{MODES.map((mode, i) => {
				const tile = TILES[mode.id];
				if (!tile) return null;
				const { Screen } = tile;
				const key = String(i + 1);
				return (
					<a
						key={mode.id}
						className={`mode mode-${mode.id}${i === 0 ? " mode-featured" : ""}`}
						href={mode.href}
						accessKey={key}
					>
						<Screen />
						<div className="mode-body">
							<h3 className="mode-title">
								<kbd>{key}</kbd> {mode.title}
							</h3>
							{tile.body}
							<span className="mode-cta">{tile.cta}</span>
						</div>
					</a>
				);
			})}
		</div>
	);
}
