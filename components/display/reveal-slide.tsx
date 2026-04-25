"use client";

import { useState, useEffect } from "react";
import type { Heat } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { Badge } from "@/components/ui/badge";

interface RevealSlideProps {
	heat: Heat;
	currentRotation?: number;
}

export function RevealSlide({ heat, currentRotation = 1 }: RevealSlideProps) {
	const [currentIndex, setCurrentIndex] = useState(0);

	const isFinalsHeat =
		heat.round === "finals" &&
		heat.finalsCouples &&
		heat.finalsCouples.length > 0;

	// Get the current rotation's data
	const currentRotationData = heat.rotations?.find(
		(r) => r.number === currentRotation,
	);
	
	const finalsCouples = currentRotationData?.finalsCouples || heat.finalsCouples || [];
	const regularCouples = currentRotationData?.couples || heat.couples || [];

	// Flatten all unique competitors in this rotation
	const competitorsToReveal = Array.from(new Map(
		(isFinalsHeat ? finalsCouples : regularCouples).flatMap((couple) => {
			if ("competitor" in couple) {
				return [[couple.competitor.id, couple.competitor]];
			} else {
				return [
					[couple.maleCompetitor.id, couple.maleCompetitor],
					[couple.femaleCompetitor.id, couple.femaleCompetitor],
				];
			}
		})
	).values());

	// Keyboard navigation to cycle through competitors
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "ArrowRight" || e.key === " ") {
				setCurrentIndex((prev) => Math.min(prev + 1, competitorsToReveal.length - 1));
			} else if (e.key === "ArrowLeft") {
				setCurrentIndex((prev) => Math.max(prev - 1, 0));
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [competitorsToReveal.length]);

	// Auto cycle timer (e.g., 5 seconds per dancer) - uncomment if auto-advance is preferred
	/*
	useEffect(() => {
		if (currentIndex < competitorsToReveal.length - 1) {
			const timer = setTimeout(() => {
				setCurrentIndex(prev => prev + 1);
			}, 5000);
			return () => clearTimeout(timer);
		}
	}, [currentIndex, competitorsToReveal.length]);
	*/

	if (competitorsToReveal.length === 0) {
		return null;
	}

	const competitor = competitorsToReveal[currentIndex];
	const isAssistant = competitor.isCompAssistant;

	return (
		<div className="h-screen flex flex-col bg-background p-6 overflow-hidden items-center justify-center">
			{/* Header info */}
			<div className="absolute top-8 left-0 right-0 text-center">
				<h2 className="text-xl md:text-2xl text-muted-foreground uppercase tracking-widest">
					Heat {heat.number} • Rotation {currentRotation}
				</h2>
			</div>

			<AnimatePresence mode="wait">
				<motion.div
					key={competitor.id}
					initial={{ opacity: 0, scale: 0.8, x: 100 }}
					animate={{ opacity: 1, scale: 1, x: 0 }}
					exit={{ opacity: 0, scale: 0.8, x: -100 }}
					transition={{ type: "spring", stiffness: 200, damping: 20 }}
					className="flex flex-col items-center"
				>
					<div className={`w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden border-4 shadow-2xl mb-8 ${isAssistant ? 'border-amber-500' : 'border-primary'}`}>
						<PlaceholderAvatar
							src={competitor.photoUrl}
							alt={competitor.name}
							name={competitor.name}
							className="w-full h-full"
						/>
					</div>

					<div className="text-center">
						<h1 className={`text-6xl md:text-8xl font-black mb-4 ${isAssistant ? 'text-amber-500' : 'text-foreground'}`}>
							#{competitor.number}
						</h1>
						
						{isAssistant ? (
							<Badge className="text-xl px-4 py-1 mb-4 bg-amber-500/20 text-amber-500 border border-amber-500/50">
								Assistant
							</Badge>
						) : (
							<p className="text-xl md:text-3xl text-muted-foreground uppercase tracking-widest">
								{competitor.gender === "male" ? "Lead" : "Follow"}
							</p>
						)}
					</div>
				</motion.div>
			</AnimatePresence>

			{/* Progress Indicator */}
			<div className="absolute bottom-12 left-0 right-0 flex justify-center gap-2">
				{competitorsToReveal.map((_, idx) => (
					<div
						key={idx}
						className={`h-2 rounded-full transition-all duration-300 ${
							idx === currentIndex ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
						}`}
					/>
				))}
			</div>
			
			<div className="absolute bottom-4 text-muted-foreground/50 text-xs text-center w-full">
				Press Left/Right arrows to navigate
			</div>
		</div>
	);
}
