"use client";

import type { Competitor } from "@/lib/types";
import { motion } from "framer-motion";
import { Trophy, PartyPopper } from "lucide-react";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";

interface CelebrationSlideProps {
	maleWinner: Competitor | null;
	femaleWinner: Competitor | null;
	eventName: string;
}

export function CelebrationSlide({
	maleWinner,
	femaleWinner,
	eventName,
}: CelebrationSlideProps) {
	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-b from-background via-amber-950/20 to-background p-8 relative overflow-hidden">
			{/* Confetti effect */}
			<motion.div className="absolute inset-0 pointer-events-none">
				{Array.from({ length: 50 }).map((_, i) => (
					<motion.div
						key={i}
						className={`absolute w-3 h-3 rounded-sm ${
							[
								"bg-amber-500",
								"bg-primary",
								"bg-accent",
								"bg-emerald-500",
							][i % 4]
						}`}
						style={{
							left: `${Math.random() * 100}%`,
							top: -20,
						}}
						animate={{
							y: ["0vh", "120vh"],
							rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
							x: [0, (Math.random() - 0.5) * 200],
						}}
						transition={{
							duration: 3 + Math.random() * 3,
							repeat: Number.POSITIVE_INFINITY,
							delay: Math.random() * 3,
							ease: "linear",
						}}
					/>
				))}
			</motion.div>

			<motion.div
				className="text-center relative z-10"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
			>
				<motion.div
					className="flex items-center justify-center gap-4 mb-8"
					initial={{ y: -50, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					transition={{ delay: 0.3 }}
				>
					<PartyPopper className="w-12 h-12 text-amber-500" />
					<h1 className="text-5xl md:text-7xl font-bold text-foreground">
						Congratulations!
					</h1>
					<PartyPopper className="w-12 h-12 text-amber-500 scale-x-[-1]" />
				</motion.div>

				<motion.p
					className="text-2xl text-muted-foreground mb-12"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.5 }}
				>
					{eventName} Champions
				</motion.p>

				<div className="flex flex-col md:flex-row items-center justify-center gap-12">
					{/* Male Winner */}
					{maleWinner && (
						<motion.div
							className="text-center"
							initial={{ x: -100, opacity: 0 }}
							animate={{ x: 0, opacity: 1 }}
							transition={{ delay: 0.7 }}
						>
							<div className="w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden border-6 border-primary mx-auto mb-4 shadow-xl shadow-primary/30">
								<PlaceholderAvatar
									src={maleWinner.photoUrl}
									alt={maleWinner.name}
									name={maleWinner.name}
									className="w-full h-full"
								/>
							</div>
							<Trophy className="w-10 h-10 text-amber-500 mx-auto mb-2" />
							<p className="text-4xl font-bold text-foreground">
								#{maleWinner.number}
							</p>
							<p className="text-xl text-muted-foreground">
								{maleWinner.name}
							</p>
							<p className="text-lg text-primary mt-1">
								Male Champion
							</p>
						</motion.div>
					)}

					{/* Trophy in middle */}
					<motion.div
						initial={{ scale: 0 }}
						animate={{ scale: 1 }}
						transition={{ delay: 1, type: "spring" }}
					>
						<img
							src="/jack-and-jill-logo-transparent.png"
							alt="Jack & Jill"
							className="w-24 h-24 md:w-32 md:h-32 object-contain"
						/>
					</motion.div>

					{/* Female Winner */}
					{femaleWinner && (
						<motion.div
							className="text-center"
							initial={{ x: 100, opacity: 0 }}
							animate={{ x: 0, opacity: 1 }}
							transition={{ delay: 0.7 }}
						>
							<div className="w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden border-6 border-emerald-500 mx-auto mb-4 shadow-xl shadow-emerald-500/30">
								<PlaceholderAvatar
									src={femaleWinner.photoUrl}
									alt={femaleWinner.name}
									name={femaleWinner.name}
									className="w-full h-full"
								/>
							</div>
							<Trophy className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
							<p className="text-4xl font-bold text-foreground">
								#{femaleWinner.number}
							</p>
							<p className="text-xl text-muted-foreground">
								{femaleWinner.name}
							</p>
							<p className="text-lg text-emerald-500 mt-1">
								Female Champion
							</p>
						</motion.div>
					)}
				</div>
			</motion.div>
		</div>
	);
}
