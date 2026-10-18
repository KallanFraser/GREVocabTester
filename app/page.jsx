/** @format */

import Link from "next/link";
import home from "../src/data/home.json";
import { MODES } from "../components/home/modes";
import ModeTiles from "../components/home/ModeTiles";
import TryIt from "../components/home/TryIt";
import ContinueCard from "../components/home/ContinueCard";
import HomeShortcuts from "../components/home/HomeShortcuts";
import { WORD_STREAK_TO_MASTER } from "../lib/pool";
import "../styles/home.css";

// A server component: the static parts render at build time and only the
// try-it card, the Continue card and the keyboard shortcuts ship as client
// code. Every count comes from src/data/home.json, a small build-time summary,
// so the most visited page never bundles the word list and copy cannot drift
// from the data (the old "800" against 679 real words).
const fmt = (n) => (Number.isFinite(n) ? n : 0).toLocaleString("en-US");
const WORD_COUNT = Number(home?.words) || 0;
const PACKS = home?.packs || {};
const PACK_COUNT = Number(PACKS.total) || 0;
const PATH_COUNT = Number(PACKS.path) || 0;
const THEMED_COUNT = (Number(PACKS.theme) || 0) + (Number(PACKS.classic) || 0);
const SAMPLE = Array.isArray(home?.sample) ? home.sample : [];

const JSON_LD = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "GRE Vocab Tester",
	url: "https://grevocabtester.com",
	description: `Free GRE vocabulary practice built around active recall. Study ${fmt(WORD_COUNT)} high-frequency GRE words in ${MODES.length} study modes, with mastery tracking, Daily Review and word packs you can share by link. No account needed.`,
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
};

// Same title and description as the root layout. The canonical and og:url live
// here, not in the layout, so the 404 page does not inherit the homepage URL.
const META_TITLE = "GRE Vocab Tester: Free GRE Vocabulary Practice With Active Recall";
const META_DESCRIPTION = `Free GRE vocabulary practice built around active recall. Study ${fmt(WORD_COUNT)} GRE words in ${MODES.length} study modes, with mastery tracking and Daily Review. No signup, no paywall.`;

export const metadata = {
	title: META_TITLE,
	description: META_DESCRIPTION,
	alternates: {
		canonical: "https://grevocabtester.com",
	},
	openGraph: {
		title: META_TITLE,
		description: META_DESCRIPTION,
		url: "https://grevocabtester.com",
		siteName: "GRE Vocab Tester",
		images: [{ url: "/images/og-image.png", width: 1200, height: 630, alt: "GRE Vocab Tester" }],
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: META_TITLE,
		description: META_DESCRIPTION,
		images: ["/images/og-image.png"],
	},
};

