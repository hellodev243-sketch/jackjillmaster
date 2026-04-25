"use client";

import { motion } from "framer-motion";
import { Users, Trophy, ArrowRight, Layers, Split, HelpCircle } from "lucide-react";
import type { Event } from "@/lib/types";
import { getCompetitionConfig, getSortedRounds } from "@/lib/competition-config";

interface FlowSlideProps {
	event: Event;
}

export function FlowSlide({ event }: FlowSlideProps) {
	const config = getCompetitionConfig(event);
	const sortedRounds = getSortedRounds(config);

	// Dynamically build stages from configuration
	const stages = [
		{ 
			label: "Unlimited", 
			desc: "All Entries", 
			icon: Users 
		},
		...sortedRounds.map((round, idx) => {
			const isLast = idx === sortedRounds.length - 1;
			if (isLast) {
				return {
					label: "Winner",
					desc: round.name || "Champion",
					icon: Trophy
				};
			}
			
			const totalAdvancing = round.competitorsAdvancing * 2;
			return {
				label: totalAdvancing > 0 ? `Top ${totalAdvancing}` : "Advancing",
				desc: round.name,
				icon: null
			};
		})
	];

	// Get some dynamic stats for the rules section
	const firstRound = sortedRounds[0];
	const heatsText = "50%";
	const judgeModeText = firstRound?.finalsJudgeMode === "same_gender" ? "Same Gender" : "Cross Gender";

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background p-8 overflow-hidden">
			<motion.h1
				className="text-5xl md:text-7xl font-black text-foreground mb-16 tracking-tight"
				initial={{ opacity: 0, y: -30 }}
				animate={{ opacity: 1, y: 0 }}
			>
				Competition Flow
			</motion.h1>

			{/* Flow diagram */}
			<div className="flex items-center justify-center gap-6 mb-20 flex-wrap max-w-7xl">
				{stages.map((stage, idx) => (
					<motion.div
						key={`${stage.label}-${idx}`}
						className="flex items-center gap-6"
						initial={{ opacity: 0, x: -20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.2 + idx * 0.15 }}
					>
						<div className="flex flex-col items-center group">
							<motion.div
								whileHover={{ scale: 1.05 }}
								className={`w-20 h-20 md:w-28 md:h-28 rounded-2xl md:rounded-3xl flex flex-col items-center justify-center shadow-xl md:shadow-2xl relative overflow-hidden ${
									idx === stages.length - 1 
										? "bg-amber-500 text-black border-2 md:border-4 border-amber-400" 
										: "bg-card border border-border group-hover:border-primary/50 transition-colors"
								}`}
							>
								{idx === stages.length - 1 && (
									<motion.div 
										className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" 
										animate={{ opacity: [0, 0.5, 0] }}
										transition={{ duration: 3, repeat: Infinity }}
									/>
								)}
								{stage.icon && <stage.icon className="w-6 h-6 md:w-8 md:h-8 mb-1 md:mb-2" />}
								<p className={`text-xl md:text-2xl font-black ${idx === stages.length - 1 ? "tracking-tight" : "text-primary"}`}>
									{stage.label}
								</p>
							</motion.div>
							<p className="text-muted-foreground font-bold mt-3 uppercase tracking-widest text-[10px] md:text-xs">
								{stage.desc}
							</p>
						</div>
						
						{idx < stages.length - 1 && (
							<motion.div
								initial={{ opacity: 0, scale: 0.5 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.5 + idx * 0.2 }}
							>
								<ArrowRight className="w-8 h-8 text-muted-foreground/40" />
							</motion.div>
						)}
					</motion.div>
				))}
			</div>

			{/* Dynamic Rules / Highlights */}
			<motion.div
				className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl"
				initial={{ opacity: 0, y: 50 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.8 }}
			>
				<div className="group p-8 bg-card/50 backdrop-blur-sm border border-border rounded-3xl hover:border-primary/30 transition-all hover:shadow-2xl hover:-translate-y-1">
					<div className="p-3 bg-primary/10 rounded-2xl w-fit mb-4 group-hover:bg-primary/20 transition-colors">
						<Layers className="w-6 h-6 text-primary" />
					</div>
					<h3 className="text-3xl font-black text-foreground mb-1">{heatsText}</h3>
					<p className="text-muted-foreground font-medium">(HALF) Couples per Heat</p>
				</div>

				<div className="group p-8 bg-card/50 backdrop-blur-sm border border-border rounded-3xl hover:border-accent/30 transition-all hover:shadow-2xl hover:-translate-y-1">
					<div className="p-3 bg-accent/10 rounded-2xl w-fit mb-4 group-hover:bg-accent/20 transition-colors">
						<Split className="w-6 h-6 text-accent" />
					</div>
					<h3 className="text-3xl font-black text-foreground mb-1">{judgeModeText}</h3>
					<p className="text-muted-foreground font-medium">Judging Mode</p>
				</div>

				<div className="group p-8 bg-card/50 backdrop-blur-sm border border-border rounded-3xl hover:border-amber-500/30 transition-all hover:shadow-2xl hover:-translate-y-1">
					<div className="p-3 bg-amber-500/10 rounded-2xl w-fit mb-4 group-hover:bg-amber-500/20 transition-colors">
						<HelpCircle className="w-6 h-6 text-amber-500" />
					</div>
					<h3 className="text-3xl font-black text-foreground mb-1">Ties?</h3>
					<p className="text-muted-foreground font-medium">Joint Winners System</p>
				</div>
			</motion.div>
		</div>
	);
}
