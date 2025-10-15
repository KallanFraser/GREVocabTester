/** @format */
"use client";

import React, { useEffect, useState } from "react";
import "../styles/globals.css";
import TestMode from "../components/TestMode";
import PracticeMode from "../components/PracticeMode";
import LearnMode from "../components/LearnMode";

export default function Page() {
	const [mode, setMode] = useState(null);

	// Keyboard shortcuts: 1 = Normal, 2 = Flash, 3 = Random
	useEffect(() => {
		const map = { 1: "test", 2: "practice", 3: "learn" };
		const onKey = (e) => {
			const next = map[e.key];
			if (next) setMode(next);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	if (mode === "test") return <TestMode onBack={() => setMode(null)} />;
	if (mode === "practice") return <PracticeMode onBack={() => setMode(null)} />;
	if (mode === "learn") return <LearnMode onBack={() => setMode(null)} />;

	return (
		<main id="home-landing" className="coral-v1">
			{/* Coral mesh + subtle texture */}
			<div className="coral-bg" aria-hidden="true" />
			<div className="coral-noise" aria-hidden="true" />

			{/* HERO */}
			<section className="coral-hero">
				<div className="hero-copy">
					<div className="eyebrow">GRE Vocab • built to grind</div>

					<h1 className="hero-title">
						Crush vocab. <span className="badge">161 in 2 weeks</span>
					</h1>

					<p className="hero-sub">800+ words. Smart typo forgiveness. Mastery that sticks.</p>

					{/* Inline micro-proof */}
					<ul className="hero-pills" aria-hidden="true">
						<li>4× to master</li>
						<li>~80% typo leeway</li>
						<li>pick your set</li>
					</ul>
				</div>

				<div className="hero-media">
					<figure className="banner-frame">
						<img
							src="/images/GRETesterBanner.png"
							alt="GRE SCORE banner"
							className="banner"
							decoding="async"
						/>
					</figure>
				</div>
			</section>

			{/* Mode tiles */}
			<section className="mode-tiles" aria-label="Choose a mode">
				<button
					className="tile primary"
					onClick={() => setMode("test")}
					accessKey="1"
					title="Normal Mode (1)"
				>
					<div className="tile-icon">🎯</div>
					<div className="tile-title">Normal Mode</div>
					<div className="tile-sub">5-word loop • master 4×</div>
				</button>

				<button
					className="tile"
					onClick={() => setMode("practice")}
					accessKey="2"
					title="Flash Cards (2)"
				>
					<div className="tile-icon">🧠</div>
					<div className="tile-title">Flash Cards</div>
					<div className="tile-sub">ordered drill</div>
				</button>

				<button
					className="tile"
					onClick={() => setMode("learn")}
					accessKey="3"
					title="Random Flash (3)"
				>
					<div className="tile-icon">🎲</div>
					<div className="tile-title">Random Flash</div>
					<div className="tile-sub">shuffled recall</div>
				</button>
			</section>

			{/* Mini explains */}
			<section className="explain-grid">
				<article className="explain">
					<h3>Why Normal?</h3>
					<p>Quick reps, honest resets, visible progress every block.</p>
				</article>
				<article className="explain">
					<h3>Why Flash?</h3>
					<p>Clean start→finish pass to ramp before a test set.</p>
				</article>
				<article className="explain">
					<h3>Why Random?</h3>
					<p>Breaks patterns so recall sticks without cues.</p>
				</article>
				<article className="explain accent">
					<h3>Focused Sets</h3>
					<p>Pick exact words. Build a cram pack in seconds.</p>
				</article>
			</section>

			{/* Donate (simple Stripe links) */}
			<section className="donate" aria-label="Support this app">
				<h2 className="donate__title">Keep it free</h2>
				<p className="donate__sub">Support the project. Hosting costs are no fun.</p>

				<div className="donate__row">
					<a
						className="donate__btn"
						href="https://buy.stripe.com/6oUbJ0dk20xWgUp3BkbII00"
						target="_blank"
						rel="noopener noreferrer"
					>
						$3
					</a>
					<a
						className="donate__btn"
						href="https://buy.stripe.com/3cIbJ093MfsQ7jP6NwbII01"
						target="_blank"
						rel="noopener noreferrer"
					>
						$5
					</a>
					<a
						className="donate__btn donate__btn--accent"
						href="https://buy.stripe.com/fZu00ifsagwUcE9efYbII02"
						target="_blank"
						rel="noopener noreferrer"
					>
						$10
					</a>
				</div>

				<p className="donate__tiny">Card • Apple Pay • Google Pay • Link</p>
			</section>

			{/* Footer */}
			<section className="home-footer">
				<img src="/images/GREWebsiteLogo.png" alt="GRE logo" className="footer-logo" />
				<p>Built to grind. No fluff.</p>
			</section>
		</main>
	);
}
