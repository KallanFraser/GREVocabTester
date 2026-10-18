/** @format */
"use client";

// The last-resort error page: Next renders it in place of the root layout when
// the layout itself throws, so it brings its own <html> and <body> and no
// stylesheet from the app. Styles are inline, with the globals.css token values
// written out. Nothing here reads storage while rendering; "Reset saved data"
// loads lib/progress.js only when the learner confirms, so a broken module
// cannot stop this page from showing.

import { useEffect, useRef, useState } from "react";

const BG = "#050505";
const TEXT = "#f2f2f2";
const MUTED = "#a3a3a3";
const CORAL = "#ea5746";
const BLUE = "#64b5ff";
const DANGER = "#e5484d";

const btnBase = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	minHeight: "2.75rem",
	padding: "0 1.25rem",
	borderRadius: "999px",
	font: "inherit",
	fontSize: "0.95rem",
	fontWeight: 600,
	cursor: "pointer",
};

const btnPrimary = { ...btnBase, background: CORAL, color: "#fff", border: `1px solid ${CORAL}` };
const btnSecondary = { ...btnBase, background: "transparent", color: TEXT, border: "1px solid rgba(255,255,255,0.22)" };
const btnDanger = { ...btnBase, background: DANGER, color: "#fff", border: `1px solid ${DANGER}` };

export default function GlobalError({ error, reset }) {
	// null | "confirm" | "working" | "failed"
	const [resetState, setResetState] = useState(null);
	const cancelRef = useRef(null);

	useEffect(() => {
		if (error) console.error(error);
	}, [error]);

	// The confirm opens with Cancel focused, like every destructive dialog.
	useEffect(() => {
		if (resetState === "confirm") cancelRef.current?.focus();
	}, [resetState]);

	function reload() {
		try {
			window.location.reload();
		} catch {
			if (typeof reset === "function") reset();
		}
	}

	async function resetSavedData() {
		setResetState("working");
		try {
			const { resetAll } = await import("../lib/progress");
			resetAll();
			window.location.assign("/");
		} catch {
			setResetState("failed");
		}
	}

	return (
		<html lang="en">
			<head>
				<title>Something went wrong | GRE Vocab Tester</title>
				<meta name="robots" content="noindex" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</head>
			<body
				style={{
					margin: 0,
					minHeight: "100vh",
					background: BG,
					color: TEXT,
					fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "3rem 1.25rem",
					boxSizing: "border-box",
					textAlign: "center",
				}}
			>
				<main style={{ maxWidth: "32rem" }}>
					<p
						style={{
							margin: 0,
							color: CORAL,
							fontSize: "0.8rem",
							fontWeight: 600,
							letterSpacing: "0.12em",
							textTransform: "uppercase",
						}}
					>
						Unexpected error
					</p>
					<h1 style={{ margin: "0.6rem 0 0.8rem", fontSize: "2rem", lineHeight: 1.1 }}>Something went wrong</h1>
					<p style={{ margin: "0 0 1.8rem", color: MUTED, fontSize: "0.95rem", lineHeight: 1.6 }}>
						The page could not be displayed. Reloading usually fixes this. If the problem keeps coming back, resetting
						the progress and settings saved in this browser may help.
					</p>

					{resetState === null && (
						<div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
							<button type="button" style={btnPrimary} onClick={reload}>
								Reload
							</button>
							<button type="button" style={btnSecondary} onClick={() => setResetState("confirm")}>
								Reset saved data
							</button>
						</div>
					)}

					{resetState !== null && (
						<div
							role="alertdialog"
							aria-labelledby="ge-confirm-title"
							aria-describedby="ge-confirm-desc"
							style={{
								margin: "0 auto",
								padding: "1.25rem",
								borderRadius: "14px",
								border: `1px solid ${DANGER}`,
								background: "rgba(229,72,77,0.08)",
								textAlign: "left",
							}}
						>
							<h2 id="ge-confirm-title" style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", color: TEXT }}>
								Reset saved data?
							</h2>
							<p id="ge-confirm-desc" style={{ margin: "0 0 1.1rem", color: MUTED, fontSize: "0.9rem", lineHeight: 1.55 }}>
								This deletes all progress, review schedules, custom packs, favorites and settings stored in this
								browser. It cannot be undone.
							</p>
							{resetState === "failed" && (
								<p role="alert" style={{ margin: "0 0 1rem", color: DANGER, fontSize: "0.9rem" }}>
									The data could not be reset. Try clearing this site's data in your browser settings.
								</p>
							)}
							<div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
								<button
									type="button"
									ref={cancelRef}
									style={{ ...btnSecondary, outlineColor: BLUE }}
									onClick={() => setResetState(null)}
									disabled={resetState === "working"}
								>
									Cancel
								</button>
								<button type="button" style={btnDanger} onClick={resetSavedData} disabled={resetState === "working"}>
									{resetState === "working" ? "Resetting…" : "Reset saved data"}
								</button>
							</div>
						</div>
					)}
				</main>
			</body>
		</html>
	);
}
