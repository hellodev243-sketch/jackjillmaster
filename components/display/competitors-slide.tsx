"use client";

import type { Competitor } from "@/lib/types";
import { motion } from "framer-motion";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";

interface CompetitorsSlideProps {
	competitors: Competitor[];
	gender: "male" | "female";
}

export function CompetitorsSlide({
	competitors,
	gender,
}: CompetitorsSlideProps) {
	const filtered = competitors
		.filter((c) => c.gender === gender)
		.sort((a, b) => a.number - b.number); // Sort by competitor number

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
			<motion.h1
				className="text-5xl md:text-6xl font-bold text-foreground mb-4"
				initial={{ opacity: 0, y: -30 }}
				animate={{ opacity: 1, y: 0 }}
			>
				{gender === "male" ? "Male" : "Female"} Competitors
			</motion.h1>

			<motion.p
				className="text-xl text-muted-foreground mb-8"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.2 }}
			>
				{filtered.length} dancers competing
			</motion.p>

			<motion.div
				className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4 max-w-7xl"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.3 }}
			>
				{filtered.map((competitor, idx) => (
					<motion.div
						key={competitor.id}
						className="text-center"
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: 0.4 + idx * 0.05 }}
					>
						<div
							className={`w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden border-2 mx-auto mb-2 ${
								gender === "male"
									? "border-primary"
									: "border-accent"
							}`}
						>
							<PlaceholderAvatar
								src={competitor.photoUrl}
								alt={competitor.name}
								name={competitor.name}
								className="w-full h-full"
							/>
						</div>
						<p className="text-xl md:text-2xl font-bold text-foreground">
							#{competitor.number}
						</p>
						<p className="text-xs text-muted-foreground truncate max-w-[100px] mx-auto">
							{competitor.name}
						</p>
					</motion.div>
				))}
			</motion.div>
		</div>
	);
}
