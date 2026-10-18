/** @format */
"use client";

// The App Router error boundary: shown when a page throws while rendering.
// The likeliest cause in a static, storage-backed app is a saved value the
// code cannot read, so besides Reload it offers a reset of everything this
// app stores in the browser, behind the red confirmation dialog. Styles are
// inline, as on the 404 page; buttons come from ui.css. It imports only
// lib/progress (for resetAll) and ConfirmDialog, so it cannot fail at load
// for the same reason as the page it replaces.

import { useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import { resetAll } from "../lib/progress";

function reload() {
	try {
		window.location.reload();
	} catch {
		/* nothing more to try */
	}
}

export default function ErrorPage() {
	const [confirm, setConfirm] = useState(false);

	function onConfirmReset() {
		try {
			resetAll();
		} catch {
			/* reload anyway; the page reads storage defensively */
		}
		reload();
	}

	return (
		<main
			style={{
				position: "relative",
				zIndex: 1,
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "6rem 1.25rem 3rem",
				textAlign: "center",
			}}
		>
			<div style={{ maxWidth: "32rem" }}>
				<h1 style={{ margin: "0 0 0.8rem", fontSize: "var(--fs-xl)", color: "var(--text)", lineHeight: 1.1 }}>
					Something went wrong
				</h1>
				<p style={{ margin: "0 0 1.8rem", color: "var(--muted)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>
					This page could not be shown. Reloading often fixes it; if it keeps happening, a value saved in this
					browser may be damaged, and resetting the saved data should clear it.
				</p>
				<div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
					<button type="button" className="btn-p" onClick={reload}>
						Reload
					</button>
					<button type="button" className="btn-s" onClick={() => setConfirm(true)}>
						Reset saved data
					</button>
				</div>
			</div>

			{confirm && (
				<ConfirmDialog
					tone="danger"
					title="Reset all saved data?"
					body="This removes all progress, review schedules, settings, favorites and custom packs stored in this browser, then reloads the page. It cannot be undone."
					confirmLabel="Reset saved data"
					onConfirm={onConfirmReset}
					onCancel={() => setConfirm(false)}
				/>
			)}
		</main>
	);
}
