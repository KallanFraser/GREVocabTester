/** @format */

import ReviewMode from "../../../components/ReviewMode";

const TITLE = "Daily Review: Spaced Repetition for GRE Vocabulary";
const SHORT = "Review mastered GRE words across every word pack on a spaced-repetition schedule, at growing intervals.";

export const metadata = {
	title: `${TITLE} | GRE Vocab Tester`,
	description:
		"Review the GRE words you have already mastered, across every word pack, on a spaced-repetition schedule. Each word returns one day after you master it, then at growing intervals, so it stays learned through test day.",
	alternates: {
		canonical: "https://grevocabtester.com/play/review",
	},
	openGraph: {
		title: TITLE,
		description: SHORT,
		url: "https://grevocabtester.com/play/review",
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

export default function ReviewRoute() {
	return <ReviewMode />;
}
