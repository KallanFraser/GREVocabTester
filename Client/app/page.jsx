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
			{/* Animated backdrop (pure CSS) */}
			<div className="home-bg" aria-hidden="true" />

			{/* Hero */}
			<section className="home-hero">
				<div className="home-hero__content">
					<div className="home-hero__eyebrow">GRE Vocab Trainer</div>
					<h1 className="home-hero__title">
						Go from <span>zero</span> to <span>161 vibes</span>.
					</h1>
					<p className="home-hero__subtitle">
						800+ words. Three modes. Smart forgiveness. Mastery bars. Built to grind fast and
						actually stick.
					</p>

					<div className="home-cta-row">
						<button className="home-btn home-btn--primary" onClick={() => setMode("test")}>
							Start Normal Mode
						</button>
						<button className="home-btn" onClick={() => setMode("practice")}>
							Flash Cards
						</button>
						<button className="home-btn" onClick={() => setMode("learn")}>
							Flash Cards (Random)
						</button>
					</div>

					<div className="home-kbd">
						Tip: press <kbd>/</kbd> to focus the input in Normal Mode, then <kbd>Enter</kbd>.
					</div>
				</div>

				{/* Banner art */}
				<div className="home-hero__media">
					<img
						className="home-banner"
						src="/images/GRETesterBanner.png"
						alt="GRE SCORE banner with A+ cards"
						decoding="async"
					/>
				</div>
			</section>

			{/* Value strip */}
			<section className="home-strip">
				<div className="home-chip">
					<span className="home-chip__big">800+</span>
					<span className="home-chip__label">Words</span>
				</div>
				<div className="home-chip">
					<span className="home-chip__big">4×</span>
					<span className="home-chip__label">Mastery to pass</span>
				</div>
				<div className="home-chip">
					<span className="home-chip__big">~80%</span>
					<span className="home-chip__label">Typo forgiveness</span>
				</div>
				<div className="home-chip">
					<span className="home-chip__big">Pick</span>
					<span className="home-chip__label">Your word set</span>
				</div>
			</section>

			{/* Feature cards */}
			<section className="home-grid">
				<article className="home-card">
					<h3>Normal Mode</h3>
					<p>
						Five-word subset that evolves as you master terms. Get one right 4× in a row and it
						rotates out. Miss? Bars reset. It’s honest.
					</p>
					<button className="home-card__btn" onClick={() => setMode("test")}>
						Run it →
					</button>
				</article>

				<article className="home-card">
					<h3>Flash Cards</h3>
					<p>
						Clean left-to-right pass through the full list. Great for drilling new sets or warming
						up before a test block.
					</p>
					<button className="home-card__btn" onClick={() => setMode("practice")}>
						Drill →
					</button>
				</article>

				<article className="home-card">
					<h3>Random Flash</h3>
					<p>Same flash vibe, fully shuffled. Perfect for spaced recall without patterns.</p>
					<button className="home-card__btn" onClick={() => setMode("learn")}>
						Shuffle →
					</button>
				</article>

				<article className="home-card home-card--accent">
					<h3>Focused Sets</h3>
					<p>
						Pick the exact words you want to train. Build a cram pack for weak spots in seconds.
					</p>
					<button className="home-card__btn" onClick={() => setMode("test")}>
						Select in-app →
					</button>
				</article>
			</section>

			{/* Social proof / minimal flex */}
			<section className="home-footnote">
				<img className="home-logo" src="/images/GREWebsiteLogo.png" alt="GRE logo" />
				<p>Built to grind. No fluff. If you’re serious about scoring, this is the move.</p>
			</section>
		</main>
	);
}
