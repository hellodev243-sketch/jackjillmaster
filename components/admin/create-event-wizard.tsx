"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
	Calendar as CalendarIcon,
	Check,
	ChevronRight,
	ChevronLeft,
	Loader2,
	MapPin,
	Trophy,
	Plus,
	Trash2,
	ChevronDown,
	ChevronUp,
	GripVertical,
	X,
	RotateCcw,
	Hash,
	Zap,
	Users,
	Sparkles,
	ArrowRight,
	AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { AdminProfile } from "@/lib/admin-types";
import type {
	RoundConfig,
	ScoringCategory,
	ScoringMode,
	PairingMode,
	AnnouncementStyle,
	FinalsJudgeMode,
	CompetitionConfig,
} from "@/lib/types";
import {
	createDefaultConfig,
	createDefaultRound,
	getSortedRounds,
	DEFAULT_SCORING_CATEGORIES,
} from "@/lib/competition-config";

interface CreateEventWizardProps {
	adminProfile?: AdminProfile | null;
	onCreateEvent: (
		name: string,
		date: string,
		venue: string,
		maleStartNumber?: number,
		maleEndNumber?: number,
		femaleStartNumber?: number,
		femaleEndNumber?: number,
		competitionConfig?: any,
	) => Promise<any>;
	onUpdateEvent?: (
		updates: Record<string, any>,
		eventId?: string,
	) => Promise<boolean>;
	onCancel: () => void;
	createdEventId?: string | null;
}

