/** @format */

import ReviewMode from "../../../components/ReviewMode";

export const metadata = {
	title: "Daily Review — Spaced Repetition for GRE Vocabulary | GRE Vocab Tester",
	description:
		"Review the GRE words you have already mastered, across every word pack, on a spaced-repetition schedule. Each word returns one day after you master it, then at growing intervals, so it stays learned through test day.",
	alternates: {
		canonical: "https://grevocabtester.com/play/review",
	},
	openGraph: {
		title: "Daily Review — Spaced Repetition for GRE Vocabulary",
		description:
			"Review mastered GRE words across every word pack on a spaced-repetition schedule, at growing intervals.",
		url: "https://grevocabtester.com/play/review",
	},
	twitter: {
		title: "Daily Review — Spaced Repetition for GRE Vocabulary",
		description: "Review mastered GRE words across every word pack on a spaced-repetition schedule.",
	},
};

export default function ReviewRoute() {
	return <ReviewMode />;
}
