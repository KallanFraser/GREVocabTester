/** @format */
"use client";

// Build or edit a custom pack: search the word list, add and remove words,
// name the pack, save it through lib/packs.js. Editing also offers Delete
// (ConfirmDialog, danger tone). "Copy share link" copies
// /wordpacks?words=a,b,c for the current selection. Loaded with next/dynamic
// so the vocabulary is only downloaded when the builder opens.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import ConfirmDialog from "../ConfirmDialog";
import { WORDS, WORD_COUNT, getWord } from "../../lib/words";
import {
	createCustomPack,
	deleteCustomPack,
	updateCustomPack,
	MAX_DESC_LENGTH,
	MAX_TITLE_LENGTH,
	MIN_PACK_WORDS,
} from "../../lib/packs";
import { copyText, foldText, shareUrl } from "./packUtils";

const RESULT_LIMIT = 60;
const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Known headwords only, canonical spelling, first-seen order.
function canonical(list) {
	const out = [];
	const seen = new Set();
	for (const w of Array.isArray(list) ? list : []) {
		const e = getWord(w);
		if (e && !seen.has(e.word)) {
			seen.add(e.word);
			out.push(e.word);
		}
	}
	return out;
}

const INDEX = WORDS.map((e) => ({ word: e.word, definition: e.definition, w: foldText(e.word), d: foldText(e.definition) }));

function search(query) {
	const q = foldText(query.trim());
	if (!q) return INDEX.slice(0, RESULT_LIMIT);
	const starts = [];
	const inWord = [];
	const inDef = [];
	for (const e of INDEX) {
		if (e.w.startsWith(q)) starts.push(e);
		else if (e.w.includes(q)) inWord.push(e);
		else if (e.d.includes(q)) inDef.push(e);
	}
	return [...starts, ...inWord, ...inDef].slice(0, RESULT_LIMIT);
}

function CloseIcon() {
	return (
		<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
			<path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
		</svg>
	);
}

