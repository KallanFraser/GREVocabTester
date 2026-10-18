"use client";

import { useEffect, useRef, useState } from "react";
import "../../styles/settings.css";
import {
	ADVANCE_DELAY_LABEL,
	ADVANCE_DELAY_OPTIONS,
	DEFAULT_SETTINGS,
	DIRECTIONS,
	DIRECTION_LABEL,
	loadSettings,
	saveSettings,
} from "../../lib/settings";
import { exportProgress, prepareImport, applyImport, resetAll } from "../../lib/progress";
import ConfirmDialog from "../../components/ConfirmDialog";
import { resolveBackgroundId } from "../../components/Background";
import { BACKGROUND_DESC, BACKGROUND_IDS, BACKGROUND_LABEL } from "../../lib/backgrounds/ids";
import { mountBackground } from "../../lib/backgrounds/engine";
import { loadPageWords } from "../../lib/backgrounds/sources";
import "../../styles/backgrounds.css";

// Imports are read into memory whole. A progress export is a small text file,
// so anything this large is not one, and it is refused before it is read.
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

// One live preview of the selected background, in a small contained box. It is
// a separate engine instance with `bus: false`: it never subscribes to answer
// events or bus words, so it cannot replace or detach the main background's
// subscription (Wortschatz L20). A background that fails here follows the same
// fallback chain as the real one (liquid to fireflies, anything else to plain).
function BackgroundPreview({ id, direction }) {
	const hostRef = useRef(null);
	const [failed, setFailed] = useState({});
	const shown = resolveBackgroundId(id, failed);

	useEffect(() => {
		const host = hostRef.current;
		if (!host || shown === "plain") return undefined;
		let alive = true;
		let handle = null;
		const onFail = (err) => {
			if (!alive) return;
			const next = BACKGROUND_IDS.includes(err?.fallback) ? err.fallback : "plain";
			setFailed((f) => (f[shown] ? f : { ...f, [shown]: next }));
		};
		const start = (words) => {
			if (!alive) return;
			try {
				handle = mountBackground(host, shown, { contained: true, bus: false, words: words || [], onFail });
			} catch (err) {
				onFail(err);
			}
		};
		if (shown === "constellation" || shown === "rain") {
			loadPageWords(shown, direction).then(start, () => start([]));
		} else {
			start([]);
		}
		return () => {
			alive = false;
			try {
				handle?.destroy();
			} catch {
				/* already torn down */
			}
		};
	}, [shown, direction]);

	let note = null;
	if (shown !== id) note = `${BACKGROUND_LABEL[id]} is not available in this browser. ${BACKGROUND_LABEL[shown]} is used instead.`;
	else if (shown === "plain") note = "No animation";

	return (
		<div className="bg-preview" role="img" aria-label={`Preview of the ${BACKGROUND_LABEL[shown]} background`}>
			<div ref={hostRef} className="bg-preview-host" />
			{note && <span className="bg-preview-note">{note}</span>}
		</div>
	);
}

// Every option with its name and a one-line description, plus a single preview
// of the selected one.
function BackgroundPicker({ labelId, value, onChange, direction }) {
	return (
		<div className="bg-picker">
			<div className="bg-options" role="radiogroup" aria-labelledby={labelId}>
				{BACKGROUND_IDS.map((id) => (
					<button
						key={id}
						type="button"
						role="radio"
						aria-checked={value === id}
						className="bg-option"
						onClick={() => onChange(id)}
					>
						<span className="bg-option-name">{BACKGROUND_LABEL[id]}</span>
						<span className="bg-option-desc">{BACKGROUND_DESC[id]}</span>
					</button>
				))}
			</div>
			<BackgroundPreview id={value} direction={direction} />
		</div>
	);
}

function Switch({ checked, onChange, labelledBy }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-labelledby={labelledBy}
			className="switch"
			onClick={() => onChange(!checked)}
		/>
	);
}

