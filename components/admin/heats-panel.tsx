"use client";

import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Heat, RoundType } from "@/lib/types";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { ChevronDown, ChevronUp, RotateCw } from "lucide-react";

interface HeatsPanelProps {
	heats: Heat[];
	currentHeat: number;
	currentRotation?: number;
	totalJudges: number;
}

// Get total rotations for each round
function getTotalRotations(round: RoundType): number {
	switch (round) {
		case "round1":
			return 3;
		case "round2":
			return 2;
		case "finals":
			return 2;
		default:
			return 3;
	}
}

export function HeatsPanel({
	heats,
	currentHeat,
	currentRotation = 1,
	totalJudges,
}: HeatsPanelProps) {
	const [expandedHeats, setExpandedHeats] = useState<Set<string>>(new Set());

	const toggleHeat = (heatId: string) => {
		setExpandedHeats((prev) => {
			const next = new Set(prev);
			if (next.has(heatId)) {
				next.delete(heatId);
			} else {
				next.add(heatId);
			}
			return next;
		});
	};

	if (heats.length === 0) {
		return (
			<Card className="border-border bg-card">
				<CardHeader>
					<CardTitle className="text-foreground">
						Heats & Rotations
					</CardTitle>
					<CardDescription>
						Generate rotations to see heats
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-center text-muted-foreground py-8">
						No heats generated yet. Use the Round Control panel to
						generate rotations.
					</p>
				</CardContent>
			</Card>
		);
	}

	// Check if this is finals
	const isFinals = heats.some(
		(h) =>
			h.round === "finals" &&
			h.finalsCouples &&
			h.finalsCouples.length > 0,
	);

	return (
		<Card className="border-border bg-card">
			<CardHeader>
				<CardTitle className="text-foreground">
					Heats & Rotations
				</CardTitle>
				<CardDescription>
					{heats.length} heats with{" "}
					{getTotalRotations(heats[0]?.round || "round1")} rotations
					each
					{isFinals && " - Finals: Competitors dance with judges"}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{heats.map((heat) => {
						const isFinalsHeat =
							heat.round === "finals" &&
							heat.finalsCouples &&
							heat.finalsCouples.length > 0;
						const totalRotations =
							heat.totalRotations ||
							getTotalRotations(heat.round);
						const isExpanded = expandedHeats.has(heat.id);
						const isCurrentHeat = heat.number === currentHeat;

						return (
							<div
								key={heat.id}
								className={`rounded-lg border ${
									isCurrentHeat
										? "border-primary bg-primary/10"
										: "border-border bg-muted"
								}`}
							>
								{/* Heat Header */}
								<div
									className="p-4 cursor-pointer"
									onClick={() => toggleHeat(heat.id)}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<h4 className="font-semibold text-foreground">
												Heat {heat.number}
											</h4>
											{isFinalsHeat &&
												heat.finalistGender && (
													<span className="text-sm text-muted-foreground">
														(
														{heat.finalistGender ===
														"male"
															? "Male Finalists + Female Judges"
															: "Female Finalists + Male Judges"}
														)
													</span>
												)}
										</div>
										<div className="flex items-center gap-2">
											<Badge
												variant="outline"
												className="bg-transparent"
											>
												<RotateCw className="w-3 h-3 mr-1" />
												{totalRotations} rotations
											</Badge>
											<Badge
												variant={
													heat.votingStatus ===
													"submitted"
														? "default"
														: "secondary"
												}
												className={
													heat.votingStatus ===
													"submitted"
														? "bg-emerald-500 text-white"
														: ""
												}
											>
												{heat.votingStatus ===
												"submitted"
													? "Complete"
													: "Pending"}
											</Badge>
											{isExpanded ? (
												<ChevronUp className="w-4 h-4 text-muted-foreground" />
											) : (
												<ChevronDown className="w-4 h-4 text-muted-foreground" />
											)}
										</div>
									</div>

									{/* Current rotation indicator for current heat */}
									{isCurrentHeat && (
										<div className="mt-2 flex gap-1">
											{Array.from(
												{ length: totalRotations },
												(_, i) => i + 1,
											).map((rotation) => (
												<div
													key={rotation}
													className={`h-1 flex-1 rounded ${
														rotation ===
														currentRotation
															? "bg-amber-500"
															: rotation <
																  currentRotation
																? "bg-emerald-500"
																: "bg-muted-foreground/30"
													}`}
												/>
											))}
										</div>
									)}
								</div>

								{/* Expanded Rotations */}
								{isExpanded && heat.rotations && (
									<div className="border-t border-border p-4 space-y-4">
										{heat.rotations.map((rotation) => {
											const isCurrentRotation =
												isCurrentHeat &&
												rotation.number ===
													currentRotation;
											const couples = isFinalsHeat
												? rotation.finalsCouples
												: rotation.couples;

											return (
												<div
													key={rotation.number}
													className={`p-3 rounded-lg ${
														isCurrentRotation
															? "bg-amber-500/10 border border-amber-500"
															: "bg-background"
													}`}
												>
													<div className="flex items-center gap-2 mb-3">
														<Badge
															variant={
																isCurrentRotation
																	? "default"
																	: "outline"
															}
															className={
																isCurrentRotation
																	? "bg-amber-500"
																	: "bg-transparent"
															}
														>
															Rotation{" "}
															{rotation.number}/
															{totalRotations}
														</Badge>
														{isCurrentRotation && (
															<span className="text-xs text-amber-500 font-medium">
																Current
															</span>
														)}
													</div>

													<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
														{isFinalsHeat &&
														rotation.finalsCouples
															? rotation.finalsCouples.map(
																	(
																		couple,
																		idx,
																	) => (
																		<div
																			key={
																				couple.id
																			}
																			className="flex items-center gap-2 p-2 bg-muted rounded border border-border"
																		>
																			<span className="text-xs text-muted-foreground w-4">
																				{idx +
																					1}

																				.
																			</span>
																			<div className="flex items-center gap-1">
																				<PlaceholderAvatar
																					src={
																						couple
																							.competitor
																							.photoUrl
																					}
																					alt=""
																					name={
																						couple
																							.competitor
																							.name
																					}
																					className="w-6 h-6 rounded-full"
																				/>
																				<div className="flex flex-col">
																					<span className="text-sm font-medium text-foreground">
																						#
																						{
																							couple
																								.competitor
																								.number
																						}
																					</span>
																					<span className="text-[10px] text-muted-foreground">
																						{
																							couple.competitor.name.split(
																								" ",
																							)[0]
																						}
																					</span>
																				</div>
																			</div>
																			<span className="text-muted-foreground">
																				+
																			</span>
																			<div className="flex items-center gap-1 text-amber-500">
																				<PlaceholderAvatar
																					src={
																						couple
																							.judge
																							.photoUrl
																					}
																					alt=""
																					name={
																						couple
																							.judge
																							.name
																					}
																					className="w-6 h-6 rounded-full border border-amber-500"
																				/>
																				<div className="flex flex-col">
																					<span className="text-sm font-medium">
																						Judge
																					</span>
																					<span className="text-[10px]">
																						{
																							couple.judge.name.split(
																								" ",
																							)[0]
																						}
																					</span>
																				</div>
																			</div>
																		</div>
																	),
																)
															: rotation.couples?.map(
																	(
																		couple,
																		idx,
																	) => {
																		const isMaleAssistant =
																			couple
																				.maleCompetitor
																				.isCompAssistant;
																		const isFemaleAssistant =
																			couple
																				.femaleCompetitor
																				.isCompAssistant;

																		return (
																			<div
																				key={
																					couple.id
																				}
																				className={`flex items-center gap-2 p-2 bg-muted rounded border ${
																					isMaleAssistant ||
																					isFemaleAssistant
																						? "border-amber-500/50"
																						: "border-border"
																				}`}
																			>
																				<span className="text-xs text-muted-foreground w-4">
																					{idx +
																						1}

																					.
																				</span>
																				<div className="flex items-center gap-1">
																					<PlaceholderAvatar
																						src={
																							couple
																								.maleCompetitor
																								.photoUrl
																						}
																						alt=""
																						name={
																							couple
																								.maleCompetitor
																								.name
																						}
																						className={`w-6 h-6 rounded-full ${
																							isMaleAssistant
																								? "ring-1 ring-amber-500"
																								: ""
																						}`}
																					/>
																					<span
																						className={`text-sm font-medium ${
																							isMaleAssistant
																								? "text-amber-500"
																								: "text-foreground"
																						}`}
																					>
																						#
																						{
																							couple
																								.maleCompetitor
																								.number
																						}
																						{isMaleAssistant && (
																							<span className="text-[10px] ml-0.5">
																								(A)
																							</span>
																						)}
																					</span>
																				</div>
																				<span className="text-muted-foreground">
																					+
																				</span>
																				<div className="flex items-center gap-1">
																					<PlaceholderAvatar
																						src={
																							couple
																								.femaleCompetitor
																								.photoUrl
																						}
																						alt=""
																						name={
																							couple
																								.femaleCompetitor
																								.name
																						}
																						className={`w-6 h-6 rounded-full ${
																							isFemaleAssistant
																								? "ring-1 ring-amber-500"
																								: ""
																						}`}
																					/>
																					<span
																						className={`text-sm font-medium ${
																							isFemaleAssistant
																								? "text-amber-500"
																								: "text-foreground"
																						}`}
																					>
																						#
																						{
																							couple
																								.femaleCompetitor
																								.number
																						}
																						{isFemaleAssistant && (
																							<span className="text-[10px] ml-0.5">
																								(A)
																							</span>
																						)}
																					</span>
																				</div>
																			</div>
																		);
																	},
																)}
													</div>
												</div>
											);
										})}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
