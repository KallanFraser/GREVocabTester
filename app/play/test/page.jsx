/** @format */

// /play/test. Metadata lives in ./layout.jsx. TestMode reads the query string
// through useSearchParams inside its own <Suspense>; this outer boundary is a
// second guard, so the static export can never fail on a missing boundary.
import { Suspense } from "react";
import TestMode from "../../../components/TestMode";

export default function TestRoute() {
	return (
		<Suspense fallback={null}>
			<TestMode />
		</Suspense>
	);
}
