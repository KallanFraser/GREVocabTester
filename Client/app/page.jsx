/** @format */
"use client";

import React, { useEffect } from "react";
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
					<div className="eyebrow">GRE Vocab • built to grind</div>

					<h1 className="hero-title">
						Crush vocab. <span className="badge">161 in 2 weeks</span>
					</h1>

					<p className="hero-sub">800+ words. Smart typo forgiveness. Mastery that sticks.</p>

					<ul className="hero-pills" aria-hidden="true">
						<li>4× to master</li>
						<li>~80% typo leeway</li>
						<li>pick your set</li>
					</ul>
				</div>

				{/* right column = banner + CTA stacked (2 elements) */}
				<div className="hero-media">
					<figure className="banner-frame">
						<img
							src="/images/GRETesterBanner.png"
							alt="GRE SCORE banner"
							className="banner"
							decoding="async"
						/>
					</figure>

					<div className="packs-cta packs-cta--in-hero" aria-label="Popular wordpacks">
						<a className="packs-cta__btn" href="/wordpacks">
							View popular wordpacks
						</a>
					</div>
				</div>
			</section>

			{/* modes -> route links */}
			<section className="mode-tiles" aria-label="Choose a mode">
				<a className="tile primary" href="/play/test" title="Normal Mode (1)" accessKey="1">
					<div className="tile-icon">🎯</div>
					<div className="tile-title">Normal Mode</div>
					<div className="tile-sub">5-word loop • master 4×</div>
				</a>
				<a className="tile" href="/play/practice" title="Flash Cards (2)" accessKey="2">
					<div className="tile-icon">🧠</div>
					<div className="tile-title">Flash Cards</div>
					<div className="tile-sub">ordered drill</div>
				</a>
				<a className="tile" href="/play/learn" title="Random Flash (3)" accessKey="3">
					<div className="tile-icon">🎲</div>
					<div className="tile-title">Random Flash</div>
					<div className="tile-sub">shuffled recall</div>
				</a>
			</section>

			{/* mini explains */}
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

			{/* donate */}
			<section className="donate" aria-label="Support this app">
				<h2 className="donate__title">Keep it free</h2>
				<p className="donate__sub">Keep it free for everyone.</p>

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

			{/* footer */}
			<section className="home-footer">
				<img src="/images/GREWebsiteLogo.png" alt="GRE logo" className="footer-logo" />
				<p>Built to grind. No fluff.</p>
			</section>
		</main>
	);
}
