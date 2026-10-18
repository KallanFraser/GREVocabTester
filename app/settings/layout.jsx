// A client page cannot export metadata, so the settings route gets it from this
// pass-through layout.
const TITLE = "Settings";
const DESCRIPTION =
	"Choose your default study direction, how long feedback stays on screen, whether answer sounds play and which backgrounds to show. Export, import or reset your progress.";

export const metadata = {
	title: `${TITLE} | GRE Vocab Tester`,
	description: DESCRIPTION,
	alternates: { canonical: "https://grevocabtester.com/settings" },
	openGraph: {
		title: `${TITLE} | GRE Vocab Tester`,
		description: DESCRIPTION,
		url: "https://grevocabtester.com/settings",
		siteName: "GRE Vocab Tester",
		images: [{ url: "/images/og-image.png", width: 1200, height: 630, alt: "GRE Vocab Tester" }],
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: `${TITLE} | GRE Vocab Tester`,
		description: DESCRIPTION,
		images: ["/images/og-image.png"],
	},
};

export default function SettingsLayout({ children }) {
	return children;
}
