/** @format */
// app/layout.tsx — Global wrapper with metadata for GRE Vocab Tester

import "../styles/globals.css";
import "../styles/components.css";
import Image from "next/image";

export const metadata = {
	title: "GRE Vocab Tester | Master 500+ Words Fast",
	description:
		"Boost your GRE verbal score with the GRE Vocab Tester — an adaptive web app that helps you master 500+ essential GRE words through smart repetition, accuracy tracking, and flashcard learning.",
	keywords: [
		"GRE vocab",
		"GRE preparation",
		"GRE verbal",
		"GRE practice app",
		"GRE flashcards",
		"GRE word list",
		"GRE study tool",
	],
	authors: [{ name: "Kallan Fraser" }],
	openGraph: {
		title: "GRE Vocab Tester | Master 500+ Words Fast",
		description:
			"Interactive GRE vocabulary trainer built to help you retain high-frequency words quickly. Practice, test, and learn smarter.",
		url: "https://grevocabtester.onrender.com",
		siteName: "GRE Vocab Tester",
		images: [
			{
				url: "/images/GREWebsiteLogo.png",
				width: 1200,
				height: 630,
				alt: "GRE Vocab Tester Logo",
			},
		],
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "GRE Vocab Tester | Master 500+ Words Fast",
		description:
			"Learn 500+ GRE words with this adaptive, gamified study tool that tracks mastery and builds memory through repetition.",
		images: ["/images/GREWebsiteLogo.png"],
	},
	icons: {
		icon: "/images/GREWebsiteLogo.png",
		shortcut: "/images/GREWebsiteLogo.png",
		apple: "/images/GREWebsiteLogo.png",
	},
};

export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<head>
				<link rel="icon" href="/images/GREWebsiteLogo.png" />
			</head>
			<body>{children}</body>
		</html>
	);
}
