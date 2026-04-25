"use client";

import type { Competitor, Event } from "@/lib/types";
import {
	getScoringMode,
	getCompetitionConfig,
	getSortedRounds,
	isFinalRound,
} from "@/lib/competition-config";
import { motion } from "framer-motion";
import { Trophy, Sparkles } from "lucide-react";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";

interface WinnerSlideProps {
	winner: Competitor;
	gender: "male" | "female";
	totalVotingJudges: number;
	event?: Event;
}

export function WinnerSlide({
	winner,
	gender,
	totalVotingJudges,
	event,
}: WinnerSlideProps) {
	const config = event ? getCompetitionConfig(event) : null;
	const finalsRound = config
		? getSortedRounds(config).find((r) => isFinalRound(r, config))
		: null;
	const scoringMode = event
		? getScoringMode(event, finalsRound?.id || "finals")
		: "selection";
	const isScoringMode = scoringMode === "scoring";
	const isRankingMode = scoringMode === "ranking";
	const scoreLabel = isRankingMode
		? "Total Rank"
		: isScoringMode
			? "points"
			: "votes";
	const scoreValue = winner.voteCount || 0;

	const isFemale = gender === "female";
	const bgClass = isFemale ? "bg-emerald-500" : "bg-amber-500";
	const borderClass = isFemale ? "border-emerald-500" : "border-amber-500";
	const textClass = isFemale ? "text-emerald-500" : "text-amber-500";
	const shadowClass = isFemale ? "shadow-emerald-500/30" : "shadow-amber-500/30";

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background via-card to-background p-8 relative overflow-hidden">
			{/* Animated background elements */}
			<motion.div
				className="absolute inset-0 opacity-20"
				initial={{ opacity: 0 }}
				animate={{ opacity: 0.2 }}
				transition={{ duration: 1 }}
			>
				{Array.from({ length: 20 }).map((_, i) => (
					<motion.div
						key={i}
						className={`absolute w-2 h-2 rounded-full ${bgClass}`}
						style={{
							left: `${Math.random() * 100}%`,
							top: `${Math.random() * 100}%`,
						}}
						animate={{
							y: [0, -20, 0],
							opacity: [0.5, 1, 0.5],
						}}
						transition={{
							duration: 2 + Math.random() * 2,
							repeat: Number.POSITIVE_INFINITY,
							delay: Math.random() * 2,
						}}
					/>
				))}
			</motion.div>

			<motion.div
				initial={{ opacity: 0, scale: 0.8 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.8 }}
				className="text-center relative z-10"
			>
				<motion.div
					className="flex items-center justify-center gap-3 mb-6"
					initial={{ y: -50, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					transition={{ delay: 0.3 }}
				>
					<img
						src="/jack-and-jill-logo-transparent.png"
						alt="Jack & Jill"
						className="w-10 h-10 object-contain"
					/>
					<h1 className="text-4xl md:text-5xl font-bold text-foreground">
						{gender === "male" ? "Male" : "Female"} Champion
					</h1>
					<img
						src="/jack-and-jill-logo-transparent.png"
						alt="Jack & Jill"
						className="w-10 h-10 object-contain"
					/>
				</motion.div>

				<motion.div
					className="relative"
					initial={{ scale: 0 }}
					animate={{ scale: 1 }}
					transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
				>
					<div className={`w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden border-8 mx-auto shadow-2xl ${borderClass} ${shadowClass}`}>
						<PlaceholderAvatar
							src={winner.photoUrl}
							alt={winner.name}
							name={winner.name}
							className="w-full h-full"
						/>
					</div>

					<motion.div
						className="absolute -bottom-4 left-1/2 -translate-x-1/2"
						initial={{ y: 20, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ delay: 0.8 }}
					>
						<div className={`${bgClass} text-black px-6 py-2 rounded-full flex items-center gap-2`}>
							<Trophy className="w-6 h-6" />
							<span className="text-xl font-bold">WINNER</span>
							<Trophy className="w-6 h-6" />
						</div>
					</motion.div>
				</motion.div>

				<motion.div
					className="mt-12"
					initial={{ y: 30, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					transition={{ delay: 1 }}
				>
					<p className="text-6xl md:text-8xl font-bold text-foreground mb-2">
						#{winner.number}
					</p>
					<p className="text-3xl md:text-4xl text-muted-foreground">
						{winner.name}
					</p>
					<p className={`text-2xl mt-4 ${textClass}`}>
						{scoreValue} {scoreLabel}
					</p>
				</motion.div>
			</motion.div>
		</div>
	);
}
