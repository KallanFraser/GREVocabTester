/** @format */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "../styles/navbar.css";

const LINKS = [
	{ href: "/wordpacks", label: "Word Packs" },
	{ href: "/play/review", label: "Daily Review" },
	{ href: "/settings", label: "Settings" },
];

// "/" is active only on the home page itself; every other link also covers its
// sub-routes. Trailing slashes are ignored.
function isActive(pathname, href) {
	const path = (pathname || "/").replace(/\/+$/, "") || "/";
	if (href === "/") return path === "/";
	return path === href || path.startsWith(href + "/");
}

export default function Navbar() {
	const pathname = usePathname();
	// Closed on the server and on first paint; only a click opens it.
	const [open, setOpen] = useState(false);
	const headerRef = useRef(null);
	const burgerRef = useRef(null);

	// Close the burger panel whenever the route changes.
	useEffect(() => {
		setOpen(false);
	}, [pathname]);

	// While open: Escape closes the panel and returns focus to the burger, and a
	// press anywhere outside the navbar closes it.
	useEffect(() => {
		if (!open) return;
		function onKey(e) {
			if (e.key === "Escape") {
				setOpen(false);
				burgerRef.current?.focus();
			}
		}
		function onPointer(e) {
			if (headerRef.current && !headerRef.current.contains(e.target)) setOpen(false);
		}
		window.addEventListener("keydown", onKey);
		document.addEventListener("pointerdown", onPointer);
		return () => {
			window.removeEventListener("keydown", onKey);
			document.removeEventListener("pointerdown", onPointer);
		};
	}, [open]);

	// Hide nav entirely on study/play pages: no distractions while studying.
	// Placed after every hook so hook order stays the same on every render.
	if (pathname?.startsWith("/play")) return null;

	const links = LINKS.map(({ href, label }) => (
		<Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined}>
			{label}
		</Link>
	));

	return (
		<header className="site-nav" ref={headerRef}>
			<div className="nav-inner">
				<Link href="/" className="nav-logo" aria-label="GRE Vocab Tester home">
					<span className="nav-logo-mark">GRE</span>
					<span className="nav-logo-sep">|</span>
					<span className="nav-logo-text">Vocab Tester</span>
				</Link>

				<nav className="nav-links" aria-label="Main">
					{links}
				</nav>
				<Link href="/play/test" className="btn-p nav-cta">
					Start Studying
				</Link>

				<button
					ref={burgerRef}
					type="button"
					className="nav-burger"
					aria-expanded={open}
					aria-controls="nav-panel"
					aria-label="Menu"
					onClick={() => setOpen((o) => !o)}
				>
					<span />
					<span />
					<span />
				</button>
			</div>

			{/* A tap on the current page's link changes no route, so close here too. */}
			<nav
				id="nav-panel"
				className={`nav-panel${open ? " open" : ""}`}
				aria-label="Main"
				onClick={(e) => e.target.closest("a") && setOpen(false)}
			>
				{links}
				<Link href="/play/test" className="btn-p">
					Start Studying
				</Link>
			</nav>
		</header>
	);
}
