/** @format */
"use client";

import { useEffect, useRef, useState } from "react";

// The miniature screens in the mode tiles, each playing a short scripted demo
// of its mode: typing an answer, picking an option, dealing a card, flipping,
// climbing the review ladder, filling a blank. The sample words are real
// entries with their real definitions; the screens are decorative and hidden
// from assistive tech, and the text beside each one says what the mode does.
//
// The server and the first client render show each demo's finished state, so
// hydration matches and the tiles read correctly without JavaScript or with
// reduced motion (where no script runs at all). After mount the script resets
// its screen while it is still below the fold and plays only while the screen
// is on screen and the tab is visible; every timer and observer stops on
// unmount.

const STOP = Symbol("stop");
const reduced = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

// sleep(ms) for a demo script: waits until the element is on screen and the
// tab is visible, then for ms, then for visibility again. Rejects with STOP
// once the gate is closed, which ends the script.
function gate(el) {
	let alive = true;
	let visible = typeof IntersectionObserver === "undefined";
	let waiting = null;
	const timers = new Set();
	const active = () => visible && !document.hidden;
	const wake = () => {
		if (waiting && (active() || !alive)) {
			const w = waiting;
			waiting = null;
			w();
		}
	};
	const io =
		typeof IntersectionObserver !== "undefined"
			? new IntersectionObserver((entries) => {
					visible = entries.some((e) => e.isIntersecting);
					wake();
				})
			: null;
	if (io) io.observe(el);
	document.addEventListener("visibilitychange", wake);

	const whenActive = () =>
		new Promise((resolve, reject) => {
			if (!alive) return reject(STOP);
			if (active()) return resolve();
			waiting = () => (alive ? resolve() : reject(STOP));
		});
	const wait = (ms) =>
		new Promise((resolve, reject) => {
			const t = setTimeout(() => {
				timers.delete(t);
				if (alive) resolve();
				else reject(STOP);
			}, ms);
			timers.add(t);
		});
	const sleep = async (ms) => {
		await whenActive();
		await wait(ms);
		await whenActive();
	};
	const stop = () => {
		alive = false;
		if (io) io.disconnect();
		document.removeEventListener("visibilitychange", wake);
		timers.forEach(clearTimeout);
		timers.clear();
		wake();
	};
	return { sleep, stop };
}

