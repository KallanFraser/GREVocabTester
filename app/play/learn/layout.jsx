/** @format */

import home from "../../../src/data/home.json";

const WORDS = (Number(home?.words) || 0).toLocaleString("en-US");
const TITLE = "Random Practice: Shuffled Multiple-Choice GRE Vocabulary Drill";
const DESCRIPTION = `Multiple-choice drilling in a shuffled order, across a word pack or all ${WORDS} GRE words. Random order breaks the pattern recognition that sequential review can build.`;
const SHORT = `Shuffled multiple-choice drilling across a word pack or all ${WORDS} GRE words.`;

export const metadata = {
	title: `${TITLE} | GRE Vocab Tester`,
	description: DESCRIPTION,
	alternates: {
		canonical: "https://grevocabtester.com/play/learn",
	},
	openGraph: {
		title: TITLE,
		description: SHORT,
		url: "https://grevocabtester.com/play/learn",
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

export default function LearnLayout({ children }) {
	return children;
}
