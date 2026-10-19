/** @format */
"use client";

// Daily review: typed recall over the words lib/review.js says are due today,
// across every pack, capped at DEFAULT_REVIEW_CAP per direction per day.
// Ported from Wortschatz's ReviewMode.
//
// It never touches pack progress: the only thing it writes is the review
// schedule, through recordReviewAnswer, and only for a word's FIRST answer of
// the session. A miss re-queues the word a few cards later (lib/review.js
// createReviewSession) and it must be answered correctly before the session
// ends. Grading is lib/matching.js, the same rules as Test mode: the 0.6
// definition threshold in Word → Definition, the headword rules (with
// near-duplicate synonyms accepted) in Definition → Word.
import { useEffect, useRef, useState } from "react";
import vocab from "../src/data/gre_combined.json";
import "../styles/review.css";
import PlayHeader from "./PlayHeader";
import { getWord } from "../lib/words";
import { gradeDefinition, gradeHeadwordWithNearDuplicates } from "../lib/matching";
import { meaningGroupsReady } from "../lib/distractors";
import { createReviewSession, wordReviewOpts, DEFAULT_REVIEW_CAP } from "../lib/review";
import { loadReviewQueue, recordReviewAnswer } from "../lib/progress";
import { blankMiss, isBlankAnswer } from "./test/engine";
import {
	loadSettings,
	saveSettings,
	DEFAULT_SETTINGS,
	DIRECTION_D2W,
	DIRECTION_LABEL,
	ADVANCE_DELAY_MANUAL,
	ADVANCE_DELAY_OPTIONS,
	ADVANCE_DELAY_LABEL,
} from "../lib/settings";
import { bgEvent, setBgOrigin, setBgWords } from "../lib/backgrounds/bus";

const REVIEW_OPTS = wordReviewOpts(vocab);
const REVIEW_CAP = DEFAULT_REVIEW_CAP; // lib/settings.js has no reviewCap setting yet

function parseDelay(value) {
	return value === ADVANCE_DELAY_MANUAL ? ADVANCE_DELAY_MANUAL : Number(value);
}

// The full answer card shown after a miss and in the summary.
function WordCard({ entry }) {
	if (!entry) return null;
	return (
		<div className="rv-card">
			<div className="rv-card-head">
				<span className="rv-card-word">{entry.word}</span>
				{entry.pos && <span className="rv-card-pos">{entry.pos}</span>}
			</div>
			<p className="rv-card-def">{entry.definition}</p>
			{entry.fullDefinition && <p className="rv-card-full">{entry.fullDefinition}</p>}
			{entry.example && <p className="rv-card-ex">{entry.example}</p>}
		</div>
	);
}

