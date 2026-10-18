/** @format */
// Route-segment metadata. The page itself is a client component, so its
// metadata is declared here in a server-component layout. Counts come from
// src/data/home.json, written by npm run packs:build.

import home from "../../src/data/home.json";

const fmt = (n) => (Number(n) || 0).toLocaleString("en-US");
const WORDS = fmt(home?.words);
const PACKS = fmt(home?.packs?.total);
const PATH = fmt(home?.packs?.path);

const TITLE = "Word Packs: Curated GRE Vocabulary Sets";
const DESCRIPTION = `Browse ${PACKS} curated GRE word packs: a ${PATH}-set learning path that covers all ${WORDS} words, plus themed and classic sets. Make your own pack and share it by link.`;
const SHORT = `${PACKS} curated GRE word packs, including a learning path through all ${WORDS} words. Make your own and share it by link.`;

export const metadata = {
	title: `${TITLE} | GRE Vocab Tester`,
	description: DESCRIPTION,
	alternates: {
		canonical: "https://grevocabtester.com/wordpacks",
	},
	openGraph: {
		title: TITLE,
		description: SHORT,
		url: "https://grevocabtester.com/wordpacks",
		siteName: "GRE Vocab Tester",
		images: [{ url: "/images/og-image.png", width: 1200, height: 630, alt: "GRE Vocab Tester" }],
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: SHORT,
		images: ["/images/og-image.png"],
	},
};

export default function WordpacksLayout({ children }) {
	return children;
}
