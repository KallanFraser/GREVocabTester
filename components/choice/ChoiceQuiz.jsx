/** @format */
"use client";

// Shared multiple-choice engine behind Practice and Learn, ported from
// Wortschatz's components/QuizMode.jsx. No mastery is recorded. `variant`
// decides the order:
//   "practice"  sequential through the scope; the position is saved per scope
//               in gv_practice_pos = { <scopeId>: index }
//   "learn"     a crypto-shuffled deck, no repeats until it runs out, then a
//               fresh shuffle; the deck lives in component state only
//
// Pack-aware through lib/packs.js resolvePackContext. The URL is the source of
// truth: once a context resolves, the address bar is rewritten to its stable
// form (?pack=<id> or ?words=a,b,c), so a reload or a shared link opens the
// same words. The old one-time handoff is accepted on the first resolve only,
// so "Leave pack" cannot bring it back.
//
// Randomness (option order, distractors, the Learn deck) comes from
// crypto.getRandomValues and only ever runs in effects and event handlers.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PlayHeader from "../PlayHeader";
import ConfirmDialog from "../ConfirmDialog";
import { WORDS, getWord } from "../../lib/words";
import {
	pickDistractors,
	cryptoRng,
	isConfusable,
	isNearDuplicateDefinition,
	isSameRoot,
} from "../../lib/distractors";
import {
	loadSettings,
	saveSettings,
	SETTINGS_EVENT,
	DEFAULT_SETTINGS,
	DIRECTION_D2W,
	ADVANCE_DELAY_MANUAL,
	ADVANCE_DELAY_OPTIONS,
	ADVANCE_DELAY_LABEL,
} from "../../lib/settings";
import { MISSING_PACK_NOTICE, isMissingPack, resolvePackContext } from "../../lib/packs";
import { scopeIdFor } from "../../lib/progress";
import * as storage from "../../lib/storage";
import { bgEvent, setBgOrigin, setBgWords } from "../../lib/backgrounds/bus";
import "../../styles/choice.css";

const ALL_KEYS = WORDS.map((e) => e.word);
const OPTION_COUNT = 4;
const PRACTICE_POS_KEY = "gv_practice_pos";
// A wrong answer reveals the answer and an example sentence, so its automatic
// advance never comes sooner than this, whatever the delay setting.
const WRONG_MIN_SECONDS = 3;
const ANSWER_KEYS = ["1", "2", "3", "4"];
const PACK_PARAMS = ["pack", "words", "id"];

const MODE = {
	practice: { title: "Practice", resetLabel: "Restart" },
	learn: { title: "Random Practice", resetLabel: "Reshuffle" },
};

// ---- Practice position: gv_practice_pos ----

function isPlainObject(v) {
	return !!v && typeof v === "object" && !Array.isArray(v);
}

function loadPracticePos(scopeId) {
	const all = storage.get(PRACTICE_POS_KEY, null);
	const n = isPlainObject(all) ? all[scopeId] : undefined;
	return Number.isInteger(n) && n >= 0 ? n : 0;
}

function savePracticePos(scopeId, index) {
	const all = storage.get(PRACTICE_POS_KEY, null);
	storage.set(PRACTICE_POS_KEY, { ...(isPlainObject(all) ? all : {}), [scopeId]: index });
}

// The key a position is saved under: the pack id, "all" for the full list, or
// for an ad-hoc selection (?words=) the word list itself, so two different
// selections never share a place.
function practiceScopeId(packId, keys) {
	if (packId) return scopeIdFor(packId);
	if (keys === ALL_KEYS) return scopeIdFor(null);
	return scopeIdFor(`words:${keys.join(",")}`);
}

// ---- Questions ----

