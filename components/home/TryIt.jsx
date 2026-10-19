/** @format */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WORD_STREAK_TO_MASTER } from "../../lib/pool";
import { FLARE_EVENT } from "./HeroCanvas";

// A live taste of Test mode on the five sample words from src/data/home.json:
// type the definition, graded by the real Word -> Definition grader
// (gradeDefinition, against each word's definition and alts), and a streak of
// WORD_STREAK_TO_MASTER masters a word. Nothing is ever saved and nothing
// takes focus on load.
//
// lib/matching.js reaches the full word list through lib/distractors.js, so it
// is loaded on demand (first focus or first Check) rather than bundled into
// the home page.
//
// Motion: the card tilts toward the pointer (fine pointers only), a correct
// answer makes the hero's glowing words flare, and mastering a word fires a
// short burst on a canvas inside the card. All of it is skipped with reduced
// motion, and every frame and timer stops on unmount.

const DELAY_OK_MS = 1100;
const DELAY_MASTERED_MS = 1800;
const DELAY_BAD_MS = 2100;
const TILT_DEG = 3.5;

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

const prefersReduced = () =>
	typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const flare = (v) => {
	if (prefersReduced()) return;
	try {
		window.dispatchEvent(new CustomEvent(FLARE_EVENT, { detail: v }));
	} catch {
		/* no CustomEvent: no flare */
	}
};

