"use client";

import { motion } from "framer-motion";
import type { Competitor, Judge, Heat } from "@/lib/types";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { Circle, CheckCircle2 } from "lucide-react";

interface FinalsDanceWithSlideProps {
	competitors: Competitor[];
	judges: Judge[];
	gender: "male" | "female";
	roundName: string;
	currentHeat?: Heat;
	judgeMode?: "same_gender" | "cross_gender";
}

export function FinalsDanceWithSlide({
	competitors,
	judges,
	gender,
	roundName,
	currentHeat,
	judgeMode = "cross_gender",
}: FinalsDanceWithSlideProps) {
	const oppositeGender = gender === "male" ? "female" : "male";
	const votingGender = judgeMode === "same_gender" ? gender : oppositeGender;
	const votingJudges = judges.filter((j) => j.gender === votingGender);
	const totalVotingJudges = votingJudges.length;
	const judgesSubmittedCount = currentHeat?.judgesSubmitted?.length || 0;

	// Sort competitors by number as in the reference image if needed
	const sortedCompetitors = [...competitors].sort((a, b) => a.number - b.number);
	const sortedJudges = [...votingJudges].sort((a, b) => a.name.localeCompare(b.name));

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 overflow-hidden">
			{/* Title */}
			<motion.div
				className="text-center mb-6"
				initial={{ opacity: 0, y: -30 }}
				animate={{ opacity: 1, y: 0 }}
			>
				<h1 className="text-3xl md:text-5xl font-black uppercase tracking-widest text-foreground">
					FINAL PAIRINGS
				</h1>
			</motion.div>

			{/* Competitors Row */}
			<div className="flex flex-wrap justify-center gap-4 md:gap-6 w-full max-w-7xl mb-6">
				{sortedCompetitors.map((comp, idx) => (
					<motion.div
						key={comp.id}
						className="flex flex-col items-center"
						initial={{ opacity: 0, scale: 0.5 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: idx * 0.1 }}
					>
						<div className={`w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-[3px] ${gender === "male" ? "border-primary" : "border-accent"} shadow-xl mb-2 relative group`}>
							<PlaceholderAvatar
								src={comp.photoUrl}
								alt={comp.name}
								name={comp.name}
								className="w-full h-full"
							/>
							<div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
						</div>
						<p className={`text-xl md:text-2xl font-black ${gender === "male" ? "text-primary" : "text-accent"}`}>
							#{comp.number}
						</p>
						<p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
							{gender === "male" ? "MALE" : "FEMALE"}
						</p>
					</motion.div>
				))}
			</div>

			{/* Middle Text */}
			<motion.div
				className="mb-6"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.5 }}
			>
				<p className="text-2xl md:text-4xl font-black italic text-muted-foreground/40 uppercase tracking-[0.2em]">
					Dance With
				</p>
			</motion.div>

			{/* Judges Row */}
			<div className="flex flex-wrap justify-center gap-4 md:gap-6 w-full max-w-7xl mb-8">
				{sortedJudges.map((judge, idx) => (
					<motion.div
						key={judge.id}
						className="flex flex-col items-center"
						initial={{ opacity: 0, scale: 0.5 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: 0.6 + idx * 0.1 }}
					>
						<div className="w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden border-[3px] border-muted shadow-xl mb-2 transition-all">
							<PlaceholderAvatar
								src={judge.photoUrl}
								alt={judge.name}
								name={judge.name}
								className="w-full h-full"
							/>
						</div>
						<p className="text-lg md:text-xl font-black text-foreground">
							JUDGE
						</p>
						<p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
							{votingGender === "male" ? "MALE" : "FEMALE"}
						</p>
					</motion.div>
				))}
			</div>

			{/* Voting Status / Footer */}
			<motion.div
				className="flex flex-col items-center gap-3 bg-card/50 backdrop-blur-md px-6 py-4 rounded-3xl border border-border shadow-xl"
				initial={{ opacity: 0, y: 50 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 1 }}
			>
				<div className="flex items-center gap-4">
					<span className="text-base md:text-lg font-black text-muted-foreground uppercase tracking-[0.15em]">
						Votes:
					</span>
					<div className="flex gap-2">
						{Array.from({ length: totalVotingJudges }).map((_, idx) => (
							<div key={idx}>
								{idx < judgesSubmittedCount ? (
									<CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-500/10" />
								) : (
									<Circle className="w-6 h-6 text-muted-foreground/20" />
								)}
							</div>
						))}
					</div>
					<div className="ml-3 flex items-baseline gap-1">
						<span className="text-2xl md:text-3xl font-black text-foreground">{judgesSubmittedCount}</span>
						<span className="text-lg md:text-xl font-black text-muted-foreground/50">/</span>
						<span className="text-lg md:text-xl font-black text-muted-foreground/50">{totalVotingJudges}</span>
					</div>
				</div>
			</motion.div>
		</div>
	);
}
