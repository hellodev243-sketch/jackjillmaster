"use client";

import { useState, useCallback, useEffect } from "react";
import type { Competitor, Judge, Heat } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import {
	Trophy,
	Circle,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Sparkles,
	Check,
} from "lucide-react";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { Button } from "@/components/ui/button";
import { useDisplayAction } from "@/hooks/use-display-action";

interface FinalsPairingSlideProps {
	finalists: Competitor[];
	judges: Judge[];
	gender: "male" | "female";
	currentHeat?: Heat;
	judgeMode?: "same_gender" | "cross_gender";
}

export function FinalsPairingSlide({
	finalists,
	judges,
	gender,
	currentHeat,
	judgeMode = "cross_gender",
}: FinalsPairingSlideProps) {
	const [phase, setPhase] = useState<"intro" | "reveal" | "finish" | "grid">(
		"intro",
	);
	const [currentIndex, setCurrentIndex] = useState(0);

	const oppositeGender = gender === "male" ? "female" : "male";
	const votingGender = judgeMode === "same_gender" ? gender : oppositeGender;
	const votingJudges = judges.filter((j) => j.gender === votingGender);
	const totalVotingJudges = votingJudges.length;

	const sortedFinalists = [...finalists].sort((a, b) => a.number - b.number);
	const hasFinalsPairings =
		currentHeat?.finalsCouples && currentHeat.finalsCouples.length > 0;
	const finalsPairings = hasFinalsPairings ? currentHeat.finalsCouples! : [];

	// Reveal only pairings
	const allItems = finalsPairings.map((p, i) => ({
		type: "pairing" as const,
		pairing: p,
		index: i,
	}));
	const totalItems = allItems.length;
	const currentItem = allItems[currentIndex];

	const handleNext = useCallback(() => {
		if (currentIndex < totalItems - 1) {
			setCurrentIndex(currentIndex + 1);
		} else {
			setPhase("grid");
		}
	}, [currentIndex, totalItems]);

	const handlePrev = useCallback(() => {
		if (currentIndex > 0) {
			setCurrentIndex(currentIndex - 1);
		}
	}, [currentIndex]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (phase === "intro") {
				if (
					e.key === "Enter" ||
					e.key === " " ||
					e.key === "ArrowRight"
				) {
					e.preventDefault();
					setPhase("reveal");
				}
				return;
			}
			if (phase === "finish" || phase === "grid") {
				if (e.key === "ArrowLeft") {
					setPhase("reveal");
					setCurrentIndex(totalItems - 1);
				}
				return;
			}
			if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				handleNext();
			} else if (e.key === "ArrowLeft") {
				handlePrev();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleNext, handlePrev, phase, totalItems]);

	// Listen for remote actions from admin panel
	useDisplayAction(
		useCallback(
			(action: string, payload?: any) => {
				console.log(
					`[FinalsPairingSlide] Received remote action: ${action}`,
					payload,
				);

				// If payload has full state, apply it directly for perfect sync
				if (
					payload &&
					payload.phase !== undefined &&
					payload.index !== undefined
				) {
					setPhase(payload.phase);
					setCurrentIndex(payload.index);
					return;
				}

				if (action === "reveal") {
					if (phase === "intro") setPhase("reveal");
				} else if (action === "next") {
					if (phase === "intro") {
						setPhase("reveal");
						setCurrentIndex(0);
					} else {
						handleNext();
					}
				} else if (action === "prev") {
					handlePrev();
				} else if (action === "finish") {
					setPhase("grid");
				} else if (action === "startOver") {
					setPhase("intro");
					setCurrentIndex(0);
				}
			},
			[phase, handleNext, handlePrev],
		),
	);

	// Intro
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
					<h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 uppercase">
						FINAL PAIRINGS
					</h1>
					<p className="text-2xl md:text-3xl text-muted-foreground mb-2">
						{finalsPairings.length} Pairings
					</p>
					<p className="text-xl text-amber-500 mb-12">
						Judged by {totalVotingJudges} {votingGender} judges
					</p>
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.5 }}
					>
						<Button
							size="lg"
							onClick={() => setPhase("reveal")}
							className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xl px-12 py-6 rounded-full"
						>
							<Trophy className="w-6 h-6 mr-3" />
							Reveal Pairings
						</Button>
					</motion.div>
				</motion.div>
			</div>
		);
	}

	// Finish
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
					<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 uppercase">
						All Pairings Revealed!
					</h1>
					<p className="text-xl text-muted-foreground mb-8">
						{finalsPairings.length}{" "}
						pairings ready
					</p>
					<div className="flex gap-4 justify-center">
						<Button
							variant="outline"
							size="lg"
							onClick={() => {
								setPhase("reveal");
								setCurrentIndex(totalItems - 1);
							}}
							className="text-lg px-8 py-6"
						>
							<ChevronLeft className="w-5 h-5 mr-2" />
							Go Back
						</Button>
						<Button
							size="lg"
							onClick={() => setPhase("grid")}
							className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-lg px-8 py-6"
						>
							View All Pairings
							<ChevronRight className="w-5 h-5 ml-2" />
						</Button>
					</div>
				</motion.div>
			</div>
		);
	}

	// Grid view
	if (phase === "grid") {
		return (
			<div className="min-h-screen flex flex-col items-center justify-start bg-background p-6 overflow-auto">
				<motion.div
					className="text-center mb-6"
					initial={{ opacity: 0, y: -30 }}
					animate={{ opacity: 1, y: 0 }}
				>
					<img
						src="/jack-and-jill-logo-transparent.png"
						alt="Jack & Jill"
						className="w-12 h-12 mx-auto mb-4 object-contain"
					/>
					<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2 uppercase">
						FINAL PAIRINGS
					</h1>
					<p className="text-xl text-muted-foreground">
						{finalsPairings.length} Pairings · {totalVotingJudges}{" "}
						Judges
					</p>
				</motion.div>

				{/* Pairings grid */}
				{finalsPairings.length > 0 && (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl w-full mb-8">
							{finalsPairings.map((couple, idx) => (
								<motion.div
									key={couple.id}
									className="bg-card rounded-2xl p-4 flex items-center gap-4 border border-border"
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.05 * idx }}
								>
									<div className="text-center flex-1">
										<div
											className={`w-16 h-16 rounded-full overflow-hidden border-2 mx-auto mb-1 ${gender === "male" ? "border-amber-500" : "border-emerald-500"}`}
										>
											<PlaceholderAvatar
												src={couple.competitor.photoUrl}
												alt={couple.competitor.name}
												name={couple.competitor.name}
												className="w-full h-full"
											/>
										</div>
										<p className="text-lg font-bold">
											#{couple.competitor.number}
										</p>
									</div>
									<span className="text-2xl text-amber-500 font-bold">
										+
									</span>
									<div className="text-center flex-1">
										<div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-500/50 mx-auto mb-1">
											<PlaceholderAvatar
												src={couple.judge.photoUrl}
												alt={couple.judge.name}
												name={couple.judge.name}
												className="w-full h-full"
											/>
										</div>
										<p className="text-xs font-bold text-amber-500">
											Judge
										</p>
									</div>
								</motion.div>
							))}
						</div>
				)}

				{/* Voting progress */}
				{currentHeat && totalVotingJudges > 0 && (
					<div className="flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-border/50 mb-8">
						<span className="text-sm font-bold text-muted-foreground uppercase">
							Voting:
						</span>
						<div className="flex gap-2">
							{Array.from({ length: totalVotingJudges }).map(
								(_, idx) => (
									<div key={idx}>
										{idx <
										(currentHeat.judgesSubmitted?.length ||
											0) ? (
											<CheckCircle2 className="w-6 h-6 text-emerald-500" />
										) : (
											<Circle className="w-6 h-6 text-muted-foreground/30" />
										)}
									</div>
								),
							)}
						</div>
						<span className="text-lg font-bold">
							{currentHeat.judgesSubmitted?.length || 0} /{" "}
							{totalVotingJudges}
						</span>
					</div>
				)}

				<div className="fixed bottom-28 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-card/90 backdrop-blur px-6 py-4 rounded-2xl border border-border shadow-xl">
					<Button
						variant="outline"
						size="lg"
						onClick={() => {
							setPhase("intro");
							setCurrentIndex(0);
						}}
						className="text-lg px-8 py-4"
					>
						Start Over
					</Button>
				</div>
			</div>
		);
	}

	// Reveal phase — one item at a time
	const revealNumber = currentIndex + 1;

	if (!currentItem) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
				<p className="text-xl text-muted-foreground">
					No pairings to display
				</p>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
			{/* Progress */}
			<div className="w-full text-center mb-8">
				<p className="text-muted-foreground text-sm mb-2 uppercase font-bold tracking-widest">
					FINAL PAIRINGS
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
								width: `${(revealNumber / totalItems) * 100}%`,
							}}
							transition={{ duration: 0.3 }}
						/>
					</div>
					<span className="text-muted-foreground">{totalItems}</span>
				</div>
			</div>

			<AnimatePresence mode="wait">
				{currentItem.type === "pairing" && (
					<motion.div
						key={`pairing-${currentItem.pairing.id}`}
						className="text-center w-full"
						initial={{ opacity: 0, y: 50, scale: 0.8 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -50, scale: 0.8 }}
						transition={{ duration: 0.4 }}
					>
						<motion.div
							className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-sm font-bold bg-amber-500/20 text-amber-500"
							initial={{ opacity: 0, y: -20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1 }}
						>
							Pairing {currentItem.index + 1} of{" "}
							{finalsPairings.length}
						</motion.div>

						<div className="flex items-center gap-8 justify-center">
							{/* Competitor */}
							<motion.div
								className="text-center"
								initial={{ opacity: 0, x: -50 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: 0.2 }}
							>
								<div
									className={`w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden mx-auto mb-4 border-4 shadow-lg ${gender === "male" ? "border-amber-500 shadow-amber-500/30" : "border-emerald-500 shadow-emerald-500/30"}`}
								>
									<PlaceholderAvatar
										src={
											currentItem.pairing.competitor
												.photoUrl
										}
										alt={
											currentItem.pairing.competitor.name
										}
										name={
											currentItem.pairing.competitor.name
										}
										className="w-full h-full"
									/>
								</div>
								<p className="text-4xl md:text-5xl font-bold text-foreground">
									#{currentItem.pairing.competitor.number}
								</p>
								<p className="text-lg text-muted-foreground">
									{currentItem.pairing.competitor.name}
								</p>
							</motion.div>

							{/* Plus */}
							<motion.div
								className="text-5xl text-amber-500 font-black"
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								transition={{ type: "spring", delay: 0.3 }}
							>
								+
							</motion.div>

							{/* Judge */}
							<motion.div
								className="text-center"
								initial={{ opacity: 0, x: 50 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: 0.4 }}
							>
								<div className="w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden mx-auto mb-4 border-4 border-amber-500/50 shadow-lg shadow-amber-500/20">
									<PlaceholderAvatar
										src={currentItem.pairing.judge.photoUrl}
										alt={currentItem.pairing.judge.name}
										name={currentItem.pairing.judge.name}
										className="w-full h-full"
									/>
								</div>
								<p className="text-xl font-bold text-amber-500 uppercase">
									Judge
								</p>
								<p className="text-lg text-muted-foreground">
									{currentItem.pairing.judge.name}
								</p>
							</motion.div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Navigation */}
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
						{revealNumber} of {totalItems}
					</p>
					<p className="text-xs text-muted-foreground">
						Pairing ·{" "}
						{currentIndex < totalItems - 1 ? "Next →" : "Finish →"}
					</p>
				</div>
				<Button
					variant={
						currentIndex === totalItems - 1 ? "default" : "outline"
					}
					size="lg"
					onClick={handleNext}
					className={`w-14 h-14 rounded-full ${currentIndex === totalItems - 1 ? "bg-amber-500 hover:bg-amber-600 text-black" : "bg-background"}`}
				>
					<ChevronRight className="w-6 h-6" />
				</Button>
			</div>
		</div>
	);
}
