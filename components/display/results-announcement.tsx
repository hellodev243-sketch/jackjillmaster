"use client";

import { useState, useMemo, useCallback } from "react";
import type { Competitor, RoundType, Event } from "@/lib/types";
import {
	getRoundName,
	getScoringMode,
	getCompetitionConfig,
	getRoundConfigForType,
	isFinalRound as checkIsFinalRound,
} from "@/lib/competition-config";
import { motion, AnimatePresence } from "framer-motion";
import {
	ChevronLeft,
	ChevronRight,
	Trophy,
	Sparkles,
	Check,
	ListOrdered,
	Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { useDisplayAction } from "@/hooks/use-display-action";

interface ResultsAnnouncementProps {
	competitors: Competitor[];
	gender: "male" | "female";
	round: RoundType;
	advancingCount: number;
	tieUpIds?: string[];
	onFinish: () => void;
	totalVotingJudges?: number;
	event: Event;
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

export function ResultsAnnouncement({
	competitors,
	gender,
	round,
	advancingCount,
	tieUpIds,
	onFinish,
	totalVotingJudges,
	event,
}: ResultsAnnouncementProps) {
	const roundNameStr = getRoundName(event, round);
	const currentRoundConfig = event.competitionConfig?.rounds?.find(
		(r) => r.id === round,
	);
	const announcementStyle =
		currentRoundConfig?.announcementStyle || "all_with_ranking";
	const scoringMode = getScoringMode(event, round);
	const isScoringMode = scoringMode === "scoring";
	const isRankingMode = scoringMode === "ranking";
	const scoreLabel = isRankingMode
		? "Total Rank"
		: isScoringMode
			? "points"
			: "votes";
	const isFinal = checkIsFinalRound(
		getRoundConfigForType(event, round),
		getCompetitionConfig(event),
	);

	const [phase, setPhase] = useState<
		"intro" | "choose-mode" | "reveal" | "finish"
	>("intro");
	const [revealMode, setRevealMode] = useState<"orderly" | "random">(
		"orderly",
	);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [randomOrder, setRandomOrder] = useState<number[]>([]);

	// Sort competitors by vote count
	// For ranking mode: already sorted ascending (lowest = best) from calculateRankings
	// For other modes: sort descending (highest first)
	const sortedCompetitors = useMemo(() => {
		const sorted = isRankingMode
			? [...competitors]
			: [...competitors].sort((a, b) => b.voteCount - a.voteCount);

		if (announcementStyle === "winners_only") {
			return isFinal
				? sorted.slice(0, 3)
				: sorted.slice(0, advancingCount);
		} else if (announcementStyle === "top_3_only") {
			return sorted.slice(0, 3);
		}

		return sorted;
	}, [competitors, announcementStyle, advancingCount, round, isFinal]);

	const totalCompetitors = sortedCompetitors.length;

	// Get the current competitor based on reveal mode
	const getCurrentCompetitor = () => {
		if (totalCompetitors === 0) return null;
		if (revealMode === "orderly") {
			// For finals, show in reverse order (6th to 1st)
			if (isFinal) {
				const reverseIndex = totalCompetitors - 1 - currentIndex;
				return sortedCompetitors[reverseIndex] || null;
			}
			// For other rounds, show in normal order (1st to last)
			return sortedCompetitors[currentIndex] || null;
		} else {
			// Random mode: use the randomOrder array to get the index
			const actualIndex = randomOrder[currentIndex];
			return sortedCompetitors[actualIndex] || null;
		}
	};

	// Get the actual rank of the current competitor (their position in sorted order)
	const getActualRank = () => {
		if (revealMode === "orderly") {
			// For finals, calculate rank based on reverse order
			if (isFinal) {
				return totalCompetitors - currentIndex;
			}
			// For other rounds, normal order
			return currentIndex + 1;
		} else {
			return randomOrder[currentIndex] + 1;
		}
	};

	const currentCompetitor = getCurrentCompetitor();
	const actualRank = getActualRank();
	// In finals, all finalists get gold styling; in other rounds, only advancing competitors
	const isAdvancing = isFinal ? true : actualRank <= advancingCount;

	const handleNext = () => {
		if (currentIndex < totalCompetitors - 1) {
			setCurrentIndex(currentIndex + 1);
		} else {
			onFinish();
		}
	};

	const handlePrev = () => {
		if (currentIndex > 0) {
			setCurrentIndex(currentIndex - 1);
		}
	};

	const handleRevealClick = () => {
		setPhase("choose-mode");
	};

	const handleModeSelect = (mode: "orderly" | "random") => {
		setRevealMode(mode);
		setCurrentIndex(0);

		if (mode === "random") {
			// Generate random order (array of indices)
			const indices = Array.from(
				{ length: totalCompetitors },
				(_, i) => i,
			);
			setRandomOrder(shuffleArray(indices));
		}

		setPhase("reveal");
	};

	// Seeded random shuffle to ensure all displays get the same "random" order
	const seededShuffle = useCallback((array: any[], seed: number) => {
		const shuffled = [...array];
		let m = shuffled.length,
			t,
			i;
		// Simple seeded PRNG (Mulberry32)
		const random = () => {
			seed |= 0;
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
		while (m) {
			i = Math.floor(random() * m--);
			t = shuffled[m];
			shuffled[m] = shuffled[i];
			shuffled[i] = t;
		}
		return shuffled;
	}, []);

	// Listen for remote actions from admin panel
	useDisplayAction(
		useCallback(
			(action: string, payload?: any) => {
				console.log(
					`[ResultsAnnouncement] Received remote action: ${action}`,
					payload,
				);

				// If payload has full state, apply it directly for perfect sync
				if (
					payload &&
					payload.phase !== undefined &&
					payload.index !== undefined
				) {
					// Handle random mode with seeded shuffle
					if (action === "random" && payload.seed) {
						setRevealMode("random");
						const indices = Array.from(
							{ length: totalCompetitors },
							(_, i) => i,
						);
						setRandomOrder(seededShuffle(indices, payload.seed));
					}
					if (action === "orderly") {
						setRevealMode("orderly");
					}
					setPhase(payload.phase);
					setCurrentIndex(payload.index);
					return;
				}

				if (action === "reveal") {
					handleRevealClick();
				} else if (action === "orderly") {
					handleModeSelect("orderly");
				} else if (action === "random") {
					const seed = payload?.seed || Date.now();
					setRevealMode("random");
					const indices = Array.from(
						{ length: totalCompetitors },
						(_, i) => i,
					);
					setRandomOrder(seededShuffle(indices, seed));
					setPhase("reveal");
					setCurrentIndex(0);
				} else if (action === "next") {
					if (phase === "intro" || phase === "choose-mode") {
						handleModeSelect("orderly");
					} else {
						handleNext();
					}
				} else if (action === "prev") {
					handlePrev();
				} else if (action === "finish") {
					onFinish();
				} else if (action === "startOver") {
					setPhase("choose-mode");
				}
			},
			[
				phase,
				handleNext,
				handlePrev,
				onFinish,
				seededShuffle,
				totalCompetitors,
				handleModeSelect,
				handleRevealClick,
			],
		),
	);

	// Intro screen
	if (phase === "intro") {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
				<motion.div
					className="text-center max-w-2xl"
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.5 }}
				>
					<motion.div
						initial={{ rotate: 0 }}
						animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
						transition={{ duration: 0.5, delay: 0.3 }}
					>
						<img
							src="/jack-and-jill-logo-transparent.png"
							alt="Jack & Jill"
							className="w-20 h-20 mx-auto mb-6 object-contain"
						/>
					</motion.div>

					<h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
						{roundNameStr} Results
					</h1>
					<p className="text-2xl md:text-3xl text-muted-foreground mb-2">
						{gender === "male" ? "Male" : "Female"} Dancers
					</p>
					<p className="text-xl text-amber-500 mb-12">
						{isFinal
							? "Final Rankings"
							: `Top ${advancingCount} will advance`}
					</p>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.5 }}
					>
						<h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
							Are you ready to see the results?
						</h2>

						<Button
							size="lg"
							onClick={handleRevealClick}
							className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xl px-12 py-6 rounded-full"
						>
							<Trophy className="w-6 h-6 mr-3" />
							Reveal Results
						</Button>
					</motion.div>
				</motion.div>
			</div>
		);
	}

	// Choose mode screen
	if (phase === "choose-mode") {
		// For finals, skip mode selection and go directly to orderly (reverse order)
		if (isFinal) {
			// Automatically start with orderly mode (reverse order for finals)
			handleModeSelect("orderly");
			return null; // Don't render anything, just transition
		}

		return (
			<div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
				<motion.div
					className="text-center max-w-2xl"
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.3 }}
				>
					<h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
						How would you like to reveal?
					</h2>
					<p className="text-xl text-muted-foreground mb-12">
						Choose the reveal order
					</p>

					<div className="flex flex-col sm:flex-row gap-6 justify-center">
						<motion.div
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.1 }}
						>
							<Button
								size="lg"
								onClick={() => handleModeSelect("orderly")}
								className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xl px-10 py-8 rounded-2xl flex flex-col items-center gap-3 h-auto min-w-[200px]"
							>
								<ListOrdered className="w-10 h-10" />
								<span>Orderly</span>
								<span className="text-sm font-normal opacity-90">
									1st → Last
								</span>
							</Button>
						</motion.div>

						<motion.div
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.2 }}
						>
							<Button
								size="lg"
								variant="outline"
								onClick={() => handleModeSelect("random")}
								className="font-bold text-xl px-10 py-8 rounded-2xl flex flex-col items-center gap-3 h-auto min-w-[200px] border-2 hover:bg-amber-500 hover:text-white hover:border-amber-500"
							>
								<Shuffle className="w-10 h-10" />
								<span>Randomly</span>
								<span className="text-sm font-normal opacity-90">
									Surprise order
								</span>
							</Button>
						</motion.div>
					</div>
				</motion.div>
			</div>
		);
	}

	// Finish screen - show button to view full results
	if (phase === "finish") {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
				<motion.div
					className="text-center max-w-2xl"
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
				>
					<motion.div
						initial={{ scale: 0 }}
						animate={{ scale: 1 }}
						transition={{ type: "spring", duration: 0.5 }}
					>
						<Check className="w-24 h-24 text-green-500 mx-auto mb-6" />
					</motion.div>

					<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
						All Results Revealed!
					</h1>
					<p className="text-xl text-muted-foreground mb-8">
						{totalCompetitors}{" "}
						{gender === "male" ? "male" : "female"} dancers
						announced
					</p>

					<div className="flex gap-4 justify-center">
						<Button
							variant="outline"
							size="lg"
							onClick={() => {
								setPhase("choose-mode");
							}}
							className="text-lg px-8 py-6"
						>
							<ChevronLeft className="w-5 h-5 mr-2" />
							Start Over
						</Button>

						<Button
							size="lg"
							onClick={onFinish}
							className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-lg px-8 py-6"
						>
							View Full Results
							<ChevronRight className="w-5 h-5 ml-2" />
						</Button>
					</div>
				</motion.div>
			</div>
		);
	}

	// Reveal phase - show one competitor at a time
	const revealNumber = currentIndex + 1; // Which reveal we're on (1, 2, 3...)

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
			{/* Progress indicator */}
			<div className="w-full text-center mb-8">
				<p className="text-muted-foreground text-sm mb-2">
					{roundNameStr} - {gender === "male" ? "Male" : "Female"}{" "}
					Results
					{revealMode === "random" && " (Random)"}
				</p>
				<div className="flex items-center justify-center gap-2">
					<span className="text-foreground font-bold">
						{revealNumber}
					</span>
					<div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
						<motion.div
							className="h-full bg-amber-500"
							initial={{ width: 0 }}
							animate={{
								width: `${
									(revealNumber / totalCompetitors) * 100
								}%`,
							}}
							transition={{ duration: 0.3 }}
						/>
					</div>
					<span className="text-muted-foreground">
						{totalCompetitors}
					</span>
				</div>
			</div>

			{/* Main competitor reveal */}
			{currentCompetitor ? (
				<AnimatePresence mode="wait">
					<motion.div
						key={currentCompetitor.id}
						className="text-center w-full"
						initial={{ opacity: 0, y: 50, scale: 0.8 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -50, scale: 0.8 }}
						transition={{ duration: 0.4 }}
					>
						{/* Rank badge */}
						<motion.div
							className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 text-3xl font-bold ${
								isAdvancing
									? "bg-amber-500 text-black"
									: "bg-muted text-muted-foreground"
							}`}
							initial={{ scale: 0, rotate: -180 }}
							animate={{ scale: 1, rotate: 0 }}
							transition={{ type: "spring", delay: 0.1 }}
						>
							{actualRank}
						</motion.div>

						{/* Photo */}
						<motion.div
							className={`w-40 h-40 md:w-56 md:h-56 rounded-full overflow-hidden mx-auto mb-6 border-4 ${
								isAdvancing
									? "border-amber-500 shadow-lg shadow-amber-500/30"
									: "border-muted-foreground/30"
							}`}
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							transition={{ type: "spring", delay: 0.2 }}
						>
							<PlaceholderAvatar
								src={currentCompetitor.photoUrl}
								alt={currentCompetitor.name}
								name={currentCompetitor.name}
								className="w-full h-full"
							/>
						</motion.div>

						{/* Number */}
						<motion.p
							className={`text-5xl md:text-7xl font-bold mb-2 ${
								isAdvancing
									? "text-foreground"
									: "text-muted-foreground"
							}`}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.3 }}
						>
							#{currentCompetitor.number}
						</motion.p>

						{/* Name */}
						<motion.p
							className="text-2xl md:text-3xl text-muted-foreground mb-4"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.35 }}
						>
							{currentCompetitor.name}
						</motion.p>

						{/* Status */}
						<motion.div
							className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-xl font-bold ${
								isAdvancing
									? "bg-amber-500/20 text-amber-500"
									: "bg-muted text-muted-foreground"
							}`}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.4 }}
						>
							{isAdvancing ? (
								<>
									<Trophy className="w-6 h-6" />
									{isFinal
										? actualRank === 1
											? "🥇 1st Place"
											: actualRank === 2
												? "🥈 2nd Place"
												: actualRank === 3
													? "🥉 3rd Place"
													: `${actualRank}th Place`
										: "Advances"}
								</>
							) : (
								<>
									{isFinal
										? `${actualRank}th Place`
										: "Eliminated"}
								</>
							)}
						</motion.div>

						{/* Vote count */}
						<motion.p
							className="text-lg text-muted-foreground mt-4"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.45 }}
						>
							{`${currentCompetitor.voteCount || 0} ${scoreLabel}`}
						</motion.p>
					</motion.div>
				</AnimatePresence>
			) : (
				<div className="text-center text-muted-foreground">
					<p className="text-xl">No competitors to display</p>
				</div>
			)}

			{/* Navigation controls - positioned higher to avoid display page controls */}
			<div className="flex items-center gap-6 bg-card/90 backdrop-blur px-6 py-4 rounded-2xl border border-border shadow-xl mt-8">
				<Button
					variant="outline"
					size="lg"
					onClick={handlePrev}
					disabled={currentIndex === 0}
					className="w-14 h-14 rounded-full bg-background"
				>
					<ChevronLeft className="w-6 h-6" />
				</Button>

				<div className="text-center min-w-[120px]">
					<p className="text-lg font-medium text-foreground">
						{revealNumber} of {totalCompetitors}
					</p>
					<p className="text-xs text-muted-foreground">
						{currentIndex < totalCompetitors - 1
							? "Next →"
							: "Finish →"}
					</p>
				</div>

				<Button
					variant={
						currentIndex === totalCompetitors - 1
							? "default"
							: "outline"
					}
					size="lg"
					onClick={handleNext}
					className={`w-14 h-14 rounded-full ${
						currentIndex === totalCompetitors - 1
							? "bg-amber-500 hover:bg-amber-600 text-black"
							: "bg-background"
					}`}
				>
					<ChevronRight className="w-6 h-6" />
				</Button>
			</div>
		</div>
	);
}
