/** @format */
"use client";

// Flashcards: flip through a pack (or the full word list) with no typing and
// no grading. Ported from Wortschatz's FlashcardMode.
//
// This mode NEVER writes progress. It reads durable mastery (loadKnown) only to
// power the Mastered / Unmastered filter. The only thing it stores is the
// direction, through saveSettings, when the learner changes it. Restart resets
// local view state only (deck order, position, flip), so it needs no
// confirmation.
//
// Pack context comes from the URL through lib/packs.js resolvePackContext
// (?pack=<id>, legacy ?pack=1,5,9, ?words=, ?id=, the old one-time handoff).
// useSearchParams requires a Suspense boundary under static export; the route
// (app/play/cards/page.jsx) provides it.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import "../styles/cards.css";
import PlayHeader from "./PlayHeader";
import { WORDS, getWord } from "../lib/words";
import { MISSING_PACK_NOTICE, isMissingPack, resolvePackContext } from "../lib/packs";
import { loadKnown, scopeIdFor } from "../lib/progress";
import { loadSettings, saveSettings, DEFAULT_DIRECTION, DIRECTION_D2W } from "../lib/settings";
import { cryptoRng } from "../lib/hard-scheduler";
import { setBgWords } from "../lib/backgrounds/bus";

const ALL_KEYS = WORDS.map((e) => e.word);
const FILTERS = [
	{ key: "all", label: "All" },
	{ key: "mastered", label: "Mastered" },
	{ key: "unmastered", label: "Unmastered" },
];

