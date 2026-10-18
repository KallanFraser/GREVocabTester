/** @format */
"use client";

// In Context (/play/context): the GRE counterpart to Text Completion. Each card
// is a word's example sentence with the word blanked out; pick the headword
// that completes it from four options. No mastery is recorded.
//
// The order is a crypto-shuffled deck of the scope's usable words (those whose
// sentence lib/context.js blankSentence can blank), with no repeats until it
// runs out, then a fresh shuffle. Pack-aware through lib/packs.js
// resolvePackContext, with the URL rewritten to its stable form (?pack=<id>,
// or ?words=a,b,c for a selection without a pack) so a reload keeps the words.
// Timing, sounds and background calls follow components/choice/ChoiceQuiz.jsx.
//
// Randomness only ever runs in effects and event handlers.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PlayHeader from "./PlayHeader";
import ConfirmDialog from "./ConfirmDialog";
import { WORDS, getWord } from "../lib/words";
import { cryptoRng } from "../lib/distractors";
import {
	loadSettings,
	saveSettings,
	SETTINGS_EVENT,
	DEFAULT_SETTINGS,
	ADVANCE_DELAY_MANUAL,
	ADVANCE_DELAY_OPTIONS,
	ADVANCE_DELAY_LABEL,
} from "../lib/settings";
import { MISSING_PACK_NOTICE, isMissingPack, resolvePackContext } from "../lib/packs";
import { buildContextQuestion, usableKeys } from "../lib/context";
import { bgEvent, setBgOrigin, setBgWords } from "../lib/backgrounds/bus";
import "../styles/choice.css";
import "../styles/context.css";

const ALL_KEYS = WORDS.map((e) => e.word);
// A wrong answer reveals two definitions and the full sentence, so its
// automatic advance never comes sooner than this, whatever the delay setting.
const WRONG_MIN_SECONDS = 3;
const ANSWER_KEYS = ["1", "2", "3", "4"];
const PACK_PARAMS = ["pack", "words", "id"];
const TITLE = "In Context";