function useDemo(script) {
	const ref = useRef(null);
	useEffect(() => {
		const el = ref.current;
		if (!el || reduced()) return undefined;
		const g = gate(el);
		script(g.sleep, el).catch(() => {});
		return g.stop;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	return ref;
}

const cls = (...names) => names.filter(Boolean).join(" ") || undefined;

/* ---------- Test: types the answer, grades it, fills the streak ---------- */

// Each word keeps its own streak, as in Test mode; a mastered word starts over
// as if a new word had taken its place in the pool.
const TEST_WORDS = [
	["Alacrity", "eager readiness", 3],
	["Obdurate", "unyielding", 1],
	["Venerate", "to revere", 2],
	["Laconic", "terse", 0],
];

export function TestScreen({ label, streakToMaster = 4 }) {
	const [s, setS] = useState({ word: "Alacrity", typed: "eager readiness", ok: true, show: true, streak: streakToMaster, verdict: "Mastered" });
	const ref = useDemo(async (sleep) => {
		const streaks = TEST_WORDS.map((w) => w[2]);
		for (let i = 0; ; i = (i + 1) % TEST_WORDS.length) {
			const [word, def] = TEST_WORDS[i];
			setS({ word, typed: "", ok: false, show: false, streak: streaks[i], verdict: "Correct" });
			await sleep(700);
			for (let k = 1; k <= def.length; k++) {
				const typed = def.slice(0, k);
				setS((p) => ({ ...p, typed }));
				await sleep(55 + Math.random() * 60);
			}
			await sleep(350);
			streaks[i] = Math.min(streakToMaster, streaks[i] + 1);
			const won = streaks[i] >= streakToMaster;
			setS((p) => ({ ...p, ok: true, show: true, streak: streaks[i], verdict: won ? "Mastered" : "Correct" }));
			await sleep(1700);
			if (won) {
				await sleep(400);
				streaks[i] = 0;
			}
		}
	});

	return (
		<div ref={ref} className="screen" aria-hidden="true">
			<div className="s-top">
				<span>{label}</span>
				<span className="seg">
					<span className="on">Normal</span>
					<span>Harder</span>
				</span>
			</div>
			<div className="s-mid">
				<div className="t-word">{s.word}</div>
				<div className={cls("t-input", s.ok && "ok")}>
					<span>{s.typed}</span>
					<span className="caret" />
				</div>
				<div className={cls("t-verdict", s.show && "show")}>{s.verdict}</div>
				<div className="t-streak">
					{Array.from({ length: streakToMaster }, (_, k) => (
						<i key={k} className={k < s.streak ? "on" : undefined} />
					))}
				</div>
			</div>
		</div>
	);
}

/* ---------- Practice: hovers down the options and picks the right one ---------- */

const PRACTICE = [
	{ q: "Mitigate", o: ["to revere", "to alleviate", "to hedge", "to absolve"], a: 1 },
	{ q: "Equivocate", o: ["to hedge", "to improve", "to waver", "to appease"], a: 0 },
	{ q: "Disparage", o: ["to strengthen", "to revere", "to speak slightingly", "to exhaust"], a: 2 },
];

export function PracticeScreen({ label }) {
	const [s, setS] = useState({ i: 0, hov: -1, ok: PRACTICE[0].a });
	const ref = useDemo(async (sleep) => {
		for (let i = 0; ; i = (i + 1) % PRACTICE.length) {
			const d = PRACTICE[i];
			setS({ i, hov: -1, ok: -1 });
			await sleep(800);
			for (let k = 0; k <= d.a; k++) {
				setS({ i, hov: k, ok: -1 });
				await sleep(380);
			}
			setS({ i, hov: -1, ok: d.a });
			await sleep(1800);
		}
	});
	const d = PRACTICE[s.i];

	return (
		<div ref={ref} className="screen" aria-hidden="true">
			<div className="s-top">
				<span>{label}</span>
				<span>In order</span>
			</div>
			<div className="prog">
				<i style={{ width: `${30 + s.i * 22}%` }} />
			</div>
			<div className="s-mid">
				<div className="mc-q">{d.q}</div>
				<div className="mc-opts">
					{d.o.map((t, k) => (
						<div key={k} className={cls("mc-opt", k === s.hov && "hov", k === s.ok && "ok")}>
							<b>{k + 1}</b>
							{t}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

/* ---------- Random Practice: deals a card, answers, throws it off ---------- */

const RANDOM = [
	{ q: "Enervate", o: ["to revere", "to exhaust", "wastefully lavish", "to alleviate"], a: 1, b: 0 },
	{ q: "Garrulous", o: ["talkative", "cowardly", "diligent", "obscure"], a: 0, b: 3 },
	{ q: "Torpor", o: ["fanatic", "lethargy", "clear", "fickle"], a: 1, b: 2 },
];

export function LearnScreen() {
	const [s, setS] = useState({ i: 0, card: "", bad: -1, ok: RANDOM[0].a });
	const ref = useDemo(async (sleep) => {
		for (let i = 0; ; i = (i + 1) % RANDOM.length) {
			const d = RANDOM[i];
			setS({ i, card: "pre", bad: -1, ok: -1 });
			await sleep(30);
			setS((p) => ({ ...p, card: "" }));
			await sleep(1100);
			// Every other card shows a wrong pick first, then the right answer.
			if (i % 2 === 0) {
				setS((p) => ({ ...p, bad: d.b }));
				await sleep(600);
			}
			setS((p) => ({ ...p, ok: d.a }));
			await sleep(1500);
			setS((p) => ({ ...p, card: "out" }));
			await sleep(500);
		}
	});
	const d = RANDOM[s.i];

	return (
		<div ref={ref} className="screen" aria-hidden="true">
			<div className="s-top">
				<span>Full word list</span>
				<span>Shuffled</span>
			</div>
			<div className="stack">
				<div className={cls("stack-card", s.card)}>
					<div className="mc-q">{d.q}</div>
					<div className="mc-opts two">
						{d.o.map((t, k) => (
							<div key={k} className={cls("mc-opt", k === s.bad && "bad", k === s.ok && "ok")}>
								{t}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

/* ---------- Flashcards: flips on its own, and on hover ---------- */

export function CardsScreen() {
	const [flip, setFlip] = useState(true);
	const ref = useDemo(async (sleep) => {
		setFlip(false);
		for (;;) {
			await sleep(2800);
			setFlip((f) => !f);
		}
	});
	useEffect(() => {
		const tile = ref.current && ref.current.closest(".mode");
		if (!tile || reduced()) return undefined;
		const onEnter = () => setFlip(true);
		tile.addEventListener("mouseenter", onEnter);
		return () => tile.removeEventListener("mouseenter", onEnter);
	}, [ref]);

	return (
		<div ref={ref} className="screen" aria-hidden="true">
			<div className="s-top">
				<div className="filters">
					<span className="on">All</span>
					<span>Mastered</span>
					<span>Unmastered</span>
				</div>
			</div>
			<div className="fc-scene">
				<div className={cls("fc-card", flip && "flip")}>
					<div className="fc-face">
						<span className="w">Prodigal</span>
						<small>adjective</small>
					</div>
					<div className="fc-face fc-back">
						<span className="w">wastefully lavish</span>
						<small>His prodigal spending left him deep in debt.</small>
					</div>
				</div>
			</div>
		</div>
	);
}

/* ---------- Daily Review: climbs the interval ladder ---------- */

export function ReviewScreen({ ladder }) {
	const steps = Array.isArray(ladder) && ladder.length ? ladder : [1];
	const rest = Math.min(2, steps.length - 1);
	const [k, setK] = useState(rest);
	const ref = useDemo(async (sleep) => {
		for (let j = 0; ; j = (j + 1) % steps.length) {
			setK(j);
			await sleep(1600);
		}
	});
	const n = steps[k];

	return (
		<div ref={ref} className="screen" aria-hidden="true">
			<div className="s-top">
				<span>Due today</span>
				<span className="s-pill">Daily Review</span>
			</div>
			<div className="s-mid">
				<div className="t-word t-word--sm">Venerate</div>
				<div className="ladder">
					{steps.map((d, j) => (
						<span key={d} className={cls(j < k && "on", j === k && "now")}>
							{d}d
						</span>
					))}
				</div>
				<div className="t-verdict show">
					Next review in {n} day{n === 1 ? "" : "s"}
				</div>
			</div>
		</div>
	);
}

/* ---------- In Context: types the missing word into the blank ---------- */

const SENTENCES = [
	["Asked about higher taxes, the governor chose to ", " instead of saying yes or no.", "equivocate"],
	["Her ", " reply, a single word, ended the interview.", "laconic"],
	["The new policy did little to ", " the damage from the flood.", "mitigate"],
];

export function ContextScreen() {
	const [s, setS] = useState({ i: 0, typed: SENTENCES[0][2], ok: true });
	const ref = useDemo(async (sleep) => {
		for (let i = 0; ; i = (i + 1) % SENTENCES.length) {
			const w = SENTENCES[i][2];
			setS({ i, typed: "", ok: false });
			await sleep(900);
			for (let k = 1; k <= w.length; k++) {
				const typed = w.slice(0, k);
				setS((p) => ({ ...p, typed }));
				await sleep(70);
			}
			setS((p) => ({ ...p, ok: true }));
			await sleep(2000);
		}
	});
	const [before, after] = SENTENCES[s.i];

	return (
		<div ref={ref} className="screen" aria-hidden="true">
			<div className="s-top">
				<span>In Context</span>
				<span className="s-pill">Sentence</span>
			</div>
			<div className="s-mid">
				<p className="cx">
					{before}
					<span className={cls("cx-blank", s.ok && "ok")}>{s.typed || " "}</span>
					{after}
				</p>
				<div className={cls("t-verdict", s.ok && "show")}>Correct</div>
			</div>
		</div>
	);
}
