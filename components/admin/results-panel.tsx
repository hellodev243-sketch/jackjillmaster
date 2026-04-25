"use client";

import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type {
	Competitor,
	Vote,
	RoundType,
	Gender,
	Event,
	Judge,
} from "@/lib/types";
import { Trophy, Download, FileText, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import { exportResultsExcel, exportVoteLogExcel } from "@/lib/export-excel";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { TieUpPanel } from "./tieup-panel";
import {
	getRoundName,
	getCompetitorsAdvancing,
	isFinalRound,
	getCurrentRoundConfig,
	getRoundConfigForType,
	getScoringMode,
	calculateRankings,
} from "@/lib/competition-config";

interface ResultsPanelProps {
	competitors: Competitor[];
	votes: Vote[];
	currentRound: RoundType;
	event: Event;
	onSetTieUp: (
		round: RoundType,
		gender: Gender,
		competitorIds: string[],
	) => Promise<boolean>;
}

export function ResultsPanel({
	competitors,
	votes,
	currentRound,
	event,
	onSetTieUp,
}: ResultsPanelProps) {
	const [showTieUpPanel, setShowTieUpPanel] = useState(false);
	const [tieUpGender, setTieUpGender] = useState<Gender>("male");
	const [selectedRound, setSelectedRound] = useState<RoundType>(currentRound);
	const [sortBy, setSortBy] = useState<"votes" | "number">("votes");

	// Get available rounds (rounds that have votes or are current round)
	const competitionConfig = event.competitionConfig || {
		rounds: [],
		updatedAt: new Date().toISOString(),
	};
	// Order based on config, then append any extras
	const allConfigRoundIds = competitionConfig.rounds.map((r) => r.id);
	const allVotesRounds = Array.from(new Set(votes.map((v) => v.round)));

	const availableRounds: RoundType[] = Array.from(
		new Set([
			...allConfigRoundIds.filter(
				(id) => allVotesRounds.includes(id) || id === currentRound,
			),
			...allVotesRounds,
			currentRound,
		]),
	);

	// Filter votes by selected round
	const roundVotes = votes.filter((v) => v.round === selectedRound);

	// For historical rounds, include eliminated competitors
	const includeEliminated = selectedRound !== currentRound;
	const selectedRoundConfig = getRoundConfigForType(event, selectedRound);
	const useWeightedScoring = isFinalRound(
		selectedRoundConfig,
		competitionConfig,
	);
	const cutoff = getCompetitorsAdvancing(event, selectedRound);
	const scoringMode = getScoringMode(event, selectedRound);
	const isScoringMode = scoringMode === "scoring";
	const isRankingMode = scoringMode === "ranking";
	const scoreLabel = isRankingMode
		? "Total Rank"
		: scoringMode === "scoring"
			? "Points"
			: "Votes";

	const maleRankings = calculateRankings(
		event,
		competitors,
		roundVotes,
		"male",
		selectedRound,
		includeEliminated,
	);
	const femaleRankings = calculateRankings(
		event,
		competitors,
		roundVotes,
		"female",
		selectedRound,
		includeEliminated,
	);

	const tieUpDataForRound = (event.tieUpData?.[selectedRound] || {}) as {
		male?: string[];
		female?: string[];
	};
	const tieUpMale = tieUpDataForRound.male?.length
		? tieUpDataForRound.male
		: selectedRound === "round1"
			? event.tieUpRound1Male
			: selectedRound === "round2"
				? event.tieUpRound2Male
				: event.tieUpFinalsMale;
	const tieUpFemale = tieUpDataForRound.female?.length
		? tieUpDataForRound.female
		: selectedRound === "round1"
			? event.tieUpRound1Female
			: selectedRound === "round2"
				? event.tieUpRound2Female
				: event.tieUpFinalsFemale;

	// Can edit tie-up for current round (including finals for winner selection)
	const canEditTieUp = selectedRound === currentRound;

	const handleOpenTieUp = (gender: Gender) => {
		setTieUpGender(gender);
		setShowTieUpPanel(true);
	};

	const handleSaveTieUp = async (competitorIds: string[]) => {
		const success = await onSetTieUp(
			selectedRound,
			tieUpGender,
			competitorIds,
		);
		if (success) {
			toast.success(
				`Tie-Up selection saved for ${
					tieUpGender === "male" ? "Male" : "Female"
				} competitors`,
			);
			setShowTieUpPanel(false);
			return true;
		} else {
			toast.error("Failed to save tie-up selection");
			return false;
		}
	};

	const handleExportExcel = async () => {
		if (!event) {
			toast.error("Event data not available for export");
			return;
		}

		toast.loading("Preparing results report...");
		try {
			await exportResultsExcel(event, votes);
			toast.dismiss();
			toast.success("Results exported successfully");
		} catch (error) {
			console.error("Excel export failed:", error);
			toast.dismiss();
			toast.error("Failed to generate Excel report");
		}
	};

	const handleExportVoteLog = async () => {
		if (!event) {
			toast.error("Event data not available for export");
			return;
		}

		toast.loading("Preparing vote log...");
		try {
			await exportVoteLogExcel(event, votes);
			toast.dismiss();
			toast.success("Vote log exported successfully");
		} catch (error) {
			console.error("Vote log export failed:", error);
			toast.dismiss();
			toast.error("Failed to export vote log");
		}
	};

	const renderRankingList = (
		rankings: Competitor[],
		gender: "male" | "female",
	) => {
		// Check if tie-up is active for this gender
		const tieUpIds = gender === "male" ? tieUpMale : tieUpFemale;
		const hasTieUp = tieUpIds && tieUpIds.length > 0;

		// For Finals, get judges who voted (opposite gender)
		// Male finalists are judged by female judges, female finalists by male judges
		const oppositeGender = gender === "male" ? "female" : "male";
		const finalsJudges = useWeightedScoring
			? event.judges.filter((j) => j.gender === oppositeGender)
			: [];

		// Find ALL competitors involved in the tie-up (same vote count as any tie-up selected competitor)
		const tiedCompetitorIds = new Set<string>();
		if (hasTieUp) {
			// Get the vote counts of all tie-up selected competitors
			const tieUpVoteCounts = new Set(
				tieUpIds!
					.map(
						(id: string) =>
							rankings.find((c) => c.id === id)?.voteCount,
					)
					.filter((v: number | undefined) => v !== undefined),
			);
			// Find ALL competitors with those vote counts - they are all tied
			rankings.forEach((c) => {
				if (tieUpVoteCounts.has(c.voteCount)) {
					tiedCompetitorIds.add(c.id);
				}
			});
		}

		// If tie-up is active, reorder rankings based on tie-up order
		let displayRankings = rankings;
		if (hasTieUp) {
			// Create a map for quick lookup
			const rankingsMap = new Map(rankings.map((c) => [c.id, c]));
			// Reorder based on tie-up IDs, then append any not in tie-up list
			const tieUpCompetitors = tieUpIds!
				.map((id: string) => rankingsMap.get(id))
				.filter(Boolean) as Competitor[];
			const nonTieUpCompetitors = rankings.filter(
				(c) => !tieUpIds!.includes(c.id),
			);
			displayRankings = [...tieUpCompetitors, ...nonTieUpCompetitors];
		}

		// Sort based on sortBy state (default is votes, already sorted)
		// Rankings are already sorted by vote count from calculateRankings
		// No additional sorting needed for "votes" mode

		// For finals, highlight ALL finalists (they all made it to the final round)
		// For other rounds, use the cutoff from competition config
		const displayCutoff = useWeightedScoring
			? displayRankings.length
			: cutoff;

		// For finals, reverse the display order (6th to 1st)
		const finalDisplayRankings = useWeightedScoring
			? [...displayRankings].reverse()
			: displayRankings;

		// Get judges who voted for each competitor (for finals)
		const getJudgesForCompetitor = (competitorId: string) => {
			if (!useWeightedScoring) return [];

			const judgeIds = roundVotes
				.filter((vote) =>
					vote.rankings.some((r) => r.competitorId === competitorId),
				)
				.map((vote) => vote.judgeId);

			return event.judges.filter((j) => judgeIds.includes(j.id));
		};

		// Get individual judge scores for a competitor (for finals)
		const getJudgeScores = (competitorId: string) => {
			if (!useWeightedScoring) return [];

			const judgeScores: {
				judge: Judge;
				rank: number;
				points: number;
			}[] = [];

			roundVotes.forEach((vote) => {
				const ranking = vote.rankings.find(
					(r) => r.competitorId === competitorId,
				);
				if (ranking) {
					const judge = event.judges.find(
						(j) => j.id === vote.judgeId,
					);
					if (judge) {
						const points = ranking.rank; // rank 1 = 1 pt, rank 2 = 2 pts, etc. (LOWER is better)
						judgeScores.push({
							judge,
							rank: ranking.rank,
							points,
						});
					}
				}
			});

			return judgeScores;
		};

		// Get vote count (how many times selected) for each competitor in finals
		const getVoteCount = (competitorId: string) => {
			if (!useWeightedScoring) return 0;

			return roundVotes.filter((vote) =>
				vote.rankings.some((r) => r.competitorId === competitorId),
			).length;
		};

		return (
			<div className="space-y-3">
				{finalDisplayRankings.map((competitor, idx) => {
					// For finals, calculate the actual rank (since we reversed the array)
					const rank = useWeightedScoring
						? displayRankings.length - idx
						: idx + 1;
					const advances = rank <= displayCutoff;
					const isTiedCompetitor = tiedCompetitorIds.has(
						competitor.id,
					);

					// Badge text for finals: "1st place", "2nd place", etc.
					const getPlaceBadgeText = (rank: number) => {
						const suffixes = ["th", "st", "nd", "rd"];
						const v = rank % 100;
						return (
							rank +
							(suffixes[(v - 20) % 10] ||
								suffixes[v] ||
								suffixes[0]) +
							" place"
						);
					};

					// Badge text: "Tied Up" if tied, otherwise "Advances"
					const statusBadgeText = isTiedCompetitor
						? "Tied Up"
						: "Advances";

					// Get judges who voted for this competitor (finals only)
					const votingJudges = getJudgesForCompetitor(competitor.id);
					const voteCount = getVoteCount(competitor.id);
					const judgeScores = getJudgeScores(competitor.id);

					// Place badge styling for finals (dynamic colors for any number of finalists)
					const placeBadgeColorsList = [
						"bg-yellow-500 text-black border-yellow-600",
						"bg-gray-300 text-black border-gray-400",
						"bg-amber-600 text-white border-amber-700",
						"bg-blue-500 text-white border-blue-600",
						"bg-green-500 text-white border-green-600",
						"bg-purple-500 text-white border-purple-600",
						"bg-rose-500 text-white border-rose-600",
						"bg-teal-500 text-white border-teal-600",
						"bg-indigo-500 text-white border-indigo-600",
						"bg-orange-500 text-white border-orange-600",
						"bg-cyan-500 text-white border-cyan-600",
						"bg-pink-500 text-white border-pink-600",
					];
					const placeBadgeColor =
						rank <= placeBadgeColorsList.length
							? placeBadgeColorsList[rank - 1]
							: "bg-gray-500 text-white border-gray-600";

					// Place text badge colors
					const placeTextColorsList = [
						"bg-yellow-500 text-black hover:bg-yellow-600",
						"bg-gray-300 text-black hover:bg-gray-400",
						"bg-amber-600 text-white hover:bg-amber-700",
						"bg-blue-500 text-white hover:bg-blue-600",
						"bg-green-500 text-white hover:bg-green-600",
						"bg-purple-500 text-white hover:bg-purple-600",
						"bg-rose-500 text-white hover:bg-rose-600",
						"bg-teal-500 text-white hover:bg-teal-600",
						"bg-indigo-500 text-white hover:bg-indigo-600",
						"bg-orange-500 text-white hover:bg-orange-600",
						"bg-cyan-500 text-white hover:bg-cyan-600",
						"bg-pink-500 text-white hover:bg-pink-600",
					];
					const placeTextColor =
						rank <= placeTextColorsList.length
							? placeTextColorsList[rank - 1]
							: "bg-gray-500 text-white hover:bg-gray-600";

					return (
						<div
							key={competitor.id}
							className={`flex flex-col gap-2 p-4 rounded-lg border ${
								advances
									? "bg-amber-500/20 border-amber-500/50"
									: "bg-muted border-border opacity-60"
							}`}
						>
							<div className="flex items-center gap-3">
								{/* Place Badge */}
								{useWeightedScoring ? (
									<div
										className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 ${placeBadgeColor}`}
									>
										{rank}
									</div>
								) : (
									<span
										className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
											advances
												? "bg-amber-500 text-black"
												: "bg-muted-foreground/20 text-muted-foreground"
										}`}
									>
										{rank}
									</span>
								)}

								<PlaceholderAvatar
									src={competitor.photoUrl}
									alt=""
									name={competitor.name}
									className="w-10 h-10 rounded-full"
								/>

								<div className="flex-1 min-w-0">
									<p className="font-semibold text-foreground">
										#{competitor.number}
									</p>
									<p className="text-sm text-muted-foreground truncate">
										{competitor.name}
									</p>
								</div>

								<div className="text-right flex items-center gap-2">
									<div className="flex flex-col items-end">
										{useWeightedScoring ? (
											<>
												<p className="font-bold text-foreground">
													{competitor.voteCount}{" "}
													{scoreLabel.toLowerCase()}
												</p>
												<p className="text-xs text-muted-foreground">
													{voteCount} votes •{" "}
													{votingJudges.length} judges
												</p>
											</>
										) : (
											<p className="font-bold text-foreground">
												{competitor.voteCount}{" "}
												{scoreLabel.toLowerCase()}
											</p>
										)}
									</div>
									{advances && (
										<div className="flex flex-col gap-1">
											{/* Place badge for finals */}
											{useWeightedScoring && (
												<Badge
													variant="secondary"
													className={`text-xs ${placeTextColor}`}
												>
													{getPlaceBadgeText(rank)}
												</Badge>
											)}
											{/* Status badge (Advances/Tied Up) */}
											<Badge
												variant="default"
												className="bg-amber-500 text-black text-xs hover:bg-amber-600"
											>
												{statusBadgeText}
											</Badge>
										</div>
									)}
								</div>
							</div>

							{/* Show judges who voted with individual scores (finals only) */}
							{useWeightedScoring && judgeScores.length > 0 && (
								<div className="ml-14 pt-2 border-t border-border/50">
									<span className="text-xs text-muted-foreground mb-2 block">
										Judge Scores:
									</span>
									<div className="flex flex-wrap gap-2">
										{judgeScores.map((js) => (
											<Badge
												key={js.judge.id}
												variant="outline"
												className="text-xs flex items-center gap-1"
											>
												<span>{js.judge.name}</span>
												<span className="text-muted-foreground">
													•
												</span>
												<span className="font-bold text-amber-500">
													Rank {js.rank}
												</span>
											</Badge>
										))}
									</div>
								</div>
							)}
						</div>
					);
				})}
			</div>
		);
	};

	return (
		<>
			<Card className="border-border bg-card">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2 text-foreground">
								<Trophy className="w-5 h-5 text-amber-500" />
								Rankings
							</CardTitle>
							<CardDescription>
								{selectedRound === currentRound ? (
									<>
										{useWeightedScoring ? (
											<>
												Finals: Top{" "}
												{maleRankings.length} male ·{" "}
												{femaleRankings.length} female
											</>
										) : (
											<>
												Top {cutoff} from each gender
												advance
											</>
										)}
									</>
								) : (
									<>
										Historical results for{" "}
										{getRoundName(event, selectedRound)}
									</>
								)}
							</CardDescription>
						</div>
						<div className="flex gap-2 items-center">
							<Select
								value={selectedRound}
								onValueChange={(value) =>
									setSelectedRound(value as RoundType)
								}
							>
								<SelectTrigger className="w-[180px]">
									<SelectValue placeholder="Select round" />
								</SelectTrigger>
								<SelectContent>
									{availableRounds.map((round) => (
										<SelectItem key={round} value={round}>
											{getRoundName(event, round)}
											{round === currentRound &&
												" (Current)"}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								variant="outline"
								size="sm"
								className="bg-transparent hover:bg-amber-500 hover:text-black transition-colors"
								onClick={handleExportExcel}
								disabled={
									maleRankings.length === 0 &&
									femaleRankings.length === 0
								}
							>
								<Download className="h-4 w-4 mr-1" />
								Export report
							</Button>
							{/* <Button
								variant="outline"
								size="sm"
								className="bg-transparent"
								onClick={handleExportVoteLog}
								disabled={votes.length === 0}
							>
								<FileText className="h-4 w-4 mr-1" />
								Vote Log
							</Button> */}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue="males">
						<TabsList className="mb-4">
							<TabsTrigger value="males">
								Male Rankings ({maleRankings.length})
							</TabsTrigger>
							<TabsTrigger value="females">
								Female Rankings ({femaleRankings.length})
							</TabsTrigger>
						</TabsList>
						<TabsContent value="males">
							{maleRankings.length > 0 ? (
								<>
									{canEditTieUp && (
										<div className="mb-4">
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													handleOpenTieUp("male")
												}
												className="w-full"
											>
												<ListOrdered className="h-4 w-4 mr-2" />
												{tieUpMale &&
												tieUpMale.length > 0
													? "Edit Tie-Up Selection"
													: "Set Tie-Up Selection"}
											</Button>
										</div>
									)}
									{renderRankingList(maleRankings, "male")}
								</>
							) : (
								<p className="text-center text-muted-foreground py-8">
									No votes recorded yet
								</p>
							)}
						</TabsContent>
						<TabsContent value="females">
							{femaleRankings.length > 0 ? (
								<>
									{canEditTieUp && (
										<div className="mb-4">
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													handleOpenTieUp("female")
												}
												className="w-full"
											>
												<ListOrdered className="h-4 w-4 mr-2" />
												{tieUpFemale &&
												tieUpFemale.length > 0
													? "Edit Tie-Up Selection"
													: "Set Tie-Up Selection"}
											</Button>
										</div>
									)}
									{renderRankingList(
										femaleRankings,
										"female",
									)}
								</>
							) : (
								<p className="text-center text-muted-foreground py-8">
									No votes recorded yet
								</p>
							)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{showTieUpPanel && canEditTieUp && (
				<TieUpPanel
					competitors={
						tieUpGender === "male" ? maleRankings : femaleRankings
					}
					gender={tieUpGender}
					round={selectedRound}
					votes={roundVotes}
					maxAdvancing={cutoff}
					scoreLabel={scoreLabel}
					onSave={handleSaveTieUp}
					onCancel={() => setShowTieUpPanel(false)}
				/>
			)}
		</>
	);
}
