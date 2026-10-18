/** @format */
"use client";

import { useEffect, useRef, useState } from "react";
import { WORD_STREAK_TO_MASTER } from "../../lib/pool";

// A live taste of Test mode on the five sample words from src/data/home.json:
// type the definition, graded by the real Word -> Definition grader, and a
// streak of WORD_STREAK_TO_MASTER masters a word. Nothing is ever saved and
// nothing takes focus on load.
//
// lib/matching.js reaches the full word list through lib/distractors.js, so it
// is loaded on demand (first focus or first Check) rather than bundled into
// the home page.

const DELAY_OK_MS = 1000;
const DELAY_BAD_MS = 2600;

let matcherPromise = null;
function loadMatcher() {
	if (!matcherPromise) {
		matcherPromise = import("../../lib/matching").catch((err) => {
			matcherPromise = null; // let the next attempt retry
			throw err;
		});
	}
	return matcherPromise;
}

// The next unmastered word after `from`, in sample order, or -1 when none are left.
function nextIndex(words, from, mastered) {
	for (let step = 1; step <= words.length; step++) {
		const i = (from + step) % words.length;
		if (!mastered.has(words[i].headword)) return i;
	}
	return -1;
}

export default function TryIt({ words }) {
	const list = Array.isArray(words) ? words.filter((w) => w && w.headword && w.definition) : [];
	const [index, setIndex] = useState(0);
	const [streaks, setStreaks] = useState({});
	const [mastered, setMastered] = useState(() => new Set());
	const [answer, setAnswer] = useState("");
	const [verdict, setVerdict] = useState(null); // null | { ok, text, example }
	const inputRef = useRef(null);
	const formRef = useRef(null);
	const againRef = useRef(null);
	const timerRef = useRef(null);
	const lockedRef = useRef(false);
	const aliveRef = useRef(true);
	const refocusRef = useRef(false);

	useEffect(() => {
		aliveRef.current = true;
		return () => {
			aliveRef.current = false;
			clearTimeout(timerRef.current);
		};
	}, []);

	const done = list.length > 0 && index === -1;

	// Keep focus in the card when the form swaps for the done panel and back:
	// to "Start over" when the last word is mastered from the keyboard, and to
	// the input after "Start over".
	useEffect(() => {
		if (!refocusRef.current) return;
		refocusRef.current = false;
		(done ? againRef.current : inputRef.current)?.focus({ preventScroll: true });
	}, [done]);

	if (!list.length) return null;

	const entry = done ? null : list[index];
	const streak = entry ? streaks[entry.headword] || 0 : 0;

	async function onSubmit(e) {
		e.preventDefault();
		if (!entry || lockedRef.current || !answer.trim()) return;
		lockedRef.current = true;

		let gradeDefinition;
		try {
			({ gradeDefinition } = await loadMatcher());
		} catch {
			if (!aliveRef.current) return;
			setVerdict({ ok: false, text: "Checking is unavailable right now. Please try again.", example: "" });
			timerRef.current = setTimeout(() => {
				setVerdict(null);
				lockedRef.current = false;
			}, DELAY_OK_MS);
			return;
		}
		if (!aliveRef.current) return;

		const result = gradeDefinition(entry, answer);
		const key = entry.headword;
		// Wording only: an answer that differs just by the definition's final
		// period gets a plain "Correct." Grading is gradeDefinition's alone.
		const bare = (s) => String(s).trim().toLowerCase().replace(/[.!?;,]+$/, "");
		const sameWords = result.exact || bare(answer) === bare(result.display);
		const nextStreak = result.correct ? Math.min(WORD_STREAK_TO_MASTER, streak + 1) : 0;
		const nextMastered = new Set(mastered);
		if (nextStreak >= WORD_STREAK_TO_MASTER) nextMastered.add(key);

		setStreaks((s) => ({ ...s, [key]: nextStreak }));
		setMastered(nextMastered);
		setVerdict(
			result.correct
				? { ok: true, text: sameWords ? "Correct." : `Correct. The definition reads: ${result.display}`, example: "" }
				: { ok: false, text: `Not quite. ${key} means: ${result.display}`, example: entry.example || "" }
		);

		timerRef.current = setTimeout(
			() => {
				if (!aliveRef.current) return;
				// Only hand focus back if the learner is still in the card.
				const inCard = !!formRef.current && formRef.current.contains(document.activeElement);
				const next = nextIndex(list, index, nextMastered);
				setIndex(next);
				setAnswer("");
				setVerdict(null);
				lockedRef.current = false;
				if (inCard && next === -1) refocusRef.current = true;
				else if (inCard) inputRef.current?.focus({ preventScroll: true });
			},
			result.correct ? DELAY_OK_MS : DELAY_BAD_MS
		);
	}

	function startOver() {
		clearTimeout(timerRef.current);
		lockedRef.current = false;
		refocusRef.current = true;
		setStreaks({});
		setMastered(new Set());
		setAnswer("");
		setVerdict(null);
		setIndex(0);
	}

	const state = verdict ? (verdict.ok ? " ok" : " bad") : "";
	const justMastered = entry && mastered.has(entry.headword);

	return (
		<div className="try">
			<div className="try-head">
				<span>Try it here</span>
				<span className="try-dir">
					{mastered.size} / {list.length} mastered
				</span>
			</div>

			{done ? (
				<div className="try-done">
					<div className="try-done-title">All {list.length} words mastered.</div>
					<p>
						That is how every word works in Test: {WORD_STREAK_TO_MASTER} correct in a row masters it, and one
						miss starts its streak over.
					</p>
					<div className="try-done-actions">
						<button ref={againRef} type="button" className="btn btn-ghost" onClick={startOver}>
							Start over
						</button>
						<a className="btn btn-primary" href="/play/test">
							Open Test
						</a>
					</div>
				</div>
			) : (
				<>
					<div className="try-word" aria-live="polite">
						<span className="w">{entry.headword}</span>
					</div>
					<div className="try-pos">{entry.pos || " "}</div>
					<form ref={formRef} className="try-form" onSubmit={onSubmit} autoComplete="off">
						<label htmlFor="try-input" className="sr-only">
							Definition of {entry.headword}
						</label>
						<input
							ref={inputRef}
							id="try-input"
							className={`try-input${state}`}
							placeholder="Type the definition"
							spellCheck={false}
							autoCapitalize="off"
							autoCorrect="off"
							autoComplete="off"
							value={answer}
							readOnly={verdict !== null}
							onFocus={() => {
								loadMatcher().catch(() => {});
							}}
							onChange={(e) => setAnswer(e.target.value)}
						/>
						{/* Not disabled while the verdict shows: a disabled button drops focus out
						    of the card. lockedRef blocks the second submit instead. */}
						<button className="btn btn-primary try-check" type="submit">
							Check
						</button>
					</form>
					<div className={`try-feedback${state}`} aria-live="polite">
						{verdict?.text}
						{verdict?.example ? <span className="try-example">{verdict.example}</span> : null}
					</div>
					<div className="try-streak">
						<div className="bars" aria-hidden="true">
							{Array.from({ length: WORD_STREAK_TO_MASTER }, (_, k) => (
								<i key={k} className={k < streak ? "on" : undefined} />
							))}
						</div>
						<span>
							{justMastered
								? `${entry.headword} mastered.`
								: `${streak} of ${WORD_STREAK_TO_MASTER} in a row. ${WORD_STREAK_TO_MASTER} in a row masters a word.`}
						</span>
					</div>
				</>
			)}
		</div>
	);
}
