"use client";

import { useState, useCallback } from "react";
import type { Competitor, CompAssistant, RoundType, Event } from "@/lib/types";
import {
	getRoundNames,
	getCompetitorsAdvancing,
	getScoringMode,
} from "@/lib/competition-config";
import { motion } from "framer-motion";
import { ArrowUp, X, HelpCircle } from "lucide-react";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { useDisplayAction } from "@/hooks/use-display-action";
import { ResultsAnnouncement } from "./results-announcement";

interface ResultsSlideProps {
	competitors: Competitor[];
	compAssistants?: CompAssistant[]; // Comp assistants to show in Round 1 only
	gender: "male" | "female";
	round: RoundType;
	tieUpIds?: string[]; // Ordered competitor IDs from tie-up selection
	event: Event;
}

export function ResultsSlide({
	competitors,
	compAssistants = [],
	gender,
	round,
	tieUpIds,

	event,
}: ResultsSlideProps) {
	const [showAnnouncement, setShowAnnouncement] = useState(true);

	// Listen for remote actions at the parent level so we can toggle the announcement phase
	useDisplayAction(
		useCallback((action: string) => {
			if (action === "startOver" || action === "reveal") {
				setShowAnnouncement(true);
			} else if (action === "finish") {
				setShowAnnouncement(false);
			}
		}, []),
	);
	const roundNames = getRoundNames(event);
	const currentRoundConfig = event.competitionConfig?.rounds?.find(
		(r) => r.id === round,
	);
	const announcementStyle =
		currentRoundConfig?.announcementStyle || "all_with_ranking";
	const advancingCount = getCompetitorsAdvancing(event, round);
	const scoringMode = getScoringMode(event, round);
	const isScoringMode = scoringMode === "scoring";
	const isRankingMode = scoringMode === "ranking";
	const scoreLabel = isRankingMode
		? "Total Rank"
		: isScoringMode
			? "points"
			: "votes";
	// Get ALL competitors of this gender, sorted by voteCount
	// Exclude comp assistants from the main competitor list (they're handled separately)
	// For ranking mode, competitors are already sorted ascending (lowest = best)
	// For other modes, sort descending (highest first)
	const pointsSortedCompetitors = isRankingMode
		? competitors.filter((c) => c.gender === gender && !c.isCompAssistant)
		: competitors
				.filter((c) => c.gender === gender && !c.isCompAssistant)
				.sort((a, b) => b.voteCount - a.voteCount);

	// Get comp assistants of this gender (only shown in the first round)
	const isFirstRound = event.competitionConfig?.rounds?.[0]?.id === round;
	const genderCompAssistants = (isFirstRound ? compAssistants : [])
		.filter((ca) => ca.gender === gender)
		.map(
			(ca) =>
				({
					id: ca.id,
					number: ca.number,
					name: ca.name,
					gender: ca.gender,
					photoUrl: ca.photoUrl,
					voteCount: 0,
					eliminated: false,
					isCompAssistant: true,
				}) as Competitor,
		);

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

	// For intermediate rounds (not first and not final), optionally restrict the display count so it doesn't get too long
	let displayCompetitors = allCompetitors;
	if (!isFirstRound) {
		displayCompetitors = allCompetitors.slice(0, advancingCount + 4);
	}
	// Filter based on announcement style
	if (announcementStyle === "winners_only") {
		// Only show those advancing
		displayCompetitors = displayCompetitors.slice(0, advancingCount);
	} else if (announcementStyle === "top_3_only") {
		// Only show top 3
		displayCompetitors = displayCompetitors.slice(0, 3);
	}

	// Build display list: competitors in rank order, with assistants appended at the end
	const displayWithAssistants = [
		...displayCompetitors,
		...genderCompAssistants,
	];

	// Show announcement mode first
	if (showAnnouncement) {
		return (
			<ResultsAnnouncement
				event={event}
				competitors={displayCompetitors}
				gender={gender}
				round={round}
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
					{roundNames[round]} Results
				</h1>
				<p className="text-xl text-muted-foreground">
					Top {advancingCount} {gender === "male" ? "Male" : "Female"}{" "}
					Dancers Advancing
				</p>
			</motion.div>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-6xl w-full">
				{displayWithAssistants.map((competitor, idx) => {
					const isAssistant = competitor.isCompAssistant;
					// Since displayCompetitors is already in rank order, the index IS the rank
					const competitorRank = isAssistant
						? -1
						: displayCompetitors.findIndex(
								(c) => c.id === competitor.id,
							);
					const isAdvancing =
						!isAssistant &&
						competitorRank < advancingCount &&
						competitorRank >= 0;
					const isTiedCompetitor = tiedCompetitorIds.has(
						competitor.id,
					);

					// Assistant card styling
					if (isAssistant) {
						return (
							<motion.div
								key={competitor.id}
								className="relative p-3 rounded-xl text-center bg-amber-500/10 border border-amber-500/30"
								initial={{ opacity: 0, y: 30 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.1 + idx * 0.03 }}
							>
								<div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden mx-auto mb-2 border-2 border-amber-500/50">
									<PlaceholderAvatar
										src={competitor.photoUrl}
										alt={competitor.name}
										name={competitor.name}
										className="w-full h-full"
									/>
								</div>
								<p className="text-xl font-bold text-amber-600">
									#{competitor.number}
								</p>
								<p className="text-xs text-muted-foreground truncate">
									{competitor.name}
								</p>
								<div className="flex items-center justify-center gap-1 mt-1 text-amber-500">
									<HelpCircle className="w-3 h-3" />
									<span className="text-xs font-medium">
										Assistant
									</span>
								</div>
							</motion.div>
						);
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
							transition={{ delay: 0.1 + idx * 0.03 }}
						>
							{/* Rank badge - yellow rounded number */}
							<div
								className={`absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm z-10 ${
									isAdvancing
										? "bg-amber-500 text-black"
										: "bg-muted-foreground/30 text-muted-foreground"
								}`}
							>
								{competitorRank + 1}
							</div>

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
										{isTiedCompetitor
											? "Tied Up"
											: "Advances"}
									</span>
								</div>
							) : (
								<div className="flex items-center justify-center gap-1 mt-1 text-muted-foreground">
									<X className="w-3 h-3" />
									<span className="text-xs">Eliminated</span>
								</div>
							)}

							{/* Vote count display */}
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