export default function Page() {
	return (
		<div id="home-landing">
			<HomeShortcuts />
			<main>
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

				{/* ============ HERO ============ */}
				<section className="hero">
					<div className="wrap hero-grid">
						<div>
							<div className="eyebrow">GRE Vocabulary Preparation</div>
							<h1>
								Master every
								<br />
								word.
							</h1>
							<p className="hero-sub">
								GRE vocabulary practice built on active recall. Type the definition from memory, answer
								correctly {WORD_STREAK_TO_MASTER} times in a row, and the word is mastered. Free, with no
								account, and your progress stays in this browser.
							</p>
							<div className="hero-actions">
								<Link className="btn btn-primary" href="/play/test">
									Start studying
								</Link>
								<Link className="btn btn-ghost" href="/wordpacks">
									Browse word packs
								</Link>
							</div>
							<div className="hero-facts">
								<div>
									<strong>{fmt(WORD_COUNT)}</strong>
									<span>high-frequency GRE words</span>
								</div>
								<div>
									<strong>{fmt(PACK_COUNT)}</strong>
									<span>word packs</span>
								</div>
								<div>
									<strong>Free</strong>
									<span>no account needed</span>
								</div>
							</div>
						</div>

						<TryIt words={SAMPLE} />
					</div>
				</section>

				{/* ============ CONTINUE (only once a pack has been opened) ============ */}
				<ContinueCard />

				{/* ============ MODES ============ */}
				<section className="block" aria-labelledby="modes-h2">
					<div className="wrap">
						<div className="block-head">
							<div className="eyebrow">The Modes</div>
							<h2 id="modes-h2">How it works</h2>
							<p>
								Each mode works the same words from a different angle, built around active recall rather than
								passive review. Press <kbd>1</kbd> to <kbd>{MODES.length}</kbd> to jump straight in.
							</p>
						</div>
						<ModeTiles />
					</div>
				</section>

				{/* ============ PROBLEM / SOLUTION ============ */}
				<section className="block" aria-labelledby="compare-h2">
					<div className="wrap">
						<div className="block-head">
							<div className="eyebrow">The Problem</div>
							<h2 id="compare-h2">Most vocab resources make you do all the work</h2>
							<p>
								The hard part of learning vocabulary isn&apos;t reading a definition once. It&apos;s getting
								the word to stick. Most resources skip that part entirely.
							</p>
						</div>

						<div className="compare">
							<article className="compare-col">
								<h3>What&apos;s out there</h3>
								<ul>
									<li>Static word lists you&apos;re left to memorize on your own.</li>
									<li>Reinforcement left entirely up to the learner.</li>
									<li>The genuinely useful tools hidden behind paywalls.</li>
									<li>Bloated apps that bury vocabulary under features you don&apos;t need.</li>
								</ul>
							</article>

							<article className="compare-col compare-col--solution">
								<h3>What GRE Vocab Tester does</h3>
								<ul>
									<li>
										Active recall built in: you type the definition from memory, and small typos still
										count.
									</li>
									<li>
										Mastery tracking that won&apos;t mark a word as learned until you answer it correctly{" "}
										{WORD_STREAK_TO_MASTER} times in a row.
									</li>
									<li>
										Words come back when you need them: Harder mode returns missed words a few cards later,
										and Daily Review brings mastered words back over the following days and weeks.
									</li>
									<li>
										Completely free. No paywall, no account required. Progress is kept in this browser,
										and Settings can export and import it.
									</li>
									<li>Focused on one thing: getting GRE vocabulary to stick.</li>
								</ul>
							</article>
						</div>
					</div>
				</section>

				{/* ============ STORY ============ */}
				<section className="block" aria-labelledby="story-h2">
					<div className="wrap">
						<div className="panel story">
							<div className="block-head">
								<div className="eyebrow">The Story</div>
								<h2 id="story-h2">Why I built this</h2>
							</div>
							<div className="prose">
								<p>
									I built GRE Vocab Tester because I needed it. I had to take the GRE on short notice, and
									I quickly realized the math wasn&apos;t going to be my problem. The vocabulary was. The
									verbal section leans on a few hundred high-frequency words that show up again and again,
									and if you don&apos;t know them, no amount of test-taking strategy saves you.
								</p>
								<p>
									When I started, I couldn&apos;t pass the verbal section even with unlimited time. I
									simply didn&apos;t know enough of the words. So I went looking for something to help me
									learn them, and what I found was discouraging. The good resources were locked behind
									paywalls. The free ones, and plenty of the paid ones, were barely resources at all:
									static lists of words and definitions with no way to actually practice them. They handed
									you the content and left the hard part, the reinforcement, entirely up to you.
								</p>
								<p>
									So I built the tool I wished existed. A focused, free app that does the reinforcing for
									you, drilling words through active recall until they actually stick. I used it to study
									for my own exam, and in a short period I went from failing the verbal section with
									unlimited time to scoring a <strong>160 under real test conditions</strong>. It worked. So
									I kept it free and put it online for everyone else taking the same test.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* ============ WORD LIST ============ */}
				<section className="block" aria-labelledby="wordlist-h2">
					<div className="wrap">
						<div className="panel wordlist">
							<div className="block-head">
								<div className="eyebrow">The Word List</div>
								<h2 id="wordlist-h2">The words that actually show up</h2>
							</div>
							<div className="prose">
								<p>
									GRE Vocab Tester is built on a curated list of{" "}
									<strong>{fmt(WORD_COUNT)} high-frequency GRE words</strong>. Every word has a short
									definition to recall, a fuller explanation and an example sentence, all written for this
									site. No padding with words you&apos;ll never see.
								</p>
								<p>
									The list is split into Core, Common and Advanced tiers, and each tier is broken into
									short sets you can finish ({fmt(PATH_COUNT)} sets in all). {fmt(THEMED_COUNT)} themed packs group words by
									topic, such as argument and rhetoric or change and degree. You can also build your own
									pack from any words on the list and share it with a link.
								</p>
							</div>
							<ul className="tiers">
								<li>
									<strong>Core</strong>
									<span>High-frequency words to learn first.</span>
								</li>
								<li>
									<strong>Common</strong>
									<span>Frequently tested words.</span>
								</li>
								<li>
									<strong>Advanced</strong>
									<span>Less common words for higher scores.</span>
								</li>
							</ul>
							<div className="panel-actions">
								<Link className="btn btn-ghost" href="/wordpacks">
									Browse word packs
								</Link>
							</div>
						</div>
					</div>
				</section>

				{/* ============ TRUST ============ */}
				<section className="block" aria-label="By the numbers">
					<div className="wrap">
						<div className="trust">
							<ul className="trust-stats">
								<li>
									<strong>8,000+</strong>
									<span>monthly active users</span>
								</li>
								<li>
									<strong>Worldwide</strong>
									<span>test-takers using it</span>
								</li>
								<li>
									<strong>Free</strong>
									<span>no account required</span>
								</li>
								<li>
									<strong>{fmt(WORD_COUNT)}</strong>
									<span>high-frequency GRE words</span>
								</li>
							</ul>
							<p className="trust-tagline">
								Built by one person who needed it, and kept free for everyone else who does too.
							</p>
						</div>
					</div>
				</section>

				{/* ============ FINAL CTA ============ */}
				<section className="block" aria-labelledby="final-h2">
					<div className="wrap">
						<div className="final-cta">
							<h2 id="final-h2">Start learning the words that matter</h2>
							<p>No signup. No paywall. Just open a mode and start.</p>
							<div className="hero-actions">
								<Link className="btn btn-primary" href="/play/test">
									Start studying
								</Link>
								<Link className="btn btn-ghost" href="/wordpacks">
									Browse word packs
								</Link>
							</div>
						</div>
					</div>
				</section>
			</main>

			{/* ============ FOOTER ============ */}
			<footer className="home-footer">
				<div className="wrap foot">
					<div className="foot-brand">
						<span className="foot-logo">
							<b>GRE</b>
							<span aria-hidden="true">|</span> Vocab Tester
						</span>
						<span>Vocabulary preparation for serious test-takers.</span>
					</div>
					<nav aria-label="Footer">
						{MODES.map((m) => (
							<Link key={m.id} href={m.href}>
								{m.title}
							</Link>
						))}
						<Link href="/wordpacks">Word Packs</Link>
						<Link href="/settings">Settings</Link>
					</nav>
				</div>
				<div className="wrap foot-copy">
					&copy; {new Date().getFullYear()} GRE Vocab Tester. {fmt(WORD_COUNT)} GRE words, free to use. All
					rights reserved.
				</div>
			</footer>
		</div>
	);
}
