/** @format */
"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import "../styles/home.css";
import "../styles/menu.css";

export default function Page() {
	// keyboard: 1/2/3 jump to modes (global listener — works anywhere on page)
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
			{/* JSON-LD structured data — WebApplication schema */}
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify({
						"@context": "https://schema.org",
						"@type": "WebApplication",
						name: "GRE Vocab Tester",
						url: "https://grevocabtester.com",
						description:
							"Free GRE vocabulary practice built around active recall. Drill 800 high-frequency GRE words across three study modes — no signup, no paywall.",
						applicationCategory: "EducationalApplication",
						operatingSystem: "Web",
						browserRequirements: "Requires JavaScript. Requires HTML5.",
						inLanguage: "en",
						isAccessibleForFree: true,
						offers: {
							"@type": "Offer",
							price: 0,
							priceCurrency: "USD",
						},
						creator: {
							"@type": "Person",
							name: "Kallan Fraser",
						},
					}),
				}}
			/>

			{/* bg */}
			<div className="coral-bg" aria-hidden="true" />
			<div className="coral-noise" aria-hidden="true" />

			{/* ============ HERO ============ */}
			<section className="coral-hero">
				<div className="container hero-container">
					<div className="hero-copy">
						<div className="eyebrow">GRE Vocabulary Preparation</div>
						<h1 className="hero-title">Master every word.</h1>
						<p className="hero-sub">
							The adaptive vocabulary platform trusted by thousands of GRE test-takers. Typo-forgiving
							input, spaced mastery tracking, and three proven study modes.
						</p>
						<div className="hero-actions">
							<a className="primary-btn" href="/play/test">
								Start Studying
							</a>
							<Link className="secondary-btn" href="/wordpacks">
								Browse Word Packs
							</Link>
						</div>
					</div>
					<div className="hero-media">
						<figure className="banner-frame">
							<img
								src="/images/GRETesterBanner.webp"
								srcSet="/images/GRETesterBanner-mobile.webp 600w, /images/GRETesterBanner.webp 1200w"
								sizes="(max-width: 900px) 92vw, 480px"
								alt="GRE SCORE banner"
								className="banner"
								width="1200"
								height="300"
								decoding="async"
							/>
						</figure>
					</div>
				</div>
			</section>

			{/* ============ HOW IT WORKS ============ */}
			<section className="how" aria-labelledby="how-h2">
				<div className="container">
					<div className="section-head section-head--narrow">
						<div className="section-eyebrow">The Modes</div>
						<h2 id="how-h2" className="section-h2">
							How it works
						</h2>
						<p className="section-lede">
							Three study modes, each built around active recall rather than passive review. They
							reinforce the same words in different ways so the learning holds.
						</p>
					</div>

					<div className="mode-tiles">
						<a className="tile primary" href="/play/test" title="Normal Mode (1)" accessKey="1">
							<div className="tile-media">
								<img
									src="/images/NormalModeScreenshot.png"
									alt="Normal Mode screen: a vocabulary word above a typed-answer input, with a mastery tracker showing progress toward four correct answers."
									className="tile-screenshot"
									width="1772"
									height="1235"
									loading="lazy"
									decoding="async"
								/>
							</div>
							<div className="tile-content">
								<h3 className="tile-title">Normal Mode</h3>
								<p className="tile-sub">
									Type the definition from memory. Each word rotates through a small focused set and has
									to be answered correctly four times before it&apos;s marked as learned. Miss once and
									the counter resets, which forces genuine recall, not recognition. Typo-tolerant, so a
									small spelling slip won&apos;t break your momentum.
								</p>
								<span className="tile-cta">
									<span>Start typing</span>
									<span className="tile-cta-arrow" aria-hidden="true">
										→
									</span>
								</span>
							</div>
						</a>

						<a className="tile" href="/play/practice" title="Flash Cards (2)" accessKey="2">
							<div className="tile-media">
								<img
									src="/images/FlashcardScreenshot.png"
									alt="Flash Cards screen: a vocabulary word with four multiple-choice definition options laid out in a grid."
									className="tile-screenshot"
									width="1689"
									height="1003"
									loading="lazy"
									decoding="async"
								/>
							</div>
							<div className="tile-content">
								<h3 className="tile-title">Flash Cards</h3>
								<p className="tile-sub">
									Sequential multiple-choice review through the full word list. The best way to make a
									first pass and see where you stand before committing to deeper drilling.
								</p>
								<span className="tile-cta">
									<span>Start review</span>
									<span className="tile-cta-arrow" aria-hidden="true">
										→
									</span>
								</span>
							</div>
						</a>

						<a className="tile" href="/play/learn" title="Random Flash (3)" accessKey="3">
							<div className="tile-media">
								<img
									src="/images/RandomFlashcardScreenshot.png"
									alt="Random Flash screen: a randomly selected vocabulary word with four multiple-choice options to identify the correct definition."
									className="tile-screenshot"
									width="1640"
									height="944"
									loading="lazy"
									decoding="async"
								/>
							</div>
							<div className="tile-content">
								<h3 className="tile-title">Random Flash</h3>
								<p className="tile-sub">
									Randomized multiple-choice that breaks the pattern recognition sequential review can
									create. Proves you actually know the word, not just its position in the list.
								</p>
								<span className="tile-cta">
									<span>Start drilling</span>
									<span className="tile-cta-arrow" aria-hidden="true">
										→
									</span>
								</span>
							</div>
						</a>
					</div>
				</div>
			</section>

			{/* ============ PROBLEM / SOLUTION ============ */}
			<section className="compare" aria-labelledby="compare-h2">
				<div className="container">
					<div className="section-head section-head--narrow">
						<div className="section-eyebrow">The Problem</div>
						<h2 id="compare-h2" className="section-h2">
							Most vocab resources make you do all the work
						</h2>
						<p className="section-lede">
							The hard part of learning vocabulary isn&apos;t reading a definition once. It&apos;s getting
							the word to stick. Most resources skip that part entirely.
						</p>
					</div>

					<div className="compare-grid">
						<article className="compare-col compare-col--problem">
							<h3 className="compare-h3">What&apos;s out there</h3>
							<ul className="compare-list">
								<li>Static word lists you&apos;re left to memorize on your own.</li>
								<li>Reinforcement left entirely up to the learner.</li>
								<li>The genuinely useful tools hidden behind paywalls.</li>
								<li>Bloated apps that bury vocabulary under features you don&apos;t need.</li>
							</ul>
						</article>

						<article className="compare-col compare-col--solution">
							<h3 className="compare-h3">What GRE Vocab Tester does</h3>
							<ul className="compare-list">
								<li>Active recall built in: you produce the answer, not just read it.</li>
								<li>
									Mastery tracking that won&apos;t advance a word until you&apos;ve proven you know it.
								</li>
								<li>Completely free. No paywall, no account required.</li>
								<li>Focused on one thing: getting GRE vocabulary to stick.</li>
							</ul>
						</article>
					</div>
				</div>
			</section>

			{/* ============ STORY ============ */}
			<section className="story" aria-labelledby="story-h2">
				<div className="container">
					<div className="story-block">
						<div className="section-head">
							<div className="section-eyebrow">The Story</div>
							<h2 id="story-h2" className="section-h2">
								Why I built this
							</h2>
						</div>
						<div className="story-body">
							<p>
								I built GRE Vocab Tester because I needed it. I had to take the GRE on short notice, and I
								quickly realized the math wasn&apos;t going to be my problem. The vocabulary was. The
								verbal section leans on a few hundred high-frequency words that show up again and again,
								and if you don&apos;t know them, no amount of test-taking strategy saves you.
							</p>
							<p>
								When I started, I couldn&apos;t pass the verbal section even with unlimited time. I simply
								didn&apos;t know enough of the words. So I went looking for something to help me learn
								them, and what I found was discouraging. The good resources were locked behind paywalls.
								The free ones, and plenty of the paid ones, were barely resources at all: static lists of
								words and definitions with no way to actually practice them. They handed you the content
								and left the hard part, the reinforcement, entirely up to you.
							</p>
							<p>
								So I built the tool I wished existed. A focused, free app that does the reinforcing for
								you, drilling words through active recall until they actually stick. I used it to study
								for my own exam, and in a short period I went from failing the verbal section with
								unlimited time to scoring a{" "}
								<strong className="story-emph">160 under real test conditions</strong>. It worked. So I
								kept it free and put it online for everyone else taking the same test.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* ============ WORD LIST ============ */}
			<section className="wordlist" aria-labelledby="wordlist-h2">
				<div className="container">
					<div className="wordlist-block">
						<div className="section-head">
							<div className="section-eyebrow">The Word List</div>
							<h2 id="wordlist-h2" className="section-h2">
								The words that actually show up
							</h2>
						</div>
						<div className="wordlist-body">
							<p>
								GRE Vocab Tester is built on a curated set of{" "}
								<strong>800 high-frequency GRE words</strong>, drawn from past papers and reputable prep
								sources, then deduplicated and normalized into a single clean list. No padding with words
								you&apos;ll never see. Just the vocabulary that consistently appears on the test.
							</p>
							<p>
								You can study the full list, or focus on a smaller set with Word Packs: curated subsets
								you can work through, share, or build yourself.
							</p>
						</div>
						<div className="wordlist-actions">
							<Link className="secondary-btn" href="/wordpacks">
								Browse Word Packs
							</Link>
						</div>
					</div>
				</div>
			</section>

			{/* ============ TRUST BAND ============ */}
			<section className="trust" aria-label="By the numbers">
				<div className="container trust-inner">
					<ul className="trust-stats">
						<li>
							<span className="trust-num">8,000+</span>
							<span className="trust-label">monthly active users</span>
						</li>
						<li>
							<span className="trust-num">Worldwide</span>
							<span className="trust-label">test-takers using it</span>
						</li>
						<li>
							<span className="trust-num">Free</span>
							<span className="trust-label">no account required</span>
						</li>
						<li>
							<span className="trust-num">800</span>
							<span className="trust-label">high-frequency GRE words</span>
						</li>
					</ul>
					<p className="trust-tagline">
						Built by one person who needed it, and kept free for everyone else who does too.
					</p>
				</div>
			</section>

			{/* ============ FINAL CTA ============ */}
			<section className="final-cta" aria-labelledby="final-h2">
				<div className="container">
					<div className="final-cta-block">
						<div className="final-cta-inner">
							<h2 id="final-h2" className="section-h2">
								Start learning the words that matter
							</h2>
							<p className="final-cta-sub">No signup. No paywall. Just open a mode and start.</p>
							<div className="final-cta-actions">
								<a className="primary-btn" href="/play/test">
									Start Studying
								</a>
								<Link className="secondary-btn" href="/wordpacks">
									Browse Word Packs
								</Link>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* ============ Footer ============ */}
			<footer className="home-footer">
				<div className="container footer-inner">
					<img
						src="/images/logo-128.webp"
						alt="GRE Vocab Tester"
						className="footer-logo"
						width="40"
						height="40"
						loading="lazy"
						decoding="async"
					/>
					<p className="footer-tagline">Vocabulary preparation for serious test-takers.</p>
					<div className="footer-links">
						<Link href="/wordpacks">Word Packs</Link>
						<a href="/play/test">Normal Mode</a>
						<a href="/play/practice">Flash Cards</a>
						<a href="/play/learn">Random Flash</a>
					</div>
					<p className="footer-copy">
						&copy; {new Date().getFullYear()} GRE Vocab Tester. All rights reserved.
					</p>
				</div>
			</footer>
		</main>
	);
}
