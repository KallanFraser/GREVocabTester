/** @format */
"use client";

// Test mode (/play/test), a port of Wortschatz's Test mode.
//
// Normal: a visible pool of five words, each with its streak; four correct in
// a row masters a word, which leaves the pool and is replaced at random
// (lib/pool.js). A miss resets the streak, shows the full answer card and asks
// the same word again. A finished scope shows the completion screen; a reset
// of a finished scope starts the next round, so best mastery persists.
// Harder: lib/hard-scheduler.js over every word in scope, saved per answer in
// gv_hard_<dir> (never Normal progress), resumable, with a best first-try %.
// Words it retires go on the daily review ladder.
//
// Rules carried over from Wortschatz (see design/overhaul/wortschatz-inventory.md):
//   - storage and settings are read after mount only (no hydration mismatch);
//     the header's dynamic parts stay hidden until then (L23);
//   - nothing random runs during render: pools, schedulers and picks are drawn
//     in effects and handlers and kept in state;
//   - the only wait between grading and the next word is one timer of the
//     advance delay; every animation is an overlay that plays on (L17);
//   - every timer is cleared on unmount and when direction, difficulty, pack or
//     delay change; held Enter never grades a blank answer (L19).

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import "../styles/testmode.css";
import PlayHeader from "./PlayHeader";
import ConfirmDialog from "./ConfirmDialog";
import ChooseWords from "./test/ChooseWords";
import SessionSummary from "./test/SessionSummary";
import AnswerCard from "./test/AnswerCard";
import SearchParamsReader from "./test/SearchParamsReader";
import { MasteryToast, burstConfetti, flyToBar, popPip, prefersReducedMotion } from "./test/MasteryFx";
import {
	DIFFICULTIES,
	DIFFICULTY_HARDER,
	DIFFICULTY_LABEL,
	DIFFICULTY_NORMAL,
	allWordsRun,
	countIn,
	gradeFor,
	isBlankAnswer,
	minSelection,
	missedRows,
	normalAnswer,
	poolLabel,
	promptFor,
	resolveDifficulty,
	resumePool,
	runFromContext,
	runSignature,
	runStreaks,
	saveDifficulty,
	selectionRun,
	winNames,
} from "./test/engine";
import { WORDS, getWord } from "../lib/words";
import {
	ADVANCE_DELAY_LABEL,
	ADVANCE_DELAY_MANUAL,
	ADVANCE_DELAY_OPTIONS,
	DEFAULT_SETTINGS,
	DIRECTION_LABEL,
	loadSettings,
	saveSettings,
} from "../lib/settings";
import {
	POOL_SIZE,
	SAVE_FAILED_EVENT,
	WORD_STREAK_TO_MASTER,
	allMastered,
	clearScopeKeys,
	clearScopeProgress,
	enrollReview,
	hardBestPct,
	hardRunScope,
	hasProgress,
	loadHardProgress,
	loadKnown,
	loadProgress,
	markScopeComplete,
	packSummary,
	recordHardRun,
	restartHardRun,
	saveHardRun,
	saveHasFailed,
	saveLastPack,
	saveProgress,
} from "../lib/progress";
import { wordReviewOpts } from "../lib/review";
import { MISSING_PACK_NOTICE, isMissingPack, resolvePackContext } from "../lib/packs";
import {
	HARD_RELEARN_CORRECT,
	WORD_LEARNING,
	WORD_RETIRED,
	createHardScheduler,
	hardStateMatchesKeys,
	restoreHardScheduler,
} from "../lib/hard-scheduler";
import { bgEvent, setBgHeat, setBgOrigin, setBgWords } from "../lib/backgrounds/bus";

const VOCAB = Object.fromEntries(WORDS.map((e) => [e.word, e]));
const ALL_KEYS = WORDS.map((e) => e.word);
const REVIEW_OPTS = wordReviewOpts(VOCAB);
const lookupWord = (k) => VOCAB[k] || null;
const canonicalWord = (w) => {
	const e = getWord(w);
	return e ? e.word : null;
};

const COUNT_WORD = { 3: "Three", 4: "Four", 5: "Five" };
const HARDER_DESC =
	"words you get right on the first try are retired. Missed words come back until you get them right twice.";
// Fixed pause after a wrong answer in Harder, before the next card. It never
// follows the advance delay, which governs the correct-answer wait only.
const HARD_WRONG_DELAY_MS = 1200;
// Answer motion. None of it holds the next prompt back. The word glow belongs
// to the old word, so it is clamped to the delay; the pip pop, confetti, the
// flight into the bar and the toast play on over the next card.
const FX_GLOW_MS = 850;
const FX_FLIGHT_START_MS = 380;
const FX_BAR_GLOW_MS = 1100;
const TOAST_SHOW_MS = 1600;
const TOAST_FADE_MS = 400; // the .tm-toast.out transition has the same length
const TOAST_GAP_PX = 12;
// The Harder caption shows for CAPTION_SHOW_MS each time a run starts, then
// fades over CAPTION_FADE_MS (the CSS transition has the same length).
const CAPTION_SHOW_MS = 5000;
const CAPTION_FADE_MS = 1000;
const SAVE_FAILED_NOTICE =
	"Progress can't be saved in this browser. Storage may be full or blocked (for example in private browsing).";

const EMPTY_SESSION = { answers: 0, firstTries: 0, firstTryCorrect: 0 };

// Bring the address bar in line with what is running, so a reload or Back
// reopens it: a pack is always ?pack=<id>; a one-time handoff becomes ?words=;
// a link that resolved to nothing loses its pack parameters. A ?mode= has
// already been applied and saved, so it goes too: a reload after switching in
// the header keeps the switch. Never fatal.
function tidyUrl(ctx, run) {
	try {
		const url = new URL(window.location.href);
		const p = url.searchParams;
		const before = p.toString();
		p.delete("mode");
		if (run.packId) {
			p.set("pack", run.packId);
			p.delete("id");
			p.delete("words");
		} else if (run.subset) {
			if (ctx && ctx.source === "handoff") p.set("words", run.keys.join(","));
		} else {
			p.delete("pack");
			p.delete("id");
			p.delete("words");
		}
		const after = p.toString();
		if (after !== before) {
			window.history.replaceState(window.history.state, "", url.pathname + (after ? `?${after}` : "") + url.hash);
		}
	} catch {
		/* the URL is a convenience; the run still works */
	}
}

