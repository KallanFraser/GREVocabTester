/** @format */
// Route-segment metadata. The page itself is a client component, so its
// metadata is declared here in a server-component layout.

export const metadata = {
	title: "Word Packs — Curated GRE Vocabulary Sets | GRE Vocab Tester",
	description:
		"Browse curated word packs of high-frequency GRE vocabulary built by the community. Pick a focused set to study, or build and share your own.",
	alternates: {
		canonical: "https://grevocabtester.com/wordpacks",
	},
	openGraph: {
		title: "Word Packs — Curated GRE Vocabulary Sets",
		description:
			"Browse curated word packs of high-frequency GRE vocabulary built by the community. Pick a focused set to study, or build and share your own.",
		url: "https://grevocabtester.com/wordpacks",
	},
	twitter: {
		title: "Word Packs — Curated GRE Vocabulary Sets",
		description:
			"Browse curated word packs of high-frequency GRE vocabulary built by the community. Pick a focused set to study, or build your own.",
	},
};

export default function WordpacksLayout({ children }) {
	return children;
}
