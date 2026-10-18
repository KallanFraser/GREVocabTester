/** @format */

import { Suspense } from "react";
import ContextMode, { ContextFallback } from "../../../components/ContextMode";

// The mode reads ?pack= through useSearchParams, which a static export can only
// render on the client, below a Suspense boundary.
export default function ContextRoute() {
	return (
		<Suspense fallback={<ContextFallback />}>
			<ContextMode />
		</Suspense>
	);
}