export default function TestMode() {
	const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS }));
	const [difficulty, setDifficulty] = useState(DIFFICULTY_NORMAL);
	const [hydrated, setHydrated] = useState(false);
	// The query string, from SearchParamsReader; null until it has reported.
	const [query, setQuery] = useState(null);
	const [run, setRun] = useState(() => allWordsRun(ALL_KEYS));
	// The keys of the running session: run.keys, or the missed words of a
	// "Drill missed words" session.
	const [runKeys, setRunKeys] = useState([]);
	const [mastered, setMastered] = useState(() => new Set());
	const [streaks, setStreaks] = useState({});
	const [pool, setPool] = useState([]);
	const [currentKey, setCurrentKey] = useState(null);
	// Bumped on every presentation, including a retry of the same word, so focus
	// is restored even when the same word is shown again.
	const [attempt, setAttempt] = useState(0);
	const [inputValue, setInputValue] = useState("");
	const [feedback, setFeedback] = useState(null);
	const [advancing, setAdvancing] = useState(false);
	const [showOverlay, setShowOverlay] = useState(false);
	const [confirmReset, setConfirmReset] = useState(false);
	// The word swapped into the pool by the latest mastery; its box pops in.
	const [freshKey, setFreshKey] = useState(null);
	// Session-only counters for the completion screen; never persisted.
	const [session, setSession] = useState(EMPTY_SESSION);
	// Harder.
	const [hardTemp, setHardTemp] = useState(false);
	const [hardSessionDone, setHardSessionDone] = useState(false);
	const [hardSummary, setHardSummary] = useState(null);
	const [hardLocked, setHardLocked] = useState(false);
	const [hardBest, setHardBest] = useState(null);
	const [hardRunId, setHardRunId] = useState(0);
	const [captionPhase, setCaptionPhase] = useState(null); // null | "on" | "fade"
	// Mastery motion: the bar holds its old count while the word flies to it.
	const [barHold, setBarHold] = useState(null);
	const [barGlow, setBarGlow] = useState(false);
	const [winOn, setWinOn] = useState(false);
	const [wordGone, setWordGone] = useState(false);
	const [toast, setToast] = useState(null);
	// A ?pack= or ?id= that named no pack; the run falls back to all words.
	const [missingPack, setMissingPack] = useState(false);
	// Shown the first time a progress or Harder write fails, once per page load.
	const [saveWarn, setSaveWarn] = useState(false);
	const saveWarnShownRef = useRef(false);

	const triedRef = useRef(false);
	// Synchronous double-submit guard, set the instant an answer is accepted.
	const submitLockRef = useRef(false);
	const hardSchedRef = useRef(null);
	// Where the running Harder run saves ({ direction, scopeId }), or null for a
	// temporary drill and once the run is recorded.
	const hardSaveRef = useRef(null);
	const hardWrongTimer = useRef(null);
	const advanceTimer = useRef(null);
	const pendingAdvanceRef = useRef(null);
	const runSigRef = useRef(null);
	const settingsRef = useRef(settings);
	const difficultyRef = useRef(difficulty);
	const hydratedRef = useRef(false);
	settingsRef.current = settings;
	difficultyRef.current = difficulty;

	const wordRef = useRef(null);
	const streakRef = useRef(null);
	const barRef = useRef(null);
	const formRef = useRef(null);
	const inputRef = useRef(null);
	const yesSound = useRef(null);
	const noSound = useRef(null);
	const fxTimers = useRef([]);
	const cancelConfettiRef = useRef(null);
	const cancelFlightRef = useRef(null);
	const launchFlightRef = useRef(null);
	const popStops = useRef(new Set());
	const toastTimers = useRef([]);
	const toastIdRef = useRef(0);

	const direction = settings.direction;
	const isHarder = difficulty === DIFFICULTY_HARDER;
	const inPack = Boolean(run.packId);
	const backHref = inPack ? "/wordpacks" : "/";
	const backLabel = inPack ? "Word Packs" : "Menu";

	// ---- Session plumbing ----

	function advanceTo(key) {
		releaseWordFx();
		triedRef.current = false;
		submitLockRef.current = false;
		setCurrentKey(key);
		setAttempt((n) => n + 1);
	}

	function resetSession() {
		setSession(EMPTY_SESSION);
		setFreshKey(null);
	}

	// Start a selection session over `keys` (default run.keys). Normal resumes
	// the scope's saved streaks for the current round (a reload keeps 2 / 4;
	// a reset or a new round clears them in storage first), with the words
	// part-way to mastery back in the pool; Harder resumes the run saved for this
	// scope, or starts one. Returns the first key, or null when there is nothing
	// to ask.
	function startSelectionSession(r, masteredSet, d, dir, opts = {}) {
		clearTimeout(hardWrongTimer.current);
		setHardLocked(false);
		setHardSessionDone(false);
		setHardSummary(null);
		const keys = opts.keys || r.keys;
		// The whole scope's streaks, since every Normal save writes them back.
		const saved = d === DIFFICULTY_HARDER ? {} : opts.streaks || {};
		setStreaks(saved);
		setRunKeys(keys);
		if (d === DIFFICULTY_HARDER) {
			setPool([]);
			return startHardRun(keys, {
				dir,
				sid: hardRunScope(r.scopeId, r.subset),
				fresh: Boolean(opts.fresh),
				temp: Boolean(opts.temp),
				exact: r.subset,
			});
		}
		hardSchedRef.current = null;
		hardSaveRef.current = null;
		setHardTemp(false);
		const p = resumePool(keys, masteredSet, saved);
		setPool(p);
		return p.length ? p[0] : null;
	}

	// Harder's scheduler. Unless `fresh` or `temp`, the saved run resumes
	// against the current keys; a restored run with nothing left is replaced by
	// a fresh one. A subset slot resumes only an exact key match. `temp` runs
	// (Drill missed words) never save, resume or record.
	function startHardRun(keys, { dir, sid, fresh, temp, exact }) {
		const target = !temp && dir && sid ? { direction: dir, scopeId: sid } : null;
		let s = null;
		if (target && !fresh) {
			const saved = loadHardProgress(dir, sid).run;
			if (saved && (!exact || hardStateMatchesKeys(saved, keys))) {
				try {
					s = restoreHardScheduler(saved, keys);
				} catch {
					s = null;
				}
				if (s && s.isDone()) s = null;
			}
		}
		if (!s) s = createHardScheduler(keys);
		hardSchedRef.current = s;
		hardSaveRef.current = target;
		setHardTemp(Boolean(temp));
		setHardBest(null);
		setHardRunId((n) => n + 1);
		const first = s.next();
		if (first !== null) persistHardRun();
		return first;
	}

	// Save the running Harder run after an answer, or record it on the answer
	// that retires the last word, so a reload during that feedback loses nothing.
	function persistHardRun() {
		const s = hardSchedRef.current;
		const target = hardSaveRef.current;
		if (!s || !target) return;
		if (s.isDone()) {
			const scope = recordHardRun(target.direction, target.scopeId, s.stats());
			setHardBest(hardBestPct(scope));
			hardSaveRef.current = null;
			if (scope && scope.saved === false) noteSaveFailed();
		} else if (saveHardRun(target.direction, target.scopeId, s.serialize()) === false) {
			noteSaveFailed();
		}
	}

	// The save-failed notice: at most once per page load, never back after Dismiss.
	function noteSaveFailed() {
		if (saveWarnShownRef.current) return;
		saveWarnShownRef.current = true;
		setSaveWarn(true);
	}

	// Normal writes report through the shared flag.
	function checkSaved() {
		if (saveHasFailed()) noteSaveFailed();
	}

	// (Re)start `r` from storage: every switch of direction, difficulty, pack or
	// selection, and every reset, goes through here.
	function startRun(r, s, d, opts = {}) {
		clearTransient();
		resetSession();
		const saved = loadProgress(s.direction, r.scopeId);
		const m = new Set(saved.mastered);
		setRun(r);
		setMastered(m);
		advanceTo(startSelectionSession(r, m, d, s.direction, { streaks: saved.streaks, ...opts }));
	}

	// ---- Hydrate: settings, difficulty and the pack from the URL ----
	// Keyed on the query string, so Back and client navigation between packs
	// re-resolve. A URL that only changed form (tidied by tidyUrl) resolves to
	// the same run and leaves the session alone. Stale resolutions (StrictMode's
	// double effect, a quick second navigation) are dropped.
	useEffect(() => {
		if (query === null) return undefined;
		let alive = true;
		(async () => {
			let ctx = null;
			try {
				ctx = await resolvePackContext(query);
			} catch {
				ctx = null;
			}
			if (!alive) return;
			// A pack that no longer exists runs as all words, with a notice; the
			// tidied URL drops its parameters.
			const missing = isMissingPack(ctx);
			if (missing) ctx = null;
			const next = runFromContext(ctx, ALL_KEYS, canonicalWord);
			tidyUrl(ctx, next);
			const sig = runSignature(next);
			if (missing) setMissingPack(true);
			else if (sig !== runSigRef.current) setMissingPack(false);
			// ?mode=normal|harder overrides the saved difficulty and is saved.
			const d = resolveDifficulty(query);
			if (hydratedRef.current && sig === runSigRef.current && d === difficultyRef.current) return;
			runSigRef.current = sig;
			const s = hydratedRef.current ? settingsRef.current : loadSettings();
			if (next.packId) saveLastPack({ id: next.packId, title: next.title, words: next.parentKeys });
			setSettings(s);
			setDifficulty(d);
			startRun(next, s, d);
			hydratedRef.current = true;
			setHydrated(true);
		})();
		return () => {
			alive = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [query]);

	// ---- Publish the running words to the background ----
	useEffect(() => {
		if (!hydrated) return;
		const known = loadKnown(direction, run.scopeId, run.parentKeys);
		setBgWords(runKeys.map((k) => ({ word: k, mastered: known.has(k) || mastered.has(k) })));
	}, [hydrated, runKeys, run, direction, mastered]);

	// ---- A failed progress write anywhere on the page shows the notice ----
	useEffect(() => {
		if (saveHasFailed()) noteSaveFailed();
		window.addEventListener(SAVE_FAILED_EVENT, noteSaveFailed);
		return () => window.removeEventListener(SAVE_FAILED_EVENT, noteSaveFailed);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ---- Audio (client only), 10% volume ----
	useEffect(() => {
		try {
			yesSound.current = new Audio("/sounds/yesmp3.mp3");
			noSound.current = new Audio("/sounds/nomp3.mp3");
			for (const a of [yesSound.current, noSound.current]) {
				a.volume = 0.1;
				a.preload = "auto";
			}
		} catch {
			/* no audio support */
		}
	}, []);

	// ---- Keep the input focused for every attempt ----
	useEffect(() => {
		if (hydrated && currentKey && !showOverlay && !confirmReset) inputRef.current?.focus({ preventScroll: true });
	}, [attempt, currentKey, showOverlay, confirmReset, hydrated]);

	// ---- Unmount: every timer and every effect node goes ----
	useEffect(
		() => () => {
			clearTimeout(advanceTimer.current);
			clearTimeout(hardWrongTimer.current);
			clearFx();
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[]
	);

	// ---- Harder caption, shown as an overlay for each run start ----
	useEffect(() => {
		if (!hardRunId || !isHarder) {
			setCaptionPhase(null);
			return undefined;
		}
		setCaptionPhase("on");
		const fade = setTimeout(() => setCaptionPhase("fade"), CAPTION_SHOW_MS);
		const hide = setTimeout(() => setCaptionPhase(null), CAPTION_SHOW_MS + CAPTION_FADE_MS);
		return () => {
			clearTimeout(fade);
			clearTimeout(hide);
		};
	}, [hardRunId, isHarder]);

	// ---- The delay changed mid-wait: restart the wait for the same target ----
	useEffect(() => {
		if (advancing) scheduleAdvance(pendingAdvanceRef.current, settings.advanceDelay);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [settings.advanceDelay]);

	const currentEntry = currentKey ? lookupWord(currentKey) : null;
	const masteredInScope = useMemo(() => countIn(run.keys, mastered), [run.keys, mastered]);
	// Normal only: Harder neither reads nor writes Normal mastery.
	const scopeMastered = !isHarder && hydrated && run.keys.length > 0 && masteredInScope === run.keys.length;
	// The answer that masters the last word keeps its feedback up for the delay.
	const complete = scopeMastered && !(advancing && feedback?.masteredNow);

	// ---- Manual advance: Enter or Space past correct-answer feedback ----
	const isManualWait = advancing && settings.advanceDelay === ADVANCE_DELAY_MANUAL && !complete;
	const keysBlocked = showOverlay || confirmReset;
	useEffect(() => {
		if (!isManualWait || keysBlocked) return undefined;
		function onKey(e) {
			if (e.repeat) return; // a held Enter from the submit never skips the wait
			if (e.key === "Enter" || e.key === " " || e.code === "Space") {
				e.preventDefault();
				runAdvance();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isManualWait, keysBlocked]);

	// Harder progress, read from the scheduler (a ref); every answer re-renders.
	const hardStats = useMemo(
		() => (isHarder && hardSchedRef.current ? hardSchedRef.current.stats() : { totalWords: 0, retired: 0, missed: [] }),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[isHarder, attempt, hardLocked, feedback, hardSessionDone]
	);
	// The current word's relearn state, or null on a first draw and in Normal.
	const hardWordState = useMemo(
		() => (isHarder && hardSchedRef.current && currentKey ? hardSchedRef.current.stateOf(currentKey) : null),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[isHarder, currentKey, attempt, hardLocked, feedback]
	);

	// ---- Credit the completion, once (markScopeComplete is idempotent) ----
	// A subset shares its parent's scope, so the parent is credited only when
	// every parent word is mastered.
	const scopeCredited = scopeMastered && allMastered(run.parentKeys, mastered);
	useEffect(() => {
		if (!scopeCredited) return;
		markScopeComplete(direction, run.scopeId, {
			keys: run.parentKeys,
			accuracy: session.firstTries ? session.firstTryCorrect / session.firstTries : null,
			answered: session.firstTries,
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [scopeCredited, direction, run.scopeId]);

	const startsNewRound = !isHarder && complete && allMastered(run.parentKeys, mastered);
	const summary = useMemo(
		() => ((confirmReset || complete) && hydrated && !isHarder ? packSummary(direction, run.scopeId, run.parentKeys) : null),
		[confirmReset, complete, hydrated, isHarder, direction, run.scopeId, run.parentKeys]
	);
	const scopeRound = summary ? summary.round : 1;

	const canReset = isHarder
		? !hardTemp && (hardStats.retired > 0 || hardStats.missed.length > 0)
		: hasProgress({
				mastered: run.subset ? run.keys.filter((k) => mastered.has(k)) : [...mastered],
				streaks: runStreaks(run.keys, streaks, mastered),
			});

	// ---- Sound ----
	function playSound(ref) {
		if (!settings.feedbackSounds || !ref.current) return;
		try {
			ref.current.currentTime = 0;
			ref.current.play().catch(() => {});
		} catch {
			/* autoplay rejected */
		}
	}

	// ---- Answer motion ----
	function clearFx() {
		stopMastery();
		for (const stop of popStops.current) stop();
		popStops.current.clear();
		clearToast();
	}

	function stopMastery() {
		for (const t of fxTimers.current) clearTimeout(t);
		fxTimers.current = [];
		launchFlightRef.current = null;
		cancelFlightRef.current?.();
		cancelFlightRef.current = null;
		cancelConfettiRef.current?.();
		cancelConfettiRef.current = null;
		setBarHold(null);
		setBarGlow(false);
		setWinOn(false);
		setWordGone(false);
	}

	// The card is about to swap: a flight that has not left yet leaves now, from
	// where the old word still sits; everything else plays on.
	function releaseWordFx() {
		launchFlightRef.current?.();
		setWinOn(false);
		setWordGone(false);
	}

	function clearToast() {
		for (const t of toastTimers.current) clearTimeout(t);
		toastTimers.current = [];
		setToast(null);
	}

	function showToast(win) {
		clearToast();
		const form = formRef.current;
		const anchor = form?.querySelector(".answer-row") || form;
		const top = anchor ? anchor.getBoundingClientRect().bottom + TOAST_GAP_PX : window.innerHeight * 0.6;
		toastIdRef.current += 1;
		setToast({ ...win, id: toastIdRef.current, top, fading: false });
		toastTimers.current = [
			setTimeout(() => setToast((t) => (t ? { ...t, fading: true } : t)), TOAST_SHOW_MS),
			setTimeout(() => {
				toastTimers.current = [];
				setToast(null);
			}, TOAST_SHOW_MS + TOAST_FADE_MS),
		];
	}

	// The "+1" pop over pip `index`, measured before this answer re-renders.
	function playPop(index) {
		if (!Number.isInteger(index) || index < 0) return;
		const pip = streakRef.current?.querySelectorAll("i")[index];
		const stop = popPip(pip, () => popStops.current.delete(stop));
		if (stop) popStops.current.add(stop);
	}

	function fxLater(fn, ms) {
		fxTimers.current.push(setTimeout(fn, ms));
	}

	function glowBar() {
		setBarGlow(true);
		fxLater(() => setBarGlow(false), FX_BAR_GLOW_MS);
	}

	// Mastered (Normal) / retired (Harder): pips go green, confetti from the
	// pips, a green copy of the word flies into the header bar (which holds its
	// old count until it lands, then glows) and the summary toast shows. Reduced
	// motion: no confetti and no flight. None of it delays the advance.
	function playMastery(prevCount, win) {
		const { count, total } = win;
		stopMastery();
		bgEvent("master");
		showToast(win);
		fxLater(() => setWinOn(true), 16);
		if (prefersReducedMotion()) {
			glowBar();
			return;
		}
		setBarHold(prevCount);
		const from = streakRef.current || wordRef.current;
		if (from) {
			const r = from.getBoundingClientRect();
			cancelConfettiRef.current = burstConfetti(r.left + r.width / 2, r.top + r.height / 2);
		}
		launchFlightRef.current = () => {
			launchFlightRef.current = null;
			const word = wordRef.current;
			const bar = barRef.current;
			const land = () => {
				cancelFlightRef.current = null;
				setBarHold(null);
				glowBar();
			};
			if (!word || !bar) {
				land();
				return;
			}
			const b = bar.getBoundingClientRect();
			const x = b.left + b.width * (total ? count / total : 0);
			setWordGone(true);
			cancelFlightRef.current = flyToBar(word, x, b.top + b.height / 2, land);
		};
		fxLater(() => launchFlightRef.current?.(), FX_FLIGHT_START_MS);
	}

	function clearTransient() {
		clearFx();
		clearTimeout(advanceTimer.current);
		clearTimeout(hardWrongTimer.current);
		pendingAdvanceRef.current = null;
		setAdvancing(false);
		setHardLocked(false);
		setFeedback(null);
		setInputValue("");
		setShowOverlay(false);
		setConfirmReset(false);
	}

	// The one gate between grading and the next card: a single timer of the
	// advance delay, or none in manual mode (Enter / the hint advances).
	function scheduleAdvance(nextKey, delay) {
		clearTimeout(advanceTimer.current);
		pendingAdvanceRef.current = nextKey;
		if (delay === ADVANCE_DELAY_MANUAL) return;
		advanceTimer.current = setTimeout(runAdvance, Math.round(Number(delay) * 1000));
	}

	function runAdvance() {
		clearTimeout(advanceTimer.current);
		const key = pendingAdvanceRef.current;
		pendingAdvanceRef.current = null;
		releaseWordFx();
		setAdvancing(false);
		setFeedback(null);
		if (key === null && hardSchedRef.current) {
			setHardSummary(hardSchedRef.current.stats());
			setHardSessionDone(true);
			return;
		}
		advanceTo(key);
	}

	// ---- Grading ----
	function handleSubmit(e) {
		e.preventDefault();
		if (!currentEntry || advancing || complete || hardLocked || hardSessionDone || submitLockRef.current) return;
		// An empty or whitespace-only submit is not an answer: no grade, no miss,
		// no streak or scheduler change. Checked before the lock is taken.
		if (isBlankAnswer(inputValue)) return;
		submitLockRef.current = true;

		const answered = inputValue;
		const firstTry = !triedRef.current;
		triedRef.current = true;
		const result = gradeFor(currentKey, currentEntry, answered, direction, VOCAB);

		setSession((s) => ({
			answers: s.answers + 1,
			firstTries: s.firstTries + (firstTry ? 1 : 0),
			firstTryCorrect: s.firstTryCorrect + (firstTry && result.correct ? 1 : 0),
		}));
		const base = { ...result, entry: currentEntry, answer: answered };

		if (result.correct && isHarder) {
			// Harder keeps its own progress; the one shared effect is that a word it
			// retires goes on the daily review ladder.
			playSound(yesSound);
			const sched = hardSchedRef.current;
			const relearning = sched.stateOf(currentKey)?.status === WORD_LEARNING;
			const retiredBefore = sched.stats().retired;
			sched.recordResult(currentKey, true);
			const after = sched.stateOf(currentKey);
			const retiredNow = after?.status === WORD_RETIRED;
			if (retiredNow) enrollReview(direction, currentKey, REVIEW_OPTS);
			const nextKey = sched.next();
			persistHardRun();
			const { retired, totalWords } = sched.stats();
			const win = retiredNow ? { ...winNames(currentEntry), label: "Retired", count: retired, total: totalWords } : null;
			setFeedback({ ...base, masteredNow: retiredNow, relearnDone: retiredNow && relearning, win });
			setInputValue("");
			setAdvancing(true);
			if (retiredNow) {
				playMastery(retiredBefore, win);
			} else {
				bgEvent("ok");
				playPop(HARD_RELEARN_CORRECT - (after?.needs ?? HARD_RELEARN_CORRECT) - 1);
			}
			scheduleAdvance(nextKey, settings.advanceDelay);
		} else if (result.correct) {
			playSound(yesSound);
			const step = normalAnswer({ pool, streaks, mastered, keys: run.keys }, currentKey, true);
			if (step.masteredNow) {
				setMastered(step.mastered);
				setPool(step.pool);
				setFreshKey(step.added);
				enrollReview(direction, currentKey, REVIEW_OPTS);
			}
			setStreaks(step.streaks);
			saveProgress(direction, run.scopeId, { mastered: [...step.mastered], streaks: step.streaks });
			checkSaved();
			const win = step.masteredNow
				? { ...winNames(currentEntry), label: "Mastered", count: countIn(run.keys, step.mastered), total: run.keys.length }
				: null;
			setFeedback({ ...base, masteredNow: step.masteredNow, win });
			setInputValue("");
			setAdvancing(true);
			if (step.masteredNow) {
				playMastery(masteredInScope, win);
			} else {
				bgEvent("ok");
				playPop(step.streak - 1);
			}
			scheduleAdvance(step.nextKey, settings.advanceDelay);
		} else {
			playSound(noSound);
			bgEvent("bad");
			if (!isHarder) {
				const step = normalAnswer({ pool, streaks, mastered, keys: run.keys }, currentKey, false);
				setStreaks(step.streaks);
				saveProgress(direction, run.scopeId, { mastered: [...mastered], streaks: step.streaks });
				checkSaved();
			}
			setFeedback({ ...base, masteredNow: false });
			setInputValue("");
			if (isHarder) {
				// Harder moves on after a fixed pause; the scheduler brings the word
				// back after its cooldown.
				hardSchedRef.current.recordResult(currentKey, false);
				const nextKey = hardSchedRef.current.next();
				persistHardRun();
				setHardLocked(true);
				clearTimeout(hardWrongTimer.current);
				hardWrongTimer.current = setTimeout(() => {
					setHardLocked(false);
					setFeedback(null);
					if (nextKey === null) {
						setHardSummary(hardSchedRef.current.stats());
						setHardSessionDone(true);
					} else {
						advanceTo(nextKey);
					}
				}, HARD_WRONG_DELAY_MS);
			} else {
				// Normal: the same word again, at once.
				submitLockRef.current = false;
				setAttempt((n) => n + 1);
			}
		}
	}

	// ---- Header controls ----
	function switchDirection(dir) {
		if (dir === direction) return;
		const next = saveSettings({ direction: dir });
		setSettings(next);
		startRun(run, next, difficulty);
	}

	// Never splices a running pool into a scheduler or back: Normal rebuilds
	// from stored mastery, Harder resumes its saved run.
	function switchDifficulty(d) {
		if (d === difficulty) return;
		saveDifficulty(d);
		setDifficulty(d);
		startRun(run, settings, d);
	}

	// Only the correct-answer wait changes; the effect above reschedules.
	function switchAdvanceDelay(value) {
		const delay = ADVANCE_DELAY_OPTIONS.find((opt) => String(opt) === value);
		if (delay === undefined || delay === settings.advanceDelay) return;
		setSettings(saveSettings({ advanceDelay: delay }));
	}

	function toggleSound() {
		setSettings(saveSettings({ feedbackSounds: !settings.feedbackSounds }));
	}

	// ---- Choose Words ----
	function commitOverlay(selection) {
		if (selection.size < minSelection(run.parentKeys)) return;
		const next = selectionRun(run, selection);
		startRun(run.packId ? next : { ...next, title: "Your selection" }, settings, difficulty);
	}

	// ---- Reset, restart, drill ----
	// Each difficulty resets only its own progress. Normal: a subset clears only
	// its words; a finished scope starts its next round.
	function performReset() {
		if (isHarder) {
			restartHardRun(direction, hardRunScope(run.scopeId, run.subset));
			startRun(run, settings, DIFFICULTY_HARDER, { fresh: true });
			return;
		}
		if (run.subset) clearScopeKeys(direction, run.scopeId, run.keys);
		else clearScopeProgress(direction, run.scopeId);
		startRun(run, settings, difficulty);
	}

	function startAnotherHarderSession() {
		restartHardRun(direction, hardRunScope(run.scopeId, run.subset));
		startRun(run, settings, DIFFICULTY_HARDER, { fresh: true });
	}

	// A temporary run over the words just missed: never saved or recorded.
	function startDrillMissed() {
		if (!hardSummary || !hardSummary.missed.length) return;
		const keys = hardSummary.missed.map((m) => m.key);
		clearTransient();
		resetSession();
		advanceTo(startSelectionSession(run, mastered, DIFFICULTY_HARDER, direction, { temp: true, keys }));
	}

	function goBack() {
		window.location.href = backHref;
	}

	// ---- Background heat and origin ----
	const streak = Math.min(streaks[currentKey] || 0, WORD_STREAK_TO_MASTER);
	const hardHeat =
		hardWordState?.status === WORD_LEARNING ? (HARD_RELEARN_CORRECT - hardWordState.needs) / HARD_RELEARN_CORRECT : 0;
	const heat = feedback?.masteredNow ? 1 : isHarder ? hardHeat : streak / WORD_STREAK_TO_MASTER;
	useEffect(() => {
		setBgHeat(heat);
	}, [heat]);
	useEffect(() => () => setBgHeat(0), []);

	useEffect(() => {
		function place() {
			const el = wordRef.current;
			if (!el) {
				setBgOrigin(null, null);
				return;
			}
			const r = el.getBoundingClientRect();
			setBgOrigin(r.left + r.width / 2, r.top + r.height / 2);
		}
		place();
		window.addEventListener("resize", place);
		return () => window.removeEventListener("resize", place);
	}, [currentKey, attempt, hydrated, complete, hardSessionDone]);
	useEffect(() => () => setBgOrigin(null, null), []);

	// ---- Derived copy ----
	const dirLabel = DIRECTION_LABEL[direction];
	const headTitle = inPack
		? run.subset
			? `${run.title}: selection`
			: run.title
		: run.subset
			? run.title || "Your selection"
			: "All words";
	const scopeTitle = inPack
		? run.subset
			? `your selection from ${run.title}`
			: run.title
		: run.subset
			? "your selection"
			: "all words";
	const headerCount = isHarder ? hardStats.retired : masteredInScope;
	const headerTotal = isHarder ? hardStats.totalWords : run.keys.length;
	const headerDone = isHarder ? hardSessionDone : complete;
	const shownCount = barHold ?? headerCount;
	const shownPct = headerTotal ? Math.round((shownCount / headerTotal) * 100) : 0;
	const accuracy = session.firstTries ? Math.round((session.firstTryCorrect / session.firstTries) * 100) : null;
	const wordNoun = (n) => (n === 1 ? "word" : "words");
	const poolCaption = `${COUNT_WORD[POOL_SIZE] || POOL_SIZE} words in rotation. ${
		COUNT_WORD[WORD_STREAK_TO_MASTER] || WORD_STREAK_TO_MASTER
	} in a row masters one, and the next word takes its place.`;
	const prompt = promptFor(currentEntry, direction);
	const placeholder = direction === "d2w" ? "Type the word" : "Type the definition";

	function dots(n, max) {
		return Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? "on" : undefined} style={{ "--i": i }} />);
	}

	// ---- Feedback ----
	let feedbackBody = null;
	if (feedback) {
		feedbackBody = feedback.correct ? (
			<>
				<span className="sr">
					{feedback.win
						? `${feedback.win.label}: ${feedback.win.word} means ${feedback.win.meaning}, ${feedback.win.count} of ${feedback.win.total}.`
						: "Correct"}
				</span>
				{feedback.alsoAccepted ? (
					<p className="fb-spelled">
						Also accepted: <strong>{feedback.alsoAccepted}</strong>
					</p>
				) : !feedback.exact ? (
					<p className="fb-spelled">
						{direction === "d2w" ? "Correct, spelled: " : "Correct. Definition: "}
						<strong>{feedback.display}</strong>
					</p>
				) : null}
			</>
		) : (
			<>
				<div className="fb-line bad">
					<span className="fb-icon" aria-hidden="true">
						<svg viewBox="0 0 24 24" width="12" height="12">
							<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
						</svg>
					</span>
					<span>Not quite</span>
				</div>
				<AnswerCard entry={feedback.entry} direction={direction} />
			</>
		);
	}

	const glowMs =
		settings.advanceDelay === ADVANCE_DELAY_MANUAL
			? FX_GLOW_MS
			: Math.min(FX_GLOW_MS, Math.round(Number(settings.advanceDelay) * 1000) || FX_GLOW_MS);
	const fxCorrect = Boolean(feedback?.correct && !feedback.masteredNow);
	const fxWin = Boolean(feedback?.masteredNow && winOn);
	const wordFxClass = `${fxCorrect ? " glow" : ""}${fxWin ? " win" : ""}${wordGone ? " gone" : ""}`;
	const pipsWinClass = fxWin ? " win" : "";

	let inputClass = "answer-input";
	if (advancing) inputClass += " ok";
	else if (feedback && !feedback.correct && !inputValue) inputClass += " bad";

	const progressNode = (
		<>
			<div
				ref={barRef}
				className={`bar tm-bar${headerDone ? " done" : ""}${barGlow ? " glow" : ""}`}
				role="progressbar"
				aria-label={isHarder ? "Retired" : "Mastered"}
				aria-valuemin={0}
				aria-valuemax={headerTotal}
				aria-valuenow={shownCount}
			>
				<i style={{ width: `${shownPct}%` }} />
			</div>
			<span>
				{shownCount} of {headerTotal} {isHarder ? "retired" : "mastered"}
			</span>
		</>
	);

	// ---- Stage ----
	let stage;
	if (!hydrated) {
		stage = <p className="tm-loading">Loading…</p>;
	} else if (complete) {
		stage = (
			<div className="done-screen">
				<h2>All words mastered</h2>
				<p>
					You mastered all {run.keys.length} {wordNoun(run.keys.length)} in {scopeTitle} ({dirLabel}).
				</p>
				<div className="done-stats">
					<div>
						<strong>{masteredInScope}</strong>
						<span>{wordNoun(masteredInScope)} mastered</span>
					</div>
					{session.answers > 0 && (
						<div>
							<strong>{session.answers}</strong>
							<span>answers given</span>
						</div>
					)}
					{accuracy !== null && (
						<div>
							<strong>{accuracy}%</strong>
							<span>first-try accuracy</span>
						</div>
					)}
					{summary && summary.completions > 0 && (
						<div>
							<strong>{summary.completions}</strong>
							<span>{summary.completions === 1 ? "completion" : "completions"}</span>
						</div>
					)}
				</div>
				<div className="done-acts">
					<a className="btn-p" href="/wordpacks">
						Back to Word Packs
					</a>
					<button type="button" className="btn-q" onClick={() => setConfirmReset(true)}>
						{startsNewRound ? `Start round ${scopeRound + 1}` : "Re-test"}
					</button>
				</div>
			</div>
		);
	} else if (isHarder && hardSessionDone && hardSummary) {
		stage = (
			<SessionSummary
				title="Session complete"
				hero={{ value: hardSummary.retiredFirstTry, max: hardSummary.totalWords, label: "words known on the first try" }}
				stats={[
					{ value: hardSummary.cardsShown, label: "cards shown" },
					{ value: hardSummary.missed.length, label: "words missed" },
					hardBest !== null && { value: `${hardBest}%`, label: "best first-try score" },
				].filter(Boolean)}
				missedTitle="Missed, hardest first:"
				missed={missedRows(hardSummary.missed, lookupWord, direction)}
				perfectTitle="Perfect run"
				perfectBody="Every word in this session was known on the first try."
				actions={[
					hardSummary.missed.length > 0 && { key: "drill", label: "Drill missed words", variant: "primary", onClick: startDrillMissed },
					{
						key: "again",
						label: "Start another session",
						variant: hardSummary.missed.length > 0 ? "secondary" : "primary",
						onClick: startAnotherHarderSession,
					},
					{ key: "back", label: backLabel, variant: "quiet", onClick: goBack },
				].filter(Boolean)}
			/>
		);
	} else if (!currentEntry) {
		stage = (
			<div className="done-screen">
				<h2>No words to study</h2>
				<p>This selection has no words in it.</p>
				<div className="done-acts">
					<a className="btn-p" href={backHref}>
						{inPack ? "Back to Word Packs" : "Back to menu"}
					</a>
				</div>
			</div>
		);
	} else {
		stage = (
			<div className="tm-block">
				{!isHarder && pool.length > 0 && (
					<>
						<div className="pool" role="list" aria-label="Words in rotation">
							{pool.map((k) => {
								const s = Math.min(streaks[k] || 0, WORD_STREAK_TO_MASTER);
								const cls = ["pool-item", k === currentKey ? "cur" : "", k === freshKey ? "new" : ""].filter(Boolean).join(" ");
								const label = poolLabel(lookupWord(k), direction);
								return (
									<div key={k} role="listitem" className={cls} aria-current={k === currentKey ? "true" : undefined}>
										<span className="pool-label" title={label}>
											{label}
										</span>
										<span className="dots" role="img" aria-label={`Streak ${s} of ${WORD_STREAK_TO_MASTER}`}>
											{dots(s, WORD_STREAK_TO_MASTER)}
										</span>
									</div>
								);
							})}
						</div>
						<p className="pool-cap">{poolCaption}</p>
					</>
				)}

				<div className="prompt" style={{ "--fx-glow": `${glowMs}ms` }}>
					{prompt.isWord ? (
						<div className="prompt-word">
							<span ref={wordRef} className={`w${wordFxClass}`}>
								{prompt.text || "…"}
							</span>
						</div>
					) : (
						<div ref={wordRef} className={`prompt-def${wordFxClass}`}>
							{prompt.text || "…"}
						</div>
					)}
					{prompt.hint && (
						<div className="prompt-hint">
							<span>{prompt.hint}</span>
						</div>
					)}
					{isHarder ? (
						// Only a word that came back after a miss shows its two relearn pips;
						// a relearned word that just retired keeps them, all filled.
						feedback?.relearnDone ? (
							<div ref={streakRef} className={`streak${pipsWinClass}`} role="img" aria-label="Retired">
								{dots(HARD_RELEARN_CORRECT, HARD_RELEARN_CORRECT)}
							</div>
						) : (
							hardWordState?.status === WORD_LEARNING && (
								<div
									ref={streakRef}
									className="streak"
									role="img"
									aria-label={`${HARD_RELEARN_CORRECT - hardWordState.needs} of ${HARD_RELEARN_CORRECT} correct answers since the last miss`}
								>
									{dots(HARD_RELEARN_CORRECT - hardWordState.needs, HARD_RELEARN_CORRECT)}
								</div>
							)
						)
					) : (
						<div ref={streakRef} className={`streak${pipsWinClass}`} role="img" aria-label={`Streak ${streak} of ${WORD_STREAK_TO_MASTER}`}>
							{dots(streak, WORD_STREAK_TO_MASTER)}
						</div>
					)}
				</div>

				<form ref={formRef} className="answer" onSubmit={handleSubmit} autoComplete="off">
					<div className="answer-row">
						<input
							ref={inputRef}
							type="text"
							className={inputClass}
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							// A held Enter autorepeats into the next prompt; only a fresh press submits.
							onKeyDown={(e) => {
								if (e.key === "Enter" && e.repeat) e.preventDefault();
							}}
							placeholder={placeholder}
							autoComplete="off"
							autoCapitalize="off"
							autoCorrect="off"
							spellCheck={false}
							lang="en"
							disabled={advancing || hardLocked}
							aria-label="Your answer"
						/>
						<button type="submit" className="btn-p" disabled={advancing || hardLocked}>
							Check
						</button>
					</div>

					<div className="fb" aria-live="polite">
						{feedbackBody}
						{isManualWait && (
							<button type="button" className="continue-hint" onClick={runAdvance}>
								Press <kbd>Enter</kbd> to continue
							</button>
						)}
					</div>
				</form>

				<p className="tm-quiet">
					<button type="button" className="btn-q" onClick={() => setShowOverlay(true)}>
						Choose words
					</button>
					{canReset && (
						<button type="button" className="btn-q" onClick={() => setConfirmReset(true)}>
							{isHarder ? "Restart run" : "Reset progress"}
						</button>
					)}
				</p>
			</div>
		);
	}

	return (
		<div className="tm-page tm-test">
			<Suspense fallback={null}>
				<SearchParamsReader onChange={setQuery} />
			</Suspense>

			<div className="tm-headwrap">
				<PlayHeader
					href={backHref}
					backLabel={backLabel}
					title="Test"
					packName={hydrated ? headTitle : " "}
					progress={progressNode}
					direction={direction}
					onDirectionChange={switchDirection}
					ready={hydrated}
				>
					<span className="seg" role="group" aria-label="Difficulty">
						{DIFFICULTIES.map((d) => (
							<button key={d} type="button" aria-pressed={difficulty === d} onClick={() => switchDifficulty(d)}>
								{DIFFICULTY_LABEL[d]}
							</button>
						))}
					</span>
					<button
						type="button"
						className="pill"
						aria-pressed={settings.feedbackSounds}
						aria-label="Answer sounds"
						onClick={toggleSound}
					>
						{settings.feedbackSounds ? "Sound on" : "Sound off"}
					</button>
					<select
						className="select"
						aria-label="Time before the next question"
						value={String(settings.advanceDelay)}
						onChange={(e) => switchAdvanceDelay(e.target.value)}
					>
						{ADVANCE_DELAY_OPTIONS.map((opt) => (
							<option key={String(opt)} value={String(opt)}>
								{ADVANCE_DELAY_LABEL[String(opt)]}
							</option>
						))}
					</select>
				</PlayHeader>
				{hydrated && missingPack && (
					<div className="notice" role="status">
						<p>{MISSING_PACK_NOTICE}</p>
						<button type="button" className="btn-q" onClick={() => setMissingPack(false)}>
							Dismiss
						</button>
					</div>
				)}
				{saveWarn && (
					<div className="notice warn" role="alert">
						<p>{SAVE_FAILED_NOTICE}</p>
						<button type="button" className="btn-q" onClick={() => setSaveWarn(false)}>
							Dismiss
						</button>
					</div>
				)}
				{isHarder && captionPhase && (
					<p className={`tm-difficulty-desc${captionPhase === "fade" ? " fade" : ""}`}>
						<strong>{DIFFICULTY_LABEL[DIFFICULTY_HARDER]}:</strong> {HARDER_DESC}
					</p>
				)}
			</div>

			<main className="tm-stage">
				<div className="tm-wrap">{stage}</div>
			</main>

			{toast && <MasteryToast key={toast.id} {...toast} />}

			{showOverlay && (
				<ChooseWords
					keys={run.parentKeys}
					lookup={lookupWord}
					initial={run.keys}
					min={minSelection(run.parentKeys)}
					onCancel={() => setShowOverlay(false)}
					onCommit={commitOverlay}
				/>
			)}

			{confirmReset && isHarder && (
				<ConfirmDialog
					tone="neutral"
					title={`Restart this Harder run of ${scopeTitle}?`}
					body={`Your place in the current run (${dirLabel}) is cleared and a fresh run starts over every word. Finished runs and Normal mastery are not affected.`}
					confirmLabel="Restart run"
					onConfirm={performReset}
					onCancel={() => setConfirmReset(false)}
				/>
			)}

			{confirmReset && !isHarder && (
				<ConfirmDialog
					tone={startsNewRound ? "neutral" : "danger"}
					title={
						startsNewRound
							? `Start round ${scopeRound + 1} of ${scopeTitle}?`
							: complete && run.subset
								? `Work through ${scopeTitle} again?`
								: `Reset this round of ${scopeTitle}?`
					}
					body={
						run.subset
							? `Current-round mastery and streaks for the ${run.keys.length} selected ${wordNoun(run.keys.length)} (${dirLabel}) are cleared.${
									startsNewRound
										? ` ${inPack ? "The pack" : "The word list"} moves to round ${scopeRound + 1}, with the rest of its words still mastered.`
										: ""
								} The rest of ${inPack ? "the pack" : "the word list"}, its completions and the other direction are not affected.`
							: startsNewRound
								? `You drill every word again (${dirLabel}). Nothing finished is lost: your best result and completion count are kept, and finishing round ${scopeRound + 1} counts as another completion.`
								: `${masteredInScope} mastered ${wordNoun(masteredInScope)} and your current streaks (${dirLabel}) will be cleared. The other direction and other packs are not affected.`
					}
					confirmLabel={startsNewRound ? `Start round ${scopeRound + 1}` : complete ? "Re-test" : "Reset progress"}
					onConfirm={performReset}
					onCancel={() => setConfirmReset(false)}
				/>
			)}
		</div>
	);
}
