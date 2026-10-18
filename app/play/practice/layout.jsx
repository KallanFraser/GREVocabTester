/** @format */

import home from "../../../src/data/home.json";

const WORDS = (Number(home?.words) || 0).toLocaleString("en-US");
const TITLE = "Practice: Multiple-Choice GRE Vocabulary Review in Order";
const DESCRIPTION = `Multiple-choice review that works through a word pack, or all ${WORDS} GRE words, in order. A clean first pass before you move on to Test.`;
const SHORT = `Multiple-choice review through a word pack, or all ${WORDS} GRE words, in order.`;

export const metadata = {
	title: `${TITLE} | GRE Vocab Tester`,
	description: DESCRIPTION,
	alternates: {
		canonical: "https://grevocabtester.com/play/practice",
	},
	openGraph: {
		title: TITLE,
		description: SHORT,
		url: "https://grevocabtester.com/play/practice",
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

export default function PracticeLayout({ children }) {
	return children;
}
