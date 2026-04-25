"use client";

import { useState } from "react";
import type { Competitor, Event } from "@/lib/types";
import {
	getRoundNames,
	getCompetitorsAdvancing,
	getScoringMode,
} from "@/lib/competition-config";
import { motion } from "framer-motion";
import { Trophy, ArrowRight, ArrowUp, X } from "lucide-react";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { ResultsAnnouncement } from "./results-announcement";

interface Round2ResultsSlideProps {
	advancingCompetitors: Competitor[];
	gender: "male" | "female";
	tieUpIds?: string[]; // Ordered competitor IDs from tie-up selection
	event: Event;
}

export function Round2ResultsSlide({
	advancingCompetitors,
	gender,
	tieUpIds,
	event,
}: Round2ResultsSlideProps) {
	const [showAnnouncement, setShowAnnouncement] = useState(true);
	const roundNames = getRoundNames(event);
	const currentRoundConfig = event.competitionConfig?.rounds?.find(
		(r) => r.id === "round2",
	);
	const announcementStyle =
		currentRoundConfig?.announcementStyle || "all_with_ranking";
	const advancingCount = getCompetitorsAdvancing(event, "round2");
	const scoringMode = getScoringMode(event, "round2");
	const isScoringMode = scoringMode === "scoring";
	const isRankingMode = scoringMode === "ranking";
	const scoreLabel = isRankingMode
		? "Total Rank"
		: isScoringMode
			? "points"
			: "votes";
	// Show only top 10 competitors, top 6 advance to finals, sorted by voteCount
	// For ranking mode, already sorted ascending (lowest = best)
	const pointsSortedCompetitors = isRankingMode
		? [...advancingCompetitors]
		: [...advancingCompetitors].sort((a, b) => b.voteCount - a.voteCount);

	// If tie-up is active, reorder based on tie-up selection
	let allCompetitors = pointsSortedCompetitors;
	const hasTieUp = tieUpIds && tieUpIds.length > 0;

	if (hasTieUp) {
		const competitorsMap = new Map(
			pointsSortedCompetitors.map((c) => [c.id, c]),
		);
		const tieUpCompetitors = tieUpIds!
			.map((id) => competitorsMap.get(id))
			.filter(Boolean) as Competitor[];
		const nonTieUpCompetitors = pointsSortedCompetitors.filter(
			(c) => !tieUpIds!.includes(c.id),
		);
		allCompetitors = [...tieUpCompetitors, ...nonTieUpCompetitors];
	}

	// Only show top 10 competitors if showing all
	let displayCompetitors = allCompetitors.slice(0, 10);

	// Filter based on announcement style
	if (announcementStyle === "winners_only") {
		displayCompetitors = displayCompetitors.slice(0, advancingCount);
	} else if (announcementStyle === "top_3_only") {
		displayCompetitors = displayCompetitors.slice(0, 3);
	}

	// Find ALL competitors involved in the tie-up (same vote count as any tie-up selected competitor)
	const tiedCompetitorIds = new Set<string>();
	if (hasTieUp) {
		// Get the vote counts of all tie-up selected competitors
		const tieUpVoteCounts = new Set(
			tieUpIds!
				.map(
					(id) =>
						pointsSortedCompetitors.find((c) => c.id === id)
							?.voteCount,
				)
				.filter((v) => v !== undefined),
		);
		// Find ALL competitors with those vote counts - they are all tied
		pointsSortedCompetitors.forEach((c) => {
			if (tieUpVoteCounts.has(c.voteCount)) {
				tiedCompetitorIds.add(c.id);
			}
		});
	}

	// Show announcement mode first
	if (showAnnouncement) {
		return (
			<ResultsAnnouncement
				event={event}
				competitors={displayCompetitors}
				gender={gender}
				round="round2"
				advancingCount={advancingCount}
				tieUpIds={tieUpIds}
				onFinish={() => setShowAnnouncement(false)}
			/>
		);
	}

	return (
		<div className="min-h-screen flex flex-col items-center justify-start bg-background p-6 overflow-auto">
			<motion.div
				className="text-center mb-6"
				initial={{ opacity: 0, y: -30 }}
				animate={{ opacity: 1, y: 0 }}
			>
				<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
					Semi-Finals Results
				</h1>
				<p className="text-xl text-muted-foreground">
					Top {advancingCount} {gender === "male" ? "Male" : "Female"}{" "}
					Dancers
				</p>
				<div className="flex items-center justify-center gap-2 mt-4 text-amber-500">
					<span className="text-lg">Advancing to Finals</span>
					<ArrowRight className="w-6 h-6" />
					<Trophy className="w-6 h-6" />
				</div>
			</motion.div>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-6xl w-full">
				{displayCompetitors.map((competitor, idx) => {
					const isAdvancing = idx < advancingCount;
					const isTiedCompetitor = tiedCompetitorIds.has(
						competitor.id,
					);

					// Determine status text
					let statusText = isAdvancing ? "Finals" : "Eliminated";
					if (isTiedCompetitor) {
						statusText = "Tied Up";
					}

					return (
						<motion.div
							key={competitor.id}
							className={`relative p-3 rounded-xl text-center transition-all ${
								isAdvancing
									? "bg-amber-500/20 border-2 border-amber-500 shadow-lg shadow-amber-500/20"
									: "bg-muted/50 border border-border opacity-60"
							}`}
							initial={{ opacity: 0, y: 30 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1 + idx * 0.05 }}
						>
							{/* Rank badge for advancing competitors */}
							{isAdvancing && (
								<div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm z-10">
									{idx + 1}
								</div>
							)}

							<div
								className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden mx-auto mb-2 border-2 ${
									isAdvancing
										? "border-amber-500"
										: "border-muted-foreground/30 grayscale"
								}`}
							>
								<PlaceholderAvatar
									src={competitor.photoUrl}
									alt={competitor.name}
									name={competitor.name}
									className="w-full h-full"
								/>
							</div>

							<p
								className={`text-xl font-bold ${
									isAdvancing
										? "text-foreground"
										: "text-muted-foreground"
								}`}
							>
								#{competitor.number}
							</p>
							<p className="text-xs text-muted-foreground truncate">
								{competitor.name}
							</p>

							{/* Status indicator */}
							{isAdvancing ? (
								<div className="flex items-center justify-center gap-1 mt-1 text-amber-500">
									<ArrowUp className="w-3 h-3" />
									<span className="text-xs font-medium">
										{statusText}
									</span>
								</div>
							) : (
								<div className="flex items-center justify-center gap-1 mt-1 text-muted-foreground">
									<X className="w-3 h-3" />
									<span className="text-xs">
										{statusText}
									</span>
								</div>
							)}

							<div className="mt-1 text-xs font-medium text-muted-foreground">
								{competitor.voteCount || 0} {scoreLabel}
							</div>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}