export default function Page() {
	const [settings, setSettings] = useState(DEFAULT_SETTINGS);
	const [hydrated, setHydrated] = useState(false);
	const [pasteOpen, setPasteOpen] = useState(false);
	const [pasteText, setPasteText] = useState("");
	const [msg, setMsg] = useState(null); // { type: "ok" | "err", text }
	const [confirmReset, setConfirmReset] = useState(false);
	const [pending, setPending] = useState(null); // validated import awaiting confirmation
	const resetRef = useRef(null);

	// Storage is read only after mount, so the server and first client render agree.
	useEffect(() => {
		setSettings(loadSettings());
		setHydrated(true);
	}, []);

	function update(patch) {
		setSettings(saveSettings(patch));
	}

	function onExport() {
		try {
			const blob = new Blob([JSON.stringify(exportProgress(), null, 2)], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			const now = new Date();
			const pad = (n) => String(n).padStart(2, "0");
			const name = `grevocabtester-progress-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
			a.download = name;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
			setMsg({ type: "ok", text: "Progress exported to " + name + "." });
		} catch {
			setMsg({ type: "err", text: "Export failed." });
		}
	}

	// Both import paths (a chosen file and pasted text) end here, so they get the
	// same validation. Nothing is written until the learner confirms.
	function stageImport(text) {
		let parsed;
		try {
			parsed = JSON.parse(text);
		} catch {
			setMsg({ type: "err", text: "That isn’t valid JSON. Nothing was imported." });
			return;
		}
		try {
			setPending(prepareImport(parsed));
			setMsg(null);
		} catch (e) {
			setMsg({ type: "err", text: `${e?.message || "Import failed."} Nothing was imported.` });
		}
	}

	function onConfirmImport() {
		const prepared = pending;
		setPending(null);
		try {
			applyImport(prepared);
			setPasteText("");
			setSettings(loadSettings());
			setMsg({ type: "ok", text: "Progress imported. Open a mode to see it." });
		} catch (e) {
			setMsg({ type: "err", text: e?.message || "Import failed." });
		}
	}

	function onFile(e) {
		const file = e.target.files?.[0];
		e.target.value = ""; // so choosing the same file again still fires change
		if (!file) return;
		if (file.size > MAX_IMPORT_BYTES) {
			setMsg({ type: "err", text: "That file is larger than 2 MB, so it isn’t a progress export. Nothing was imported." });
			return;
		}
		const reader = new FileReader();
		reader.onload = () => stageImport(String(reader.result ?? ""));
		reader.onerror = () => setMsg({ type: "err", text: "That file couldn’t be read. Nothing was imported." });
		reader.readAsText(file);
	}

	function onConfirmReset() {
		setConfirmReset(false);
		resetAll();
		setSettings(loadSettings());
		setMsg({ type: "ok", text: "All progress and settings have been reset." });
		resetRef.current?.focus();
	}

	function onCancelReset() {
		setConfirmReset(false);
		resetRef.current?.focus();
	}

	if (!hydrated) {
		return (
			<main id="settings">
				<div className="settings-wrap">
					<p className="settings-loading">Loading…</p>
				</div>
			</main>
		);
	}

	return (
		<main id="settings">
			<div className="settings-wrap">
				<header className="settings-head">
					<h1>Settings</h1>
					<p>Everything is stored in this browser. Nothing is sent anywhere.</p>
				</header>

				<section className="set-group" aria-labelledby="set-study">
					<h2 id="set-study">Study</h2>

					<div className="set-row">
						<div>
							<h3 id="set-direction">Default direction</h3>
							<p>
								Which side you are shown and which you answer in. Progress is kept separately for each.{" "}
								<span className="where">Test, Practice, Random Practice, Flashcards and Daily Review.</span>
							</p>
						</div>
						<div className="seg big" role="group" aria-labelledby="set-direction">
							{DIRECTIONS.map((d) => (
								<button key={d} type="button" aria-pressed={settings.direction === d} onClick={() => update({ direction: d })}>
									{DIRECTION_LABEL[d]}
								</button>
							))}
						</div>
					</div>
				</section>

				<section className="set-group" aria-labelledby="set-answers">
					<h2 id="set-answers">Answers</h2>

					<div className="set-row">
						<div>
							<h3 id="set-delay">Time before the next question</h3>
							<p>
								How long a correct answer stays on screen. Manual waits for Enter, Space or a click. Wrong
								answers always keep their own pause.{" "}
								<span className="where">Test, Practice, Random Practice, Daily Review and In Context.</span>
							</p>
						</div>
						<div className="seg" role="group" aria-labelledby="set-delay">
							{ADVANCE_DELAY_OPTIONS.map((v) => (
								<button key={v} type="button" aria-pressed={settings.advanceDelay === v} onClick={() => update({ advanceDelay: v })}>
									{ADVANCE_DELAY_LABEL[v]}
								</button>
							))}
						</div>
					</div>

					<div className="set-row">
						<div>
							<h3 id="set-sound">Feedback sounds</h3>
							<p>
								Play a short tone after each answer, one for correct and one for incorrect.{" "}
								<span className="where">Test, Practice, Random Practice, Daily Review and In Context.</span>
							</p>
						</div>
						<Switch
							checked={settings.feedbackSounds}
							onChange={(v) => update({ feedbackSounds: v })}
							labelledBy="set-sound"
						/>
					</div>
				</section>

				<section className="set-group" aria-labelledby="set-appearance">
					<h2 id="set-appearance">Background</h2>

					<div className="set-row set-row-stack">
						<div>
							<h3 id="set-play-bg">Play background</h3>
							<p>
								The animated background behind questions. Some react to your answers.{" "}
								<span className="where">
									Test, Practice, Random Practice, Flashcards, Daily Review and In Context.
								</span>
							</p>
						</div>
						<BackgroundPicker
							labelId="set-play-bg"
							value={settings.playBackground}
							onChange={(id) => update({ playBackground: id })}
							direction={settings.direction}
						/>
					</div>

					<div className="set-row set-row-stack">
						<div>
							<h3 id="set-pages-bg">Pages background</h3>
							<p>
								The background everywhere else. Changes apply to this page immediately.{" "}
								<span className="where">Home, Word Packs, Settings and every other page outside the study modes.</span>
							</p>
						</div>
						<BackgroundPicker
							labelId="set-pages-bg"
							value={settings.pagesBackground}
							onChange={(id) => update({ pagesBackground: id })}
							direction={settings.direction}
						/>
					</div>
				</section>

				<section className="set-group" aria-labelledby="set-progress">
					<h2 id="set-progress">Backup</h2>

					<div className="set-row">
						<div>
							<h3 id="set-export">Export</h3>
							<p>Download your progress and settings as a JSON file.</p>
						</div>
						<button type="button" className="btn-s" onClick={onExport}>
							Export progress
						</button>
					</div>

					<div className="set-row set-row-stack">
						<div>
							<h3 id="set-import">Import</h3>
							<p>Load a file you exported earlier. It is checked before anything changes.</p>
						</div>
						<div className="drop">
							<label className="btn-s file-pick">
								Choose a file
								<input type="file" accept=".json,application/json" className="file-input" onChange={onFile} />
							</label>
							<div>
								or{" "}
								<button
									type="button"
									className="btn-q"
									aria-expanded={pasteOpen}
									aria-controls="s-paste"
									onClick={() => setPasteOpen((open) => !open)}
								>
									paste the JSON instead
								</button>
							</div>
							<div id="s-paste" className="paste-box" hidden={!pasteOpen}>
								<textarea
									className="paste"
									value={pasteText}
									onChange={(e) => setPasteText(e.target.value)}
									placeholder={'{ "app": "grevocabtester", "version": 1, "data": { … } }'}
									rows={5}
									spellCheck={false}
									autoCapitalize="off"
									autoCorrect="off"
									autoComplete="off"
									aria-label="Progress JSON to import"
								/>
								<div className="paste-actions">
									<button type="button" className="btn-s" onClick={() => stageImport(pasteText)} disabled={!pasteText.trim()}>
										Import
									</button>
								</div>
							</div>
						</div>
					</div>

					<div className="set-row danger-row">
						<div>
							<h3 id="set-reset">Reset all progress</h3>
							<p>Clears mastery, review state, saved packs and settings on this device. This cannot be undone.</p>
						</div>
						<button ref={resetRef} type="button" className="btn-danger" onClick={() => setConfirmReset(true)}>
							Reset all progress
						</button>
					</div>
				</section>

				<p className={`status${msg ? (msg.type === "err" ? " err" : " ok") : ""}`} role="status">
					{msg?.text}
				</p>
			</div>

			{pending && (
				<ConfirmDialog
					tone="danger"
					title="Replace progress on this device?"
					body={
						pending.summary
							.map((s) => `${DIRECTION_LABEL[s.direction] || s.direction}: ${s.file} learned in the file, ${s.device} on this device.`)
							.join(" ") +
						" Importing overwrites the progress stored here and cannot be undone. Export first if you want to keep it."
					}
					confirmLabel="Overwrite and import"
					onConfirm={onConfirmImport}
					onCancel={() => setPending(null)}
				/>
			)}

			{confirmReset && (
				<ConfirmDialog
					tone="danger"
					title="Reset all progress?"
					body="Mastery, review state and saved packs will be cleared, and your settings return to their defaults. Export first if you might want it back."
					confirmLabel="Reset all progress"
					onConfirm={onConfirmReset}
					onCancel={onCancelReset}
				/>
			)}
		</main>
	);
}
