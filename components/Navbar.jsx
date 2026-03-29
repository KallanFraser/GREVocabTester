/** @format */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "../styles/navbar.css";

export default function Navbar() {
	const pathname = usePathname();

	// Hide nav entirely on study/play pages — no distractions while studying
	if (pathname?.startsWith("/play")) return null;

	return (
		<nav className="site-nav" aria-label="Main navigation">
			<div className="nav-inner">
				<Link href="/" className="nav-logo" aria-label="GRE Vocab Tester — Home">
					<span className="nav-logo-mark">GRE</span>
					<span className="nav-logo-sep">|</span>
					<span className="nav-logo-text">Vocab Tester</span>
				</Link>

				<div className="nav-links">
					<Link href="/wordpacks" className="nav-link">
						Word Packs
					</Link>
					<a href="/play/practice" className="nav-link">
						Flash Cards
					</a>
					<a href="/play/test" className="nav-cta">
						Start Studying →
					</a>
				</div>
			</div>
		</nav>
	);
}
