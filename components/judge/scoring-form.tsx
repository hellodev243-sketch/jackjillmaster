"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CompetitorCard } from "./competitor-card";
import type {
	Competitor,
	Heat,
	Judge,
	Vote,
	CompAssistant,
	Event,
	RoundType,
} from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import {
	getScoringMode,
	getRoundConfigForType,
	getSelectionsForJudge,
	getFinalsJudgeMode,
	isFinalRound,
	getCurrentRoundConfig,
	getCompetitionConfig,
} from "@/lib/competition-config";
import { Slider } from "@/components/ui/slider";

interface ScoringFormProps {
	judge: Judge;
	heat: Heat;
	competitors: Competitor[];
	compAssistants?: CompAssistant[];
	onSubmit: (vote: Vote) => void;
	existingVote: Vote | null;
	votingOpen: boolean;
	event: Event;
}

export function ScoringForm({
	judge,
	heat,
	competitors,
	compAssistants = [],
	onSubmit,
	existingVote,
	votingOpen,
	event,
}: ScoringFormProps) {
	const scoringMode = getScoringMode(event, heat.round);
	const roundConfig = getRoundConfigForType(event, heat.round);
	const categories = roundConfig.scoringCategories || [];
	// For selection mode
	const targetSelections = getSelectionsForJudge(
		event,
		heat.round,
		heat.number,
	);

	const [rankings, setRankings] = useState<Map<string, number>>(new Map());
	const [scores, setScores] = useState<
		Record<string, Record<string, number>>
	>({});
	const [submitted, setSubmitted] = useState(!!existingVote);

	const judgeMode = getFinalsJudgeMode(event, heat.round);
	const isFinal = isFinalRound(
		getCurrentRoundConfig(event),
		getCompetitionConfig(event),
	);

	const eligibleCompetitors = competitors.filter((c) => {
		const isAssistant = c.isCompAssistant;
		if (isAssistant) return false;

		// If same gender mode, judge votes for same gender
		if (judgeMode === "same_gender") return c.gender === judge.gender;
		// If cross gender mode, judge votes for opposite gender
		return c.gender !== judge.gender;
	});

	const heatAssistants = competitors.filter((c) => {
		const isAssistant = c.isCompAssistant;
		if (!isAssistant) return false;

		if (judgeMode === "same_gender") return c.gender === judge.gender;
		return c.gender !== judge.gender;
	});
	const allParticipants = [...eligibleCompetitors, ...heatAssistants].sort(
		(a, b) => a.number - b.number,
	);

	const MAX_SELECTIONS = Math.min(targetSelections, allParticipants.length);

	useEffect(() => {
		if (!existingVote) {
			setRankings(new Map());

			// Initialize scores
			if (scoringMode === "scoring") {
				const initial: Record<string, Record<string, number>> = {};
				eligibleCompetitors.forEach((comp) => {
					initial[comp.id] = {};
					categories.forEach((cat) => {
						initial[comp.id][cat.id] = 0;
					});
				});
				setScores(initial);
			} else {
				setScores({});
			}
			setSubmitted(false);
		} else {
			const newRankings = new Map<string, number>();
			const newScores: Record<string, Record<string, number>> = {};
			existingVote.rankings.forEach((r) => {
				newRankings.set(r.competitorId, r.rank);
				if (r.scores) {
					newScores[r.competitorId] = { ...r.scores };
				}
			});
			setRankings(newRankings);
			setScores(newScores);
			setSubmitted(true);
		}
	}, [heat.id, existingVote, scoringMode, eligibleCompetitors.length]);

	const handleSelect = (competitorId: string) => {
		if (!votingOpen || submitted || scoringMode === "scoring") return;

		const currentRank = rankings.get(competitorId);
		const newRankings = new Map(rankings);

		if (currentRank) {
			newRankings.delete(competitorId);
			const entries = Array.from(newRankings.entries())
				.filter(([, rank]) => rank > currentRank)
				.map(([id, rank]) => [id, rank - 1] as [string, number]);

			entries.forEach(([id, rank]) => newRankings.set(id, rank));
		} else {
			const currentSelections = rankings.size;
			if (currentSelections < MAX_SELECTIONS) {
				newRankings.set(competitorId, currentSelections + 1);
			}
		}

		setRankings(newRankings);
	};

	const handleScoreChange = (
		competitorId: string,
		categoryId: string,
		value: number,
	) => {
		if (!votingOpen || submitted) return;
		setScores((prev) => ({
			...prev,
			[competitorId]: {
				...(prev[competitorId] || {}),
				[categoryId]: value,
			},
		}));
	};

	const handleSubmit = () => {
		if (scoringMode !== "scoring" && rankings.size !== MAX_SELECTIONS)
			return;

		const vote: Vote = {
			judgeId: judge.id,
			heatId: heat.id,
			round: heat.round,
			rankings:
				scoringMode === "scoring"
					? eligibleCompetitors.map((c, idx) => ({
							competitorId: c.id,
							rank: 1, // Base rank since scoring handles the real order
							scores: scores[c.id] || {},
						}))
					: Array.from(rankings.entries()).map(
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
	const isJudgesTurn = heat.finalistGender
		? judgeMode === "same_gender"
			? heat.finalistGender === judge.gender
			: heat.finalistGender !== judge.gender
		: true;

	if (!isJudgesTurn && heat.finalistGender) {
		const votingGender =
			judgeMode === "same_gender"
				? heat.finalistGender
				: heat.finalistGender === "male"
					? "female"
					: "male";
		return (
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center"
			>
				<AlertCircle className="w-20 h-20 text-muted-foreground mb-4" />
				<h2 className="text-xl font-semibold text-foreground mb-2">
					Not Your Turn Yet
				</h2>
				<p className="text-muted-foreground">
					Currently {heat.finalistGender} competitors are being judged
					by {votingGender} judges.
					<br />
					You will vote when{" "}
					{judge.gender === "male"
						? judgeMode === "same_gender"
							? "male"
							: "female"
						: judgeMode === "same_gender"
							? "female"
							: "male"}{" "}
					competitors are dancing.
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
					this heat.
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
					Vote Submitted!
				</h2>
				<p className="text-muted-foreground mb-6">
					Your votes have been recorded for Heat {heat.number}.
				</p>

				<div className="w-full max-w-md space-y-3 mb-6">
					{scoringMode === "scoring"
						? eligibleCompetitors.map((competitor) => {
								const compScores = scores[competitor.id] || {};
								const totalScore = Object.values(
									compScores,
								).reduce((a, b) => a + b, 0);
								return (
									<div
										key={competitor.id}
										className="flex justify-between items-center p-3 bg-muted rounded-lg border border-border"
									>
										<div className="flex items-center gap-3">
											<span className="font-bold text-lg">
												#{competitor.number}
											</span>
											<span>{competitor.name}</span>
										</div>
										<span className="font-semibold text-primary">
											{totalScore} pts
										</span>
									</div>
								);
							})
						: Array.from(rankings.entries())
								.sort((a, b) => a[1] - b[1])
								.map(([competitorId, rank]) => {
									const competitor = eligibleCompetitors.find(
										(c) => c.id === competitorId,
									);
									if (!competitor) return null;
									return (
										<div
											key={competitorId}
											className="flex items-center gap-3 p-3 bg-muted rounded-lg"
										>
											<span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
												{rank}
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
			<div className="mb-4 sm:mb-6">
				<h2 className="text-base sm:text-lg font-semibold text-foreground mb-1">
					{scoringMode === "scoring"
						? "Score Each Competitor"
						: scoringMode === "ranking"
							? `Rank Your Top ${MAX_SELECTIONS} ${
									judgeMode === "same_gender"
										? judge.gender === "male"
											? "Male"
											: "Female"
										: judge.gender === "male"
											? "Female"
											: "Male"
								} Dancers`
							: `Select Your Top ${MAX_SELECTIONS} ${
									judgeMode === "same_gender"
										? judge.gender === "male"
											? "Male"
											: "Female"
										: judge.gender === "male"
											? "Female"
											: "Male"
								} Dancers`}
				</h2>
				{scoringMode !== "scoring" &&
					targetSelections !== MAX_SELECTIONS && (
						<p className="text-xs text-amber-500 font-medium">
							Note: Target is {targetSelections}, but only{" "}
							{MAX_SELECTIONS} are in this heat.
						</p>
					)}
				{scoringMode !== "scoring" &&
					targetSelections === MAX_SELECTIONS && (
						<p className="text-xs text-muted-foreground">
							{isFinal
								? `Rank your top ${targetSelections} to determine the final placements.`
								: `Select ${targetSelections} who you like to see in the next round.`}
						</p>
					)}
			</div>

			{scoringMode === "scoring" ? (
				<div className="space-y-6">
					<AnimatePresence>
						{allParticipants.map((participant) => {
							if (participant.isCompAssistant) return null;
							const participantScores =
								scores[participant.id] || {};
							const sum = Object.values(participantScores).reduce(
								(a, b) => a + b,
								0,
							);

							return (
								<motion.div
									key={participant.id}
									layout
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									className="p-4 rounded-xl border-2 border-border bg-card"
								>
									<div className="flex items-center gap-4 mb-6">
										<div className="w-16 h-16 rounded-full overflow-hidden bg-muted border border-border">
											<PlaceholderAvatar
												src={participant.photoUrl}
												alt={participant.name}
												name={participant.name}
											/>
										</div>
										<div className="flex-1">
											<p className="text-2xl font-bold">
												#{participant.number}
											</p>
											<p className="text-muted-foreground">
												{participant.name}
											</p>
										</div>
										<div className="text-right">
											<p className="text-xs text-muted-foreground uppercase font-semibold">
												Total Score
											</p>
											<p className="text-2xl font-bold text-primary">
												{sum}
											</p>
										</div>
									</div>

									<div className="space-y-6 pl-2">
										{categories.map((category) => (
											<div
												key={category.id}
												className="space-y-3"
											>
												<div className="flex justify-between items-center text-sm font-medium">
													<span>{category.name}</span>
													<span className="text-muted-foreground">
														{participantScores[
															category.id
														] ?? 0}{" "}
														/ 100
													</span>
												</div>
												<Slider
													value={[
														participantScores[
															category.id
														] ?? 0,
													]}
													min={0}
													max={100}
													step={1}
													onValueChange={(vals) =>
														handleScoreChange(
															participant.id,
															category.id,
															vals[0],
														)
													}
													className="[&>[role=slider]]:h-5 [&>[role=slider]]:w-5"
												/>
											</div>
										))}
									</div>
								</motion.div>
							);
						})}
					</AnimatePresence>
				</div>
			) : (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
					<AnimatePresence>
						{allParticipants.map((participant) => (
							<motion.div
								key={participant.id}
								layout
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.9 }}
							>
								<CompetitorCard
									competitor={participant}
									rank={rankings.get(participant.id) || null}
									onSelect={() =>
										handleSelect(participant.id)
									}
									disabled={
										participant.isCompAssistant ||
										(rankings.size >= MAX_SELECTIONS &&
											!rankings.has(participant.id))
									}
									isAssistant={participant.isCompAssistant}
								/>
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			)}

			<div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-background/95 backdrop-blur-sm border-t border-border z-50">
				{scoringMode !== "scoring" && (
					<div className="flex items-center justify-between mb-2 sm:mb-3">
						<span className="text-xs sm:text-sm text-muted-foreground">
							{rankings.size}/{MAX_SELECTIONS} selected
						</span>
						<div className="flex gap-1 flex-wrap justify-end">
							{Array.from(
								{ length: MAX_SELECTIONS },
								(_, i) => i + 1,
							).map((rank) => (
								<div
									key={rank}
									className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold ${
										rankings.size >= rank
											? "bg-primary text-primary-foreground"
											: "bg-muted text-muted-foreground"
									}`}
								>
									{rank}
								</div>
							))}
						</div>
					</div>
				)}
				<Button
					onClick={handleSubmit}
					disabled={
						scoringMode !== "scoring" &&
						rankings.size !== MAX_SELECTIONS
					}
					className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold"
				>
					Submit Vote
				</Button>
			</div>
		</div>
	);
}
