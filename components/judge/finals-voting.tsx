"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CompetitorCard } from "./competitor-card";
import type { Competitor, Judge, Vote, Heat } from "@/lib/types";
import { motion } from "framer-motion";
import { Trophy, CheckCircle2, AlertCircle } from "lucide-react";

import {
	getFinalsJudgeMode,
	getSelectionsForJudge,
} from "@/lib/competition-config";

interface FinalsVotingProps {
	judge: Judge;
	finalists: Competitor[];
	onSubmit: (vote: Vote) => void;
	existingVote: Vote | null;
	votingOpen: boolean;
	currentHeat?: Heat | null;
	event: import("@/lib/types").Event;
}

export function FinalsVoting({
	judge,
	finalists,
	onSubmit,
	existingVote,
	votingOpen,
	currentHeat,
	event,
}: FinalsVotingProps) {
	const [rankings, setRankings] = useState<Map<string, number>>(new Map());
	const [submitted, setSubmitted] = useState(!!existingVote);
	const judgeMode = getFinalsJudgeMode(event, currentHeat?.round || "finals");

	// Judges vote based on judgeMode (same_gender or cross_gender)
	const eligibleFinalists = finalists.filter((c) => {
		if (judgeMode === "same_gender") return c.gender === judge.gender;
		return c.gender !== judge.gender;
	});

	// Points for each rank position: 1st = N, 2nd = N-1, etc.
	const getPointsForRank = (rank: number) => {
		return Math.max(0, eligibleFinalists.length + 1 - rank);
	};

	const MAX_SELECTIONS = getSelectionsForJudge(
		event,
		currentHeat?.round || "finals",
		currentHeat?.number || 1,
		eligibleFinalists.length,
	);

	// Reset state when heat changes
	useEffect(() => {
		if (!existingVote) {
			setRankings(new Map());
			setSubmitted(false);
		}
	}, [currentHeat?.id, existingVote]);

	useEffect(() => {
		if (existingVote) {
			const newRankings = new Map<string, number>();
			existingVote.rankings.forEach((r) => {
				newRankings.set(r.competitorId, r.rank);
			});
			setRankings(newRankings);
			setSubmitted(true);
		}
	}, [existingVote]);

	const handleSelect = (competitorId: string) => {
		if (!votingOpen || submitted) return;

		const currentRank = rankings.get(competitorId);
		const newRankings = new Map(rankings);

		if (currentRank) {
			// Remove this selection and shift others down
			newRankings.delete(competitorId);
			const entries = Array.from(newRankings.entries())
				.filter(([, rank]) => (rank as number) > currentRank)
				.map(
					([id, rank]) =>
						[id, (rank as number) - 1] as [string, number],
				);

			entries.forEach(([id, rank]) => newRankings.set(id, rank));
		} else {
			// Add new selection if less than MAX_SELECTIONS
			const currentSelections = rankings.size;
			if (currentSelections < MAX_SELECTIONS) {
				newRankings.set(competitorId, currentSelections + 1);
			}
		}

		setRankings(newRankings);
	};

	const handleSubmit = () => {
		if (rankings.size !== MAX_SELECTIONS || !currentHeat) return;

		const vote: Vote = {
			judgeId: judge.id,
			heatId: currentHeat.id,
			round: currentHeat.round,
			rankings: Array.from(rankings.entries()).map(
				([competitorId, rank]) => ({
					competitorId,
					rank: rank as 1 | 2 | 3 | 4 | 5 | 6,
				}),
			),
			submittedAt: new Date().toISOString(),
		};

		onSubmit(vote);
		setSubmitted(true);
	};

	const handleEdit = () => {
		setSubmitted(false);
	};

	// Check if this judge should be voting in the current heat
	// In same_gender mode: male judges vote when male finalists dance
	// In cross_gender mode: male judges vote when female finalists dance
	const isJudgesTurn = currentHeat?.finalistGender
		? judgeMode === "same_gender"
			? currentHeat.finalistGender === judge.gender
			: currentHeat.finalistGender !== judge.gender
		: true;

	if (!isJudgesTurn && currentHeat?.finalistGender) {
		const votingGender =
			judgeMode === "same_gender"
				? currentHeat.finalistGender
				: currentHeat.finalistGender === "male"
					? "female"
					: "male";
		return (
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center"
			>
				<Trophy className="w-20 h-20 text-muted-foreground mb-4" />
				<h2 className="text-xl font-semibold text-foreground mb-2">
					Not Your Turn Yet
				</h2>
				<p className="text-muted-foreground">
					Currently {currentHeat.finalistGender} finalists are being
					judged by {votingGender} judges.
					<br />
					You will vote when{" "}
					{judge.gender === "male"
						? judgeMode === "same_gender"
							? "male"
							: "female"
						: judgeMode === "same_gender"
							? "female"
							: "male"}{" "}
					finalists are dancing.
				</p>
			</motion.div>
		);
	}

	if (!votingOpen && !submitted) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
				<AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
				<h2 className="text-xl font-semibold text-foreground mb-2">
					Voting Not Open
				</h2>
				<p className="text-muted-foreground">
					Please wait for the competition manager to open voting for
					the finals.
				</p>
			</div>
		);
	}

	if (submitted) {
		return (
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center"
			>
				<CheckCircle2 className="w-20 h-20 text-emerald-500 mb-4" />
				<h2 className="text-xl font-semibold text-foreground mb-2">
					Finals Vote Submitted!
				</h2>
				<p className="text-muted-foreground mb-6">
					Your Top {MAX_SELECTIONS} rankings have been recorded.
				</p>

				<div className="w-full max-w-sm space-y-2 mb-6">
					{Array.from(rankings.entries())
						.sort((a, b) => (a[1] as number) - (b[1] as number))
						.map(([competitorId, rank]) => {
							const competitor = eligibleFinalists.find(
								(c) => c.id === competitorId,
							);
							if (!competitor) return null;
							return (
								<div
									key={competitorId}
									className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/20 border border-amber-500/30"
								>
									<span className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-amber-500 text-white">
										{rank as number}
									</span>
									<span className="font-medium">
										#{competitor.number}
									</span>
									<span className="text-muted-foreground">
										{competitor.name}
									</span>
								</div>
							);
						})}
				</div>

				{votingOpen && (
					<Button variant="outline" onClick={handleEdit}>
						Edit Vote
					</Button>
				)}
			</motion.div>
		);
	}

	return (
		<div className="p-3 sm:p-4 pb-36 sm:pb-40">
			<div className="mb-4 sm:mb-6 text-center">
				<Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500 mx-auto mb-2 sm:mb-3" />
				<h2 className="text-lg sm:text-xl font-semibold text-foreground mb-1">
					Finals — Rank Your Top {MAX_SELECTIONS}
				</h2>
				<p className="text-xs sm:text-sm text-muted-foreground">
					Rank your top {MAX_SELECTIONS}{" "}
					{judgeMode === "same_gender"
						? judge.gender
						: judge.gender === "male"
							? "female"
							: "male"}{" "}
					dancers to determine the final placements.
				</p>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
				{eligibleFinalists.map((competitor) => (
					<motion.div key={competitor.id} whileTap={{ scale: 0.98 }}>
						<CompetitorCard
							competitor={competitor}
							rank={rankings.get(competitor.id) || null}
							onSelect={() => handleSelect(competitor.id)}
							disabled={
								rankings.size >= MAX_SELECTIONS &&
								!rankings.has(competitor.id)
							}
						/>
					</motion.div>
				))}
			</div>

			<div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-background/95 backdrop-blur-sm border-t border-border z-50">
				<div className="flex items-center justify-between mb-2 sm:mb-3">
					<span className="text-xs sm:text-sm text-muted-foreground">
						{rankings.size}/{MAX_SELECTIONS} selected
					</span>
					<div className="flex gap-0.5 sm:gap-1">
						{Array.from(
							{ length: MAX_SELECTIONS },
							(_, i) => i + 1,
						).map((rank) => {
							const rankIndicatorColors: Record<number, string> =
								{
									1: "bg-amber-500 text-white",
									2: "bg-rose-500 text-white",
									3: "bg-emerald-500 text-white",
									4: "bg-sky-500 text-white",
									5: "bg-violet-500 text-white",
									6: "bg-pink-500 text-white",
								};
							return (
								<div
									key={rank}
									className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold ${
										rankings.size >= rank
											? rankIndicatorColors[rank] ||
												"bg-primary text-primary-foreground"
											: "bg-muted text-muted-foreground"
									}`}
								>
									{rank}
								</div>
							);
						})}
					</div>
				</div>
				<Button
					onClick={handleSubmit}
					disabled={rankings.size !== MAX_SELECTIONS || !currentHeat}
					className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold"
				>
					<Trophy className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
					Submit Finals Vote
				</Button>
			</div>
		</div>
	);
}
