"use client";

import { Badge } from "@/components/ui/badge";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import type { Judge, Heat, RoundType } from "@/lib/types";

interface JudgeHeaderProps {
	judge: Judge;
	currentHeat: Heat | null;
	roundName: string;
	totalHeats: number;
	votingOpen: boolean;
}

export function JudgeHeader({
	judge,
	currentHeat,
	roundName,
	totalHeats,
	votingOpen,
}: JudgeHeaderProps) {
	return (
		<header className="bg-card border-b border-border sticky top-0 z-50">
			<div className="px-3 sm:px-4 py-2 sm:py-3">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 sm:gap-3 min-w-0">
						<div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted overflow-hidden shrink-0">
							<PlaceholderAvatar
								src={judge.photoUrl || "/placeholder.svg"}
								alt={judge.name}
								name={judge.name}
								className="w-full h-full"
							/>
						</div>
						<div className="min-w-0">
							<p className="font-semibold text-foreground text-sm sm:text-base truncate">
								{judge.name}
							</p>
							<p className="text-xs text-muted-foreground capitalize">
								{judge.gender} Judge
							</p>
						</div>
					</div>
					<Badge
						variant={votingOpen ? "default" : "secondary"}
						className={`shrink-0 text-xs ${
							votingOpen ? "bg-emerald-500 text-white" : ""
						}`}
					>
						{votingOpen ? "Open" : "Closed"}
					</Badge>
				</div>

				{currentHeat && (
					<div className="mt-2 sm:mt-3 p-2 bg-muted rounded-lg">
						<div className="flex items-center justify-between">
							<p className="text-xs sm:text-sm font-medium text-foreground">
								{roundName}
							</p>
							<p className="text-[10px] text-muted-foreground font-mono">
								HEAT {currentHeat.number} / {totalHeats}
							</p>
						</div>
					</div>
				)}
			</div>
		</header>
	);
}
