/** @format */
"use client";

// Reports the page's query string to Test mode. useSearchParams makes the
// nearest Suspense boundary render on the client only under a static export,
// so this renders nothing and TestMode wraps just this in <Suspense>: the rest
// of the page still prerenders. Following the hook (rather than reading
// window.location once) keeps Back and client navigations between packs in
// sync.
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function SearchParamsReader({ onChange }) {
	const params = useSearchParams();
	const qs = params ? params.toString() : "";
	useEffect(() => {
		onChange(qs);
	}, [qs, onChange]);
	return null;
}
