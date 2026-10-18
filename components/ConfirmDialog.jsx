/** @format */
"use client";

// Shared confirmation dialog, ported from Wortschatz. Replaces window.confirm()
// so the dialog matches the app's surface tokens and can state exactly what is
// about to happen.
// - tone "danger" (default) is for actions that erase progress: red confirm,
//   and Cancel takes the initial focus so a stray Enter cannot erase anything.
// - tone "neutral" is for actions that lose nothing (Restart, Reshuffle): plain
//   white confirm, focused.
// Escape and a backdrop press cancel. Tab is trapped inside the dialog, page
// scroll is locked while it is open, and focus returns to whatever held it
// before the dialog opened. Render it only while open:
//   {confirm && <ConfirmDialog ... onCancel={() => setConfirm(false)} />}
import { useEffect, useId, useRef } from "react";
import "../styles/dialog.css";

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ConfirmDialog({
	title,
	body,
	confirmLabel = "Reset",
	cancelLabel = "Cancel",
	tone = "danger",
	onConfirm,
	onCancel,
}) {
	const dialogRef = useRef(null);
	const confirmRef = useRef(null);
	const cancelRef = useRef(null);
	const onCancelRef = useRef(onCancel);
	onCancelRef.current = onCancel;
	const neutral = tone === "neutral";
	const id = useId();
	const titleId = `${id}-title`;
	const bodyId = `${id}-body`;

	// Open: remember the focused element, focus the safe button, lock scroll and
	// listen for Escape. Close: undo all of it. Deliberately keyed on [] so a
	// parent re-render never steals focus back mid-interaction.
	useEffect(() => {
		const previous = document.activeElement;
		(neutral ? confirmRef : cancelRef).current?.focus();

		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		// Capture phase, so a page-level Escape handler does not also fire.
		function onKey(e) {
			if (e.key !== "Escape") return;
			e.preventDefault();
			e.stopPropagation();
			onCancelRef.current?.();
		}
		// Focus that lands outside the dialog (a click on the page behind, a
		// programmatic focus) is pulled back in.
		function onFocusIn(e) {
			const dialog = dialogRef.current;
			if (dialog && !dialog.contains(e.target)) (neutral ? confirmRef : cancelRef).current?.focus();
		}
		window.addEventListener("keydown", onKey, true);
		document.addEventListener("focusin", onFocusIn);

		return () => {
			window.removeEventListener("keydown", onKey, true);
			document.removeEventListener("focusin", onFocusIn);
			document.body.style.overflow = prevOverflow;
			if (previous && typeof previous.focus === "function" && document.contains(previous)) {
				previous.focus({ preventScroll: true });
			}
		};
	}, []);

	function onKeyDown(e) {
		// Keys pressed inside the dialog never reach the page's own window
		// listeners (for example a drill's Enter-to-submit).
		e.stopPropagation();
		if (e.key !== "Tab") return;
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

	const BodyTag = typeof body === "string" ? "p" : "div";

	return (
		<div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel?.()}>
			<div
				ref={dialogRef}
				className="dialog"
				role={neutral ? "dialog" : "alertdialog"}
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={body ? bodyId : undefined}
				onKeyDown={onKeyDown}
			>
				<h2 className="dialog-title" id={titleId}>
					{title}
				</h2>
				{body && (
					<BodyTag className="dialog-body" id={bodyId}>
						{body}
					</BodyTag>
				)}
				<div className="dialog-actions">
					<button ref={cancelRef} type="button" className="btn-s" onClick={() => onCancel?.()}>
						{cancelLabel}
					</button>
					<button
						ref={confirmRef}
						type="button"
						className={neutral ? "btn-neutral" : "btn-danger"}
						onClick={() => onConfirm?.()}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
