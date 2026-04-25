"use client";

import type { Event, RoundType } from "@/lib/types";
import { motion } from "framer-motion";
import { Circle, CheckCircle2, Loader2, RotateCw } from "lucide-react";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { Badge } from "@/components/ui/badge";
import { getRoundNames, getRotationsForRound } from "@/lib/competition-config";

interface LiveStatusSlideProps {
	event: Event;
}


export function LiveStatusSlide({ event }: LiveStatusSlideProps) {
	const currentHeat = event.heats.find(
		(h) => h.number === event.currentHeat && h.round === event.currentRound
	);
	const roundHeats = event.heats.filter(
		(h) => h.round === event.currentRound
	);
	const totalJudges = event.judges.length;
	const currentRotation = event.currentRotation || 1;
	const totalRotations =
		currentHeat?.totalRotations || getRotationsForRound(event, event.currentRound);
	const roundNames = getRoundNames(event);

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
			{/* Round Name */}
			<motion.div
				className="text-center mb-8"
				initial={{ opacity: 0, y: -30 }}
				animate={{ opacity: 1, y: 0 }}
			>
				<h1 className="text-5xl md:text-7xl font-bold text-foreground mb-2">
					{roundNames[event.currentRound]}
				</h1>
				{currentHeat && (
					<p className="text-3xl text-muted-foreground">
						Heat {currentHeat.number} of {roundHeats.length}
					</p>
				)}
			</motion.div>

			{/* Rotation Indicator */}
			<motion.div
				className="flex items-center gap-3 mb-8"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.2 }}
			>
				<RotateCw className="w-8 h-8 text-amber-500" />
				<span className="text-3xl font-bold text-amber-500">
					Rotation {currentRotation}/{totalRotations}
				</span>
			</motion.div>

			{/* Rotation Progress Bar */}
			<motion.div
				className="flex gap-2 mb-8"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.25 }}
			>
				{Array.from({ length: totalRotations }, (_, i) => i + 1).map(
					(rotation) => (
						<div
							key={rotation}
							className={`w-16 h-3 rounded-full ${
								rotation === currentRotation
									? "bg-amber-500"
									: rotation < currentRotation
									? "bg-emerald-500"
									: "bg-muted-foreground/30"
							}`}
						/>
					)
				)}
			</motion.div>

			{/* Voting Status */}
			<motion.div
				className={`px-12 py-6 rounded-2xl mb-12 ${
					event.votingOpen
						? "bg-emerald-500/20 border-2 border-emerald-500"
						: "bg-muted"
				}`}
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ delay: 0.3 }}
			>
				<div className="flex items-center gap-4">
					{event.votingOpen ? (
						<Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
					) : (
						<Circle className="w-10 h-10 text-muted-foreground" />
					)}
					<span
						className={`text-4xl font-bold ${
							event.votingOpen
								? "text-emerald-400"
								: "text-muted-foreground"
						}`}
					>
						{event.votingOpen ? "VOTING OPEN" : "VOTING CLOSED"}
					</span>
				</div>
			</motion.div>

			{/* Current Couples */}
			{currentHeat && (
				<motion.div
					className="w-full max-w-5xl"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.5 }}
				>
					<h2 className="text-2xl font-semibold text-muted-foreground mb-6 text-center">
						Now Dancing
					</h2>
					<div className="grid grid-cols-5 gap-4">
						{currentHeat.couples.map((couple, idx) => {
							const isMaleAssistant =
								couple.maleCompetitor.isCompAssistant;
							const isFemaleAssistant =
								couple.femaleCompetitor.isCompAssistant;

							return (
								<motion.div
									key={couple.id}
									className={`bg-muted rounded-xl p-4 text-center ${
										isMaleAssistant || isFemaleAssistant
											? "ring-1 ring-amber-500/30"
											: ""
									}`}
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.6 + idx * 0.1 }}
								>
									<div className="flex items-center justify-center gap-2 mb-3">
										<div
											className={`w-12 h-12 rounded-full overflow-hidden border-2 ${
												isMaleAssistant
													? "border-amber-500"
													: "border-primary"
											}`}
										>
											<PlaceholderAvatar
												src={
													couple.maleCompetitor
														.photoUrl
												}
												alt=""
												name={
													couple.maleCompetitor.name
												}
												className="w-full h-full"
											/>
										</div>
										<span className="text-muted-foreground">
											+
										</span>
										<div
											className={`w-12 h-12 rounded-full overflow-hidden border-2 ${
												isFemaleAssistant
													? "border-amber-500"
													: "border-accent"
											}`}
										>
											<PlaceholderAvatar
												src={
													couple.femaleCompetitor
														.photoUrl
												}
												alt=""
												name={
													couple.femaleCompetitor.name
												}
												className="w-full h-full"
											/>
										</div>
									</div>
									<p className="text-lg font-bold text-foreground">
										<span
											className={
												isMaleAssistant
													? "text-amber-500"
													: ""
											}
										>
											#{couple.maleCompetitor.number}
										</span>
										{" & "}
										<span
											className={
												isFemaleAssistant
													? "text-amber-500"
													: ""
											}
										>
											#{couple.femaleCompetitor.number}
										</span>
									</p>
									{(isMaleAssistant || isFemaleAssistant) && (
										<Badge
											variant="outline"
											className="mt-1 bg-amber-500/20 text-amber-600 border-amber-500/50 text-xs"
										>
											{isMaleAssistant &&
											isFemaleAssistant
												? "Both Assistants"
												: "Assistant"}
										</Badge>
									)}
								</motion.div>
							);
						})}
					</div>
				</motion.div>
			)}

			{/* Judges Counter */}
			{currentHeat && (
				<motion.div
					className="mt-12 flex items-center gap-4"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 1 }}
				>
					<span className="text-xl text-muted-foreground">
						Judges Submitted:
					</span>
					<div className="flex gap-2">
						{Array.from({ length: totalJudges }).map((_, idx) => (
							<div key={idx}>
								{idx <
								(currentHeat.judgesSubmitted.length || 0) ? (
									<CheckCircle2 className="w-8 h-8 text-emerald-500" />
								) : (
									<Circle className="w-8 h-8 text-muted-foreground" />
								)}
							</div>
						))}
					</div>
					<span className="text-xl font-bold text-foreground">
						{currentHeat.judgesSubmitted.length || 0} /{" "}
						{totalJudges}
					</span>
				</motion.div>
			)}
		</div>
	);
}
