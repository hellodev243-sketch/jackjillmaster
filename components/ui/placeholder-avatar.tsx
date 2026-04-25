"use client";

import { useState, useEffect, useMemo } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaceholderAvatarProps {
	src?: string | null;
	alt?: string;
	className?: string;
	name?: string;
	eventId?: string;
	competitorId?: string;
}

/**
 * Extract eventId and competitorId from a GCS signed URL.
 * URL pattern: https://storage.googleapis.com/jack_jill_data/events/{eventId}/competitors/photos/{competitorId}.jpg?...
 * Also handles judge photos: events/{eventId}/judges/photos/{judgeId}.jpg
 * And comp assistant photos: events/{eventId}/comp-assistants/photos/{id}.jpg
 */
function extractIdsFromUrl(url: string): {
	eventId?: string;
	entityId?: string;
	entityType?: "competitors" | "judges" | "comp-assistants";
} {
	try {
		// Match: events/{eventId}/competitors/photos/{competitorId}.jpg or .png
		const competitorMatch = url.match(
			/events\/([^/]+)\/competitors\/photos\/([^/.]+)\./,
		);
		if (competitorMatch) {
			return {
				eventId: competitorMatch[1],
				entityId: competitorMatch[2],
				entityType: "competitors",
			};
		}
		// Match: events/{eventId}/judges/photos/{judgeId}.jpg or .png
		const judgeMatch = url.match(
			/events\/([^/]+)\/judges\/photos\/([^/.]+)\./,
		);
		if (judgeMatch) {
			return {
				eventId: judgeMatch[1],
				entityId: judgeMatch[2],
				entityType: "judges",
			};
		}
		// Match: events/{eventId}/comp-assistants/photos/{id}.jpg or .png
		const caMatch = url.match(
			/events\/([^/]+)\/comp-assistants\/photos\/([^/.]+)\./,
		);
		if (caMatch) {
			return {
				eventId: caMatch[1],
				entityId: caMatch[2],
				entityType: "comp-assistants",
			};
		}
	} catch {
		// ignore parse errors
	}
	return {};
}

export function PlaceholderAvatar({
	src,
	alt = "",
	className,
	name,
	eventId: propEventId,
	competitorId: propCompetitorId,
}: PlaceholderAvatarProps) {
	const [imageSrc, setImageSrc] = useState<string | null>(src || null);
	const [hasError, setHasError] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Auto-extract eventId and competitorId from the URL if not provided as props
	const { eventId, competitorId, entityType } = useMemo(() => {
		if (propEventId && propCompetitorId) {
			return {
				eventId: propEventId,
				competitorId: propCompetitorId,
				entityType: "competitors" as const,
			};
		}
		if (src) {
			const extracted = extractIdsFromUrl(src);
			return {
				eventId: propEventId || extracted.eventId,
				competitorId: propCompetitorId || extracted.entityId,
				entityType: extracted.entityType,
			};
		}
		return {
			eventId: propEventId,
			competitorId: propCompetitorId,
			entityType: undefined,
		};
	}, [src, propEventId, propCompetitorId]);

	// Reset state when src changes
	useEffect(() => {
		setImageSrc(src || null);
		setHasError(false);
	}, [src]);

	// Check if it's a placeholder (no photo uploaded)
	const isPlaceholder = !imageSrc || imageSrc.includes("/placeholder.svg");

	// Handle image load error - try to refresh the signed URL
	const handleError = async () => {
		if (hasError || isRefreshing) return;

		// Try to get a fresh URL if we can identify the entity
		if (eventId && competitorId && !isPlaceholder) {
			setIsRefreshing(true);
			try {
				// Use the competitor photo API (works for competitors)
				if (entityType === "competitors" || !entityType) {
					const response = await fetch(
						`/api/competitors/photo?eventId=${eventId}&competitorId=${competitorId}`,
					);
					const data = await response.json();

					if (data.success && data.photoUrl) {
						setImageSrc(data.photoUrl);
						setIsRefreshing(false);
						return;
					}
				}
			} catch (error) {
				console.error("Failed to refresh photo URL:", error);
			}
			setIsRefreshing(false);
		}

		setHasError(true);
	};

	if (isPlaceholder || hasError) {
		// Show question mark for competitors without photos or failed loads
		return (
			<div
				className={cn(
					"flex items-center justify-center bg-muted",
					className,
				)}
			>
				<HelpCircle className="text-muted-foreground w-1/2 h-1/2" />
			</div>
		);
	}

	// Has a real photo URL (either uploaded or default judge image)
	return (
		<img
			src={imageSrc || ""}
			alt={alt || name || ""}
			className={cn("object-cover", className)}
			onError={handleError}
		/>
	);
}
