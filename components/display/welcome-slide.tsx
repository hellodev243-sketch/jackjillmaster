"use client";

import type { Event } from "@/lib/types";
import { motion } from "framer-motion";

interface WelcomeSlideProps {
	event: Event;
}

export function WelcomeSlide({ event }: WelcomeSlideProps) {
	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 pt-20 pb-24 md:p-8 md:pt-20">
			<motion.div
				initial={{ opacity: 0, y: 30 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.8 }}
				className="text-center"
			>
				<motion.div
					initial={{ scale: 0 }}
					animate={{ scale: 1 }}
					transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
					className="mb-6"
				>
					<img
						src="/jack-and-jill-logo-transparent.png"
						alt="Jack & Jill"
						className="w-24 h-24 md:w-32 md:h-32 mx-auto object-contain"
					/>
				</motion.div>

				<motion.h1
					className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold text-foreground mb-4 md:mb-6 text-balance"
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ delay: 0.3, duration: 0.6 }}
				>
					Jack & Jill
				</motion.h1>

				<motion.div
					className="h-1 w-32 md:w-48 bg-primary mx-auto mb-6 md:mb-8"
					initial={{ scaleX: 0 }}
					animate={{ scaleX: 1 }}
					transition={{ delay: 0.5, duration: 0.6 }}
				/>

				<motion.h2
					className="text-xl sm:text-2xl md:text-4xl lg:text-5xl text-foreground mb-3 md:mb-4"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.7 }}
				>
					{event.name}
				</motion.h2>

				<motion.div
					className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground space-y-1 md:space-y-2"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.9 }}
				>
					<p>{event.venue}</p>
					<p>
						{new Date(event.date).toLocaleDateString("en-US", {
							dateStyle: "long",
						})}
					</p>
				</motion.div>

				<motion.div
					className="mt-8 md:mt-12 flex justify-center gap-6 md:gap-8"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 1.1 }}
				>
					<div className="text-center">
						<p className="text-3xl md:text-5xl font-bold text-primary">
							{event.competitors.length}
						</p>
						<p className="text-sm md:text-base text-muted-foreground">
							Competitors
						</p>
					</div>
					<div className="text-center">
						<p className="text-3xl md:text-5xl font-bold text-primary">
							{event.judges.length}
						</p>
						<p className="text-sm md:text-base text-muted-foreground">
							Judges
						</p>
					</div>
				</motion.div>
			</motion.div>
		</div>
	);
}