export default function ReviewMode() {
	const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS }));
	const [hydrated, setHydrated] = useState(false);
	const [queueInfo, setQueueInfo] = useState({ due: 0, remaining: 0, total: 0 });
	const [currentKey, setCurrentKey] = useState(null);
	const [attempt, setAttempt] = useState(0);
	const [inputValue, setInputValue] = useState("");
	// { correct, exact, entry, acceptedKey }
	const [feedback, setFeedback] = useState(null);
	// "correct" while correct-answer feedback waits on the advance delay,
	// "miss" while a miss waits for the learner to continue; null otherwise.
	const [waiting, setWaiting] = useState(null);
	const [summary, setSummary] = useState(null);
	const [progress, setProgress] = useState({ done: 0, total: 0 });

	const sessionRef = useRef(null);
	const submitLockRef = useRef(false);
	const advanceTimer = useRef(null);
	const inputRef = useRef(null);
	const yesSound = useRef(null);
	const noSound = useRef(null);

	const direction = settings.direction;
	const d2w = direction === DIRECTION_D2W;

	function startSession(s) {
		clearTimeout(advanceTimer.current);
		const q = loadReviewQueue(s.direction, REVIEW_CAP, REVIEW_OPTS);
		// lib/review.js already drops unknown keys; this second filter means a
		// stale key can never reach the renderer either way.
		const keys = q.keys.filter((k) => REVIEW_OPTS.isKnown(k));
		// Every review word is mastered somewhere, so the background shows them lit.
		setBgWords(keys.map((word) => ({ word, mastered: true })));
		const session = createReviewSession(keys);
		sessionRef.current = session;
		setQueueInfo({ due: q.due, remaining: q.remaining, total: keys.length });
		setProgress({ done: 0, total: keys.length });
		setFeedback(null);
		setWaiting(null);
		setInputValue("");
		setSummary(keys.length ? null : session.stats());
		showNext(session);
	}

	function showNext(session) {
		submitLockRef.current = false;
		const key = session.next();
		setCurrentKey(key);
		setAttempt((n) => n + 1);
		if (key === null) setSummary(session.stats());
	}

	// ---- Hydrate after mount: settings and the review store are client-only ----
	// The first card waits for the meaning groups (at most
	// MEANING_GROUPS_TIMEOUT_MS), so the first Definition -> Word grade accepts
	// the same synonyms as every later one.
	useEffect(() => {
		let alive = true;
		meaningGroupsReady.then(() => {
			if (!alive) return;
			const s = loadSettings();
			setSettings(s);
			startSession(s);
			setHydrated(true);
		});
		return () => {
			alive = false;
			clearTimeout(advanceTimer.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (typeof Audio === "undefined") return;
		yesSound.current = new Audio("/sounds/yesmp3.mp3");
		noSound.current = new Audio("/sounds/nomp3.mp3");
		[yesSound.current, noSound.current].forEach((a) => {
			a.volume = 0.1;
			a.preload = "auto";
		});
	}, []);

	// Background effects radiate from the centre of the prompt.
	useEffect(() => {
		const el = typeof document !== "undefined" ? document.querySelector(".rv-prompt-main") : null;
		if (!el) return;
		const r = el.getBoundingClientRect();
		setBgOrigin(r.left + r.width / 2, r.top + r.height / 2);
	}, [attempt, currentKey]);
	useEffect(() => () => setBgOrigin(null), []);

	useEffect(() => {
		if (hydrated && currentKey && !waiting) inputRef.current?.focus({ preventScroll: true });
	}, [attempt, currentKey, waiting, hydrated]);

	// Enter or Space moves on from a miss, and from correct feedback under a
	// "manual" advance delay. A held Enter's autorepeat never counts.
	const keyWait = waiting === "miss" || (waiting === "correct" && settings.advanceDelay === ADVANCE_DELAY_MANUAL);
	useEffect(() => {
		if (!keyWait) return;
		function onKey(e) {
			if (e.repeat) return;
			if (e.key === "Enter" || e.key === " " || e.code === "Space") {
				e.preventDefault();
				advance();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [keyWait]);

	function playSound(ref) {
		if (!settings.feedbackSounds || !ref.current) return;
		try {
			ref.current.currentTime = 0;
			ref.current.play().catch(() => {});
		} catch {
			/* ignore autoplay rejections */
		}
	}

	function advance() {
		clearTimeout(advanceTimer.current);
		setWaiting(null);
		setFeedback(null);
		setInputValue("");
		if (sessionRef.current) showNext(sessionRef.current);
	}

	const currentEntry = currentKey ? getWord(currentKey) : null;

	function handleSubmit(e) {
		e.preventDefault();
		const session = sessionRef.current;
		if (!session || !currentEntry || waiting || submitLockRef.current) return;
		submitLockRef.current = true;

		// w2d also accepts the entry's alternative short definitions, which only the
		// raw vocabulary carries. An empty submit is "I don't know": a miss.
		const raw = vocab && vocab[currentKey];
		const result = isBlankAnswer(inputValue)
			? blankMiss(currentKey, currentEntry, d2w ? "d2w" : "w2d")
			: d2w
				? gradeHeadwordWithNearDuplicates(currentKey, inputValue, vocab)
				: gradeDefinition({ ...currentEntry, alts: raw ? raw.alts : undefined }, inputValue);
		const { firstAnswer } = session.record(currentKey, result.correct);
		// Only the first answer of the session moves the schedule; a retry after
		// a miss is practice, and the word already went back to one day.
		if (firstAnswer) recordReviewAnswer(direction, currentKey, result.correct);
		const st = session.stats();
		setProgress({ done: st.done, total: st.total });

		setFeedback({ correct: result.correct, exact: result.exact, entry: currentEntry, acceptedKey: result.acceptedKey || null });
		setInputValue("");
		bgEvent(result.correct ? "ok" : "bad");
		if (result.correct) {
			playSound(yesSound);
			setWaiting("correct");
			if (settings.advanceDelay !== ADVANCE_DELAY_MANUAL) {
				clearTimeout(advanceTimer.current);
				advanceTimer.current = setTimeout(advance, Math.round(Number(settings.advanceDelay) * 1000));
			}
		} else {
			// Held until the learner moves on. The word comes back later in this
			// session and must be answered correctly.
			playSound(noSound);
			setWaiting("miss");
		}
	}

	function switchDirection(dir) {
		if (dir === direction) return;
		const next = saveSettings({ direction: dir });
		setSettings(next);
		startSession(next);
	}

	function switchAdvanceDelay(value) {
		const delay = parseDelay(value);
		const next = saveSettings({ advanceDelay: delay });
		setSettings(next);
		if (waiting === "correct") {
			clearTimeout(advanceTimer.current);
			if (next.advanceDelay !== ADVANCE_DELAY_MANUAL) {
				advanceTimer.current = setTimeout(advance, Math.round(Number(next.advanceDelay) * 1000));
			}
		}
	}

	let inputClass = "rv-input";
	if (waiting === "correct") inputClass += " ok";
	else if (waiting === "miss") inputClass += " bad";

	const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
	const capReached = queueInfo.remaining === 0 && queueInfo.due > 0;

	function renderSummary() {
		if (!summary || summary.total === 0) {
			return (
				<div className="rv-done rv-empty">
					<h2>{capReached ? "Today's reviews are done" : "Nothing due today"}</h2>
					<p>
						{capReached
							? `You reached today's limit of ${REVIEW_CAP} reviews. ${queueInfo.due} more ${
									queueInfo.due === 1 ? "word is" : "words are"
								} due and will wait for tomorrow.`
							: `No mastered words are due for review in ${DIRECTION_LABEL[direction]}. Words come back here one day after you master them, then at growing intervals.`}
					</p>
					<div className="rv-acts">
						<a className="btn-p" href="/">
							Menu
						</a>
						{!capReached && (
							<a className="btn-s" href="/play/test">
								Start studying
							</a>
						)}
					</div>
				</div>
			);
		}
		const leftToday = queueInfo.due - summary.reviewed;
		const missed = summary.missed
			.map((m) => ({ entry: getWord(m.key), misses: m.misses }))
			.filter((m) => m.entry)
			.sort((a, b) => b.misses - a.misses);
		const canReviewMore = leftToday > 0 && queueInfo.remaining - summary.reviewed > 0;
		return (
			<div className="rv-done">
				<h2>{missed.length ? "Review complete" : "Perfect review"}</h2>
				<p className="rv-hero">
					<strong>
						{summary.correctFirstTry} of {summary.reviewed}
					</strong>{" "}
					correct on the first try
				</p>
				{missed.length > 0 ? (
					<>
						<p className="rv-missed-title">Missed, back tomorrow:</p>
						<ul className="rv-missed">
							{missed.map((m) => (
								<li key={m.entry.word}>
									<span className="rv-missed-word">{m.entry.word}</span>
									<span className="rv-missed-def">{m.entry.definition}</span>
								</li>
							))}
						</ul>
					</>
				) : (
					<p>Every word reviewed today was correct on the first try.</p>
				)}
				<div className="rv-acts">
					<a className="btn-p" href="/">
						Menu
					</a>
					{canReviewMore && (
						<button type="button" className="btn-q" onClick={() => startSession(settings)}>
							Review more
						</button>
					)}
				</div>
			</div>
		);
	}

	const headerProgress = (
		<>
			<div className="bar" role="progressbar" aria-label="Reviewed" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
				<i style={{ width: `${pct}%` }} />
			</div>
			<span>
				{progress.done} of {progress.total} done
			</span>
		</>
	);

	return (
		<div className="rv-page">
			<PlayHeader
				title="Daily review"
				packName="All packs"
				progress={headerProgress}
				direction={direction}
				onDirectionChange={switchDirection}
				ready={hydrated}
			>
				<select
					className="select"
					aria-label="Auto-advance delay"
					title="Auto-advance delay after a correct answer"
					value={String(settings.advanceDelay)}
					onChange={(e) => switchAdvanceDelay(e.target.value)}
				>
					{ADVANCE_DELAY_OPTIONS.map((o) => (
						<option key={String(o)} value={String(o)}>
							{ADVANCE_DELAY_LABEL[String(o)]}
						</option>
					))}
				</select>
			</PlayHeader>

			<main className="rv-stage">
				<div className="rv-wrap">
					{!hydrated ? (
						<p className="rv-loading">Loading…</p>
					) : summary ? (
						renderSummary()
					) : (
						<div className="rv-block">
							<div className="rv-prompt">
								<div className={`rv-prompt-main${d2w ? " def" : ""}`}>{currentEntry ? (d2w ? currentEntry.definition : currentEntry.word) : "…"}</div>
								{currentEntry && currentEntry.pos && <div className="rv-prompt-hint">{currentEntry.pos}</div>}
							</div>

							<form className="rv-answer" onSubmit={handleSubmit} autoComplete="off">
								<div className="rv-answer-row">
									<input
										ref={inputRef}
										type="text"
										className={inputClass}
										value={inputValue}
										onChange={(e) => setInputValue(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && e.repeat) e.preventDefault();
										}}
										placeholder={d2w ? "Type the word" : "Type the definition"}
										autoComplete="off"
										autoCapitalize="off"
										autoCorrect="off"
										spellCheck={false}
										disabled={!!waiting}
										aria-label="Your answer"
									/>
									<button type="submit" className="btn-p" disabled={!!waiting}>
										Check
									</button>
								</div>

								<div className="rv-fb" aria-live="polite">
									{feedback && (
										<>
											<div className={`rv-fb-line ${feedback.correct ? "ok" : "bad"}`}>
												{feedback.correct ? "Correct" : "Not quite. This word comes back before the session ends."}
											</div>
											{feedback.correct && d2w && feedback.acceptedKey && feedback.acceptedKey !== currentKey && (
												<p className="rv-fb-note">
													Correct. <strong>{feedback.acceptedKey}</strong> works too; the word here was <strong>{feedback.entry.word}</strong>.
												</p>
											)}
											{feedback.correct && d2w && !feedback.exact && feedback.acceptedKey === currentKey && (
												<p className="rv-fb-note">
													Spelled: <strong>{feedback.entry.word}</strong>
												</p>
											)}
											{feedback.correct && !d2w && !feedback.exact && (
												<p className="rv-fb-note">
													Definition: <strong>{feedback.entry.definition}</strong>
												</p>
											)}
											{!feedback.correct && <WordCard entry={feedback.entry} />}
										</>
									)}
									{keyWait && (
										<button type="button" className="rv-continue" onClick={advance}>
											Press <kbd>Enter</kbd> to continue
										</button>
									)}
								</div>
							</form>
						</div>
					)}
				</div>
			</main>
		</div>
	);
}
