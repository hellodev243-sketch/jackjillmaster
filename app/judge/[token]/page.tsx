"use client";

import { use } from "react";
import { JudgePageClient } from "./judge-page-client";

export default function JudgePage({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = use(params);
	// Decode the token in case it has URL-encoded characters
	const decodedToken = decodeURIComponent(token);
	return <JudgePageClient token={decodedToken} />;
}
