"use client";

import { useState, useCallback, useEffect } from "react";
import type { Heat, Competitor } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { ChevronLeft, ChevronRight, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDisplayAction } from "@/hooks/use-display-action";

interface IndividualDancersSlideProps {
	heat?: Heat;
	currentRotation?: number;
	// Alternative: pass competitors directly (for finals no-pairing mode)
	competitors?: Competitor[];
	gender?: "male" | "female";
	title?: string;
}

export function IndividualDancersSlide({
	heat,
	currentRotation = 1,
	competitors: directCompetitors,
	gender: directGender,
	title: directTitle,
}: IndividualDancersSlideProps) {
	// If direct competitors are provided, use them; otherwise extract from heat
	let maleCompetitors: Competitor[] = [];
	let femaleCompetitors: Competitor[] = [];

	if (directCompetitors && directGender) {
		if (directGender === "male") {
			maleCompetitors = directCompetitors;
		} else {
			femaleCompetitors = directCompetitors;
		}
	} else if (heat) {
		const currentRotationData = heat.rotations?.find(
			(r) => r.number === currentRotation,
		);
		maleCompetitors =
			currentRotationData?.maleCompetitors || heat.maleCompetitors || [];
		femaleCompetitors =
			currentRotationData?.femaleCompetitors ||
			heat.femaleCompetitors ||
			[];
	}

	const allDancers = [...maleCompetitors, ...femaleCompetitors];
	const totalDancers = allDancers.length;

	const [phase, setPhase] = useState<"intro" | "reveal" | "finish" | "grid">(
		"intro",
	);
	const [currentIndex, setCurrentIndex] = useState(0);

	const currentDancer = allDancers[currentIndex];
	const isMale = currentIndex < maleCompetitors.length;
	const genderLabel = isMale ? "Lead" : "Follow";
	const genderIndex = isMale
		? currentIndex + 1
		: currentIndex - maleCompetitors.length + 1;
	const genderTotal = isMale
		? maleCompetitors.length
		: femaleCompetitors.length;
	const accentColor = isMale ? "amber" : "emerald";

	const handleNext = useCallback(() => {
		if (currentIndex < totalDancers - 1) {
			setCurrentIndex(currentIndex + 1);
		} else {
			setPhase("grid");
		}
	}, [currentIndex, totalDancers]);

	const handlePrev = useCallback(() => {
		if (currentIndex > 0) {
			setCurrentIndex(currentIndex - 1);
		}
	}, [currentIndex]);

	// Keyboard navigation
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
			if (phase === "finish") {
				if (e.key === "ArrowLeft") {
					setPhase("reveal");
					setCurrentIndex(totalDancers - 1);
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
	}, [handleNext, handlePrev, phase, totalDancers]);

	// Listen for remote actions from admin panel
	useDisplayAction(
		useCallback(
			(action: string, payload?: any) => {
				console.log(
					`[IndividualDancersSlide] Received remote action: ${action}`,
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
						{directTitle || `Heat ${heat?.number} Pairings`}
					</h1>
					{!directTitle && (
						<p className="text-2xl md:text-3xl text-muted-foreground mb-2">
							Rotation {currentRotation}
						</p>
					)}
					<p className="text-xl text-amber-500 mb-4">
						{maleCompetitors.length} Leads ·{" "}
						{femaleCompetitors.length} Follows
					</p>
					<p className="text-lg text-muted-foreground mb-12">
						{totalDancers} dancers to introduce
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
							Introduce Dancers
						</Button>
					</motion.div>
				</motion.div>
			</div>
		);
	}

	// Finish screen
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
						All Dancers Introduced!
					</h1>
					<p className="text-xl text-muted-foreground mb-8">
						{totalDancers} dancers {directTitle ? "ready" : `ready for Heat ${heat?.number}`}
					</p>

					<div className="flex gap-4 justify-center">
						<Button
							variant="outline"
							size="lg"
							onClick={() => {
								setPhase("reveal");
								setCurrentIndex(totalDancers - 1);
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
							View All Dancers
							<ChevronRight className="w-5 h-5 ml-2" />
						</Button>
					</div>
				</motion.div>
			</div>
		);
	}

	// Grid view — all dancers shown together
	if (phase === "grid") {
		return (
			<div className="min-h-screen flex flex-col items-center justify-start bg-background p-6 overflow-auto">
				<motion.div
					className="text-center mb-6"
					initial={{ opacity: 0, y: -30 }}
					animate={{ opacity: 1, y: 0 }}
				>
					<h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
						{directTitle || `Heat ${heat?.number} Dancers`}
					</h1>
					<p className="text-xl text-muted-foreground">
						{directTitle ? "" : `Rotation ${currentRotation} · `}
						{maleCompetitors.length} Leads · {femaleCompetitors.length} Follows
					</p>
				</motion.div>

				<div className="grid grid-cols-2 gap-6 max-w-6xl w-full">
					{/* Leads column */}
					<div className="bg-amber-500/5 rounded-2xl p-4 border border-amber-500/20">
						<h2 className="text-xl font-bold text-amber-500 uppercase tracking-wider mb-4 text-center">
							Leads
						</h2>
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
							{maleCompetitors.map((dancer, idx) => (
								<motion.div
									key={dancer.id}
									className="relative p-3 rounded-xl text-center bg-amber-500/20 border-2 border-amber-500"
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.03 * idx }}
								>
									<div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden mx-auto mb-2 border-2 border-amber-500">
										<PlaceholderAvatar
											src={dancer.photoUrl}
											alt={dancer.name}
											name={dancer.name}
											className="w-full h-full"
										/>
									</div>
									<p className="text-lg font-bold text-amber-500">
										#{dancer.number}
									</p>
									<p className="text-xs text-muted-foreground truncate">
										{dancer.name}
									</p>
								</motion.div>
							))}
						</div>
					</div>

					{/* Follows column */}
					<div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/20">
						<h2 className="text-xl font-bold text-emerald-500 uppercase tracking-wider mb-4 text-center">
							Follows
						</h2>
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
							{femaleCompetitors.map((dancer, idx) => (
								<motion.div
									key={dancer.id}
									className="relative p-3 rounded-xl text-center bg-emerald-500/20 border-2 border-emerald-500"
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.03 * idx }}
								>
									<div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden mx-auto mb-2 border-2 border-emerald-500">
										<PlaceholderAvatar
											src={dancer.photoUrl}
											alt={dancer.name}
											name={dancer.name}
											className="w-full h-full"
										/>
									</div>
									<p className="text-lg font-bold text-emerald-500">
										#{dancer.number}
									</p>
									<p className="text-xs text-muted-foreground truncate">
										{dancer.name}
									</p>
								</motion.div>
							))}
						</div>
					</div>
				</div>

				{/* Bottom nav */}
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

	// Reveal phase — one dancer at a time, centered, big card
	const revealNumber = currentIndex + 1;

	if (!currentDancer) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
				<p className="text-xl text-muted-foreground">
					No dancers to display
				</p>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
			{/* Progress indicator */}
			<div className="w-full text-center mb-8">
				<p className="text-muted-foreground text-sm mb-2">
					{directTitle || `Heat ${heat?.number} · Rotation ${currentRotation}`}
				</p>
				<div className="flex items-center justify-center gap-2">
					<span className="text-foreground font-bold">
						{revealNumber}
					</span>
					<div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
						<motion.div
							className={`h-full ${isMale ? "bg-amber-500" : "bg-emerald-500"}`}
							initial={{ width: 0 }}
							animate={{
								width: `${(revealNumber / totalDancers) * 100}%`,
							}}
							transition={{ duration: 0.3 }}
						/>
					</div>
					<span className="text-muted-foreground">
						{totalDancers}
					</span>
				</div>
			</div>

			{/* Main dancer reveal */}
			<AnimatePresence mode="wait">
				<motion.div
					key={currentDancer?.id || currentIndex}
					className="text-center w-full"
					initial={{ opacity: 0, y: 50, scale: 0.8 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: -50, scale: 0.8 }}
					transition={{ duration: 0.4 }}
				>
					{/* Gender + index badge */}
					<motion.div
						className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-sm font-bold ${
							isMale
								? "bg-amber-500/20 text-amber-500"
								: "bg-emerald-500/20 text-emerald-500"
						}`}
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
					>
						{genderLabel} {genderIndex} of {genderTotal}
					</motion.div>

					{/* Photo */}
					<motion.div
						className={`w-40 h-40 md:w-56 md:h-56 rounded-full overflow-hidden mx-auto mb-6 border-4 shadow-lg ${
							isMale
								? "border-amber-500 shadow-amber-500/30"
								: "border-emerald-500 shadow-emerald-500/30"
						}`}
						initial={{ scale: 0 }}
						animate={{ scale: 1 }}
						transition={{ type: "spring", delay: 0.2 }}
					>
						<PlaceholderAvatar
							src={currentDancer?.photoUrl}
							alt={currentDancer?.name || ""}
							name={currentDancer?.name || ""}
							className="w-full h-full"
						/>
					</motion.div>

					{/* Number */}
					<motion.p
						className={`text-5xl md:text-7xl font-bold mb-2 ${
							isMale ? "text-amber-500" : "text-emerald-500"
						}`}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.3 }}
					>
						#{currentDancer?.number}
					</motion.p>

					{/* Name */}
					<motion.p
						className="text-2xl md:text-3xl text-muted-foreground mb-4"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.35 }}
					>
						{currentDancer?.name}
					</motion.p>

					{/* Role badge */}
					<motion.div
						className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-xl font-bold ${
							isMale
								? "bg-amber-500/20 text-amber-500"
								: "bg-emerald-500/20 text-emerald-500"
						}`}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.4 }}
					>
						{genderLabel}
					</motion.div>
				</motion.div>
			</AnimatePresence>

			{/* Navigation controls */}
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
						{revealNumber} of {totalDancers}
					</p>
					<p className="text-xs text-muted-foreground">
						{currentIndex < totalDancers - 1
							? "Next →"
							: "Finish →"}
					</p>
				</div>

				<Button
					variant={
						currentIndex === totalDancers - 1
							? "default"
							: "outline"
					}
					size="lg"
					onClick={handleNext}
					className={`w-14 h-14 rounded-full ${
						currentIndex === totalDancers - 1
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
