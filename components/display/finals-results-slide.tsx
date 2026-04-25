"use client";

import { useState, useCallback } from "react";
import type { Competitor, Event, RoundType } from "@/lib/types";
import { motion } from "framer-motion";
import { Trophy, Medal, Award } from "lucide-react";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { ResultsAnnouncement } from "./results-announcement";
import { useDisplayAction } from "@/hooks/use-display-action";
import {
	getScoringMode,
	getCompetitionConfig,
	getSortedRounds,
	isFinalRound,
} from "@/lib/competition-config";

interface FinalsResultsSlideProps {
	finalists: Competitor[];
	gender: "male" | "female";
	totalVotingJudges: number;
	tieUpIds?: string[];
	event: Event;
	round?: RoundType;
}

export function FinalsResultsSlide({
	event,
	finalists,
	gender,
	totalVotingJudges,
	tieUpIds,
	round,
}: FinalsResultsSlideProps) {
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

	// Determine the actual finals round ID from config
	const config = getCompetitionConfig(event);
	const sortedRounds = getSortedRounds(config);
	const finalsRoundConfig = round
		? config.rounds.find((r) => r.id === round)
		: sortedRounds.find((r) => isFinalRound(r, config));
	const finalsRoundId = finalsRoundConfig?.id || round || "finals";

	const announcementStyle =
		finalsRoundConfig?.announcementStyle || "all_with_ranking";
	const scoringMode = getScoringMode(event, finalsRoundId);
	const isScoringMode = scoringMode === "scoring";
	const isRankingMode = scoringMode === "ranking";
	const scoreLabel = isRankingMode
		? "Total Rank"
		: isScoringMode
			? "points"
			: "votes";

	// For ranking mode, finalists are already sorted ascending (lowest = best) from calculateRankings
	// For other modes, sort descending (highest first)
	const pointsSortedFinalists = isRankingMode
		? [...finalists]
		: [...finalists].sort((a, b) => b.voteCount - a.voteCount);

	// If tie-up is active, reorder based on tie-up selection
	let sortedFinalists = pointsSortedFinalists;
	const hasTieUp = tieUpIds && tieUpIds.length > 0;

	if (hasTieUp) {
		const finalistsMap = new Map(
			pointsSortedFinalists.map((c) => [c.id, c]),
		);
		const tieUpFinalists = tieUpIds!
			.map((id) => finalistsMap.get(id))
			.filter(Boolean) as Competitor[];
		const nonTieUpFinalists = pointsSortedFinalists.filter(
			(c) => !tieUpIds!.includes(c.id),
		);
		sortedFinalists = [...tieUpFinalists, ...nonTieUpFinalists];
	}

	let displayFinalists = sortedFinalists;
	if (announcementStyle === "winners_only") {
		displayFinalists = displayFinalists.slice(0, 3);
	} else if (announcementStyle === "top_3_only") {
		displayFinalists = displayFinalists.slice(0, 3);
	}

	// Reverse to show 6th → 1st (descending order)
	const reversedFinalists = [...displayFinalists].reverse();

	// Show announcement mode first
	if (showAnnouncement) {
		return (
			<ResultsAnnouncement
				event={event}
				competitors={sortedFinalists}
				gender={gender}
				round={finalsRoundId}
				advancingCount={1} // Only 1st place "advances" (wins)
				tieUpIds={tieUpIds}
				onFinish={() => setShowAnnouncement(false)}
				totalVotingJudges={totalVotingJudges}
			/>
		);
	}

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
			<motion.div
				className="text-center mb-8"
				initial={{ opacity: 0, y: -30 }}
				animate={{ opacity: 1, y: 0 }}
			>
				<img
					src="/jack-and-jill-logo-transparent.png"
					alt="Jack & Jill"
					className="w-16 h-16 mx-auto mb-4 object-contain"
				/>
				<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
					{gender === "male" ? "Male" : "Female"} Finals Results
				</h1>
				<p className="text-xl text-muted-foreground">
					Top {displayFinalists.length}{" "}
					{gender === "male" ? "Male" : "Female"} Dancers
				</p>
			</motion.div>

			<div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl">
				{reversedFinalists.map((finalist, idx) => {
					// Calculate actual position (rank) from the original sorted order
					const position = displayFinalists.indexOf(finalist) + 1;
					const positionLabels = [
						"1st",
						"2nd",
						"3rd",
						"4th",
						"5th",
						"6th",
					];

					return (
						<motion.div
							key={finalist.id}
							className="relative p-6 rounded-2xl text-center bg-amber-500/20 border-2 border-amber-500 shadow-lg shadow-amber-500/20"
							initial={{ opacity: 0, y: 30, scale: 0.9 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							transition={{ delay: 0.3 + idx * 0.15 }}
						>
							{/* Position badge with ranking */}
							<div className="absolute -top-4 -right-4 w-14 h-14 rounded-full flex flex-col items-center justify-center text-sm font-bold bg-amber-500 text-white">
								{position === 1 ? (
									<Trophy className="w-6 h-6" />
								) : position === 2 ? (
									<Medal className="w-6 h-6" />
								) : position === 3 ? (
									<Award className="w-6 h-6" />
								) : (
									<span className="text-lg">{position}</span>
								)}
								<span className="text-[10px] mt-0.5">
									{positionLabels[position - 1]}
								</span>
							</div>

							<div
								className={`w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden mx-auto mb-4 border-4 border-amber-500 ${
									position === 1
										? "ring-4 ring-amber-400/50"
										: ""
								}`}
							>
								<PlaceholderAvatar
									src={finalist.photoUrl}
									alt={finalist.name}
									name={finalist.name}
									className="w-full h-full"
								/>
							</div>

							<p className="text-3xl font-bold text-foreground">
								#{finalist.number}
							</p>
							<p className="text-sm text-foreground">
								{finalist.name}
							</p>
							<p className="text-xs text-muted-foreground mt-1">
								{finalist.voteCount || 0} {scoreLabel}
							</p>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}
