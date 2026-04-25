"use client";

import { cn } from "@/lib/utils";
import type { Competitor } from "@/lib/types";
import { motion } from "framer-motion";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { Badge } from "@/components/ui/badge";

interface CompetitorCardProps {
	competitor: Competitor;
	rank: number | null;
	onSelect: () => void;
	disabled: boolean;
	isAssistant?: boolean;
}

// 20 distinct vibrant colors so cards never look the same, even with large selections
const CARD_COLORS = [
	"bg-amber-500 border-amber-400 shadow-lg shadow-amber-500/50",
	"bg-emerald-500 border-emerald-400 shadow-lg shadow-emerald-500/50",
	"bg-rose-500 border-rose-400 shadow-lg shadow-rose-500/50",
	"bg-sky-500 border-sky-400 shadow-lg shadow-sky-500/50",
	"bg-violet-500 border-violet-400 shadow-lg shadow-violet-500/50",
	"bg-pink-500 border-pink-400 shadow-lg shadow-pink-500/50",
	"bg-teal-500 border-teal-400 shadow-lg shadow-teal-500/50",
	"bg-orange-500 border-orange-400 shadow-lg shadow-orange-500/50",
	"bg-indigo-500 border-indigo-400 shadow-lg shadow-indigo-500/50",
	"bg-lime-500 border-lime-400 shadow-lg shadow-lime-500/50",
	"bg-fuchsia-500 border-fuchsia-400 shadow-lg shadow-fuchsia-500/50",
	"bg-cyan-500 border-cyan-400 shadow-lg shadow-cyan-500/50",
	"bg-red-500 border-red-400 shadow-lg shadow-red-500/50",
	"bg-green-500 border-green-400 shadow-lg shadow-green-500/50",
	"bg-blue-500 border-blue-400 shadow-lg shadow-blue-500/50",
	"bg-yellow-500 border-yellow-400 shadow-lg shadow-yellow-500/50",
	"bg-purple-500 border-purple-400 shadow-lg shadow-purple-500/50",
	"bg-stone-500 border-stone-400 shadow-lg shadow-stone-500/50",
	"bg-rose-600 border-rose-500 shadow-lg shadow-rose-600/50",
	"bg-emerald-600 border-emerald-500 shadow-lg shadow-emerald-600/50",
];

function getCardColor(rank: number): string {
	// Use modulo to cycle through colors, but offset so adjacent ranks look different
	const index = (rank - 1) % CARD_COLORS.length;
	return CARD_COLORS[index];
}

export function CompetitorCard({
	competitor,
	rank,
	onSelect,
	disabled,
	isAssistant = false,
}: CompetitorCardProps) {
	const cardColor = rank ? getCardColor(rank) : "";

	// Assistant styling - amber border, not selectable
	if (isAssistant) {
		return (
			<div
				className={cn(
					"relative w-full p-3 rounded-xl border-2 transition-all",
					"flex flex-col items-center gap-2",
					"bg-amber-500/10 border-amber-500/40 opacity-70 cursor-not-allowed",
				)}
			>
				<div className="w-20 h-20 rounded-full overflow-hidden bg-muted border-2 border-amber-500/30">
					<PlaceholderAvatar
						src={competitor.photoUrl}
						alt={competitor.name}
						name={competitor.name}
						className="w-full h-full"
					/>
				</div>

				<div className="text-center">
					<p className="text-2xl font-bold text-amber-500">
						#{competitor.number}
					</p>
					<p className="text-sm truncate max-w-[120px] text-muted-foreground">
						{competitor.name}
					</p>
					<Badge
						variant="outline"
						className="mt-1 bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs"
					>
						Assistant
					</Badge>
				</div>
			</div>
		);
	}

	return (
		<motion.button
			onClick={onSelect}
			disabled={disabled && !rank}
			whileTap={{ scale: 0.98 }}
			whileHover={rank ? { scale: 1.03 } : { scale: 1.01 }}
			className={cn(
				"relative w-full p-2 sm:p-3 rounded-xl border-2 transition-all touch-manipulation",
				"flex flex-col items-center gap-1 sm:gap-2",
				rank
					? `${cardColor} text-white ring-2 ring-white/30`
					: "bg-card border-border hover:border-primary/50",
				disabled && !rank && "opacity-50 cursor-not-allowed",
			)}
		>
			{rank && (
				<div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-foreground text-background flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg ring-2 ring-white/50">
					{rank}
				</div>
			)}

			<div className="w-12 h-12 sm:w-16 sm:h-16 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full overflow-hidden bg-muted border-2 border-background/20">
				<PlaceholderAvatar
					src={competitor.photoUrl}
					alt={competitor.name}
					name={competitor.name}
					className="w-full h-full"
				/>
			</div>

			<div className="text-center">
				<p
					className={cn(
						"text-lg sm:text-xl md:text-lg font-bold",
						rank ? "text-white" : "text-foreground",
					)}
				>
					#{competitor.number}
				</p>
				<p
					className={cn(
						"text-sm truncate max-w-[120px]",
						rank ? "text-white/90" : "text-muted-foreground",
					)}
				>
					{competitor.name}
				</p>
			</div>
		</motion.button>
	);
}
