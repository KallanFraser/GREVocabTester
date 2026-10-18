/** @format */
// The 404 page (out/404.html under static export). The root layout carries no
// canonical or og:url, so nothing here claims the homepage URL; the page is
// also kept out of search results. Styles are inline because no stylesheet
// owns this page; colors and type come from the globals.css tokens and the
// buttons from ui.css.

import Link from "next/link";

const TITLE = "Page Not Found | GRE Vocab Tester";
const DESCRIPTION = "The page you were looking for does not exist or has moved.";

export const metadata = {
	title: TITLE,
	description: DESCRIPTION,
	robots: { index: false, follow: true },
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		siteName: "GRE Vocab Tester",
		images: [{ url: "/images/og-image.png", width: 1200, height: 630, alt: "GRE Vocab Tester" }],
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: DESCRIPTION,
		images: ["/images/og-image.png"],
	},
};

export default function NotFound() {
	return (
		<main
			style={{
				position: "relative",
				zIndex: 1,
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "6rem 1.25rem 3rem",
				textAlign: "center",
			}}
		>
			<div style={{ maxWidth: "32rem" }}>
				<p
					style={{
						margin: 0,
						color: "var(--coral-light)",
						fontSize: "0.8rem",
						fontWeight: 600,
						letterSpacing: "0.12em",
						textTransform: "uppercase",
					}}
				>
					Error 404
				</p>
				<h1 style={{ margin: "0.6rem 0 0.8rem", fontSize: "var(--fs-xl)", color: "var(--text)", lineHeight: 1.1 }}>
					Page not found
				</h1>
				<p style={{ margin: "0 0 1.8rem", color: "var(--muted)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>
					The page you were looking for does not exist or has moved. Pick up your study from the home page or
					choose a word pack.
				</p>
				<div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
					<Link className="btn-p" href="/">
						Go to the home page
					</Link>
					<Link className="btn-s" href="/wordpacks">
						Browse word packs
					</Link>
				</div>
			</div>
		</main>
	);
}
