/** @format */

import home from "../../../src/data/home.json";

const WORDS = (Number(home?.words) || 0).toLocaleString("en-US");
const TITLE = "Test: Type-to-Recall GRE Vocabulary Practice";
const DESCRIPTION = `Type the definition from memory, or the word from its definition. In Normal, a word is mastered after four correct answers in a row; in Harder, a word is retired when you get it right on the first try. Typo-tolerant active recall across ${WORDS} GRE words.`;
const SHORT = "Type the definition from memory, in Normal or Harder difficulty. Typo-tolerant active recall with mastery tracking.";

export const metadata = {
	title: `${TITLE} | GRE Vocab Tester`,
	description: DESCRIPTION,
	alternates: {
		canonical: "https://grevocabtester.com/play/test",
	},
	openGraph: {
		title: TITLE,
		description: SHORT,
		url: "https://grevocabtester.com/play/test",
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

export default function TestLayout({ children }) {
	return children;
}
