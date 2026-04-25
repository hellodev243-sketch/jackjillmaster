"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Event, RoundType } from "@/lib/types";
import {
	Play,
	Pause,
	SkipForward,
	CheckCircle2,
	Users,
	RotateCw,
} from "lucide-react";
import {
	getRoundName,
	getRotationsForRound,
	isFinalRound,
	getCurrentRoundConfig,
	getSortedRounds,
	getCompetitionConfig,
	getFinalsJudgeMode,
} from "@/lib/competition-config";

interface RoundControlProps {
	event: Event;
	onOpenVoting: () => void;
	onCloseVoting: () => void;
	onNextHeat: () => void;
	onNextRotation: () => void;
	onGeneratePairings: () => void;
	onPublishResults: () => void;
	onAdvanceRound: () => void;
	onNavigateDisplay?: (slide: string) => void;
}

export function RoundControl({
	event,
	onOpenVoting,
	onCloseVoting,
	onNextHeat,
	onNextRotation,
	onGeneratePairings,
	onPublishResults,
	onAdvanceRound,
	onNavigateDisplay,
}: RoundControlProps) {
	const currentHeat = event.heats.find(
		(h) => h.number === event.currentHeat && h.round === event.currentRound,
	);
	const roundHeats = event.heats.filter(
		(h) => h.round === event.currentRound,
	);
	const currentRoundConfig = getCurrentRoundConfig(event);
	const roundNameStr = getRoundName(event, event.currentRound);

	// Determine if final round
	const isFinalsRound = isFinalRound(
		currentRoundConfig,
		getCompetitionConfig(event),
	);
	const finalistGender = currentHeat?.finalistGender;
	const judgeMode = getFinalsJudgeMode(event, event.currentRound);
	const totalJudges =
		isFinalsRound && finalistGender
			? event.judges.filter((j) =>
					judgeMode === "same_gender"
						? j.gender === finalistGender
						: j.gender !== finalistGender,
				).length
			: event.judges.length;
	const submittedJudges = currentHeat?.judgesSubmitted.length || 0;

	// Rotation info
	const currentRotation = event.currentRotation || 1;
	const totalRotations =
		currentHeat?.totalRotations ||
		getRotationsForRound(event, event.currentRound);
	const isLastRotation = currentRotation >= totalRotations;
	const isLastHeat = event.currentHeat >= roundHeats.length;

	// Check if all heats have completed voting
	const allHeatsHaveVoted =
		roundHeats.length > 0 &&
		roundHeats.every((h) => h.votingStatus === "submitted");

	// All heats and rotations complete - show advance button when:
	// All heats have votingStatus === "submitted" and voting is not currently open
	const allHeatsComplete =
		roundHeats.length > 0 && !event.votingOpen && allHeatsHaveVoted;

	// Check if there are no heats for the current round
	const noHeatsForCurrentRound = roundHeats.length === 0;

	// Check if this is a finals heat with competitor+judge pairings
	const isFinalsHeat =
		currentHeat?.round === "finals" &&
		currentHeat?.finalsCouples &&
		currentHeat.finalsCouples.length > 0;
	const coupleCount = isFinalsHeat
		? currentHeat.finalsCouples!.length
		: currentHeat?.couples.length || 0;

	// Next round config for Advance button
	const config = getCompetitionConfig(event);
	const sortedRounds = getSortedRounds(config);
	const currentIndex = sortedRounds.findIndex(
		(r) => r.id === currentRoundConfig.id,
	);
	const nextRoundConfig = sortedRounds[currentIndex + 1];

	return (
		<Card className="border-border bg-card">
			<CardHeader>
				<CardTitle className="flex items-center justify-between text-foreground">
					<span>Round Control</span>
					<Badge
						variant="outline"
						className="text-lg px-3 py-1 bg-transparent"
					>
						{roundNameStr}
					</Badge>
				</CardTitle>
				<CardDescription>
					Manage the competition flow and voting
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Heat Status */}
				{noHeatsForCurrentRound ? (
					<div className="text-center py-8">
						<Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
						<p className="text-muted-foreground mb-4">
							No heats generated for {roundNameStr}
						</p>
						<Button onClick={onGeneratePairings}>
							<Users className="w-4 h-4 mr-2" />
							Create Pairings
						</Button>
					</div>
				) : (
					<>
						{/* Current Heat & Rotation Info */}
						<div className="p-4 bg-muted rounded-lg">
							<div className="flex items-center justify-between mb-3">
								<div>
									<h3 className="font-semibold text-foreground">
										Heat {event.currentHeat} of{" "}
										{roundHeats.length}
									</h3>
									<p className="text-sm text-amber-500 font-medium">
										Rotation {currentRotation}/
										{totalRotations}
									</p>
								</div>
								<Badge
									variant={
										event.votingOpen
											? "default"
											: "secondary"
									}
									className={
										event.votingOpen
											? "bg-emerald-500 text-white"
											: ""
									}
								>
									{event.votingOpen
										? "Voting Open"
										: "Voting Closed"}
								</Badge>
							</div>

							{currentHeat && (
								<div className="space-y-2 text-sm">
									<div className="flex items-center gap-2">
										<span className="text-muted-foreground">
											Judges submitted:
										</span>
										<span className="font-semibold text-foreground">
											{submittedJudges} / {totalJudges}
										</span>
										{submittedJudges === totalJudges && (
											<CheckCircle2 className="w-4 h-4 text-emerald-500" />
										)}
									</div>
									{isFinalsRound && finalistGender && (
										<p className="text-xs text-muted-foreground">
											{judgeMode === "same_gender"
												? `${finalistGender} judges voting for ${finalistGender} finalists`
												: `${finalistGender === "male" ? "female" : "male"} judges voting for ${finalistGender} finalists`}
										</p>
									)}
								</div>
							)}
						</div>

						{/* Rotation Progress */}
						<div className="space-y-2">
							<p className="text-sm font-medium text-foreground">
								Rotation Progress (Heat {event.currentHeat})
							</p>
							<div className="flex gap-2">
								{Array.from(
									{ length: totalRotations },
									(_, i) => i + 1,
								).map((rotation) => (
									<div
										key={rotation}
										className={`flex-1 p-2 rounded text-center text-sm ${
											rotation === currentRotation
												? "bg-amber-500 text-white"
												: rotation < currentRotation
													? "bg-emerald-500/20 text-emerald-400"
													: "bg-muted text-muted-foreground"
										}`}
									>
										{rotation}/{totalRotations}
									</div>
								))}
							</div>
						</div>

						{/* Voting Controls */}
						<div className="flex gap-3">
							{event.votingOpen ? (
								<Button
									onClick={onCloseVoting}
									variant="destructive"
									className="flex-1"
								>
									<Pause className="w-4 h-4 mr-2" />
									Close Voting ({submittedJudges}/
									{totalJudges})
								</Button>
							) : (
								<Button
									onClick={onOpenVoting}
									className="flex-1"
									disabled={!currentHeat}
								>
									<Play className="w-4 h-4 mr-2" />
									Open Voting
								</Button>
							)}
						</div>

						{/* Navigation Controls */}
						<div className="flex gap-3">
							<Button
								onClick={onNextRotation}
								variant="outline"
								disabled={
									totalRotations <= 1 ||
									(isLastRotation && isLastHeat)
								}
								className="flex-1 bg-transparent"
							>
								<RotateCw className="w-4 h-4 mr-2" />
								Next Rotation
							</Button>

							<Button
								onClick={onNextHeat}
								variant="outline"
								disabled={
									roundHeats.length <= 1 ||
									!isLastRotation ||
									isLastHeat
								}
								className="flex-1 bg-transparent"
							>
								<SkipForward className="w-4 h-4 mr-2" />
								Next Heat
							</Button>
						</div>

						{/* Heat Progress */}
						<div className="space-y-2">
							<p className="text-sm font-medium text-foreground">
								Heat Progress
							</p>
							<div className="grid grid-cols-5 gap-2">
								{roundHeats.map((heat) => (
									<div
										key={heat.id}
										className={`p-2 rounded text-center text-sm ${
											heat.number === event.currentHeat
												? "bg-primary text-primary-foreground"
												: heat.votingStatus ===
													  "submitted"
													? "bg-emerald-500/20 text-emerald-400"
													: "bg-muted text-muted-foreground"
										}`}
									>
										{heat.number}
									</div>
								))}
							</div>
						</div>

						{/* Round Actions */}
						{allHeatsComplete && (
							<div className="pt-4 border-t border-border space-y-3">
								<Button
									onClick={() => {
										onPublishResults();
										// Navigate display to results slide for current round (male first)
										const resultsSlide = `results-${event.currentRound}-male`;
										onNavigateDisplay?.(resultsSlide);
										// Open display page in new tab
										window.open(
											`/display?event=${event.id}`,
											"_blank",
										);
									}}
									variant="outline"
									className="w-full bg-transparent"
								>
									Publish {roundNameStr} Results
								</Button>
								{!isFinalsRound && nextRoundConfig && (
									<Button
										onClick={onAdvanceRound}
										className="w-full"
									>
										Advance to {nextRoundConfig.name}
									</Button>
								)}
							</div>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}