export function CreateEventWizard({
	adminProfile,
	onCreateEvent,
	onUpdateEvent,
	onCancel,
}: CreateEventWizardProps) {
	const [step, setStep] = useState(1);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Step 1 fields
	const [eventName, setEventName] = useState(
		adminProfile?.organizationName || "",
	);
	const [eventDate, setEventDate] = useState(
		new Date().toISOString().split("T")[0],
	);
	const [venue, setVenue] = useState("");
	const [maleStart, setMaleStart] = useState<number | "">(0);
	const [maleEnd, setMaleEnd] = useState<number | "">(0);
	const [femaleStart, setFemaleStart] = useState<number | "">(0);
	const [femaleEnd, setFemaleEnd] = useState<number | "">(0);
	const [showOverlapError, setShowOverlapError] = useState(false);

	// Step 2 fields - Competition Structure
	const [configRounds, setConfigRounds] = useState<RoundConfig[]>(() => {
		const config = createDefaultConfig();
		return getSortedRounds(config);
	});
	const [expandedRounds, setExpandedRounds] = useState<Set<string>>(
		new Set(),
	);

	const totalSteps = 3;
	const hasOverlap =
		maleStart !== "" &&
		maleEnd !== "" &&
		femaleStart !== "" &&
		femaleEnd !== "" &&
		Math.max(maleStart, femaleStart) <= Math.min(maleEnd, femaleEnd);

	const canProceedStep1 = eventName.trim() && eventDate && venue.trim();

	const handleNext = () => {
		if (step === 1 && hasOverlap) {
			setShowOverlapError(true);
			return;
		}
		setShowOverlapError(false);
		if (step < totalSteps) setStep(step + 1);
	};
	const handleBack = () => {
		if (step > 1) setStep(step - 1);
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);
		try {
			const finalizedRounds = configRounds.map((r, i) => {
				if (i === configRounds.length - 1)
					return { ...r, competitorsAdvancing: 0 };
				if (r.competitorsAdvancing === 0)
					return { ...r, competitorsAdvancing: 6 };
				return r;
			});
			const config: CompetitionConfig = {
				rounds: finalizedRounds,
				updatedAt: new Date().toISOString(),
			};
			const result = await onCreateEvent(
				eventName.trim(),
				eventDate,
				venue.trim(),
				maleStart === "" ? undefined : maleStart,
				maleEnd === "" ? undefined : maleEnd,
				femaleStart === "" ? undefined : femaleStart,
				femaleEnd === "" ? undefined : femaleEnd,
				config,
			);
			if (result) onCancel();
		} catch (error) {
			console.error("Failed to create event:", error);
		}
		setIsSubmitting(false);
	};

	// Competition Structure handlers
	const toggleRoundExpanded = (roundId: string) => {
		setExpandedRounds((prev) => {
			const next = new Set(prev);
			if (next.has(roundId)) next.delete(roundId);
			else next.add(roundId);
			return next;
		});
	};

	const updateRound = (roundId: string, updates: Partial<RoundConfig>) => {
		setConfigRounds((prev) =>
			prev.map((r) => (r.id === roundId ? { ...r, ...updates } : r)),
		);
	};

	const addRound = () => {
		const newOrder = configRounds.length + 1;
		const newRound = createDefaultRound(newOrder);
		setConfigRounds((prev) => [...prev, newRound]);
		setExpandedRounds((prev) => new Set(prev).add(newRound.id));
	};

	const removeRound = (roundId: string) => {
		if (configRounds.length <= 1) return;
		setConfigRounds((prev) => {
			const filtered = prev.filter((r) => r.id !== roundId);
			return filtered.map((r, i) => ({ ...r, order: i + 1 }));
		});
	};

	const moveRound = (roundId: string, direction: "up" | "down") => {
		setConfigRounds((prev) => {
			const idx = prev.findIndex((r) => r.id === roundId);
			if (idx === -1) return prev;
			if (direction === "up" && idx === 0) return prev;
			if (direction === "down" && idx === prev.length - 1) return prev;
			const newRounds = [...prev];
			const swapIdx = direction === "up" ? idx - 1 : idx + 1;
			[newRounds[idx], newRounds[swapIdx]] = [
				newRounds[swapIdx],
				newRounds[idx],
			];
			return newRounds.map((r, i) => ({ ...r, order: i + 1 }));
		});
	};

	const addScoringCategory = (roundId: string) => {
		const newCat: ScoringCategory = {
			id: `cat-${Date.now()}`,
			name: "New Category",
			minScore: 1,
			maxScore: 100,
			weight: 1.0,
		};
		updateRound(roundId, {
			scoringCategories: [
				...(configRounds.find((r) => r.id === roundId)
					?.scoringCategories || []),
				newCat,
			],
		});
	};

	const updateScoringCategory = (
		roundId: string,
		catId: string,
		updates: Partial<ScoringCategory>,
	) => {
		const round = configRounds.find((r) => r.id === roundId);
		if (!round) return;
		const updatedCats = (round.scoringCategories || []).map((c) =>
			c.id === catId ? { ...c, ...updates } : c,
		);
		updateRound(roundId, { scoringCategories: updatedCats });
	};

	const removeScoringCategory = (roundId: string, catId: string) => {
		const round = configRounds.find((r) => r.id === roundId);
		if (!round) return;
		updateRound(roundId, {
			scoringCategories: (round.scoringCategories || []).filter(
				(c) => c.id !== catId,
			),
		});
	};

	const handleResetConfig = () => {
		const defaultConfig = createDefaultConfig();
		setConfigRounds(getSortedRounds(defaultConfig));
	};

	const announcementLabel = (style: string) => {
		switch (style) {
			case "all_with_ranking":
				return "All with Ranking";
			case "winners_and_eliminated":
				return "Winners & Eliminated";
			case "winners_only":
				return "Winners Only";
			case "top_3_only":
				return "Top 3 Only";
			default:
				return style;
		}
	};

	const stepLabels = ["Event Details", "Structure", "Review"];

	return (
		<div className="max-w-2xl mx-auto py-8 px-4">
			{/* Modern Progress Steps */}
			<div className="flex items-center justify-center mb-10">
				{stepLabels.map((label, i) => {
					const stepNum = i + 1;
					const isCompleted = stepNum < step;
					const isCurrent = stepNum === step;
					return (
						<div key={label} className="flex items-center">
							<div className="flex flex-col items-center">
								<div
									className={cn(
										"w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-500 ease-out",
										isCompleted
											? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground scale-95"
											: isCurrent
												? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 scale-105 ring-4 ring-primary/10"
												: "bg-muted/60 text-muted-foreground/60 border border-border/50",
									)}
								>
									{isCompleted ? (
										<Check
											className="w-5 h-5"
											strokeWidth={3}
										/>
									) : (
										stepNum
									)}
								</div>
								<span
									className={cn(
										"text-[11px] font-medium mt-2.5 transition-all duration-300",
										isCurrent
											? "text-foreground"
											: isCompleted
												? "text-primary"
												: "text-muted-foreground/50",
									)}
								>
									{label}
								</span>
							</div>
							{i < stepLabels.length - 1 && (
								<div className="relative w-24 mx-4 -mt-5">
									<div className="h-[2px] rounded-full bg-muted/40" />
									<div
										className={cn(
											"absolute inset-y-0 left-0 h-[2px] rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-700 ease-out",
											isCompleted ? "w-full" : "w-0",
										)}
									/>
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Step Content Card */}
			<div className="relative border border-border/60 bg-card/80 backdrop-blur-sm rounded-2xl p-7 shadow-xl shadow-black/5">
				{/* Subtle gradient accent at top */}
				<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent rounded-t-2xl" />

				{/* Step 1: Event Details */}
				{step === 1 && (
					<div className="space-y-6">
						<div className="flex items-start gap-3">
							<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
								<Trophy className="w-5 h-5 text-primary" />
							</div>
							<div>
								<h2 className="text-xl font-bold text-foreground tracking-tight">
									Event Details
								</h2>
								<p className="text-sm text-muted-foreground mt-0.5">
									Tell us about your competition
								</p>
							</div>
						</div>

						<div className="space-y-2">
							<Label className="text-sm font-medium">
								Event Name{" "}
								<span className="text-red-400">*</span>
							</Label>
							<Input
								value={eventName}
								onChange={(e) => setEventName(e.target.value)}
								placeholder="e.g. West Coast Swing Championship 2025"
								className="h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all"
								autoFocus
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label className="text-sm font-medium flex items-center gap-1.5">
									<CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
									Date <span className="text-red-400">*</span>
								</Label>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className="w-full h-11 justify-start text-left font-normal bg-muted/30 border-border/50 hover:bg-muted/50 transition-all"
										>
											<CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
											{eventDate
												? format(
														new Date(
															eventDate +
																"T00:00:00",
														),
														"PPP",
													)
												: "Pick a date"}
										</Button>
									</PopoverTrigger>
									<PopoverContent
										className="w-auto p-0"
										align="start"
									>
										<Calendar
											mode="single"
											selected={
												eventDate
													? new Date(
															eventDate +
																"T00:00:00",
														)
													: undefined
											}
											onSelect={(date) =>
												setEventDate(
													date
														? format(
																date,
																"yyyy-MM-dd",
															)
														: "",
												)
											}
											autoFocus
										/>
									</PopoverContent>
								</Popover>
							</div>
							<div className="space-y-2">
								<Label className="text-sm font-medium flex items-center gap-1.5">
									<MapPin className="w-3.5 h-3.5 text-muted-foreground" />
									Location{" "}
									<span className="text-red-400">*</span>
								</Label>
								<Input
									value={venue}
									onChange={(e) => setVenue(e.target.value)}
									placeholder="Venue, City"
									className="h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all"
								/>
							</div>
						</div>

						{/* Number Ranges - Modern Card Style */}
						<div className="space-y-3">
							<Label className="text-sm font-medium flex items-center gap-1.5">
								<Hash className="w-3.5 h-3.5 text-muted-foreground" />
								Competitor Number Ranges
							</Label>
							<div className="grid grid-cols-2 gap-3">
								{/* Male Range */}
								<div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 space-y-2.5">
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 rounded-full bg-blue-400" />
										<span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
											Male
										</span>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
												Start
											</Label>
											<Input
												type="number"
												min={0}
												value={maleStart}
												onChange={(e) =>
													setMaleStart(
														e.target.value === ""
															? ""
															: parseInt(
																	e.target
																		.value,
																	10,
																),
													)
												}
												placeholder="0"
												className="h-9 text-sm bg-background/50 border-border/30 mt-1"
											/>
										</div>
										<div>
											<Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
												End
											</Label>
											<Input
												type="number"
												min={0}
												value={maleEnd}
												onChange={(e) =>
													setMaleEnd(
														e.target.value === ""
															? ""
															: parseInt(
																	e.target
																		.value,
																	10,
																),
													)
												}
												placeholder="0"
												className="h-9 text-sm bg-background/50 border-border/30 mt-1"
											/>
										</div>
									</div>
								</div>
								{/* Female Range */}
								<div className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-3.5 space-y-2.5">
									<div className="flex items-center gap-2">
										<div className="w-2 h-2 rounded-full bg-pink-400" />
										<span className="text-xs font-semibold text-pink-400 uppercase tracking-wider">
											Female
										</span>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
												Start
											</Label>
											<Input
												type="number"
												min={0}
												value={femaleStart}
												onChange={(e) =>
													setFemaleStart(
														e.target.value === ""
															? ""
															: parseInt(
																	e.target
																		.value,
																	10,
																),
													)
												}
												placeholder="0"
												className="h-9 text-sm bg-background/50 border-border/30 mt-1"
											/>
										</div>
										<div>
											<Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
												End
											</Label>
											<Input
												type="number"
												min={0}
												value={femaleEnd}
												onChange={(e) =>
													setFemaleEnd(
														e.target.value === ""
															? ""
															: parseInt(
																	e.target
																		.value,
																	10,
																),
													)
												}
												placeholder="0"
												className="h-9 text-sm bg-background/50 border-border/30 mt-1"
											/>
										</div>
									</div>
								</div>
							</div>

							{showOverlapError && hasOverlap && (
								<div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive animate-in fade-in slide-in-from-top-1 duration-300">
									<AlertCircle className="w-4 h-4" />
									<p className="text-xs font-semibold">
										Numbers overlap! Competitor number
										ranges for Male and Female must not
										have any common numbers.
									</p>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Step 2: Competition Structure */}
				{step === 2 && (
					<div className="space-y-6">
						<div className="flex items-start justify-between">
							<div className="flex items-start gap-3">
								<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center shrink-0">
									<Zap className="w-5 h-5 text-violet-400" />
								</div>
								<div>
									<h2 className="text-xl font-bold text-foreground tracking-tight">
										Competition Structure
									</h2>
									<p className="text-sm text-muted-foreground mt-0.5">
										Configure rounds, scoring modes, and
										pairing
									</p>
								</div>
							</div>
							<div className="flex gap-1.5">
								<Button
									size="sm"
									variant="outline"
									className="h-8 text-xs bg-transparent border-border/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
									onClick={handleResetConfig}
									title="Reset to default"
								>
									<RotateCcw className="h-3 w-3" />
								</Button>
								<Button
									size="sm"
									variant="outline"
									className="h-8 text-xs bg-transparent border-border/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
									onClick={addRound}
								>
									<Plus className="h-3 w-3 mr-1" />
									Add Round
								</Button>
							</div>
						</div>

						<div className="space-y-3">
							{configRounds.map((round, index) => {
								const isExpanded = expandedRounds.has(round.id);
								const isFirst = index === 0;
								const isLast =
									index === configRounds.length - 1;
								const isFinal = isLast;

								return (
									<div
										key={round.id}
										className={cn(
											"border rounded-xl overflow-hidden transition-all duration-300",
											isFinal
												? "border-amber-500/30 bg-gradient-to-br from-amber-500/8 to-amber-500/3"
												: "border-border/50 bg-muted/20 hover:bg-muted/30",
											isExpanded &&
												"shadow-lg shadow-black/5",
										)}
									>
										{/* Round Header */}
										<div
											className="flex items-center gap-2.5 px-4 py-3 cursor-pointer transition-colors"
											onClick={() =>
												toggleRoundExpanded(round.id)
											}
										>
											<GripVertical className="h-3.5 w-3.5 text-muted-foreground/30" />
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													<span className="text-sm font-semibold">
														Round {round.order}
													</span>
													<span className="text-xs text-muted-foreground">
														{round.name}
													</span>
													{isFinal && (
														<Badge className="text-[10px] h-[18px] px-1.5 bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/15">
															Final
														</Badge>
													)}
												</div>
												{!isExpanded && (
													<div className="flex items-center gap-1.5 mt-0.5">
														{[
															`${round.numberOfHeats}H`,
															`${round.numberOfRotations}R`,
															round.scoringMode,
															isFinal
																? "Final"
																: `Top ${round.competitorsAdvancing}`,
														].map((tag, ti) => (
															<span
																key={ti}
																className="text-[10px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded-md"
															>
																{tag}
															</span>
														))}
													</div>
												)}
											</div>
											<div
												className="flex items-center gap-0.5"
												onClick={(e) =>
													e.stopPropagation()
												}
											>
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 rounded-lg"
													onClick={() =>
														moveRound(
															round.id,
															"up",
														)
													}
													disabled={isFirst}
												>
													<ChevronUp className="h-3 w-3" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 rounded-lg"
													onClick={() =>
														moveRound(
															round.id,
															"down",
														)
													}
													disabled={isLast}
												>
													<ChevronDown className="h-3 w-3" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 rounded-lg text-destructive/70 hover:text-destructive"
													onClick={() =>
														removeRound(round.id)
													}
													disabled={
														configRounds.length <= 1
													}
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
											<ChevronDown
												className={cn(
													"h-4 w-4 text-muted-foreground/50 transition-transform duration-300",
													isExpanded && "rotate-180",
												)}
											/>
										</div>

										{/* Round Body (Expanded) */}
										{isExpanded && (
											<div className="px-4 pb-4 space-y-4 border-t border-border/30">
												<div className="pt-4">
													<Label className="text-xs font-medium text-muted-foreground">
														Round Name
													</Label>
													<Input
														value={round.name}
														onChange={(e) =>
															updateRound(
																round.id,
																{
																	name: e
																		.target
																		.value,
																},
															)
														}
														placeholder="e.g. Qualifier, Semi Final, Final"
														className="h-9 text-sm mt-1.5 bg-muted/30 border-border/40"
													/>
												</div>

												<div
													className={`grid ${isLast ? "grid-cols-2" : "grid-cols-3"} gap-3`}
												>
													<div>
														<Label className="text-xs font-medium text-muted-foreground">
															Heats
														</Label>
														<Input
															type="number"
															min={1}
															max={20}
															value={
																round.numberOfHeats
															}
															onChange={(e) => {
																const val =
																	parseInt(
																		e.target
																			.value,
																		10,
																	);
																if (
																	!isNaN(
																		val,
																	) &&
																	val >= 1
																)
																	updateRound(
																		round.id,
																		{
																			numberOfHeats:
																				val,
																		},
																	);
															}}
															className="h-9 text-sm mt-1.5 bg-muted/30 border-border/40"
														/>
													</div>
													<div>
														<Label className="text-xs font-medium text-muted-foreground">
															Rotations
														</Label>
														<Input
															type="number"
															min={1}
															max={10}
															value={
																round.numberOfRotations
															}
															onChange={(e) => {
																const val =
																	parseInt(
																		e.target
																			.value,
																		10,
																	);
																if (
																	!isNaN(
																		val,
																	) &&
																	val >= 1
																)
																	updateRound(
																		round.id,
																		{
																			numberOfRotations:
																				val,
																		},
																	);
															}}
															className="h-9 text-sm mt-1.5 bg-muted/30 border-border/40"
														/>
													</div>
													{!isLast && (
														<div>
															<Label className="text-xs font-medium text-muted-foreground">
																Advancing
															</Label>
															<Input
																type="number"
																min={0}
																value={
																	round.competitorsAdvancing
																}
																onChange={(
																	e,
																) => {
																	const val =
																		parseInt(
																			e
																				.target
																				.value,
																			10,
																		);
																	if (
																		!isNaN(
																			val,
																		) &&
																		val >= 0
																	)
																		updateRound(
																			round.id,
																			{
																				competitorsAdvancing:
																					val,
																			},
																		);
																}}
																className="h-9 text-sm mt-1.5 bg-muted/30 border-border/40"
															/>
															<p className="text-[10px] text-muted-foreground/60 mt-1">
																per gender
															</p>
														</div>
													)}
												</div>

												{/* Scoring Mode */}
												<div>
													<Label className="text-xs font-medium text-muted-foreground">
														Scoring Mode
													</Label>
													<div className="flex gap-1.5 mt-1.5">
														{(
															[
																"selection",
																"ranking",
																"scoring",
															] as ScoringMode[]
														)
															.filter((mode) =>
																isFinal
																	? mode !==
																		"selection"
																	: true,
															)
															.map((mode) => (
																<Button
																	key={mode}
																	size="sm"
																	variant={
																		round.scoringMode ===
																		mode
																			? "default"
																			: "outline"
																	}
																	className={cn(
																		"h-8 text-xs flex-1 capitalize rounded-lg transition-all",
																		round.scoringMode !==
																			mode &&
																			"bg-transparent border-border/40 hover:bg-muted/50 text-foreground",
																	)}
																	onClick={() => {
																		const updates: Partial<RoundConfig> =
																			{
																				scoringMode:
																					mode,
																			};
																		if (
																			mode ===
																				"scoring" &&
																			(!round.scoringCategories ||
																				round
																					.scoringCategories
																					.length ===
																					0)
																		) {
																			updates.scoringCategories =
																				[
																					...DEFAULT_SCORING_CATEGORIES,
																				];
																		}
																		updateRound(
																			round.id,
																			updates,
																		);
																	}}
																>
																	{mode}
																</Button>
															))}
													</div>
												</div>

												{/* Scoring Categories */}
												{round.scoringMode ===
													"scoring" && (
													<div className="bg-muted/30 rounded-xl p-3 space-y-2 border border-border/30">
														<div className="flex items-center justify-between">
															<Label className="text-xs text-muted-foreground">
																Scoring
																Categories
															</Label>
															<Button
																size="sm"
																variant="ghost"
																className="h-6 text-[10px] px-2 rounded-lg"
																onClick={() =>
																	addScoringCategory(
																		round.id,
																	)
																}
															>
																<Plus className="h-2.5 w-2.5 mr-0.5" />{" "}
																Add
															</Button>
														</div>
														{(
															round.scoringCategories ||
															[]
														).map((cat) => (
															<div
																key={cat.id}
																className="flex items-center gap-1.5"
															>
																<Input
																	value={
																		cat.name
																	}
																	onChange={(
																		e,
																	) =>
																		updateScoringCategory(
																			round.id,
																			cat.id,
																			{
																				name: e
																					.target
																					.value,
																			},
																		)
																	}
																	className="h-8 text-xs flex-1 bg-background/50 border-border/30"
																	placeholder="Category name"
																/>
																<Input
																	type="number"
																	min={0}
																	max={10}
																	step={0.1}
																	value={
																		cat.weight
																	}
																	onChange={(
																		e,
																	) => {
																		const val =
																			parseFloat(
																				e
																					.target
																					.value,
																			);
																		if (
																			!isNaN(
																				val,
																			)
																		)
																			updateScoringCategory(
																				round.id,
																				cat.id,
																				{
																					weight: val,
																				},
																			);
																	}}
																	className="h-8 text-xs w-16 bg-background/50 border-border/30"
																	title="Weight"
																/>
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-7 w-7 text-destructive/60 hover:text-destructive rounded-lg"
																	onClick={() =>
																		removeScoringCategory(
																			round.id,
																			cat.id,
																		)
																	}
																>
																	<X className="h-3 w-3" />
																</Button>
															</div>
														))}
													</div>
												)}

												{/* Pairing Mode */}
												<div>
													<Label className="text-xs font-medium text-muted-foreground">
														Pairing
													</Label>
													<div className="flex gap-1.5 mt-1.5">
														{(
															[
																"automatic",
																"none",
															] as PairingMode[]
														).map((mode) => (
															<Button
																key={mode}
																size="sm"
																variant={
																	round.pairingMode ===
																	mode
																		? "default"
																		: "outline"
																}
																className={cn(
																	"h-8 text-xs flex-1 capitalize rounded-lg transition-all",
																	round.pairingMode !==
																		mode &&
																		"bg-transparent border-border/40 hover:bg-muted/50 text-foreground",
																)}
																onClick={() =>
																	updateRound(
																		round.id,
																		{
																			pairingMode:
																				mode,
																		},
																	)
																}
															>
																{mode === "none"
																	? "No Pairing"
																	: mode}
															</Button>
														))}
													</div>
												</div>

												{/* Announcement Style */}
												<div>
													<Label className="text-xs font-medium text-muted-foreground">
														Announcement Style
													</Label>
													<Select
														value={
															round.announcementStyle
														}
														onValueChange={(val) =>
															updateRound(
																round.id,
																{
																	announcementStyle:
																		val as AnnouncementStyle,
																},
															)
														}
													>
														<SelectTrigger className="h-9 text-xs mt-1.5 bg-muted/30 border-border/40">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="all_with_ranking">
																All with Ranking
															</SelectItem>
															<SelectItem value="winners_and_eliminated">
																Winners &
																Eliminated
															</SelectItem>
															<SelectItem value="winners_only">
																Winners Only
															</SelectItem>
															<SelectItem value="top_3_only">
																Top 3 Only
															</SelectItem>
														</SelectContent>
													</Select>
												</div>

												{/* Finals Judge Mode */}
												{(round.scoringMode ===
													"selection" ||
													round.scoringMode ===
														"ranking" ||
													round.scoringMode ===
														"scoring") && (
													<div>
														<Label className="text-xs font-medium text-muted-foreground">
															Judge-Competitor
															Matching
														</Label>
														<div className="flex gap-1.5 mt-1.5">
															{(
																[
																	"cross_gender",
																	"same_gender",
																] as FinalsJudgeMode[]
															).map((mode) => (
																<Button
																	key={mode}
																	size="sm"
																	variant={
																		(round.finalsJudgeMode ||
																			"cross_gender") ===
																		mode
																			? "default"
																			: "outline"
																	}
																	className={cn(
																		"h-8 text-xs flex-1 rounded-lg transition-all",
																		(round.finalsJudgeMode ||
																			"cross_gender") !==
																			mode &&
																			"bg-transparent border-border/40 hover:bg-muted/50 text-foreground",
																	)}
																	onClick={() =>
																		updateRound(
																			round.id,
																			{
																				finalsJudgeMode:
																					mode,
																			},
																		)
																	}
																>
																	{mode ===
																	"cross_gender"
																		? "Cross Gender"
																		: "Same Gender"}
																</Button>
															))}
														</div>
														<p className="text-[10px] text-muted-foreground/60 mt-1.5">
															{(round.finalsJudgeMode ||
																"cross_gender") ===
															"cross_gender"
																? "Male judge → Female competitor"
																: "Male judge → Male competitor"}
														</p>
													</div>
												)}
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* Step 3: Review */}
				{step === 3 && (
					<div className="space-y-6">
						<div className="flex items-start gap-3">
							<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center shrink-0">
								<Sparkles className="w-5 h-5 text-emerald-400" />
							</div>
							<div>
								<h2 className="text-xl font-bold text-foreground tracking-tight">
									Review & Create
								</h2>
								<p className="text-sm text-muted-foreground mt-0.5">
									Everything looks good? Let&apos;s launch
									your event
								</p>
							</div>
						</div>

						{/* Event Details Card */}
						<div className="rounded-xl border border-border/40 bg-gradient-to-br from-muted/40 to-muted/20 overflow-hidden">
							<div className="px-4 py-2.5 border-b border-border/30 flex items-center gap-2">
								<Trophy className="w-3.5 h-3.5 text-primary" />
								<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
									Event Details
								</span>
							</div>
							<div className="p-4 space-y-0">
								{[
									{
										label: "Event Name",
										value: eventName || "Untitled Event",
									},
									{
										label: "Date",
										value: eventDate
											? format(
													new Date(
														eventDate + "T00:00:00",
													),
													"EEEE, MMMM do, yyyy",
												)
											: "Not Set",
									},
									{
										label: "Location",
										value: venue || "Not Set",
									},
								].map((item, i) => (
									<div
										key={i}
										className="flex justify-between items-center py-2.5 border-b border-border/20 last:border-0"
									>
										<span className="text-sm text-muted-foreground">
											{item.label}
										</span>
										<span className="text-sm font-medium text-foreground">
											{item.value}
										</span>
									</div>
								))}
							</div>
						</div>

						{/* Number Ranges */}
						<div className="grid grid-cols-2 gap-3">
							<div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/8 to-blue-500/3 p-4">
								<div className="flex items-center gap-2 mb-2">
									<div className="w-2 h-2 rounded-full bg-blue-400" />
									<span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
										Male Range
									</span>
								</div>
								{maleStart !== "" && maleEnd !== "" ? (
									<>
										<p className="text-lg font-bold text-foreground">
											#{maleStart}{" "}
											<span className="text-muted-foreground font-normal mx-1">
												→
											</span>{" "}
											#{maleEnd}
										</p>
										<p className="text-xs text-muted-foreground mt-0.5">
											{(maleEnd as number) -
												(maleStart as number) +
												1}{" "}
											available slots
										</p>
									</>
								) : (
									<p className="text-sm text-muted-foreground/60">
										Not configured
									</p>
								)}
							</div>
							<div className="rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-500/8 to-pink-500/3 p-4">
								<div className="flex items-center gap-2 mb-2">
									<div className="w-2 h-2 rounded-full bg-pink-400" />
									<span className="text-[11px] font-semibold text-pink-400 uppercase tracking-wider">
										Female Range
									</span>
								</div>
								{femaleStart !== "" && femaleEnd !== "" ? (
									<>
										<p className="text-lg font-bold text-foreground">
											#{femaleStart}{" "}
											<span className="text-muted-foreground font-normal mx-1">
												→
											</span>{" "}
											#{femaleEnd}
										</p>
										<p className="text-xs text-muted-foreground mt-0.5">
											{(femaleEnd as number) -
												(femaleStart as number) +
												1}{" "}
											available slots
										</p>
									</>
								) : (
									<p className="text-sm text-muted-foreground/60">
										Not configured
									</p>
								)}
							</div>
						</div>

						{/* Competition Structure - Visual Timeline */}
						<div className="rounded-xl border border-border/40 bg-gradient-to-br from-muted/40 to-muted/20 overflow-hidden">
							<div className="px-4 py-2.5 border-b border-border/30 flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Zap className="w-3.5 h-3.5 text-violet-400" />
									<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Competition Flow
									</span>
								</div>
								<span className="text-xs text-muted-foreground/60">
									{configRounds.length}{" "}
									{configRounds.length === 1
										? "round"
										: "rounds"}
								</span>
							</div>
							<div className="p-4">
								<div className="relative">
									{/* Vertical timeline line */}
									<div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-primary/30 via-violet-500/30 to-amber-500/30 rounded-full" />

									<div className="space-y-4">
										{configRounds.map((round, index) => {
											const isLast =
												index ===
												configRounds.length - 1;
											const dotColor = isLast
												? "bg-amber-400"
												: index === 0
													? "bg-primary"
													: "bg-violet-400";
											const ringColor = isLast
												? "ring-amber-400/20"
												: index === 0
													? "ring-primary/20"
													: "ring-violet-400/20";

											return (
												<div
													key={round.id}
													className="relative pl-10"
												>
													{/* Timeline dot */}
													<div
														className={cn(
															"absolute left-[9px] top-1 w-[14px] h-[14px] rounded-full ring-4",
															dotColor,
															ringColor,
														)}
													/>

													{/* Arrow between rounds */}
													{!isLast && (
														<div className="absolute left-[11px] bottom-[-12px]">
															<ArrowRight className="w-2.5 h-2.5 text-muted-foreground/30 rotate-90" />
														</div>
													)}

													<div
														className={cn(
															"rounded-xl p-3.5 transition-all",
															isLast
																? "bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20"
																: "bg-muted/30 border border-border/30",
														)}
													>
														<div className="flex items-center gap-2 mb-2.5">
															<h4 className="text-sm font-bold text-foreground">
																{round.name}
															</h4>
															{isLast && (
																<Badge className="text-[9px] h-[16px] px-1.5 bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/15 font-bold">
																	FINAL
																</Badge>
															)}
														</div>

														{/* Stats Grid */}
														<div className="grid grid-cols-3 gap-2 mb-2.5">
															{[
																{
																	label: "Heats",
																	value: round.numberOfHeats,
																},
																{
																	label: "Rotations",
																	value: round.numberOfRotations,
																},
																...(isLast
																	? []
																	: [
																			{
																				label: "Advancing",
																				value: `Top ${round.competitorsAdvancing}`,
																			},
																		]),
															].map(
																(stat, si) => (
																	<div
																		key={si}
																		className="text-center py-1.5 rounded-lg bg-background/40 border border-border/20"
																	>
																		<p className="text-xs font-bold text-foreground">
																			{
																				stat.value
																			}
																		</p>
																		<p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">
																			{
																				stat.label
																			}
																		</p>
																	</div>
																),
															)}
														</div>

														{/* Tags */}
														<div className="flex flex-wrap gap-1.5">
															<span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary/80 font-medium capitalize">
																{
																	round.scoringMode
																}
															</span>
															<span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium capitalize">
																{round.pairingMode ===
																"none"
																	? "No Pairing"
																	: round.pairingMode}
															</span>
															<span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium">
																{announcementLabel(
																	round.announcementStyle,
																)}
															</span>
															<span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium">
																{(round.finalsJudgeMode ||
																	"cross_gender") ===
																"cross_gender"
																	? "Cross Gender"
																	: "Same Gender"}
															</span>
														</div>

														{/* Scoring Categories */}
														{round.scoringMode ===
															"scoring" &&
															round.scoringCategories &&
															round
																.scoringCategories
																.length > 0 && (
																<div className="mt-2.5 pt-2.5 border-t border-border/20">
																	<div className="flex flex-wrap gap-1.5">
																		{round.scoringCategories.map(
																			(
																				c,
																			) => (
																				<span
																					key={
																						c.id
																					}
																					className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400/80 font-medium"
																				>
																					{
																						c.name
																					}{" "}
																					<span className="ml-1 opacity-60">
																						×
																						{
																							c.weight
																						}
																					</span>
																				</span>
																			),
																		)}
																	</div>
																</div>
															)}
													</div>
												</div>
											);
										})}
									</div>
								</div>
							</div>
						</div>

						<p className="text-xs text-muted-foreground/60 text-center">
							You can always edit these settings later from the
							event dashboard
						</p>
					</div>
				)}
			</div>

			{/* Footer Actions */}
			<div className="flex items-center justify-between mt-8">
				{step > 1 ? (
					<Button
						variant="ghost"
						onClick={handleBack}
						className="h-11 px-5 rounded-xl text-muted-foreground hover:text-foreground"
					>
						<ChevronLeft className="w-4 h-4 mr-1" />
						Back
					</Button>
				) : (
					<Button
						variant="ghost"
						onClick={onCancel}
						className="h-11 px-5 rounded-xl text-muted-foreground hover:text-foreground"
					>
						Cancel
					</Button>
				)}

				{step < totalSteps ? (
					<Button
						onClick={handleNext}
						disabled={step === 1 && !canProceedStep1}
						className="h-11 px-6 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
					>
						Continue
						<ChevronRight className="w-4 h-4 ml-1" />
					</Button>
				) : (
					<Button
						onClick={handleSubmit}
						disabled={isSubmitting}
						className="h-11 px-6 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
					>
						{isSubmitting ? (
							<>
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								Creating...
							</>
						) : (
							<>
								<Sparkles className="w-4 h-4 mr-2" />
								Create Event
							</>
						)}
					</Button>
				)}
			</div>
		</div>
	);
}
