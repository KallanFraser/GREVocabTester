/** @format */
//Wraps all pages
//The global layout
// app/layout.tsx
import "../styles/globals.css";
import "../styles/components.css";

export default function RootLayout({ children }) {
	return (
		<html>
			<body>{children}</body>
		</html>
	);
}
