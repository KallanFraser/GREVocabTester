/** @format */
// app/layout.tsx — Global wrapper with metadata for GRE Vocab Tester

import "../styles/globals.css";
import "../styles/components.css";
import Navbar from "../components/Navbar";

export const metadata = {
	metadataBase: new URL("https://grevocabtester.com"),
	title: "GRE Vocab Tester — Free GRE Vocabulary Practice With Active Recall",
	description:
		"Free GRE vocabulary practice built around active recall. Drill 800 high-frequency GRE words across three study modes — no signup, no paywall.",
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
		title: "GRE Vocab Tester — Free GRE Vocabulary Practice With Active Recall",
		description:
			"Free GRE vocabulary practice built around active recall. Drill 800 high-frequency GRE words across three study modes — no signup, no paywall.",
		url: "https://grevocabtester.com",
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
		title: "GRE Vocab Tester — Free GRE Vocabulary Practice With Active Recall",
		description:
			"Free GRE vocabulary practice built around active recall. Drill 800 high-frequency GRE words across three study modes — no signup, no paywall.",
		images: ["/images/og-image.png"],
	},
	icons: {
		icon: "/favicon.ico",
		apple: "/apple-touch-icon.png",
	},
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body>
					<Navbar />
					{children}
				</body>
		</html>
	);
}