export default function TryIt({ words }) {
	const list = Array.isArray(words) ? words.filter((w) => w && w.headword && w.definition) : [];
	const [index, setIndex] = useState(0);
	const [streaks, setStreaks] = useState({});
	const [mastered, setMastered] = useState(() => new Set());
	const [answer, setAnswer] = useState("");
	const [verdict, setVerdict] = useState(null); // null | { ok, lead, text }
	const [won, setWon] = useState(false);
	const shellRef = useRef(null);
	const burstRef = useRef(null);
	const inputRef = useRef(null);
	const formRef = useRef(null);
	const againRef = useRef(null);
	const timerRef = useRef(null);
	const lockedRef = useRef(false);
	const aliveRef = useRef(true);
	const refocusRef = useRef(false);
	const burstRafRef = useRef(0);

	useEffect(() => {
		aliveRef.current = true;
		return () => {
			aliveRef.current = false;
			clearTimeout(timerRef.current);
			cancelAnimationFrame(burstRafRef.current);
		};
	}, []);

	// Tilt toward the pointer. Fine pointers only, and never with reduced motion.
	useEffect(() => {
		const el = shellRef.current;
		const stage = el && el.parentElement;
		if (!el || !stage || !window.matchMedia) return undefined;
		if (prefersReduced() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;
		let raf = 0;
		let px = 0;
		let py = 0;
		const apply = () => {
			raf = 0;
			el.style.setProperty("--rx", `${(-py * TILT_DEG).toFixed(2)}deg`);
			el.style.setProperty("--ry", `${(px * TILT_DEG).toFixed(2)}deg`);
		};
		const onMove = (e) => {
			const r = el.getBoundingClientRect();
			px = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
			py = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
			if (!raf) raf = requestAnimationFrame(apply);
		};
		const onLeave = () => {
			px = 0;
			py = 0;
			if (!raf) raf = requestAnimationFrame(apply);
		};
		stage.addEventListener("pointermove", onMove);
		stage.addEventListener("pointerleave", onLeave);
		return () => {
			cancelAnimationFrame(raf);
			stage.removeEventListener("pointermove", onMove);
			stage.removeEventListener("pointerleave", onLeave);
			el.style.removeProperty("--rx");
			el.style.removeProperty("--ry");
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

	// A short burst from the middle of the card, on a canvas sized to it. The
	// loop ends by itself when the last particle fades.
	function burst() {
		const canvas = burstRef.current;
		const card = canvas && canvas.parentElement;
		if (!canvas || !card || prefersReduced()) return;
		let ctx = null;
		try {
			ctx = canvas.getContext("2d");
		} catch {
			ctx = null;
		}
		if (!ctx) return;
		const r = card.getBoundingClientRect();
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		canvas.width = Math.max(1, r.width * dpr);
		canvas.height = Math.max(1, r.height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		const ox = r.width / 2;
		const oy = r.height * 0.45;
		const colors = ["#ea5746", "#ff8a7a", "#ffd0c8", "#5fd39a"];
		const parts = Array.from({ length: 34 }, (_, i) => {
			const a = Math.random() * Math.PI * 2;
			const v = 2.5 + Math.random() * 5;
			return {
				x: ox,
				y: oy,
				vx: Math.cos(a) * v,
				vy: Math.sin(a) * v - 2,
				s: 8,
				rot: 0,
				vr: (Math.random() - 0.5) * 0.4,
				c: colors[i % colors.length],
				life: 0,
				max: 54 + Math.random() * 30,
			};
		});
		cancelAnimationFrame(burstRafRef.current);
		let last = 0;
		const frame = (t) => {
			if (!aliveRef.current) return;
			const k = last ? Math.min(3, (t - last) / 16.7) : 1;
			last = t;
			ctx.clearRect(0, 0, r.width, r.height);
			let live = 0;
			for (const p of parts) {
				if (p.life >= p.max) continue;
				live++;
				p.life += k;
				p.vy += 0.08 * k;
				p.vx *= Math.pow(0.97, k);
				p.vy *= Math.pow(0.985, k);
				p.x += p.vx * k;
				p.y += p.vy * k;
				p.rot += p.vr * k;
				ctx.save();
				ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rot);
				ctx.fillStyle = p.c;
				ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
				ctx.restore();
			}
			burstRafRef.current = live ? requestAnimationFrame(frame) : 0;
			if (!live) ctx.clearRect(0, 0, r.width, r.height);
		};
		burstRafRef.current = requestAnimationFrame(frame);
	}

	async function onSubmit(e) {
		e.preventDefault();
		if (!entry || lockedRef.current || !answer.trim()) return;
		lockedRef.current = true;

		let gradeDefinition;
		try {
			({ gradeDefinition } = await loadMatcher());
		} catch {
			if (!aliveRef.current) return;
			setVerdict({ ok: false, lead: "", text: "Checking is unavailable right now. Please try again." });
			timerRef.current = setTimeout(() => {
				setVerdict(null);
				lockedRef.current = false;
			}, DELAY_OK_MS);
			return;
		}
		if (!aliveRef.current) return;

		const result = gradeDefinition(entry, answer);
		const key = entry.headword;
		const meaning = String(result.display || entry.definition).replace(/[.!?;,]+$/, "");
		const nextStreak = result.correct ? Math.min(WORD_STREAK_TO_MASTER, streak + 1) : 0;
		const nextMastered = new Set(mastered);
		const masteredNow = nextStreak >= WORD_STREAK_TO_MASTER;
		if (masteredNow) nextMastered.add(key);

		setStreaks((s) => ({ ...s, [key]: nextStreak }));
		setMastered(nextMastered);
		setVerdict(
			result.correct
				? { ok: true, lead: "Correct.", text: `${key} means ${meaning}.` }
				: { ok: false, lead: "Not quite.", text: `${key} means ${meaning}.` }
		);
		if (result.correct) flare(masteredNow ? 1 : 0.6);
		if (masteredNow) {
			setWon(true);
			burst();
		}

		timerRef.current = setTimeout(
			() => {
				if (!aliveRef.current) return;
				// Only hand focus back if the learner is still in the card.
				const inCard = !!formRef.current && formRef.current.contains(document.activeElement);
				const next = nextIndex(list, index, nextMastered);
				setIndex(next);
				setAnswer("");
				setVerdict(null);
				setWon(false);
				lockedRef.current = false;
				if (inCard && next === -1) refocusRef.current = true;
				else if (inCard) inputRef.current?.focus({ preventScroll: true });
			},
			result.correct ? (masteredNow ? DELAY_MASTERED_MS : DELAY_OK_MS) : DELAY_BAD_MS
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
		setWon(false);
		setIndex(0);
	}

	const state = verdict ? (verdict.ok ? " ok" : " bad") : "";
	const justMastered = entry && mastered.has(entry.headword);

	return (
		<div className="try-stage" data-loop="">
			<div ref={shellRef} className="try-shell">
				<div className={`try${won ? " won" : ""}`}>
					<canvas ref={burstRef} className="try-burst" aria-hidden="true" />
					<div className="try-head">
						<span className="tag">Try it right here</span>
						<span className="chip">
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
							<div className="actions">
								<button ref={againRef} type="button" className="btn btn-ghost" onClick={startOver}>
									Start over
								</button>
								<Link className="btn btn-primary" href="/play/test">
									Open Test
								</Link>
							</div>
						</div>
					) : (
						<>
							<div className="try-word" aria-live="polite">
								<span className="w" key={entry.headword}>
									{entry.headword}
								</span>
							</div>
							<div className="try-pos">{entry.pos || " "}</div>
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
							<div className="try-fb" aria-live="polite">
								{verdict ? (
									<>
										{verdict.lead ? <span className={verdict.ok ? "y" : "n"}>{verdict.lead}</span> : null}{" "}
										{verdict.text}
									</>
								) : null}
							</div>
							<div className="try-foot">
								<div className={`bars${justMastered ? " win" : ""}`} aria-hidden="true">
									{Array.from({ length: WORD_STREAK_TO_MASTER }, (_, k) => (
										<i key={k} className={k < streak ? "on" : undefined} />
									))}
								</div>
								<span>
									{justMastered
										? "Mastered. That is the whole idea."
										: `${streak} of ${WORD_STREAK_TO_MASTER} in a row`}
								</span>
							</div>
							<div className="try-hint">
								Small typos and close wording still count. Press <kbd>Enter</kbd> to check.
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