function cryptoShuffle(list) {
	const a = [...list];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.min(i, Math.floor(cryptoRng() * (i + 1)));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function withPeriod(s) {
	return /[.?!]$/.test(s) ? s : `${s}.`;
}

// The stable URL query for a resolved context.
function canonicalQuery(packId, keys) {
	if (!keys) return "";
	if (packId) return `?pack=${encodeURIComponent(packId)}`;
	return `?words=${keys.map(encodeURIComponent).join(",")}`;
}

function CheckIcon() {
	return (
		<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
			<path d="M3.2 8.6l3 3L12.8 4.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function CrossIcon() {
	return (
		<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
			<path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
		</svg>
	);
}

// What the page shows before the search params are available (the Suspense
// fallback in app/play/context/page.jsx): the same frame, controls hidden.
export function ContextFallback() {
	return (
		<div className="ch-page cx-page">
			<PlayHeader title={TITLE} ready={false} />
			<main className="ch-stage">
				<div className="ch-wrap">
					<p className="ch-loading">Loading…</p>
				</div>
			</main>
		</div>
	);
}

export default function ContextMode() {
	const search = useSearchParams().toString();

	const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS }));
	const [hydrated, setHydrated] = useState(false);
	// keys: every word in scope; usable: those with a sentence that can be blanked
	const [scope, setScope] = useState({ keys: ALL_KEYS, usable: [], packId: null, title: null });
	const [position, setPosition] = useState(0);
	const [question, setQuestion] = useState(null);
	const [answer, setAnswer] = useState(null); // { picked, correct } once answered
	const [confirmReset, setConfirmReset] = useState(false);
	// A ?pack= or ?id= that named no pack; the quiz falls back to all words.
	const [missingPack, setMissingPack] = useState(false);

	const settingsRef = useRef(settings);
	settingsRef.current = settings;
	const deckRef = useRef([]);
	const timerRef = useRef(null);
	const sigRef = useRef(null); // identity of the scope in play
	const resolvedOnceRef = useRef(false);
	const promptRef = useRef(null);
	const yesSound = useRef(null);
	const noSound = useRef(null);

	const inPack = !!scope.packId || scope.keys !== ALL_KEYS;
	const manual = settings.advanceDelay === ADVANCE_DELAY_MANUAL;

	function clearTimer() {
		clearTimeout(timerRef.current);
		timerRef.current = null;
	}

	function showCard(key, keys) {
		clearTimer();
		setAnswer(null);
		setQuestion(key ? buildContextQuestion(key, keys) : null);
	}

	function deal(usable, keys, avoid) {
		const deck = cryptoShuffle(usable);
		// No immediate repeat across a reshuffle.
		if (avoid && deck.length > 1 && deck[0] === avoid) [deck[0], deck[1]] = [deck[1], deck[0]];
		deckRef.current = deck;
		setPosition(0);
		showCard(deck[0], keys);
	}

	// Start (or restart) a scope with a fresh shuffle. Any pending advance from
	// the previous scope is cancelled by showCard.
	function startScope(keys, packId, title) {
		clearTimer();
		setConfirmReset(false);
		const usable = usableKeys(keys);
		setScope({ keys, usable, packId, title });
		deal(usable, keys, null);
	}

	// ---- Settings, after mount; follow changes made elsewhere ----
	useEffect(() => {
		const s = loadSettings();
		settingsRef.current = s;
		setSettings(s);
		const onChange = () => setSettings(loadSettings());
		window.addEventListener(SETTINGS_EVENT, onChange);
		return () => window.removeEventListener(SETTINGS_EVENT, onChange);
	}, []);

	// ---- Pack context from the URL ----
	useEffect(() => {
		let alive = true;
		function apply(ctx) {
			if (!alive) return;
			const first = !resolvedOnceRef.current;
			resolvedOnceRef.current = true;
			// The legacy handoff is cached for the page load; honour it only once.
			if (ctx && ctx.source === "handoff" && !first) ctx = null;
			// A pack that no longer exists runs as all words, with a notice; the
			// rewrite below drops its parameters.
			const missing = isMissingPack(ctx);
			if (missing) ctx = null;

			const keys = ctx && Array.isArray(ctx.words) ? [...new Set(ctx.words.map(getWord).filter(Boolean).map((e) => e.word))] : [];
			const usePack = keys.length > 0;
			const packId = usePack ? ctx.id : null;

			// Rewrite the address bar to the stable form so a reload keeps the pack.
			const params = new URLSearchParams(search);
			const hasPackParam = PACK_PARAMS.some((p) => params.has(p));
			const want = usePack ? canonicalQuery(packId, keys) : "";
			if ((usePack || hasPackParam) && window.location.search !== want) {
				window.history.replaceState(window.history.state, "", window.location.pathname + want + window.location.hash);
			}

			const sig = usePack ? `${packId || ""}|${keys.join(",")}` : "all";
			if (missing) setMissingPack(true);
			else if (sig !== sigRef.current) setMissingPack(false);
			if (sig === sigRef.current) return;
			sigRef.current = sig;
			startScope(usePack ? keys : ALL_KEYS, packId, usePack ? ctx.title : null);
			setHydrated(true);
		}
		// A failed resolve behaves as no context: all words.
		resolvePackContext(search)
			.then(apply)
			.catch(() => apply(null));
		return () => {
			alive = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search]);

	// ---- Advance delay changed while feedback is up: restart the wait ----
	useEffect(() => {
		if (answer) scheduleAdvance(answer.correct);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [settings.advanceDelay]);

	// ---- Audio (client only), 10% volume ----
	useEffect(() => {
		yesSound.current = new Audio("/sounds/yesmp3.mp3");
		noSound.current = new Audio("/sounds/nomp3.mp3");
		for (const a of [yesSound.current, noSound.current]) {
			a.volume = 0.1;
			a.preload = "auto";
		}
	}, []);

	// ---- Unmount: no timer may fire into an unmounted page ----
	useEffect(
		() => () => {
			clearTimeout(timerRef.current);
			setBgOrigin(null);
		},
		[],
	);

	// ---- Background: effects radiate from the sentence; publish the scope ----
	useEffect(() => {
		const el = promptRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		setBgOrigin(r.left + r.width / 2, r.top + r.height / 2);
	}, [question]);

	useEffect(() => {
		if (!hydrated) return;
		const cur = question ? question.key : null;
		setBgWords(scope.usable.map((word) => ({ word, current: word === cur })));
	}, [hydrated, scope, question]);

	function playSound(ref) {
		if (!settingsRef.current.feedbackSounds || !ref.current) return;
		try {
			ref.current.currentTime = 0;
			ref.current.play().catch(() => {});
		} catch {
			/* autoplay rejections are fine */
		}
	}

	function scheduleAdvance(correct) {
		clearTimer();
		const delay = settingsRef.current.advanceDelay;
		if (delay === ADVANCE_DELAY_MANUAL) return;
		const seconds = correct ? Number(delay) : Math.max(Number(delay), WRONG_MIN_SECONDS);
		timerRef.current = setTimeout(() => advanceRef.current(), Math.round(seconds * 1000));
	}

	function advance() {
		clearTimer();
		const deck = deckRef.current;
		if (!deck.length) return;
		const next = position + 1;
		if (next >= deck.length) {
			deal(scope.usable, scope.keys, question ? question.key : null);
			return;
		}
		setPosition(next);
		showCard(deck[next], scope.keys);
	}
	// Timers call through this ref so they always see the current render.
	const advanceRef = useRef(advance);
	advanceRef.current = advance;

	function choose(idx) {
		if (!question || answer || confirmReset) return;
		const correct = idx === question.correctIndex;
		setAnswer({ picked: idx, correct });
		playSound(correct ? yesSound : noSound);
		bgEvent(correct ? "ok" : "bad");
		scheduleAdvance(correct);
	}

	// ---- Keys: 1 to 4 answer; Enter or Space advances past feedback ----
	const keyRef = useRef(null);
	keyRef.current = (e) => {
		if (e.ctrlKey || e.metaKey || e.altKey || confirmReset || !question) return;
		const t = e.target;
		if (t && (t.isContentEditable || ["SELECT", "INPUT", "TEXTAREA"].includes(t.tagName))) return;
		if (answer) {
			if (e.key !== "Enter" && e.key !== " ") return;
			// Leave other focused controls (the header pills) their own Enter/Space.
			if (t && ["BUTTON", "A"].includes(t.tagName) && !t.classList.contains("ch-continue")) return;
			e.preventDefault();
			if (!e.repeat) advance();
			return;
		}
		if (e.repeat) return;
		const idx = ANSWER_KEYS.indexOf(e.key);
		if (idx === -1 || idx >= question.options.length) return;
		e.preventDefault();
		choose(idx);
	};
	useEffect(() => {
		const onKey = (e) => keyRef.current && keyRef.current(e);
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// ---- Header actions ----
	function changeDelay(value) {
		const v = value === ADVANCE_DELAY_MANUAL ? value : Number(value);
		setSettings(saveSettings({ advanceDelay: v }));
	}

	function toggleSounds() {
		setSettings(saveSettings({ feedbackSounds: !settings.feedbackSounds }));
	}

	function performReset() {
		setConfirmReset(false);
		deal(scope.usable, scope.keys, null);
	}

	function leavePack() {
		sigRef.current = "all";
		window.history.replaceState(window.history.state, "", window.location.pathname + window.location.hash);
		startScope(ALL_KEYS, null, null);
	}

	// ---- Render ----
	const total = scope.usable.length;
	const current = Math.min(position + 1, total);
	const pct = total ? Math.round((current / total) * 100) : 0;
	const packName = inPack ? scope.title || "Selected words" : "All words";
	const canReset = hydrated && position !== 0;

	const entry = question ? getWord(question.key) : null;
	const pickedEntry = question && answer && !answer.correct ? getWord(question.options[answer.picked]) : null;

	const progress =
		hydrated && total > 0 ? (
			<>
				<div
					className="bar"
					role="progressbar"
					aria-label="Position in the shuffled deck"
					aria-valuemin={1}
					aria-valuemax={total}
					aria-valuenow={current}
				>
					<i style={{ width: `${pct}%` }} />
				</div>
				<span>{`${current} of ${total}, shuffled`}</span>
			</>
		) : null;

	let body;
	if (!hydrated) {
		body = <p className="ch-loading">Loading…</p>;
	} else if (!total || !question || !entry) {
		body = (
			<div className="cx-empty">
				<p>None of the words in this pack has an example sentence that can be used here.</p>
				{inPack && (
					<button type="button" className="pill" onClick={leavePack}>
						Practice all words
					</button>
				)}
			</div>
		);
	} else {
		body = (
			<>
				<div className="ch-prompt">
					<p className="ch-ask">Which word best completes the sentence?</p>
					<p ref={promptRef} className="cx-sentence">
						{question.before}
						{answer ? (
							<mark className={`cx-form ${answer.correct ? "ok" : "bad"}`}>{question.form}</mark>
						) : (
							<span className="cx-blank">
								<span className="ch-sr">blank</span>
							</span>
						)}
						{question.after}
					</p>
				</div>

				<div className="ch-opts is-words" role="group" aria-label="Answer options">
					{question.options.map((word, i) => {
						const isAnswer = i === question.correctIndex;
						const tone = !answer ? "" : isAnswer ? "ok" : i === answer.picked ? "bad" : "dim";
						return (
							<button
								key={`${question.key}-${word}`}
								type="button"
								className={["ch-opt", tone].filter(Boolean).join(" ")}
								disabled={!!answer}
								aria-keyshortcuts={String(i + 1)}
								onClick={() => choose(i)}
							>
								<kbd className="k">{i + 1}</kbd>
								<span className="ch-opt-text">{word}</span>
								<span className="ch-mark">
									{tone === "ok" && (
										<>
											<CheckIcon />
											<span className="ch-sr">Correct answer</span>
										</>
									)}
									{tone === "bad" && (
										<>
											<CrossIcon />
											<span className="ch-sr">Your answer</span>
										</>
									)}
								</span>
							</button>
						);
					})}
				</div>

				<div className="ch-fb" aria-live="polite">
					{answer && (
						<>
							{answer.correct ? (
								<p className="ch-fb-line ok">
									<span className="ch-fb-icon">
										<CheckIcon />
									</span>
									Correct.
								</p>
							) : (
								<p className="ch-fb-line bad">
									<span className="ch-fb-icon">
										<CrossIcon />
									</span>
									<span>
										Not quite. The word is <strong>{entry.word}</strong>.
									</span>
								</p>
							)}
							<div className="ch-card">
								<div className="hw">{entry.word}</div>
								<div className="gloss">{withPeriod(entry.definition)}</div>
								{pickedEntry && (
									<div className="cx-picked">
										<span className="cx-picked-label">You chose</span>
										<div className="cx-picked-word">{pickedEntry.word}</div>
										<div className="gloss">{withPeriod(pickedEntry.definition)}</div>
									</div>
								)}
							</div>
						</>
					)}
				</div>

				{answer ? (
					<button type="button" className="ch-continue" onClick={advance}>
						{manual ? "Press Enter to continue" : "Continue"} <kbd>Enter</kbd>
					</button>
				) : (
					<p className="ch-keys">
						Press <kbd>1</kbd> to <kbd>4</kbd> to answer
					</p>
				)}
			</>
		);
	}

	return (
		<div className="ch-page cx-page">
			<PlayHeader title={TITLE} packName={hydrated ? packName : undefined} progress={progress} ready={hydrated}>
				{canReset && (
					<button type="button" className="pill" onClick={() => setConfirmReset(true)}>
						Reshuffle
					</button>
				)}
				{inPack && (
					<button type="button" className="pill" onClick={leavePack}>
						Leave pack
					</button>
				)}
				<button type="button" className="pill" aria-pressed={settings.feedbackSounds} onClick={toggleSounds}>
					{settings.feedbackSounds ? "Sound on" : "Sound off"}
				</button>
				<label className="ch-delay">
					<span className="ch-sr">Advance after a correct answer</span>
					<select className="select" value={String(settings.advanceDelay)} onChange={(e) => changeDelay(e.target.value)}>
						{ADVANCE_DELAY_OPTIONS.map((o) => (
							<option key={String(o)} value={String(o)}>
								{o === ADVANCE_DELAY_MANUAL ? "Manual advance" : `Next in ${ADVANCE_DELAY_LABEL[String(o)]}`}
							</option>
						))}
					</select>
				</label>
			</PlayHeader>
			{hydrated && missingPack && (
				<div className="notice" role="status">
					<p>{MISSING_PACK_NOTICE}</p>
					<button type="button" className="btn-q" onClick={() => setMissingPack(false)}>
						Dismiss
					</button>
				</div>
			)}

			<main className="ch-stage">
				<div className="ch-wrap">{body}</div>
			</main>

			{confirmReset && (
				<ConfirmDialog
					tone="neutral"
					title="Reshuffle and start over?"
					body="The sentences are shuffled again and start from the first card. Your mastery progress is not affected."
					confirmLabel="Reshuffle"
					onConfirm={performReset}
					onCancel={() => setConfirmReset(false)}
				/>
			)}
		</div>
	);
}
