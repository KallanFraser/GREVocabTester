/** @format */

import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import home from "../src/data/home.json";
import { MODES } from "../components/home/modes";
import ModeTiles from "../components/home/ModeTiles";
import TryIt from "../components/home/TryIt";
import ContinueCard from "../components/home/ContinueCard";
import HomeShortcuts from "../components/home/HomeShortcuts";
import HomeMotion from "../components/home/HomeMotion";
import HeroCanvas from "../components/home/HeroCanvas";
import ScrambleWord from "../components/home/ScrambleWord";
import CountUp from "../components/home/CountUp";
import ReviewChart from "../components/home/ReviewChart";
import { WORD_STREAK_TO_MASTER } from "../lib/pool";
import { REVIEW_INTERVALS } from "../lib/review";
import "../styles/home.css";

// Self-hosted at build time by next/font, so no external origin is needed in
// the CSP. Scoped to this page: the variable is set on the home wrapper only.
const serif = Instrument_Serif({
	subsets: ["latin"],
	weight: "400",
	style: ["normal", "italic"],
	variable: "--font-serif",
	display: "swap",
});

// A server component: the static parts render at build time and only the
// try-it card, the Continue card, the mode demos, the motion helpers and the
// keyboard shortcuts ship as client code. Every count comes from
// src/data/home.json, a small build-time summary, so the most visited page
// never bundles the word list and copy cannot drift from the data.
const fmt = (n) => (Number.isFinite(n) ? n : 0).toLocaleString("en-US");
const WORD_COUNT = Number(home?.words) || 0;
const PACKS = home?.packs || {};
const PACK_COUNT = Number(PACKS.total) || 0;
const PATH_COUNT = Number(PACKS.path) || 0;
const THEMED_COUNT = (Number(PACKS.theme) || 0) + (Number(PACKS.classic) || 0);
const SAMPLE = Array.isArray(home?.sample) ? home.sample : [];
const MARQUEE = Array.isArray(home?.marquee) ? home.marquee.filter((m) => m && m.headword) : [];
const TIERS = Array.isArray(home?.tiers) ? home.tiers : [];
// Tier blurbs and example words. The examples are checked against the tier
// field in gre_combined.json.
const TIER_INFO = {
	1: { blurb: "High-frequency words to learn first.", ex: ["Laconic", "Mitigate", "Venerate"] },
	2: { blurb: "Frequently tested words.", ex: ["Sedulous", "Bellicose", "Anathema"] },
	3: { blurb: "Less common words for higher scores.", ex: ["Pusillanimous", "Lugubrious", "Cynosure"] },
};
// The headline's last word scrambles through these, then settles on "word.".
const HEADLINE_WORDS = ["laconic.", "alacrity.", "obdurate.", "sedulous."];
const CANVAS_WORDS = [...SAMPLE.map((s) => s.headword), ...MARQUEE.map((m) => m.headword)];
const HALF = Math.ceil(MARQUEE.length / 2);
const MARQUEE_ROWS = [MARQUEE.slice(0, HALF), MARQUEE.slice(HALF)].filter((r) => r.length);
const LADDER = REVIEW_INTERVALS.slice(0, 5);
const LADDER_AND = `${LADDER.slice(0, -1).join(", ")} and ${LADDER[LADDER.length - 1]}`;
const FIRST_DAY = REVIEW_INTERVALS[0];

// GRE Verbal is scored 130 to 170; the story's score sits on that scale.
const GAUGE = { min: 130, max: 170, score: 160 };
const GAUGE_F = (GAUGE.score - GAUGE.min) / (GAUGE.max - GAUGE.min);

const METHOD = [
	{ title: "See the word", text: "One word, no definition on screen. Nothing to skim, nothing to lean on." },
	{ title: "Recall it", text: "Type what it means from memory. Small typos and close wording still count." },
	{
		title: `${WORD_STREAK_TO_MASTER === 4 ? "Four" : WORD_STREAK_TO_MASTER} in a row`,
		text: `A word is mastered only after ${WORD_STREAK_TO_MASTER} correct answers in a row. One miss resets it.`,
	},
	{
		title: "Review on schedule",
		text: `Mastered words return after ${LADDER_AND} days, right before they slip.`,
	},
];

const JSON_LD = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "GRE Vocab Tester",
	url: "https://grevocabtester.com",
	description: `Free GRE vocabulary practice built around active recall. Study ${fmt(WORD_COUNT)} GRE words in ${MODES.length} study modes, with mastery tracking, Daily Review and word packs you can share by link. No account needed.`,
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

