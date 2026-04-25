"use client";

import { useState, useCallback, useEffect } from "react";
import type { Competitor, RoundType } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import {
	ArrowUp,
	X,
	ChevronLeft,
	ChevronRight,
	Trophy,
	Sparkles,
	PartyPopper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
interface ResultsAnnouncementSlideProps {
	competitors: Competitor[];
	gender: "male" | "female";
	round: RoundType;
	tieUpIds?: string[];
	onFinish: () => void;
}

const cutoffs: Record<RoundType, number> = {
	round1: 10,
	round2: 6,
	finals: 1,
};

const roundNames: Record<RoundType, string> = {
	round1: "Round 1",
	round2: "Semi-Finals",
	finals: "Finals",
};

type AnnouncementPhase = "intro" | "revealing" | "finished";

export function ResultsAnnouncementSlide({
	competitors,
	gender,
	round,
	tieUpIds,
	onFinish,
}: ResultsAnnouncementSlideProps) {
	const [phase, setPhase] = useState<AnnouncementPhase>("intro");
	const [currentRevealIndex, setCurrentRevealIndex] = useState(0);

	// Get ALL competitors of this gender, sorted by voteCount
	const pointsSortedCompetitors = competitors
		.filter((c) => c.gender === gender)
		.sort((a, b) => b.voteCount - a.voteCount);

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

	const advancingCount = cutoffs[round];
	const displayCompetitors =
		round === "round2" ? allCompetitors.slice(0, 10) : allCompetitors;

	// Reverse order for announcement (last place first, winner last)
	const announcementOrder = [...displayCompetitors].reverse();
	const totalCompetitors = announcementOrder.length;

	// Find ALL competitors involved in the tie-up
	const tiedCompetitorIds = new Set<string>();
	if (hasTieUp) {
		const tieUpVoteCounts = new Set(
			tieUpIds!
				.map(
					(id) =>
						pointsSortedCompetitors.find((c) => c.id === id)
							?.voteCount,
				)
				.filter((v) => v !== undefined),
		);
		pointsSortedCompetitors.forEach((c) => {
			if (tieUpVoteCounts.has(c.voteCount)) {
				tiedCompetitorIds.add(c.id);
			}
		});
	}

	const handleStartAnnouncement = () => {
		setPhase("revealing");
		setCurrentRevealIndex(0);
	};

	const handleNext = useCallback(() => {
		if (currentRevealIndex < totalCompetitors - 1) {
			setCurrentRevealIndex((prev) => prev + 1);
		} else {
			setPhase("finished");
		}
	}, [currentRevealIndex, totalCompetitors]);

	const handlePrev = useCallback(() => {
		if (currentRevealIndex > 0) {
			setCurrentRevealIndex((prev) => prev - 1);
		}
	}, [currentRevealIndex]);

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (phase === "intro") {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleStartAnnouncement();
				}
			} else if (phase === "revealing") {
				if (e.key === "ArrowRight" || e.key === " ") {
					e.preventDefault();
					handleNext();
				} else if (e.key === "ArrowLeft") {
					e.preventDefault();
					handlePrev();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [phase, handleNext, handlePrev]);

	const currentCompetitor = announcementOrder[currentRevealIndex];
	const currentRank = totalCompetitors - currentRevealIndex;
	const isAdvancing = currentRank <= advancingCount;
	const isTiedCompetitor =
		currentCompetitor && tiedCompetitorIds.has(currentCompetitor.id);
	const isLastReveal = currentRevealIndex === totalCompetitors - 1;

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
						animate={{ rotate: [0, 10, -10, 0] }}
						transition={{ repeat: Infinity, duration: 2 }}
					>
						<PartyPopper className="w-24 h-24 text-amber-500 mx-auto mb-8" />
					</motion.div>

					<h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
						{roundNames[round]} Results
					</h1>
					<p className="text-2xl md:text-3xl text-muted-foreground mb-8">
						{gender === "male" ? "Male" : "Female"} Dancers
					</p>

					<motion.div
						className="mb-12"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.5 }}
					>
						<p className="text-xl text-amber-500 mb-2">
							Are you ready to see who advances?
						</p>
						<p className="text-lg text-muted-foreground">
							Top {advancingCount} dancers will advance to the
							next round
						</p>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.8 }}
					>
						<Button
							size="lg"
							onClick={handleStartAnnouncement}
							className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xl px-12 py-6 rounded-full"
						>
							<Sparkles className="w-6 h-6 mr-3" />
							Let&apos;s Go!
						</Button>
					</motion.div>
				</motion.div>
			</div>
		);
	}

	// Revealing phase - show one competitor at a time
	if (phase === "revealing" && currentCompetitor) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 relative">
				{/* Progress indicator */}
				<div className="absolute top-8 left-1/2 -translate-x-1/2">
					<div className="flex items-center gap-2 text-muted-foreground">
						<span className="text-sm">
							{currentRevealIndex + 1} / {totalCompetitors}
						</span>
						<div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
							<motion.div
								className="h-full bg-amber-500"
								initial={{ width: 0 }}
								animate={{
									width: `${
										((currentRevealIndex + 1) /
											totalCompetitors) *
										100
									}%`,
								}}
							/>
						</div>
					</div>
				</div>

				<AnimatePresence mode="wait">
					<motion.div
						key={currentCompetitor.id}
						className="text-center"
						initial={{ opacity: 0, scale: 0.8, y: 50 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.8, y: -50 }}
						transition={{ duration: 0.4 }}
					>
						{/* Rank badge */}
						<motion.div
							className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 text-3xl font-bold ${
								isAdvancing
									? "bg-amber-500 text-black"
									: "bg-muted text-muted-foreground"
							}`}
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							transition={{ delay: 0.2, type: "spring" }}
						>
							{currentRank <= 3 && isAdvancing && (
								<Trophy className="w-8 h-8 mr-1" />
							)}
							{currentRank}
						</motion.div>

						{/* Competitor photo */}
						<motion.div
							className={`w-40 h-40 md:w-56 md:h-56 rounded-full overflow-hidden mx-auto mb-6 border-4 ${
								isAdvancing
									? "border-amber-500 shadow-lg shadow-amber-500/30"
									: "border-muted-foreground/30 grayscale"
							}`}
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							transition={{ delay: 0.3, type: "spring" }}
						>
							<PlaceholderAvatar
								src={currentCompetitor.photoUrl}
								alt={currentCompetitor.name}
								name={currentCompetitor.name}
								className="w-full h-full"
							/>
						</motion.div>

						{/* Competitor info */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.4 }}
						>
							<p
								className={`text-5xl md:text-7xl font-bold mb-2 ${
									isAdvancing
										? "text-foreground"
										: "text-muted-foreground"
								}`}
							>
								#{currentCompetitor.number}
							</p>
							<p className="text-2xl text-muted-foreground mb-4">
								{currentCompetitor.name}
							</p>

							{/* Status */}
							{isAdvancing ? (
								<div className="flex items-center justify-center gap-2 text-amber-500 text-xl">
									<ArrowUp className="w-6 h-6" />
									<span className="font-bold">
										{isTiedCompetitor
											? "Tied Up - Advances"
											: "Advances"}
									</span>
								</div>
							) : (
								<div className="flex items-center justify-center gap-2 text-muted-foreground text-xl">
									<X className="w-6 h-6" />
									<span>
										{isTiedCompetitor
											? "Tied Up - Eliminated"
											: "Eliminated"}
									</span>
								</div>
							)}

							{/* Vote count */}
							<p className="mt-4 text-lg text-muted-foreground">
								{currentCompetitor.voteCount || 0} votes
							</p>
						</motion.div>
					</motion.div>
				</AnimatePresence>

				{/* Navigation controls */}
				<div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
					<Button
						variant="outline"
						size="lg"
						onClick={handlePrev}
						disabled={currentRevealIndex === 0}
						className="bg-transparent"
					>
						<ChevronLeft className="w-6 h-6" />
					</Button>

					{isLastReveal ? (
						<Button
							size="lg"
							onClick={() => setPhase("finished")}
							className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-8"
						>
							<Trophy className="w-5 h-5 mr-2" />
							Show All Results
						</Button>
					) : (
						<Button
							variant="outline"
							size="lg"
							onClick={handleNext}
							className="bg-transparent"
						>
							<ChevronRight className="w-6 h-6" />
						</Button>
					)}
				</div>
			</div>
		);
	}

	// Finished phase - show full results grid
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
				{displayCompetitors.map((competitor, idx) => {
					const isAdvancingGrid = idx < advancingCount;
					const isTiedGrid = tiedCompetitorIds.has(competitor.id);
					let statusText = isAdvancingGrid
						? "Advances"
						: "Eliminated";
					if (isTiedGrid) statusText = "Tied Up";

					return (
						<motion.div
							key={competitor.id}
							className={`relative p-3 rounded-xl text-center transition-all ${
								isAdvancingGrid
									? "bg-amber-500/20 border-2 border-amber-500 shadow-lg shadow-amber-500/20"
									: "bg-muted/50 border border-border opacity-60"
							}`}
							initial={{ opacity: 0, y: 30 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1 + idx * 0.03 }}
						>
							{isAdvancingGrid && (
								<div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-sm z-10">
									{idx + 1}
								</div>
							)}

							<div
								className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden mx-auto mb-2 border-2 ${
									isAdvancingGrid
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
									isAdvancingGrid
										? "text-foreground"
										: "text-muted-foreground"
								}`}
							>
								#{competitor.number}
							</p>
							<p className="text-xs text-muted-foreground truncate">
								{competitor.name}
							</p>

							{isAdvancingGrid ? (
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
								{competitor.voteCount || 0} votes
							</div>
						</motion.div>
					);
				})}
			</div>

			{/* Back to announcement button */}
			<motion.div
				className="mt-8"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.5 }}
			>
				<Button
					variant="outline"
					onClick={onFinish}
					className="bg-transparent"
				>
					Continue
				</Button>
			</motion.div>
		</div>
	);
}
