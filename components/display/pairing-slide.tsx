"use client";

import { useState, useCallback, useEffect } from "react";
import type { Heat, RoundType } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDisplayAction } from "@/hooks/use-display-action";

interface PairingSlideProps {
	heat: Heat;
	currentRotation?: number;
}

function getTotalRotations(round: RoundType): number {
	switch (round) {
		case "round1":
			return 3;
		case "round2":
			return 2;
		case "finals":
			return 2;
		default:
			return 3;
	}
}

export function PairingSlide({ heat, currentRotation = 1 }: PairingSlideProps) {
	const totalRotations = heat.totalRotations || getTotalRotations(heat.round);
	const isFinalsHeat =
		heat.round === "finals" &&
		heat.finalsCouples &&
		heat.finalsCouples.length > 0;

	const currentRotationData = heat.rotations?.find(
		(r) => r.number === currentRotation,
	);
	const finalsCouples =
		currentRotationData?.finalsCouples || heat.finalsCouples || [];
	const regularCouples = currentRotationData?.couples || heat.couples || [];
	const displayCouples = isFinalsHeat ? finalsCouples : regularCouples;

	const [phase, setPhase] = useState<"intro" | "reveal" | "finish" | "grid">(
		"intro",
	);
	const [currentIndex, setCurrentIndex] = useState(0);
	const totalCouples = displayCouples.length;

	const handleNext = useCallback(() => {
		if (currentIndex < totalCouples - 1) {
			setCurrentIndex(currentIndex + 1);
		} else {
			setPhase("grid");
		}
	}, [currentIndex, totalCouples]);

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
					setCurrentIndex(totalCouples - 1);
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
	}, [handleNext, handlePrev, phase, totalCouples]);

	// Listen for remote actions from admin panel
	useDisplayAction(
		useCallback(
			(action: string, payload?: any) => {
				console.log(
					`[PairingSlide] Received remote action: ${action}`,
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
					<h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
						Heat {heat.number} Pairings
					</h1>
					<p className="text-2xl md:text-3xl text-muted-foreground mb-2">
						Rotation {currentRotation} of {totalRotations}
					</p>
					<p className="text-xl text-amber-500 mb-12">
						{totalCouples} couples to reveal
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
							<Sparkles className="w-6 h-6 mr-3" />
							Reveal Couples
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
					<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
						All Couples Revealed!
					</h1>
					<p className="text-xl text-muted-foreground mb-8">
						{totalCouples} couples for Heat {heat.number}
					</p>
					<div className="flex gap-4 justify-center">
						<Button
							variant="outline"
							size="lg"
							onClick={() => {
								setPhase("reveal");
								setCurrentIndex(totalCouples - 1);
							}}
							className="text-lg px-8 py-6"
						>
							<ChevronLeft className="w-5 h-5 mr-2" /> Go Back
						</Button>
						<Button
							size="lg"
							onClick={() => setPhase("grid")}
							className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-lg px-8 py-6"
						>
							View All Couples{" "}
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
					<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
						Heat {heat.number} Pairings
					</h1>
					<p className="text-xl text-muted-foreground">
						Rotation {currentRotation}/{totalRotations} ·{" "}
						{totalCouples} Couples
					</p>
				</motion.div>
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-6xl w-full">
					{displayCouples.map((couple: any, idx: number) => {
						const isFinals = isFinalsHeat;
						const leftName = isFinals
							? couple.competitor?.name
							: couple.maleCompetitor?.name;
						const leftPhoto = isFinals
							? couple.competitor?.photoUrl
							: couple.maleCompetitor?.photoUrl;
						const leftNumber = isFinals
							? couple.competitor?.number
							: couple.maleCompetitor?.number;
						const rightName = isFinals
							? couple.judge?.name
							: couple.femaleCompetitor?.name;
						const rightPhoto = isFinals
							? couple.judge?.photoUrl
							: couple.femaleCompetitor?.photoUrl;
						const rightNumber = isFinals
							? null
							: couple.femaleCompetitor?.number;
						const rightLabel = isFinals ? "Judge" : null;
						return (
							<motion.div
								key={couple.id}
								className="bg-card rounded-xl p-3 border border-border flex items-center gap-2"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.03 * idx }}
							>
								<div className="text-center flex-1">
									<div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500 mx-auto mb-1">
										<PlaceholderAvatar
											src={leftPhoto}
											alt={leftName || ""}
											name={leftName || ""}
											className="w-full h-full"
										/>
									</div>
									<p className="text-sm font-bold text-amber-500">
										#{leftNumber}
									</p>
									<p className="text-[10px] text-muted-foreground truncate">
										{leftName?.split(" ")[0]}
									</p>
								</div>
								<span className="text-amber-500 font-bold">
									&
								</span>
								<div className="text-center flex-1">
									<div className="w-12 h-12 rounded-full overflow-hidden border-2 border-emerald-500 mx-auto mb-1">
										<PlaceholderAvatar
											src={rightPhoto}
											alt={rightName || ""}
											name={rightName || ""}
											className="w-full h-full"
										/>
									</div>
									{rightNumber ? (
										<p className="text-sm font-bold text-emerald-500">
											#{rightNumber}
										</p>
									) : (
										<p className="text-sm font-bold text-emerald-500">
											{rightLabel}
										</p>
									)}
									<p className="text-[10px] text-muted-foreground truncate">
										{rightName?.split(" ")[0]}
									</p>
								</div>
							</motion.div>
						);
					})}
				</div>
				<div className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur px-6 py-4 rounded-2xl border border-border shadow-xl">
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

	// Reveal phase — one couple at a time, centered
	const revealNumber = currentIndex + 1;
	const couple: any = displayCouples[currentIndex];

	if (!couple) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
				<p className="text-xl text-muted-foreground">
					No couples to display
				</p>
			</div>
		);
	}

	const isFinals = isFinalsHeat;

	const leftName = isFinals
		? couple?.competitor?.name
		: couple?.maleCompetitor?.name;
	const leftPhoto = isFinals
		? couple?.competitor?.photoUrl
		: couple?.maleCompetitor?.photoUrl;
	const leftNumber = isFinals
		? couple?.competitor?.number
		: couple?.maleCompetitor?.number;
	const leftIsAssistant =
		!isFinals && couple?.maleCompetitor?.isCompAssistant;

	const rightName = isFinals
		? couple?.judge?.name
		: couple?.femaleCompetitor?.name;
	const rightPhoto = isFinals
		? couple?.judge?.photoUrl
		: couple?.femaleCompetitor?.photoUrl;
	const rightNumber = isFinals ? null : couple?.femaleCompetitor?.number;
	const rightLabel = isFinals ? "Judge" : null;
	const rightIsAssistant =
		!isFinals && couple?.femaleCompetitor?.isCompAssistant;

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
			{/* Progress */}
			<div className="w-full text-center mb-8">
				<p className="text-muted-foreground text-sm mb-2">
					Heat {heat.number} · Rotation {currentRotation}/
					{totalRotations}
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
								width: `${(revealNumber / totalCouples) * 100}%`,
							}}
							transition={{ duration: 0.3 }}
						/>
					</div>
					<span className="text-muted-foreground">
						{totalCouples}
					</span>
				</div>
			</div>

			{/* Main couple reveal */}
			<AnimatePresence mode="wait">
				<motion.div
					key={couple?.id || currentIndex}
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
						Couple {revealNumber} of {totalCouples}
					</motion.div>

					<div className="flex items-center gap-8 md:gap-12 justify-center">
						{/* Left (male / competitor) */}
						<motion.div
							className="text-center"
							initial={{ opacity: 0, x: -50 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.2 }}
						>
							<div
								className={`w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden mx-auto mb-4 border-4 shadow-lg ${leftIsAssistant ? "border-yellow-500 shadow-yellow-500/30" : "border-amber-500 shadow-amber-500/30"}`}
							>
								<PlaceholderAvatar
									src={leftPhoto}
									alt={leftName || ""}
									name={leftName || ""}
									className="w-full h-full"
								/>
							</div>
							<p
								className={`text-4xl md:text-5xl font-bold mb-1 ${leftIsAssistant ? "text-yellow-500" : "text-amber-500"}`}
							>
								#{leftNumber}
							</p>
							<p className="text-lg text-muted-foreground">
								{leftName}
							</p>
							{leftIsAssistant && (
								<Badge
									variant="outline"
									className="mt-1 bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
								>
									Assistant
								</Badge>
							)}
						</motion.div>

						{/* Ampersand */}
						<motion.div
							className="text-5xl text-amber-500 font-black"
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							transition={{ type: "spring", delay: 0.3 }}
						>
							&
						</motion.div>

						{/* Right (female / judge) */}
						<motion.div
							className="text-center"
							initial={{ opacity: 0, x: 50 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.4 }}
						>
							<div
								className={`w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden mx-auto mb-4 border-4 shadow-lg ${rightIsAssistant ? "border-yellow-500 shadow-yellow-500/30" : "border-emerald-500 shadow-emerald-500/30"}`}
							>
								<PlaceholderAvatar
									src={rightPhoto}
									alt={rightName || ""}
									name={rightName || ""}
									className="w-full h-full"
								/>
							</div>
							{rightNumber ? (
								<p
									className={`text-4xl md:text-5xl font-bold mb-1 ${rightIsAssistant ? "text-yellow-500" : "text-emerald-500"}`}
								>
									#{rightNumber}
								</p>
							) : (
								<p className="text-2xl font-bold text-emerald-500 mb-1">
									{rightLabel}
								</p>
							)}
							<p className="text-lg text-muted-foreground">
								{rightName}
							</p>
							{rightIsAssistant && (
								<Badge
									variant="outline"
									className="mt-1 bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
								>
									Assistant
								</Badge>
							)}
						</motion.div>
					</div>
				</motion.div>
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
						{revealNumber} of {totalCouples}
					</p>
					<p className="text-xs text-muted-foreground">
						{currentIndex < totalCouples - 1
							? "Next →"
							: "Finish →"}
					</p>
				</div>
				<Button
					variant={
						currentIndex === totalCouples - 1
							? "default"
							: "outline"
					}
					size="lg"
					onClick={handleNext}
					className={`w-14 h-14 rounded-full ${currentIndex === totalCouples - 1 ? "bg-amber-500 hover:bg-amber-600 text-black" : "bg-background"}`}
				>
					<ChevronRight className="w-6 h-6" />
				</Button>
			</div>
		</div>
	);
}