function cryptoShuffle(list) {
	const a = [...list];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.min(i, Math.floor(cryptoRng() * (i + 1)));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// Same test pickDistractors applies between its own picks: could `a` pass as
// a second correct answer next to `b`?
function clashes(a, b) {
	return (
		a.word === b.word ||
		isSameRoot(a.word, b.word) ||
		isConfusable(a.word, b.word) ||
		isNearDuplicateDefinition(a.definition, b.definition)
	);
}

// Distractors come from the scope first (a pack's own words are the useful
// confusions). A small pack, or one whose words clash with each other, is
// topped up from the full list, never offering anything that clashes with an
// option already chosen.
function buildQuestion(key, scopeKeys, direction) {
	const target = getWord(key);
	const need = OPTION_COUNT - 1;
	let picked = scopeKeys.length > 1 ? pickDistractors(target, need, { direction, pool: scopeKeys }) : [];
	if (picked.length < need) {
		const pool = WORDS.filter((e) => !picked.some((p) => clashes(e, p)));
		picked = picked.concat(pickDistractors(target, need - picked.length, { direction, pool }));
	}
	const options = cryptoShuffle([target, ...picked]).map((e) => e.word);
	return { key: target.word, options, correctIndex: options.indexOf(target.word), direction };
}

function stripQuotes(s) {
	return String(s || "")
		.trim()
		.replace(/^["“”']+|["“”']+$/g, "");
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
// fallback in app/play/*/page.jsx): the same frame, controls hidden.
export function ChoiceFallback({ variant = "practice" }) {
	const mode = MODE[variant] || MODE.practice;
	return (
		<div className="ch-page">
			<PlayHeader title={mode.title} ready={false} />
			<main className="ch-stage">
				<div className="ch-wrap">
					<p className="ch-loading">Loading…</p>
				</div>
			</main>
		</div>
	);
}

export default function ChoiceQuiz({ variant = "practice" }) {
	const mode = MODE[variant] || MODE.practice;
	const isPractice = variant === "practice";
	const search = useSearchParams().toString();

	const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS }));
	const [hydrated, setHydrated] = useState(false);
	const [scope, setScope] = useState({ keys: ALL_KEYS, packId: null, title: null });
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
	const scopeId = practiceScopeId(scope.packId, scope.keys);
	const direction = settings.direction;
	const manual = settings.advanceDelay === ADVANCE_DELAY_MANUAL;

	function clearTimer() {
		clearTimeout(timerRef.current);
		timerRef.current = null;
	}

	function showCard(key, keys, dir = settingsRef.current.direction) {
		clearTimer();
		setAnswer(null);
		setQuestion(buildQuestion(key, keys, dir));
	}

	// Start (or restart) a scope: Practice resumes its saved place, Learn deals
	// a fresh shuffle.
	function startScope(keys, packId, title) {
		clearTimer();
		setConfirmReset(false);
		setScope({ keys, packId, title });
		if (isPractice) {
			const sid = practiceScopeId(packId, keys);
			let pos = loadPracticePos(sid);
			if (pos >= keys.length) pos = 0;
			setPosition(pos);
			showCard(keys[pos], keys);
		} else {
			const deck = cryptoShuffle(keys);
			deckRef.current = deck;
			setPosition(0);
			showCard(deck[0], keys);
		}
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

	// ---- Direction changed (here or elsewhere): rebuild the card in place ----
	useEffect(() => {
		if (question && question.direction !== direction) showCard(question.key, scope.keys, direction);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [direction]);

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

	// ---- Background: effects radiate from the prompt; publish the scope ----
	useEffect(() => {
		const el = promptRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		setBgOrigin(r.left + r.width / 2, r.top + r.height / 2);
	}, [question]);

	useEffect(() => {
		if (!hydrated) return;
		const cur = question ? question.key : null;
		setBgWords(scope.keys.map((word) => ({ word, current: word === cur })));
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
		const keys = scope.keys;
		if (!keys.length) return;
		if (isPractice) {
			const next = position + 1 >= keys.length ? 0 : position + 1;
			setPosition(next);
			savePracticePos(scopeId, next);
			showCard(keys[next], keys);
		} else {
			let deck = deckRef.current;
			let next = position + 1;
			if (next >= deck.length) {
				deck = cryptoShuffle(keys);
				// No immediate repeat across the reshuffle.
				if (deck.length > 1 && question && deck[0] === question.key) [deck[0], deck[1]] = [deck[1], deck[0]];
				deckRef.current = deck;
				next = 0;
			}
			setPosition(next);
			showCard(deck[next], keys);
		}
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
	function changeDirection(next) {
		setSettings(saveSettings({ direction: next }));
	}

	function changeDelay(value) {
		const v = value === ADVANCE_DELAY_MANUAL ? value : Number(value);
		setSettings(saveSettings({ advanceDelay: v }));
	}

	function toggleSounds() {
		setSettings(saveSettings({ feedbackSounds: !settings.feedbackSounds }));
	}

	// Restart and Reshuffle only move the place in the list; nothing is erased.
	function performReset() {
		setConfirmReset(false);
		const keys = scope.keys;
		if (isPractice) {
			savePracticePos(scopeId, 0);
			setPosition(0);
			showCard(keys[0], keys);
		} else {
			const deck = cryptoShuffle(keys);
			deckRef.current = deck;
			setPosition(0);
			showCard(deck[0], keys);
		}
	}

	function leavePack() {
		sigRef.current = "all";
		window.history.replaceState(window.history.state, "", window.location.pathname + window.location.hash);
		startScope(ALL_KEYS, null, null);
	}

	// ---- Render ----
	const total = scope.keys.length;
	const current = Math.min(position + 1, total);
	const pct = total ? Math.round((current / total) * 100) : 0;
	const counter = isPractice ? `Word ${current} of ${total}` : `${current} of ${total}, shuffled`;
	const packName = inPack ? scope.title || "Selected words" : "All words";
	const canReset = hydrated && position !== 0;

	const entry = question ? getWord(question.key) : null;
	const d2w = question ? question.direction === DIRECTION_D2W : direction === DIRECTION_D2W;
	const optionText = (word) => {
		const e = getWord(word);
		return d2w ? e.word : e.definition;
	};
	const example = entry ? stripQuotes(entry.example) : "";

	const progress =
		hydrated && total > 0 ? (
			<>
				<div
					className="bar"
					role="progressbar"
					aria-label={isPractice ? "Position in the word list" : "Position in the shuffled deck"}
					aria-valuemin={1}
					aria-valuemax={total}
					aria-valuenow={current}
				>
					<i style={{ width: `${pct}%` }} />
				</div>
				<span>{counter}</span>
			</>
		) : null;

	return (
		<div className="ch-page">
			<PlayHeader
				title={mode.title}
				packName={hydrated ? packName : undefined}
				progress={progress}
				direction={direction}
				onDirectionChange={changeDirection}
				ready={hydrated}
			>
				{canReset && (
					<button type="button" className="pill" onClick={() => setConfirmReset(true)}>
						{mode.resetLabel}
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
				<div className="ch-wrap">
					{!hydrated || !question || !entry ? (
						<p className="ch-loading">Loading…</p>
					) : (
						<>
							<div className="ch-prompt">
								<p className="ch-ask">{d2w ? "Which word matches this definition?" : "What does this word mean?"}</p>
								<div ref={promptRef} className={d2w ? "ch-prompt-def" : "ch-prompt-word"}>
									{d2w ? entry.definition : entry.word}
								</div>
							</div>

							<div className={`ch-opts${d2w ? " is-words" : ""}`} role="group" aria-label="Answer options">
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
											<span className="ch-opt-text">{optionText(word)}</span>
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
								{answer &&
									(answer.correct ? (
										<p className="ch-fb-line ok">
											<span className="ch-fb-icon">
												<CheckIcon />
											</span>
											Correct.
										</p>
									) : (
										<>
											<p className="ch-fb-line bad">
												<span className="ch-fb-icon">
													<CrossIcon />
												</span>
												<span>
													{d2w ? (
														<>
															Not quite. The word is <strong>{entry.word}</strong>.
														</>
													) : (
														<>
															Not quite. <strong>{entry.word}</strong> means &ldquo;{withPeriod(entry.definition)}&rdquo;
														</>
													)}
												</span>
											</p>
											<div className="ch-card">
												<div className="hw">{entry.word}</div>
												<div className="gloss">{entry.definition}</div>
												{example && <p className="ex">{example}</p>}
											</div>
										</>
									))}
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
					)}
				</div>
			</main>

			{confirmReset && (
				<ConfirmDialog
					tone="neutral"
					title={isPractice ? "Restart from the first word?" : "Reshuffle and start over?"}
					body={
						isPractice
							? `Your place in ${inPack ? "this pack" : "the word list"} goes back to the first word. Your mastery progress is not affected.`
							: "The deck is shuffled again and starts from the first card. Your mastery progress is not affected."
					}
					confirmLabel={mode.resetLabel}
					onConfirm={performReset}
					onCancel={() => setConfirmReset(false)}
				/>
			)}
		</div>
	);
}