function MarqueeRow({ items, reverse }) {
	const group = (copy) =>
		items.map((m, i) => (
			<span key={`${copy}-${m.headword}`} className={i % 7 === 2 ? "hot" : undefined}>
				<b>{m.headword}</b>
				<em>{m.definition}</em>
			</span>
		));
	return (
		<div className={`mrow${reverse ? " rev" : ""}`}>
			{group("a")}
			{group("b")}
		</div>
	);
}

function Logo() {
	return (
		<Link className="logo" href="/">
			<b>GRE</b>
			<i aria-hidden="true">|</i>
			<span>Vocab Tester</span>
		</Link>
	);
}

export default function Page() {
	return (
		<div id="home-landing" className={serif.variable}>
			<HomeShortcuts />
			<HomeMotion />
			<div className="grain" aria-hidden="true" />
			<main>
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

				{/* ============ HERO ============ */}
				<section className="hero" data-loop="">
					<HeroCanvas words={CANVAS_WORDS} />
					<div className="glow g1" aria-hidden="true" />
					<div className="glow g2" aria-hidden="true" />
					<div className="wrap hero-grid">
						<div className="hero-copy">
							<div className="pill-live">
								<span className="dot" aria-hidden="true" />
								8,000+ monthly active users
							</div>
							<h1 aria-label="Master every word.">
								Master every
								<span className="l2">
									<ScrambleWord className="rot" words={HEADLINE_WORDS} settle="word." />
								</span>
							</h1>
							<p className="hero-sub">
								GRE vocabulary practice built on <strong>active recall</strong>. Type the definition from memory,
								get it right {WORD_STREAK_TO_MASTER} times in a row, and the word is yours. No account, no paywall.
							</p>
							<div className="actions">
								<Link className="btn btn-primary" href="/play/test">
									Start studying <span className="arr">&rarr;</span>
								</Link>
								<Link className="btn btn-ghost" href="/wordpacks">
									Browse word packs
								</Link>
							</div>
							<div className="facts">
								<div>
									<CountUp className="fact-num" value={WORD_COUNT} />
									<span>GRE words</span>
								</div>
								<div>
									<CountUp className="fact-num" value={PACK_COUNT} />
									<span>word packs</span>
								</div>
								<div>
									<CountUp className="fact-num" value={MODES.length} />
									<span>study modes</span>
								</div>
							</div>
						</div>

						<TryIt words={SAMPLE} />
					</div>
					<div className="scroll-cue" aria-hidden="true">
						Scroll
						<i />
					</div>
				</section>

				{/* ============ MARQUEE ============ */}
				{MARQUEE_ROWS.length ? (
					<div className="marquee" aria-hidden="true" data-loop="">
						{MARQUEE_ROWS.map((row, i) => (
							<MarqueeRow key={i} items={row} reverse={i % 2 === 1} />
						))}
					</div>
				) : null}

				{/* ============ CONTINUE (only once a pack has been opened) ============ */}
				<ContinueCard />

				{/* ============ METHOD ============ */}
				<section className="sec" aria-labelledby="method-h2">
					<div className="wrap">
						<div className="head center" data-reveal="">
							<div className="eyebrow">The Method</div>
							<h2 id="method-h2">
								Reading a word list <em>isn&apos;t</em> learning it.
							</h2>
							<p>
								Every session runs the same loop: pull the word out of memory, prove it {WORD_STREAK_TO_MASTER} times,
								then let the schedule bring it back before it fades.
							</p>
						</div>
						<div className="loop" data-reveal="">
							<div className="track" aria-hidden="true">
								<i />
							</div>
							{METHOD.map((s, i) => (
								<div key={s.title} className="step spot">
									<div className="num" aria-hidden="true">
										{i + 1}
									</div>
									<h3>{s.title}</h3>
									<p>{s.text}</p>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* ============ MODES ============ */}
				<section className="sec" id="modes" aria-labelledby="modes-h2">
					<div className="wrap">
						<div className="head" data-reveal="">
							<div className="eyebrow">The Modes</div>
							<h2 id="modes-h2">
								Six ways to <em>work</em> every word.
							</h2>
							<p>
								Each mode hits the same words from a different angle. Press <kbd>1</kbd> to{" "}
								<kbd>{MODES.length}</kbd> to jump straight in.
							</p>
						</div>
						<ModeTiles />
					</div>
				</section>

				{/* ============ DAILY REVIEW ============ */}
				<section className="sec" aria-labelledby="review-h2">
					<div className="wrap split">
						<div data-reveal="">
							<div className="eyebrow">Daily Review</div>
							<h2 id="review-h2">
								Words come back <em>right before</em> you forget them.
							</h2>
							<p className="lead">
								Cramming fades within days. Each time you recall a mastered word on schedule, the gap before its
								next review grows, so your effort goes to the words that are slipping.
							</p>
							<ul className="bullets">
								<li>
									<span className="ic" aria-hidden="true">
										1
									</span>
									<div>
										<b>Mastered words join the schedule automatically.</b> Nothing to set up.
									</div>
								</li>
								<li>
									<span className="ic" aria-hidden="true">
										2
									</span>
									<div>
										<b>Right on the first try?</b> The next review moves out: {LADDER.join(", ")} days and beyond.
									</div>
								</li>
								<li>
									<span className="ic" aria-hidden="true">
										3
									</span>
									<div>
										<b>Missed it?</b> It comes back {FIRST_DAY === 1 ? "tomorrow" : `in ${FIRST_DAY} days`} and
										climbs again.
									</div>
								</li>
							</ul>
						</div>
						<div className="chart-card" data-reveal="" style={{ "--d": "160ms" }}>
							<div className="chart-legend" aria-hidden="true">
								<span>
									<i className="lg-coral" />
									With Daily Review
								</span>
								<span>
									<i className="lg-grey" />
									Read once
								</span>
							</div>
							<ReviewChart intervals={REVIEW_INTERVALS} />
							<div className="chart-note">Illustrative curve, not measured data.</div>
						</div>
					</div>
				</section>

				{/* ============ PROBLEM / SOLUTION ============ */}
				<section className="sec" aria-labelledby="compare-h2">
					<div className="wrap">
						<div className="head" data-reveal="">
							<div className="eyebrow">The Problem</div>
							<h2 id="compare-h2">
								Most vocab tools hand you a list and <em>walk away.</em>
							</h2>
							<p>The hard part isn&apos;t reading a definition once. It&apos;s getting the word to stick.</p>
						</div>
						<div className="compare">
							<article className="col spot" data-reveal="">
								<h3>What&apos;s out there</h3>
								<ul>
									<li>Static word lists you memorize on your own.</li>
									<li>Reinforcement left entirely to you.</li>
									<li>The useful tools locked behind paywalls.</li>
									<li>Bloated apps that bury the words under features.</li>
								</ul>
							</article>
							<article className="col sol spot" data-reveal="" style={{ "--d": "80ms" }}>
								<h3>What GRE Vocab Tester does</h3>
								<ul>
									<li>Active recall built in. Small typos and close wording still count.</li>
									<li>No word is mastered until you get it right {WORD_STREAK_TO_MASTER} times in a row.</li>
									<li>Missed words come back until you get them right. Mastered words return over weeks.</li>
									<li>Completely free, no account. Export and import progress in Settings.</li>
									<li>One job: getting GRE vocabulary to stick.</li>
								</ul>
							</article>
						</div>
					</div>
				</section>

				{/* ============ STORY ============ */}
				<section className="sec" aria-label="Why I built this">
					<div className="wrap">
						<div className="story" data-reveal="">
							<div className="prose">
								<div className="eyebrow">Why I built this</div>
								<p className="lede">
									I couldn&apos;t pass the verbal section with unlimited time. In a short period, I went on to score a
									160 under real test conditions.
								</p>
								<p>
									I had to take the GRE on short notice, and the math wasn&apos;t the problem. The vocabulary was. The
									verbal section leans on a few hundred high-frequency words, and if you don&apos;t know them, no
									strategy saves you.
								</p>
								<p>
									The good resources were behind paywalls. The free ones were static lists that left the reinforcing
									to you. So I built the tool I wished existed, one that drills words through{" "}
									<strong>active recall</strong> until they stick, used it for my own exam, and kept it free for
									everyone else.
								</p>
								<div className="sig">
									<div className="av" aria-hidden="true">
										KF
									</div>
									<div>
										<b>Kallan Fraser</b>
										Built GRE Vocab Tester to pass the GRE
									</div>
								</div>
							</div>
							<div className="gauge" style={{ "--f": GAUGE_F.toFixed(3) }}>
								<svg viewBox="0 0 340 190" aria-hidden="true">
									<defs>
										<linearGradient id="home-gauge-grad" x1="0" x2="1">
											<stop offset="0" stopColor="#8f2a20" />
											<stop offset="1" stopColor="#ff8a7a" />
										</linearGradient>
									</defs>
									<path className="g-track" d="M20 170 A150 150 0 0 1 320 170" pathLength="100" />
									<path
										className="g-arc"
										d="M20 170 A150 150 0 0 1 320 170"
										pathLength="100"
										stroke="url(#home-gauge-grad)"
									/>
									<g className="g-needle">
										<line x1="170" y1="170" x2="170" y2="44" />
										<circle cx="170" cy="170" r="7" />
									</g>
									<text x="20" y="188" textAnchor="middle">
										{GAUGE.min}
									</text>
									<text x="320" y="188" textAnchor="middle">
										{GAUGE.max}
									</text>
								</svg>
								<div className="val">
									<CountUp value={GAUGE.score} from={GAUGE.min} duration={2200} ease="cubic" />
								</div>
								<div className="lbl">
									<b>GRE Verbal</b>, real test conditions
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* ============ WORD LIST ============ */}
				<section className="sec" aria-labelledby="wordlist-h2">
					<div className="wrap">
						<div className="head" data-reveal="">
							<div className="eyebrow">The Word List</div>
							<h2 id="wordlist-h2">
								The words that <em>actually</em> show up.
							</h2>
							<p>
								{fmt(WORD_COUNT)} GRE words, each with a short definition to recall, a fuller explanation and an
								example sentence, all written for this site.
							</p>
						</div>
						{TIERS.length ? (
							<div className="tiers">
								{TIERS.map((t, i) => {
									const info = TIER_INFO[t.tier] || { blurb: "", ex: [] };
									return (
										<div key={t.tier} className="tier spot" data-reveal="" style={{ "--d": `${i * 80}ms` }}>
											<div className="lv" aria-hidden="true">
												{[1, 2, 3].map((n) => (
													<i key={n} className={n <= t.tier ? "on" : undefined} />
												))}
											</div>
											<h3>{t.label}</h3>
											<p>{info.blurb}</p>
											<div className="ex">
												{info.ex.map((w) => (
													<span key={w}>{w}</span>
												))}
											</div>
										</div>
									);
								})}
							</div>
						) : null}
						<div className="packstats" data-reveal="">
							<div>
								<CountUp className="ps-num" value={PATH_COUNT} />
								<span>short sets across the three tiers</span>
							</div>
							<div>
								<CountUp className="ps-num" value={THEMED_COUNT} />
								<span>themed and classic packs, like argument and rhetoric</span>
							</div>
							<div>
								<span className="ps-num">&infin;</span>
								<span>custom packs you build and share by link</span>
							</div>
						</div>
					</div>
				</section>

				{/* ============ STATS BAND ============ */}
				<section className="sec" aria-label="By the numbers">
					<div className="wrap">
						<div className="band" data-reveal="">
							<ul>
								<li>
									<CountUp className="band-num" value={8000} suffix="+" />
									<span>monthly active users</span>
								</li>
								<li>
									<strong className="band-num">Global</strong>
									<span>test-takers worldwide</span>
								</li>
								<li>
									<strong className="band-num">$0</strong>
									<span>no account, no paywall</span>
								</li>
								<li>
									<CountUp className="band-num" value={WORD_COUNT} />
									<span>GRE words</span>
								</li>
							</ul>
							<p>Built by one person who needed it, and kept free for everyone who does too.</p>
						</div>
					</div>
				</section>

				{/* ============ FINAL CTA ============ */}
				<section className="final" aria-labelledby="final-h2">
					<div className="halo" aria-hidden="true" />
					<div className="wrap" data-reveal="">
						<h2 id="final-h2">
							Start with
							<br />
							<em>one word.</em>
						</h2>
						<p>No signup. No paywall. Open a mode and go.</p>
						<div className="actions">
							<Link className="btn btn-primary" href="/play/test">
								Start studying <span className="arr">&rarr;</span>
							</Link>
							<Link className="btn btn-ghost" href="/wordpacks">
								Browse word packs
							</Link>
						</div>
					</div>
				</section>
			</main>

			{/* ============ FOOTER ============ */}
			<footer className="home-footer">
				<div className="wrap foot">
					<div>
						<Logo />
						<div className="foot-tag">Vocabulary preparation for serious test-takers.</div>
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
				<div className="wrap copy">
					&copy; {new Date().getFullYear()} GRE Vocab Tester. {fmt(WORD_COUNT)} GRE words, free to use.
				</div>
			</footer>
		</div>
	);
}
