/** @format */

import { Suspense } from "react";
import Flashcards from "../../../components/Flashcards";
import home from "../../../src/data/home.json";

const WORDS = (Number(home?.words) || 0).toLocaleString("en-US");
const TITLE = "Flashcards: Flip-Card GRE Vocabulary Review";
const SHORT = "Flip through GRE vocabulary with definitions, fuller explanations and example sentences.";

export const metadata = {
	title: `${TITLE} | GRE Vocab Tester`,
	description: `Flip through GRE vocabulary one card at a time. Each card shows the word, its definition, a fuller explanation and an example sentence. Study a word pack or all ${WORDS} words, shuffled or in order.`,
	alternates: {
		canonical: "https://grevocabtester.com/play/cards",
	},
	openGraph: {
		title: TITLE,
		description: SHORT,
		url: "https://grevocabtester.com/play/cards",
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

// Flashcards reads the pack from the URL with useSearchParams, which needs a
// Suspense boundary under static export.
export default function CardsRoute() {
	return (
		<Suspense fallback={null}>
			<Flashcards />
		</Suspense>
	);
}
