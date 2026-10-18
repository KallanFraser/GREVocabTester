// A client page cannot export metadata, so the settings route gets it from this
// pass-through layout.
export const metadata = {
	title: "Settings | GRE Vocab Tester",
	description:
		"Choose your default study direction, how long feedback stays on screen and whether answer sounds play. Export, import or reset your progress.",
	alternates: { canonical: "https://grevocabtester.com/settings" },
};

export default function SettingsLayout({ children }) {
	return children;
}
