/** @format */
"use client";

// Test mode's Choose Words modal, ported from Wortschatz. It edits a private
// copy of the selection, so Cancel, Escape and a backdrop press leave the
// running drill exactly as it was; only "Drill these" hands the selection back.
// The page behind is scroll-locked while it is open and released on every way
// out (the effect cleanup runs on unmount, whichever button closed it).
//
//   keys      the words offered: the current pack's words, or every word
//   lookup    (key) => { word, definition } for a row
//   initial   the keys selected when it opens (filtered to `keys`)
//   min       the fewest words "Drill these" accepts
import { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/dialog.css";

const COUNT_WORD = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five" };

function foldSearch(s) {
	return String(s || "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "");
}

export default function ChooseWords({ keys, lookup, initial, min, onCancel, onCommit }) {
	// Only keys the picker offers can be selected, so a stale selection from
	// another scope never counts or gets committed.
	const [sel, setSel] = useState(() => {
		const offered = new Set(keys);
		return new Set((initial || []).filter((k) => offered.has(k)));
	});
	const [query, setQuery] = useState("");
	const dialogRef = useRef(null);
	const searchRef = useRef(null);
	const onCancelRef = useRef(onCancel);
	onCancelRef.current = onCancel;

	// Search text per key, built once: headword and short definition.
	const haystack = useMemo(() => {
		const m = new Map();
		for (const k of keys) {
			const e = lookup(k);
			m.set(k, foldSearch([k, e && e.definition].filter(Boolean).join(" ")));
		}
		return m;
	}, [keys, lookup]);

	const q = foldSearch(query.trim());
	const visible = useMemo(() => (q ? keys.filter((k) => haystack.get(k).includes(q)) : keys), [q, keys, haystack]);

	useEffect(() => {
		const previous = document.activeElement;
		searchRef.current?.focus();
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		function onKey(e) {
			if (e.key === "Escape") {
				e.preventDefault();
				onCancelRef.current?.();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = prevOverflow;
			if (previous && typeof previous.focus === "function" && document.contains(previous)) {
				previous.focus({ preventScroll: true });
			}
		};
	}, []);

	// Keep Tab inside the dialog, and keep keys pressed here away from the
	// drill's own window listeners.
	function onKeyDown(e) {
		if (e.key !== "Escape") e.stopPropagation();
		if (e.key !== "Tab" || !dialogRef.current) return;
		const items = [...dialogRef.current.querySelectorAll("input, button:not([disabled])")];
		if (!items.length) return;
		const first = items[0];
		const last = items[items.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	// Select all and Clear act on what the search shows, which is every word
	// when the search is empty.
	function setVisible(on) {
		setSel((prev) => {
			const next = new Set(prev);
			for (const k of visible) {
				if (on) next.add(k);
				else next.delete(k);
			}
			return next;
		});
	}

	function toggle(k, on) {
		setSel((prev) => {
			const next = new Set(prev);
			if (on) next.add(k);
			else next.delete(k);
			return next;
		});
	}

	const n = sel.size;
	const short = n < min;

	return (
		<div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
			<div
				ref={dialogRef}
				className="dialog cw"
				role="dialog"
				aria-modal="true"
				aria-labelledby="cw-title"
				aria-describedby="cw-desc"
				onKeyDown={onKeyDown}
			>
				<h2 className="dialog-title" id="cw-title">
					Choose words
				</h2>
				<p className="dialog-body cw-desc" id="cw-desc">
					Drill only the words you pick. You need at least {COUNT_WORD[min] || min}.
				</p>
				<div className="cw-tools">
					<input
						ref={searchRef}
						type="search"
						placeholder="Search words or definitions"
						aria-label="Search words"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
					<button type="button" className="btn-s" onClick={() => setVisible(true)}>
						Select all
					</button>
					<button type="button" className="btn-s" onClick={() => setVisible(false)}>
						Clear
					</button>
				</div>
				<div className="cw-list">
					{visible.length ? (
						visible.map((k) => {
							const e = lookup(k);
							return (
								<label key={k}>
									<input type="checkbox" checked={sel.has(k)} onChange={(ev) => toggle(k, ev.target.checked)} />
									<span className="cw-word">{k}</span>
									<span className="cw-def">{e ? e.definition : ""}</span>
								</label>
							);
						})
					) : (
						<p className="cw-empty">No words match.</p>
					)}
				</div>
				<div className="cw-foot">
					<span className={short ? "count warn" : "count"} aria-live="polite">
						{n} of {keys.length} selected{short ? `. Pick at least ${min}.` : ""}
					</span>
					<div className="dialog-actions">
						<button type="button" className="btn-s" onClick={onCancel}>
							Cancel
						</button>
						<button type="button" className="btn-p" disabled={short} onClick={() => onCommit(sel)}>
							Drill these
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