function shuffle(source) {
	const arr = [...source];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.min(i, Math.floor(cryptoRng() * (i + 1)));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function computeFiltered(scopeArr, masteredSet, mode) {
	if (mode === "mastered") return scopeArr.filter((k) => masteredSet.has(k));
	if (mode === "unmastered") return scopeArr.filter((k) => !masteredSet.has(k));
	return scopeArr;
}

// Pack words mapped to their canonical headwords; unknown words are dropped.
function canonicalWords(list) {
	const seen = new Set();
	const out = [];
	for (const w of list || []) {
		const entry = getWord(w);
		if (!entry || seen.has(entry.word)) continue;
		seen.add(entry.word);
		out.push(entry.word);
	}
	return out;
}

export default function Flashcards() {
	const searchParams = useSearchParams();
	const search = searchParams ? searchParams.toString() : "";

	const [direction, setDirection] = useState(DEFAULT_DIRECTION);
	const [hydrated, setHydrated] = useState(false);
	const [scope, setScope] = useState([]); // full ordered key list for the pack or the word list
	const [pack, setPack] = useState(null); // { id, title } or null
	const [mastered, setMastered] = useState(() => new Set());
	const [filterMode, setFilterMode] = useState("all");
	const [shuffleOn, setShuffleOn] = useState(true);
	const [deck, setDeck] = useState([]);
	const [position, setPosition] = useState(0);
	const [flipped, setFlipped] = useState(false);
	// A ?pack= or ?id= that named no pack; the cards fall back to all words.
	const [missingPack, setMissingPack] = useState(false);

	const currentKey = deck.length ? deck[position] : null;

	// The single place every control (direction, filter, order, restart) routes
	// through: refilter, reorder, jump to the first card face-up.
	function rebuildDeck(scopeArr, masteredSet, mode, shuffled) {
		const filtered = computeFiltered(scopeArr, masteredSet, mode);
		setDeck(shuffled ? shuffle(filtered) : filtered);
		setPosition(0);
		setFlipped(false);
	}

	// ---- Hydrate settings and scope after mount (storage is client-only) ----
	useEffect(() => {
		let alive = true;
		(async () => {
			const s = loadSettings();
			let ctx = null;
			try {
				ctx = await resolvePackContext(search);
			} catch {
				ctx = null;
			}
			if (!alive) return;
			// A pack that no longer exists: all words, a notice, and the address bar
			// loses the dead ?pack= / ?id= so a reload does not repeat it.
			if (isMissingPack(ctx)) {
				ctx = null;
				setMissingPack(true);
				try {
					const url = new URL(window.location.href);
					url.searchParams.delete("pack");
					url.searchParams.delete("id");
					const q = url.searchParams.toString();
					window.history.replaceState(window.history.state, "", url.pathname + (q ? `?${q}` : "") + url.hash);
				} catch {
					/* the URL is a convenience; the cards still work */
				}
			}
			const words = ctx ? canonicalWords(ctx.words) : [];
			if (words.length) setMissingPack(false);
			const scopeKeys = words.length ? words : ALL_KEYS;
			const packInfo = words.length ? { id: ctx.id || null, title: ctx.title || "Word pack" } : null;
			const m = loadKnown(s.direction, scopeIdFor(packInfo && packInfo.id), scopeKeys);

			setDirection(s.direction);
			setScope(scopeKeys);
			setPack(packInfo);
			setMastered(m);
			setFilterMode("all");
			rebuildDeck(scopeKeys, m, "all", true);
			setHydrated(true);
		})();
		return () => {
			alive = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search]);

	// ---- Publish the scope's words to the background. Display only. ----
	useEffect(() => {
		if (!hydrated) return;
		setBgWords(scope.map((word) => ({ word, mastered: mastered.has(word), current: word === currentKey })));
	}, [hydrated, scope, mastered, currentKey]);

	function flipCard() {
		setFlipped((f) => !f);
	}

	function next() {
		if (deck.length < 2) return;
		if (shuffleOn && position + 1 >= deck.length) {
			// Deck exhausted: a fresh permutation rather than a repeat, without the
			// same card straddling the boundary.
			const fresh = shuffle(computeFiltered(scope, mastered, filterMode));
			if (fresh.length > 1 && fresh[0] === deck[deck.length - 1]) [fresh[0], fresh[1]] = [fresh[1], fresh[0]];
			setDeck(fresh);
			setPosition(0);
			setFlipped(false);
			return;
		}
		setPosition((p) => (p + 1) % deck.length);
		setFlipped(false);
	}

	function prev() {
		if (deck.length < 2) return;
		setPosition((p) => (p - 1 + deck.length) % deck.length);
		setFlipped(false);
	}

	function switchDirection(dir) {
		if (dir === direction) return;
		const s = saveSettings({ direction: dir });
		setDirection(s.direction);
		const m = loadKnown(s.direction, scopeIdFor(pack && pack.id), scope);
		setMastered(m);
		rebuildDeck(scope, m, filterMode, shuffleOn);
	}

	function switchFilter(mode) {
		if (mode === filterMode) return;
		setFilterMode(mode);
		rebuildDeck(scope, mastered, mode, shuffleOn);
	}

	function toggleOrder() {
		const shuffled = !shuffleOn;
		setShuffleOn(shuffled);
		rebuildDeck(scope, mastered, filterMode, shuffled);
	}

	function restart() {
		rebuildDeck(scope, mastered, filterMode, shuffleOn);
	}

	// ---- Keyboard: Space flips, Left/Right arrows move, Enter flips the focused card ----
	// Attached once; it calls whatever handler the latest render left in the
	// ref, so it never reads stale state.
	const keyHandler = useRef(null);
	keyHandler.current = (e) => {
		if (!hydrated || e.altKey || e.ctrlKey || e.metaKey) return;
		const t = e.target;
		const tag = (t?.tagName || "").toLowerCase();
		if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
		if (e.key === " " || e.code === "Space") {
			// Only when focus is on the card or nowhere in particular. A focused
			// button keeps its own Space activation, so one press never both flips
			// the card and presses Next.
			const onCard = t?.closest?.(".fc");
			if (!onCard && t !== document.body && t !== document.documentElement) return;
			if (!deck.length) return;
			e.preventDefault();
			flipCard();
		} else if (e.key === "ArrowLeft") {
			e.preventDefault();
			prev();
		} else if (e.key === "ArrowRight") {
			e.preventDefault();
			next();
		}
	};
	useEffect(() => {
		const onKey = (e) => keyHandler.current?.(e);
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// ---- The two faces for the current card ----
	const entry = currentKey ? getWord(currentKey) : null;
	const isMastered = currentKey ? mastered.has(currentKey) : false;
	const d2w = direction === DIRECTION_D2W;
	let front = null;
	let back = null;
	if (entry) {
		const pos = entry.pos ? <span className="pos">{entry.pos}</span> : null;
		const details = (
			<>
				{entry.fullDefinition && <p className="full">{entry.fullDefinition}</p>}
				{entry.example && <p className="ex">{entry.example}</p>}
			</>
		);
		if (d2w) {
			front = (
				<>
					<span className="gl">{entry.definition}</span>
					{pos}
				</>
			);
			back = (
				<>
					<span className="w">{entry.word}</span>
					{pos}
					{details}
				</>
			);
		} else {
			front = (
				<>
					<span className="w">{entry.word}</span>
					{pos}
				</>
			);
			back = (
				<>
					<span className="gl">{entry.definition}</span>
					{details}
				</>
			);
		}
	}

	const total = deck.length;
	const current = total ? position + 1 : 0;
	const progressPct = total ? Math.round((current / total) * 100) : 0;
	const setNoun = pack ? "pack" : "word list";
	const emptyText =
		filterMode === "mastered"
			? `No mastered words in this ${setNoun} yet in this direction.`
			: filterMode === "unmastered"
				? `Every word in this ${setNoun} is mastered in this direction.`
				: `This ${setNoun} has no words.`;

	const progress =
		hydrated && total > 0 ? (
			<>
				<div className="bar" role="progressbar" aria-label="Position in the deck" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current}>
					<i style={{ width: `${progressPct}%` }} />
				</div>
				<span>
					{current} of {total}
				</span>
			</>
		) : null;

	return (
		<div className="fc-page">
			<PlayHeader
				href={pack ? "/wordpacks" : "/"}
				backLabel={pack ? "Packs" : "Menu"}
				title="Flashcards"
				packName={pack ? pack.title : "All words"}
				progress={progress}
				direction={direction}
				onDirectionChange={switchDirection}
				ready={hydrated}
			>
				<span className="seg" role="group" aria-label="Filter by progress">
					{FILTERS.map((f) => (
						<button key={f.key} type="button" onClick={() => switchFilter(f.key)} aria-pressed={filterMode === f.key}>
							{f.label}
						</button>
					))}
				</span>
				<button
					type="button"
					className="pill"
					onClick={toggleOrder}
					aria-label={`Card order ${shuffleOn ? "Shuffled" : "In order"}. Switch to ${shuffleOn ? "In order" : "Shuffled"}`}
				>
					{shuffleOn ? "Shuffled" : "In order"}
				</button>
			</PlayHeader>
			{hydrated && missingPack && (
				<div className="notice" role="status">
					<p>{MISSING_PACK_NOTICE}</p>
					<button type="button" className="btn-q" onClick={() => setMissingPack(false)}>
						Dismiss
					</button>
				</div>
			)}

			<main className="fc-stage">
				<div className="fc-wrap">
					{!hydrated ? (
						<p className="fc-loading">Loading…</p>
					) : !total ? (
						<div className="fc-empty">
							<p>{emptyText}</p>
							{filterMode !== "all" && (
								<button type="button" className="btn-q" onClick={() => switchFilter("all")}>
									Show all
								</button>
							)}
						</div>
					) : (
						<>
							<div className="fc-scene">
								<div
									className={`fc${flipped ? " flipped" : ""}`}
									role="button"
									tabIndex={0}
									aria-label={flipped ? "Flashcard, showing the answer. Press to flip back." : "Flashcard, showing the prompt. Press to flip."}
									onClick={flipCard}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											flipCard();
										}
									}}
								>
									<div className={`fc-face fc-front${d2w ? " fc-def" : ""}${isMastered ? " has-tag" : ""}`} aria-hidden={flipped}>
										{isMastered && <span className="tag done corner">Mastered</span>}
										<div className="fc-in">{front}</div>
									</div>
									<div className={`fc-face fc-back${d2w ? "" : " fc-def"}`} aria-hidden={!flipped}>
										<div className="fc-in">{back}</div>
									</div>
								</div>
							</div>

							<div className="fc-nav">
								<button type="button" className="btn-s" onClick={prev} disabled={total < 2}>
									Previous
								</button>
								<button type="button" className="btn-q" onClick={restart}>
									Restart
								</button>
								<button type="button" className="btn-s" onClick={next} disabled={total < 2}>
									Next
								</button>
							</div>
							<p className="fc-keys">
								<span className="fc-keys-kbd">
									<kbd>Space</kbd> or <kbd>Enter</kbd> flip &nbsp; <kbd>←</kbd> <kbd>→</kbd> move
								</span>
								<span className="fc-keys-touch">Tap the card to flip</span>
							</p>
						</>
					)}
				</div>
			</main>
		</div>
	);
}
