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
		<main id="home-landing">
			<div className="home-bg" aria-hidden="true" />

			{/* HERO — compact, punchy */}
			<section className="home-hero home-hero--v2">
				<div className="home-hero__content">
					<div className="home-hero__eyebrow">GRE Vocab Trainer</div>

					<h1 className="home-hero__title home-hero__title--gradient">
						Ace the vocab
						<span className="home-badge">161 in 2 weeks</span>
					</h1>

					<p className="home-hero__subtitle">800+ words. Smart forgiveness. Mastery that sticks.</p>

					<div className="home-hero__pills" aria-hidden="true">
						<span>4× to master</span>
						<span>~80% typo leeway</span>
						<span>pick your set</span>
					</div>
				</div>

				<div className="home-hero__media home-hero__media--frame">
					<img
						className="home-banner home-banner--float"
						src="/images/GRETesterBanner.png"
						alt="GRE SCORE banner"
						decoding="async"
					/>
				</div>
			</section>

			{/* Mode picker */}
			<section className="home-modes" aria-label="Choose a mode">
				<button className="mode-card mode-card--primary" onClick={() => setMode("test")}>
					<div className="mode-emoji" aria-hidden>
						🎯
					</div>
					<div className="mode-title">Normal Mode</div>
					<div className="mode-sub">5-word loop · master 4×</div>
				</button>

				<button className="mode-card" onClick={() => setMode("practice")}>
					<div className="mode-emoji" aria-hidden>
						🧠
					</div>
					<div className="mode-title">Flash Cards</div>
					<div className="mode-sub">ordered drill</div>
				</button>

				<button className="mode-card" onClick={() => setMode("learn")}>
					<div className="mode-emoji" aria-hidden>
						🎲
					</div>
					<div className="mode-title">Random Flash</div>
					<div className="mode-sub">shuffled recall</div>
				</button>
			</section>

			{/* Mini details */}
			<section className="home-grid home-grid--compact">
				<article className="home-card">
					<h3>Why Normal?</h3>
					<p>Small loop, fast reps, honest resets.</p>
				</article>
				<article className="home-card">
					<h3>Why Flash?</h3>
					<p>Clean end-to-end ramp. Perfect warm-up.</p>
				</article>
				<article className="home-card">
					<h3>Why Random?</h3>
					<p>Break patterns. Recall without cues.</p>
				</article>
				<article className="home-card home-card--accent">
					<h3>Focused Sets</h3>
					<p>Build a cram pack in seconds.</p>
				</article>
			</section>

			{/* Footer note — small logo */}
			<section className="home-footnote">
				<img className="home-logo" src="/images/GREWebsiteLogo.png" alt="GRE logo" />
				<p>Built to grind. No fluff.</p>
			</section>
		</main>
	);
}
