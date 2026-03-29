/** @format */
"use client";

import React, { useEffect } from "react";
import Link from "next/link"; // Import Link
import "../styles/home.css";
import "../styles/menu.css";

export default function Page() {
	// keyboard: 1/2/3 jump to modes
	useEffect(() => {
		const map = { 1: "/play/test", 2: "/play/practice", 3: "/play/learn" };
		const onKey = (e) => {
			const url = map[e.key];
			if (url) window.location.href = url;
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return (
		<main id="home-landing" className="coral-v1">
			{/* bg */}
			<div className="coral-bg" aria-hidden="true" />
			<div className="coral-noise" aria-hidden="true" />

			{/* hero */}
			<section className="coral-hero">
				<div className="hero-copy">
					<div className="eyebrow">GRE Vocabulary Preparation</div>

					<h1 className="hero-title">
						Master every word. <span className="badge">800+ terms</span>
					</h1>

					<p className="hero-sub">The adaptive vocabulary platform trusted by thousands of GRE test-takers. Typo-forgiving input, spaced mastery tracking, and three proven study modes.</p>

					{/* CTA moved here - switched to Link */}
					<div className="hero-actions">
						<a className="primary-btn" href="/play/test">
							Start Studying
						</a>
						<Link className="secondary-btn" href="/wordpacks">
							Browse Word Packs
						</Link>
					</div>
				</div>

				{/* right column = banner only */}
				<div className="hero-media">
					<figure className="banner-frame">
						<img src="/images/GRETesterBanner.png" alt="GRE SCORE banner" className="banner" decoding="async" />
					</figure>
				</div>
			</section>

			{/* modes -> route links (Switched to Link) */}
			<section className="mode-tiles" aria-label="Choose a mode">
				<a className="tile primary" href="/play/test" title="Normal Mode (1)" accessKey="1">
					<div className="tile-bg-glow"></div>
					<div className="tile-icon-styled tile-icon--test" aria-hidden="true">T</div>
					<div className="tile-content">
						<div className="tile-title">Normal Mode</div>
						<div className="tile-sub">Type answers in a 5-word rotation. Master each word 4 times to advance.</div>
					</div>
				</a>
				<a className="tile" href="/play/practice" title="Flash Cards (2)" accessKey="2">
					<div className="tile-icon-styled tile-icon--practice" aria-hidden="true">F</div>
					<div className="tile-content">
						<div className="tile-title">Flash Cards</div>
						<div className="tile-sub">Multiple-choice review in sequential order. Ideal for first passes.</div>
					</div>
				</a>
				<a className="tile" href="/play/learn" title="Random Flash (3)" accessKey="3">
					<div className="tile-icon-styled tile-icon--learn" aria-hidden="true">R</div>
					<div className="tile-content">
						<div className="tile-title">Random Flash</div>
						<div className="tile-sub">Randomized multiple-choice to break pattern recognition.</div>
					</div>
				</a>
			</section>

			{/* features */}
			<section className="explain-grid">
				<article className="explain">
					<h3>Adaptive Mastery</h3>
					<p>Each word requires 4 correct answers before it&apos;s marked as learned. Miss once and the counter resets — building durable recall.</p>
				</article>
				<article className="explain">
					<h3>Typo Forgiveness</h3>
					<p>Our string-similarity engine accepts answers within 60% accuracy, so minor spelling mistakes won&apos;t break your flow.</p>
				</article>
				<article className="explain">
					<h3>Community Word Packs</h3>
					<p>Browse curated sets built by other test-takers, or create your own focused study pack from our 800+ word library.</p>
				</article>
				<article className="explain accent">
					<h3>Three Study Modes</h3>
					<p>Type-to-answer for deep encoding, sequential flashcards for review, and randomized drills for pattern-free recall.</p>
				</article>
			</section>

			{/* Footer */}
			<footer className="home-footer">
				<div className="footer-inner">
					<img src="/images/GREWebsiteLogo.png" alt="GRE Vocab Tester" className="footer-logo" />
					<p className="footer-tagline">Vocabulary preparation for serious test-takers.</p>
					<div className="footer-links">
						<Link href="/wordpacks">Word Packs</Link>
						<a href="/play/test">Normal Mode</a>
						<a href="/play/practice">Flash Cards</a>
						<a href="/play/learn">Random Flash</a>
					</div>
					<p className="footer-copy">&copy; {new Date().getFullYear()} GRE Vocab Tester. All rights reserved.</p>
				</div>
			</footer>
		</main>
	);
}
