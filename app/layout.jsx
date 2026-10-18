/** @format */
// app/layout.jsx — Global wrapper with metadata for GRE Vocab Tester

import "../styles/globals.css";
import "../styles/ui.css";
import "../styles/components.css";
import Navbar from "../components/Navbar";
import Background from "../components/Background";
import home from "../src/data/home.json";
import { MODES } from "../components/home/modes";

// The word count comes from src/data/home.json (written by npm run packs:build),
// so the description cannot drift from the data.
const WORDS = (Number(home?.words) || 0).toLocaleString("en-US");
const TITLE = "GRE Vocab Tester: Free GRE Vocabulary Practice With Active Recall";
const DESCRIPTION = `Free GRE vocabulary practice built around active recall. Study ${WORDS} GRE words in ${MODES.length} study modes, with mastery tracking and Daily Review. No signup, no paywall.`;

// Route metadata replaces openGraph and twitter whole rather than merging them,
// so every route repeats these. There is deliberately no canonical or og:url
// here: the root layout also wraps the 404 page, which must not claim the
// homepage URL. The homepage sets both in app/page.jsx.
export const metadata = {
	metadataBase: new URL("https://grevocabtester.com"),
	title: TITLE,
	description: DESCRIPTION,
	keywords: [
		"GRE vocab",
		"GRE vocabulary practice",
		"free GRE vocabulary",
		"GRE preparation",
		"GRE verbal",
		"GRE practice app",
		"GRE flashcards",
		"GRE word list",
		"GRE active recall",
		"high-frequency GRE words",
	],
	authors: [{ name: "Kallan Fraser" }],
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		siteName: "GRE Vocab Tester",
		images: [
			{
				url: "/images/og-image.png",
				width: 1200,
				height: 630,
				alt: "GRE Vocab Tester",
			},
		],
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: DESCRIPTION,
		images: ["/images/og-image.png"],
	},
	icons: {
		icon: "/favicon.ico",
		apple: "/apple-touch-icon.png",
	},
	// Static file in public/ (a static export cannot serve app/manifest.js as a
	// dynamic route, and the file form needs no build step).
	manifest: "/manifest.webmanifest",
	// Emits apple-mobile-web-app-capable (and the modern mobile-web-app-capable).
	appleWebApp: { capable: true, title: "GRE Vocab", statusBarStyle: "black-translucent" },
	other: { "apple-mobile-web-app-capable": "yes" },
};

// No maximumScale: pinch zoom stays allowed. themeColor matches --bg.
export const viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: "#050505",
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body>
				<Background />
				<Navbar />
				{children}
			</body>
		</html>
	);
}
