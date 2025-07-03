/** @format */
//Wraps all pages
//The global layout
// app/layout.tsx
export default function RootLayout({ children }) {
	return (
		<html>
			<body>{children}</body>
		</html>
	);
}