// `pack` is the custom pack being edited, or null to create one. `initial`
// prefills a new pack ({ title, words }, for example from a share link).
export default function PackBuilder({ pack, initial, onSaved, onDeleted, onClose }) {
	const editing = !!(pack && pack.id);
	const start = editing ? pack : initial || {};
	const [title, setTitle] = useState(() => String(start.title || "").slice(0, MAX_TITLE_LENGTH));
	const [desc, setDesc] = useState(() => String(start.desc || "").slice(0, MAX_DESC_LENGTH));
	const [words, setWords] = useState(() => canonical(start.words));
	const [query, setQuery] = useState("");
	const [error, setError] = useState(null);
	const [copyState, setCopyState] = useState(null); // null | "copied" | url (copy failed: show it)
	const [confirmDelete, setConfirmDelete] = useState(false);
	const dialogRef = useRef(null);
	const titleRef = useRef(null);
	const confirmRef = useRef(false);
	confirmRef.current = confirmDelete;
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;
	const id = useId();

	const selected = useMemo(() => new Set(words), [words]);
	const results = useMemo(() => search(query), [query]);
	const short = Math.max(0, MIN_PACK_WORDS - words.length);

	useEffect(() => {
		const previous = document.activeElement;
		titleRef.current?.focus();
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		function onKey(e) {
			// The delete confirmation handles its own Escape.
			if (e.key !== "Escape" || confirmRef.current) return;
			e.preventDefault();
			onCloseRef.current?.();
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

	function onKeyDown(e) {
		if (e.key !== "Tab" || confirmRef.current) return;
		const items = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || []);
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

	function toggle(word) {
		setError(null);
		setCopyState(null);
		setWords((prev) => (prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]));
	}

	function save(e) {
		e.preventDefault();
		try {
			const fields = { title, desc, words };
			const saved = editing ? updateCustomPack(pack.id, fields) : createCustomPack(fields);
			if (!saved) throw new Error("This pack no longer exists. Close the builder and try again.");
			onSaved(saved, editing);
		} catch (err) {
			setError(err?.message || "The pack could not be saved.");
		}
	}

	async function copyLink() {
		if (!words.length) return;
		const url = shareUrl(words);
		setCopyState((await copyText(url)) ? "copied" : url);
	}

	function doDelete() {
		setConfirmDelete(false);
		if (editing) deleteCustomPack(pack.id);
		onDeleted(pack.id);
	}

	return (
		<div className="pb-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
			<form
				ref={dialogRef}
				className="pb"
				role="dialog"
				aria-modal="true"
				aria-labelledby={`${id}-title`}
				onKeyDown={onKeyDown}
				onSubmit={save}
			>
				<div className="pb-head">
					<h2 className="pb-heading" id={`${id}-title`}>
						{editing ? "Edit pack" : "Build a pack"}
					</h2>
					<button type="button" className="pb-close" aria-label="Close" onClick={onClose}>
						<CloseIcon />
					</button>
				</div>

				<div className="pb-fields">
					<label className="pb-field">
						<span>Pack name</span>
						<input
							ref={titleRef}
							type="text"
							value={title}
							maxLength={MAX_TITLE_LENGTH}
							placeholder="For example: Words I keep missing"
							onChange={(e) => {
								setTitle(e.target.value);
								setError(null);
							}}
						/>
					</label>
					<label className="pb-field">
						<span>Description (optional)</span>
						<input
							type="text"
							value={desc}
							maxLength={MAX_DESC_LENGTH}
							placeholder="What this pack is for"
							onChange={(e) => setDesc(e.target.value)}
						/>
					</label>
				</div>

				<div className="pb-cols">
					<div className="pb-col">
						<label className="pb-field">
							<span>Search {WORD_COUNT} words</span>
							<input
								type="search"
								value={query}
								placeholder="Search by word or definition"
								onChange={(e) => setQuery(e.target.value)}
							/>
						</label>
						<ul className="pb-results" aria-label="Search results">
							{results.length === 0 ? (
								<li className="pb-none">No words match this search.</li>
							) : (
								results.map((r) => {
									const on = selected.has(r.word);
									return (
										<li key={r.word}>
											<button
												type="button"
												className={`pb-result${on ? " is-on" : ""}`}
												aria-pressed={on}
												onClick={() => toggle(r.word)}
											>
												<span className="pb-result-word">{r.word}</span>
												<span className="pb-result-def">{r.definition}</span>
												<span className="pb-result-act">{on ? "Remove" : "Add"}</span>
											</button>
										</li>
									);
								})
							)}
						</ul>
					</div>

					<div className="pb-col">
						<div className="pb-sel-head">
							<span>
								{words.length} {words.length === 1 ? "word" : "words"} selected
							</span>
							{words.length > 0 && (
								<button type="button" className="btn-q" onClick={() => setWords([])}>
									Clear all
								</button>
							)}
						</div>
						{words.length === 0 ? (
							<p className="pb-none">Add at least {MIN_PACK_WORDS} words from the search results.</p>
						) : (
							<ul className="pb-chips" aria-label="Words in this pack">
								{words.map((w) => (
									<li key={w}>
										<span className="pb-chip">
											{w}
											<button type="button" aria-label={`Remove ${w}`} onClick={() => toggle(w)}>
												<CloseIcon />
											</button>
										</span>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>

				<p className="pb-status" aria-live="polite">
					{error
						? error
						: copyState === "copied"
						? "Share link copied."
						: short > 0
						? `Add ${short} more ${short === 1 ? "word" : "words"} to save this pack.`
						: ""}
				</p>
				{copyState && copyState !== "copied" && (
					<label className="pb-field pb-linkout">
						<span>Copying is blocked in this browser. Copy the link below.</span>
						<input type="text" readOnly value={copyState} onFocus={(e) => e.target.select()} />
					</label>
				)}

				<div className="pb-actions">
					{editing && (
						<button type="button" className="btn-q pb-delete" onClick={() => setConfirmDelete(true)}>
							Delete pack
						</button>
					)}
					<span className="pb-spacer" />
					<button type="button" className="btn-s" disabled={!words.length} onClick={copyLink}>
						Copy share link
					</button>
					<button type="button" className="btn-s" onClick={onClose}>
						Cancel
					</button>
					<button type="submit" className="btn-p" disabled={short > 0 || !title.trim()}>
						{editing ? "Save changes" : "Save pack"}
					</button>
				</div>
			</form>

			{confirmDelete && (
				<ConfirmDialog
					title={`Delete ${pack.title}?`}
					body="The pack is removed from Your packs and Favorites. The words themselves and every other pack are not affected."
					confirmLabel="Delete pack"
					onConfirm={doDelete}
					onCancel={() => setConfirmDelete(false)}
				/>
			)}
		</div>
	);
}
