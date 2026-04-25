"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Competitor, RoundType, Vote } from "@/lib/types";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";
import { Check, X, ArrowUp, ArrowDown, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TieUpPanelProps {
	competitors: Competitor[];
	gender: "male" | "female";
	round: RoundType;
	votes: Vote[];
	maxAdvancing?: number;
	scoreLabel?: string;
	onSave: (selectedIds: string[]) => Promise<boolean>;
	onCancel: () => void;
}

export function TieUpPanel({
	competitors,
	gender,
	round,
	votes,
	maxAdvancing,
	scoreLabel = "votes",
	onSave,
	onCancel,
}: TieUpPanelProps) {
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);

	// Use the dynamic maxAdvancing from the competition config, fallback to competitor count
	const maxSelect = maxAdvancing || competitors.length;
	// Competitors are already filtered by gender and sorted by vote count from ResultsPanel
	const genderCompetitors = competitors;

	const handleToggleSelect = (competitorId: string) => {
		setSelectedIds((prev) => {
			if (prev.includes(competitorId)) {
				return prev.filter((id) => id !== competitorId);
			} else if (prev.length < maxSelect) {
				return [...prev, competitorId];
			}
			return prev;
		});
	};

	const handleMoveUp = (competitorId: string) => {
		setSelectedIds((prev) => {
			const index = prev.indexOf(competitorId);
			if (index > 0) {
				const newOrder = [...prev];
				[newOrder[index - 1], newOrder[index]] = [
					newOrder[index],
					newOrder[index - 1],
				];
				return newOrder;
			}
			return prev;
		});
	};

	const handleMoveDown = (competitorId: string) => {
		setSelectedIds((prev) => {
			const index = prev.indexOf(competitorId);
			if (index < prev.length - 1 && index !== -1) {
				const newOrder = [...prev];
				[newOrder[index], newOrder[index + 1]] = [
					newOrder[index + 1],
					newOrder[index],
				];
				return newOrder;
			}
			return prev;
		});
	};

	const handleSave = async () => {
		if (selectedIds.length !== maxSelect) return;
		setSaving(true);
		const success = await onSave(selectedIds);
		setSaving(false);
		if (success) {
			// Panel will be closed by parent
		}
	};

	const roundName =
		round === "round1"
			? "Round 1"
			: round === "round2"
				? "Semi-Finals"
				: "Finals";

	return (
		<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
			<Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
				<CardHeader className="border-b">
					<CardTitle className="flex items-center justify-between">
						<span>
							Tie-Up Selection - {roundName} (
							{gender === "male" ? "Male" : "Female"})
						</span>
						<Button variant="ghost" size="sm" onClick={onCancel}>
							<X className="w-4 h-4" />
						</Button>
					</CardTitle>
					<p className="text-sm text-muted-foreground">
						Select exactly {maxSelect} competitors to advance. Click
						to select, then reorder as needed.
					</p>
				</CardHeader>

				<CardContent className="flex-1 overflow-auto p-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Available Competitors */}
						<div>
							<h3 className="text-lg font-semibold mb-4">
								Available Competitors (
								{genderCompetitors.length})
							</h3>
							<div className="space-y-2">
								{genderCompetitors.map((competitor) => {
									const isSelected = selectedIds.includes(
										competitor.id,
									);
									const position =
										selectedIds.indexOf(competitor.id) + 1;

									return (
										<motion.div
											key={competitor.id}
											layout
											className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
												isSelected
													? "border-amber-500 bg-amber-500/10"
													: "border-border hover:border-primary/50"
											}`}
											onClick={() =>
												handleToggleSelect(
													competitor.id,
												)
											}
										>
											<div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border">
												<PlaceholderAvatar
													src={competitor.photoUrl}
													alt={competitor.name}
													name={competitor.name}
													className="w-full h-full"
												/>
											</div>

											<div className="flex-1">
												<p className="font-semibold">
													#{competitor.number} -{" "}
													{competitor.name}
												</p>
												<p className="text-xs text-muted-foreground">
													{competitor.voteCount || 0}{" "}
													{scoreLabel}
												</p>
											</div>

											{isSelected && (
												<div className="flex items-center gap-2">
													<span className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold">
														{position}
													</span>
													<Check className="w-5 h-5 text-amber-500" />
												</div>
											)}
										</motion.div>
									);
								})}
							</div>
						</div>

						{/* Selected Order */}
						<div>
							<h3 className="text-lg font-semibold mb-4">
								Selected ({selectedIds.length}/{maxSelect})
							</h3>
							<div className="space-y-2">
								<AnimatePresence>
									{selectedIds.map((competitorId, index) => {
										const competitor =
											genderCompetitors.find(
												(c) => c.id === competitorId,
											);
										if (!competitor) return null;

										return (
											<motion.div
												key={competitor.id}
												layout
												initial={{ opacity: 0, x: -20 }}
												animate={{ opacity: 1, x: 0 }}
												exit={{ opacity: 0, x: 20 }}
												className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-500 bg-amber-500/10"
											>
												<div className="w-10 h-10 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-lg">
													{index + 1}
												</div>

												<div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500">
													<PlaceholderAvatar
														src={
															competitor.photoUrl
														}
														alt={competitor.name}
														name={competitor.name}
														className="w-full h-full"
													/>
												</div>

												<div className="flex-1">
													<p className="font-semibold">
														#{competitor.number} -{" "}
														{competitor.name}
													</p>
												</div>

												<div className="flex gap-1">
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.stopPropagation();
															handleMoveUp(
																competitor.id,
															);
														}}
														disabled={index === 0}
													>
														<ArrowUp className="w-4 h-4" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.stopPropagation();
															handleMoveDown(
																competitor.id,
															);
														}}
														disabled={
															index ===
															selectedIds.length -
																1
														}
													>
														<ArrowDown className="w-4 h-4" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.stopPropagation();
															handleToggleSelect(
																competitor.id,
															);
														}}
													>
														<X className="w-4 h-4" />
													</Button>
												</div>
											</motion.div>
										);
									})}
								</AnimatePresence>

								{selectedIds.length === 0 && (
									<div className="text-center py-12 text-muted-foreground">
										<p>No competitors selected yet</p>
										<p className="text-sm">
											Click on competitors to select them
										</p>
									</div>
								)}
							</div>
						</div>
					</div>
				</CardContent>

				<div className="border-t p-4 flex items-center justify-between bg-muted/50">
					<div className="text-sm text-muted-foreground">
						{selectedIds.length < maxSelect && (
							<span className="text-amber-500">
								Select {maxSelect - selectedIds.length} more
								competitor(s)
							</span>
						)}
						{selectedIds.length === maxSelect && (
							<span className="text-emerald-500">
								✓ Ready to save
							</span>
						)}
					</div>
					<div className="flex gap-2">
						<Button variant="outline" onClick={onCancel}>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							disabled={
								selectedIds.length !== maxSelect || saving
							}
						>
							<Save className="w-4 h-4 mr-2" />
							{saving ? "Saving..." : "Save Tie-Up Selection"}
						</Button>
					</div>
				</div>
			</Card>
		</div>
	);
}
