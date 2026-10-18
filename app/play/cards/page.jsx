/** @format */

import { Suspense } from "react";
import Flashcards from "../../../components/Flashcards";

export const metadata = {
	title: "Flashcards — Flip-Card GRE Vocabulary Review | GRE Vocab Tester",
	description:
		"Flip through high-frequency GRE vocabulary one card at a time. Each card shows the word, its definition, a fuller explanation and an example sentence. Study a word pack or the full list, shuffled or in order.",
	alternates: {
		canonical: "https://grevocabtester.com/play/cards",
	},
	openGraph: {
		title: "Flashcards — Flip-Card GRE Vocabulary Review",
		description:
			"Flip through high-frequency GRE vocabulary with definitions, fuller explanations and example sentences.",
		url: "https://grevocabtester.com/play/cards",
	},
	twitter: {
		title: "Flashcards — Flip-Card GRE Vocabulary Review",
		description: "Flip through high-frequency GRE vocabulary with definitions and example sentences.",
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
