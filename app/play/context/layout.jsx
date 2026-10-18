/** @format */

const TITLE = "In Context: GRE Sentence Practice";
const DESCRIPTION =
	"Complete real example sentences with the right GRE word. Sentence-level multiple-choice practice modeled on GRE Text Completion, with the full sentence and definition revealed after every answer.";
const SHORT = "Complete real example sentences with the right GRE word, in the style of GRE Text Completion.";

export const metadata = {
	title: `${TITLE} | GRE Vocab Tester`,
	description: DESCRIPTION,
	alternates: {
		canonical: "https://grevocabtester.com/play/context",
	},
	openGraph: {
		title: TITLE,
		description: SHORT,
		url: "https://grevocabtester.com/play/context",
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

export default function ContextLayout({ children }) {
	return children;
}
