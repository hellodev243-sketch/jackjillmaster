"use client";

import type { Judge } from "@/lib/types";
import { motion } from "framer-motion";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";

interface JudgesSlideProps {
	judges: Judge[];
}

export function JudgesSlide({ judges }: JudgesSlideProps) {
	const maleJudges = judges.filter((j) => j.gender === "male");
	const femaleJudges = judges.filter((j) => j.gender === "female");

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8 pt-20 md:p-8 md:pt-20">
			<motion.h1
				className="text-4xl sm:text-5xl md:text-7xl font-bold text-foreground mb-6 md:mb-12 text-center"
				initial={{ opacity: 0, y: -30 }}
				animate={{ opacity: 1, y: 0 }}
			>
				Meet Your Judges
			</motion.h1>

			<div className="flex flex-col lg:flex-row gap-6 lg:gap-16 max-w-6xl w-full">
				{/* Male Judges */}
				<motion.div
					className="flex-1"
					initial={{ opacity: 0, x: -50 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: 0.3 }}
				>
					<h2 className="text-xl md:text-2xl font-semibold text-primary mb-4 md:mb-6 text-center">
						Male Judges
					</h2>
					<div className="grid grid-cols-3 gap-2 md:gap-4">
						{maleJudges.map((judge, idx) => (
							<motion.div
								key={judge.id}
								className="text-center"
								initial={{ opacity: 0, y: 30 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.4 + idx * 0.15 }}
							>
								<div className="w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden border-2 md:border-4 border-primary mx-auto mb-1 md:mb-3 shadow-lg shadow-primary/20">
									<PlaceholderAvatar
										src={judge.photoUrl}
										alt={judge.name}
										name={judge.name}
										className="w-full h-full"
									/>
								</div>
								<p className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-foreground truncate px-1">
									{judge.name}
								</p>
							</motion.div>
						))}
					</div>
				</motion.div>

				{/* Divider */}
				<div className="hidden lg:block w-px bg-border" />
				<div className="lg:hidden h-px bg-border mx-8" />

				{/* Female Judges */}
				<motion.div
					className="flex-1"
					initial={{ opacity: 0, x: 50 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: 0.3 }}
				>
					<h2 className="text-xl md:text-2xl font-semibold text-accent mb-4 md:mb-6 text-center">
						Female Judges
					</h2>
					<div className="grid grid-cols-3 gap-2 md:gap-4">
						{femaleJudges.map((judge, idx) => (
							<motion.div
								key={judge.id}
								className="text-center"
								initial={{ opacity: 0, y: 30 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.4 + idx * 0.15 }}
							>
								<div className="w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden border-2 md:border-4 border-accent mx-auto mb-1 md:mb-3 shadow-lg shadow-accent/20">
									<PlaceholderAvatar
										src={judge.photoUrl}
										alt={judge.name}
										name={judge.name}
										className="w-full h-full"
									/>
								</div>
								<p className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-foreground truncate px-1">
									{judge.name}
								</p>
							</motion.div>
						))}
					</div>
				</motion.div>
			</div>
		</div>
	);
}
