"use client";

import { useEffect } from "react";

/**
 * Hook for display slide components to listen for remote actions
 * from the admin remote panel via socket -> display:action -> DOM CustomEvent.
 *
 * Actions: "next", "prev", "reveal", "orderly", "random", "finish", "startOver"
 */
export function useDisplayAction(handler: (action: string, payload?: any) => void) {
	useEffect(() => {
		const listener = (e: Event) => {
			const { action, payload } = (e as CustomEvent).detail || {};
			console.log(
				`[useDisplayAction] Action received: ${action}`,
				payload ? "with payload" : "",
			);
			handler(action, payload);
		};
		window.addEventListener("display-action", listener);
		return () => window.removeEventListener("display-action", listener);
	}, [handler]);
}
