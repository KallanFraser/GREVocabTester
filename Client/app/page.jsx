/** @format */
"use client";

import React, { useState } from "react";
import "../styles/globals.css";
import TestMode from "../components/TestMode";
import PracticeMode from "../components/PracticeMode";
import LearnMode from "../components/LearnMode";

export default function Page() {
	const [mode, setMode] = useState(null);

	if (mode === "test") return <TestMode onBack={() => setMode(null)} />;
	if (mode === "practice") return <PracticeMode onBack={() => setMode(null)} />;
	if (mode === "learn") return <LearnMode onBack={() => setMode(null)} />;

	return (
		<main id="menu">
			<div className="menu-card">
				<div className="menu-title">
					<h1>GRE Vocab Trainer</h1>
					<p>Pick a mode. Switch whenever.</p>
				</div>

				<div className="menu-buttons">
					<button className="button-like menu-button" onClick={() => setMode("test")}>
						Normal Mode
					</button>
					<button className="button-like menu-button" onClick={() => setMode("practice")}>
						Flash Card Mode
					</button>
					<button className="button-like menu-button" onClick={() => setMode("learn")}>
						Flash Card Mode (Random)
					</button>
				</div>
			</div>
		</main>
	);
}
