"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import type {
	Event,
	EventSummary,
	CompetitionConfig,
	RoundConfig,
	ScoringCategory,
	ScoringMode,
	PairingMode,
	AnnouncementStyle,
	FinalsJudgeMode,
} from "@/lib/types";
import {
	createDefaultConfig,
	createDefaultRound,
	getCompetitionConfig,
	getSortedRounds,
	validateConfig,
	DEFAULT_SCORING_CATEGORIES,
} from "@/lib/competition-config";
import {
	Settings,
	QrCode,
	Copy,
	Check,
	Link,
	Trash2,
	RefreshCw,
	Calendar as CalendarIcon,
	MapPin,
	Trophy,
	Plus,
	ExternalLink,
	Download,
	ChevronDown,
	ChevronUp,
	GripVertical,
	Layers,
	Save,
	RotateCcw,
	X,
	AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { exportToExcel } from "@/lib/export-excel";

interface EventSettingsPanelProps {
	event: Event;
	events: EventSummary[];
	baseUrl: string;
	socket?: any;
	onUpdateEvent?: (updates: Partial<Event>) => Promise<boolean>;
	onRebuildRound?: () => Promise<Event | null>;
	onResetEvent?: () => Promise<void>;
	onCreateEvent?: (
		name: string,
		date: string,
		venue: string,
		maleStartNumber?: number,
		maleEndNumber?: number,
		femaleStartNumber?: number,
		femaleEndNumber?: number,
	) => Promise<Event | null>;
	onDeleteEvent?: (eventId: string) => Promise<boolean>;
	onSeedEventData?: (eventId: string) => Promise<Event | null>;
	onSwitchEvent?: (eventId: string) => void;
	onRefreshEvents?: () => Promise<void>;
}

export function EventSettingsPanel({
	event,
	events,
	baseUrl,
	onUpdateEvent,
	onRebuildRound,
	onResetEvent,
	onCreateEvent,
	onDeleteEvent,
	onSeedEventData,
	onSwitchEvent,
	onRefreshEvents,
	socket,
}: EventSettingsPanelProps) {
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
	const [copiedLink, setCopiedLink] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [editedEvent, setEditedEvent] = useState<{
		name: string;
		date: string;
		venue: string;
		maleStartNumber: number | "";
		maleEndNumber: number | "";
		femaleStartNumber: number | "";
		femaleEndNumber: number | "";
	}>({
		name: event.name,
		date: event.date,
		venue: event.venue,
		maleStartNumber: event.maleStartNumber ?? "",
		maleEndNumber: event.maleEndNumber ?? "",
		femaleStartNumber: event.femaleStartNumber ?? "",
		femaleEndNumber: event.femaleEndNumber ?? "",
	});
	const [newEvent, setNewEvent] = useState<{
		name: string;
		date: string;
		venue: string;
		maleStartNumber: number | "";
		maleEndNumber: number | "";
		femaleStartNumber: number | "";
		femaleEndNumber: number | "";
	}>({
		name: "",
		date: new Date().toISOString().split("T")[0],
		venue: "",
		maleStartNumber: "",
		maleEndNumber: "",
		femaleStartNumber: "",
		femaleEndNumber: "",
	});

	const [showNewEventOverlapError, setShowNewEventOverlapError] =
		useState(false);
	const [showEditedEventOverlapError, setShowEditedEventOverlapError] =
		useState(false);

	const newEventOverlap =
		newEvent.maleStartNumber !== "" &&
		newEvent.maleEndNumber !== "" &&
		newEvent.femaleStartNumber !== "" &&
		newEvent.femaleEndNumber !== "" &&
		Math.max(newEvent.maleStartNumber, newEvent.femaleStartNumber) <=
			Math.min(newEvent.maleEndNumber, newEvent.femaleEndNumber);

	const editedEventOverlap =
		editedEvent.maleStartNumber !== "" &&
		editedEvent.maleEndNumber !== "" &&
		editedEvent.femaleStartNumber !== "" &&
		editedEvent.femaleEndNumber !== "" &&
		Math.max(Number(editedEvent.maleStartNumber), Number(editedEvent.femaleStartNumber)) <=
			Math.min(Number(editedEvent.maleEndNumber), Number(editedEvent.femaleEndNumber));

	// ============================================
	// COMPETITION CONFIG STATE
	// ============================================
	const [configRounds, setConfigRounds] = useState<RoundConfig[]>(() => {
		const config = getCompetitionConfig(event);
		return getSortedRounds(config);
	});
	const [expandedRounds, setExpandedRounds] = useState<Set<string>>(
		new Set(),
	);
	const [isRebuildDialogOpen, setIsRebuildDialogOpen] = useState(false);
	const [isSavingConfig, setIsSavingConfig] = useState(false);
	const [configHasChanges, setConfigHasChanges] = useState(false);

	useEffect(() => {
		setEditedEvent({
			name: event.name,
			date: event.date,
			venue: event.venue,
			maleStartNumber: event.maleStartNumber ?? "",
			maleEndNumber: event.maleEndNumber ?? "",
			femaleStartNumber: event.femaleStartNumber ?? "",
			femaleEndNumber: event.femaleEndNumber ?? "",
		});
		// Sync config rounds from event (for real-time updates from other tabs)
		if (!configHasChanges) {
			const config = getCompetitionConfig(event);
			setConfigRounds(getSortedRounds(config));
		}
	}, [event]);

	const registrationLink = `${baseUrl}/?event=${event.id}`;
	const displayLink = `${baseUrl}/display?event=${event.id}`;

	// Helper to get round name for display
	const getRoundName = (event: Event, roundId: string) => {
		const config = getCompetitionConfig(event);
		return config.rounds.find((r) => r.id === roundId)?.name || roundId;
	};

	const getQRCodeUrl = (link: string) => {
		return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
			link,
		)}`;
	};

	const copyLink = (link: string, label: string) => {
		navigator.clipboard.writeText(link);
		setCopiedLink(link);
		toast.success(`${label} link copied!`);
		setTimeout(() => setCopiedLink(null), 2000);
	};

	const handleSaveEvent = async () => {
		if (!onUpdateEvent) return;
		// Validate numbers (must be >= 0 if provided)
		const maleStart = editedEvent.maleStartNumber;
		const maleEnd = editedEvent.maleEndNumber;
		const femaleStart = editedEvent.femaleStartNumber;
		const femaleEnd = editedEvent.femaleEndNumber;

		if (
			(maleStart !== "" && maleStart < 0) ||
			(maleEnd !== "" && maleEnd < 0) ||
			(femaleStart !== "" && femaleStart < 0) ||
			(femaleEnd !== "" && femaleEnd < 0)
		) {
			toast.error("Numbers cannot be negative");
			return;
		}
		// Validate ending >= starting (only if both are provided)
		if (maleStart !== "" && maleEnd !== "" && maleEnd < maleStart) {
			toast.error("Male ending number must be >= starting number");
			return;
		}
		if (femaleStart !== "" && femaleEnd !== "" && femaleEnd < femaleStart) {
			toast.error("Female ending number must be >= starting number");
			return;
		}

		// Validate overlap
		if (
			maleStart !== "" &&
			maleEnd !== "" &&
			femaleStart !== "" &&
			femaleEnd !== "" &&
			Math.max(Number(maleStart), Number(femaleStart)) <=
				Math.min(Number(maleEnd), Number(femaleEnd))
		) {
			setShowEditedEventOverlapError(true);
			setShowNewEventOverlapError(true);
			toast.error("Numbers overlap! Competitor number ranges for Male and Female must not have any common numbers.");
			return;
		}
		setShowEditedEventOverlapError(false);
		setShowNewEventOverlapError(false);
		setIsSubmitting(true);
		// Convert empty strings to undefined for the API
		const updates = {
			name: editedEvent.name,
			date: editedEvent.date,
			venue: editedEvent.venue,
			maleStartNumber: maleStart === "" ? undefined : maleStart,
			maleEndNumber: maleEnd === "" ? undefined : maleEnd,
			femaleStartNumber: femaleStart === "" ? undefined : femaleStart,
			femaleEndNumber: femaleEnd === "" ? undefined : femaleEnd,
		};
		const success = await onUpdateEvent(updates);
		if (success) {
			toast.success("Event settings updated");
			setIsEditDialogOpen(false);
		} else {
			toast.error("Failed to update event");
		}
		setIsSubmitting(false);
	};

	const handleCreateEvent = async () => {
		if (!onCreateEvent) return;
		if (!newEvent.name.trim() || !newEvent.venue.trim()) {
			toast.error("Please fill in all fields");
			return;
		}
		// Validate numbers (must be >= 0 if provided)
		const maleStart = newEvent.maleStartNumber;
		const maleEnd = newEvent.maleEndNumber;
		const femaleStart = newEvent.femaleStartNumber;
		const femaleEnd = newEvent.femaleEndNumber;

		if (
			(maleStart !== "" && maleStart < 0) ||
			(maleEnd !== "" && maleEnd < 0) ||
			(femaleStart !== "" && femaleStart < 0) ||
			(femaleEnd !== "" && femaleEnd < 0)
		) {
			toast.error("Numbers cannot be negative");
			return;
		}
		// Validate ending >= starting (only if both are provided)
		if (maleStart !== "" && maleEnd !== "" && maleEnd < maleStart) {
			toast.error("Male ending number must be >= starting number");
			return;
		}
		if (femaleStart !== "" && femaleEnd !== "" && femaleEnd < femaleStart) {
			toast.error("Female ending number must be >= starting number");
			return;
		}

		// Validate overlap
		if (
			maleStart !== "" &&
			maleEnd !== "" &&
			femaleStart !== "" &&
			femaleEnd !== "" &&
			Math.max(Number(maleStart), Number(femaleStart)) <=
				Math.min(Number(maleEnd), Number(femaleEnd))
		) {
			toast.error("Numbers overlap! Competitor number ranges for Male and Female must not have any common numbers.");
			return;
		}
		setIsSubmitting(true);
		const created = await onCreateEvent(
			newEvent.name.trim(),
			newEvent.date,
			newEvent.venue.trim(),
			maleStart === "" ? undefined : maleStart,
			maleEnd === "" ? undefined : maleEnd,
			femaleStart === "" ? undefined : femaleStart,
			femaleEnd === "" ? undefined : femaleEnd,
		);
		if (created) {
			toast.success(`Event "${created.name}" created!`);
			setIsCreateDialogOpen(false);
			setNewEvent({
				name: "",
				date: new Date().toISOString().split("T")[0],
				venue: "",
				maleStartNumber: "",
				maleEndNumber: "",
				femaleStartNumber: "",
				femaleEndNumber: "",
			});
			if (onRefreshEvents) await onRefreshEvents();
		} else {
			toast.error("Failed to create event");
		}
		setIsSubmitting(false);
	};

	const handleDeleteEvent = async (eventId: string) => {
		if (!onDeleteEvent) return;
		const success = await onDeleteEvent(eventId);
		if (success) {
			toast.success("Event deleted");
			if (onRefreshEvents) await onRefreshEvents();
		} else {
			toast.error("Failed to delete event");
		}
	};

	const handleResetEvent = async () => {
		if (!onResetEvent) return;
		await onResetEvent();
		// After reset, refresh events list to keep UI in sync
		if (onRefreshEvents) await onRefreshEvents();
	};

	const handleExportAll = async () => {
		try {
			toast.info("Generating Excel file with images...");
			await exportToExcel(event, event.votes);
			toast.success(
				"Excel file downloaded! Open it to view embedded images.",
			);
		} catch (error) {
			toast.error("Failed to export Excel");
			console.error("Export error:", error);
		}
	};

	// ============================================
	// COMPETITION CONFIG HANDLERS
	// ============================================
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
		setConfigHasChanges(true);
	};

	const addRound = () => {
		const newOrder = configRounds.length + 1;
		const newRound = createDefaultRound(newOrder);
		setConfigRounds((prev) => [...prev, newRound]);
		setExpandedRounds((prev) => new Set(prev).add(newRound.id));
		setConfigHasChanges(true);
	};

	const removeRound = (roundId: string) => {
		if (configRounds.length <= 1) {
			toast.error("At least one round is required");
			return;
		}
		setConfigRounds((prev) => {
			const filtered = prev.filter((r) => r.id !== roundId);
			// Re-number orders
			return filtered.map((r, i) => ({ ...r, order: i + 1 }));
		});
		setConfigHasChanges(true);
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
			// Re-number orders
			return newRounds.map((r, i) => ({ ...r, order: i + 1 }));
		});
		setConfigHasChanges(true);
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

	const handleSaveConfig = async () => {
		if (!onUpdateEvent) return;
		// Ensure the last round always has competitorsAdvancing = 0 (it's the final)
		// Also restore previous rounds that might have been set to 0 when they were last
		const finalizedRounds = configRounds.map((r, i) => {
			if (i === configRounds.length - 1) {
				return { ...r, competitorsAdvancing: 0 };
			}
			// If a non-last round has competitorsAdvancing = 0, give it a default
			if (r.competitorsAdvancing === 0) {
				return { ...r, competitorsAdvancing: 6 };
			}
			return r;
		});
		const config: CompetitionConfig = {
			rounds: finalizedRounds,
			updatedAt: new Date().toISOString(),
		};
		const errors = validateConfig(config);
		if (errors.length > 0) {
			toast.error(errors[0].message);
			return;
		}
		setIsSavingConfig(true);
		const success = await onUpdateEvent({ competitionConfig: config });
		if (success) {
			toast.success("Competition structure saved!");
			setConfigHasChanges(false);

			// Automatically rebuild the round without prompting
			if (onRebuildRound) {
				try {
					const result = await onRebuildRound();
					if (result) {
						toast.success(
							"Heats re-generated and synced automatically!",
						);
					}
					// Silently ignore rebuild failures (e.g. no competitors yet)
				} catch {
					// Silently ignore - rebuild may not be needed yet
				}
			}
		} else {
			toast.error("Failed to save competition structure");
		}
		setIsSavingConfig(false);
	};

	const handleRebuildRound = async () => {
		if (onRebuildRound) {
			const result = await onRebuildRound();
			if (result) {
				toast.success(
					"Round heats re-generated and synced successfully!",
				);
				setIsRebuildDialogOpen(false);
			} else {
				toast.error("Failed to rebuild round");
			}
		}
	};

	const handleResetConfig = () => {
		const defaultConfig = createDefaultConfig();
		setConfigRounds(getSortedRounds(defaultConfig));
		setConfigHasChanges(true);
		toast.info("Reset to default 3-round structure. Click Save to apply.");
	};

	const handleRevertConfig = () => {
		const config = getCompetitionConfig(event);
		setConfigRounds(getSortedRounds(config));
		setConfigHasChanges(false);
		toast.info("Reverted to saved configuration.");
	};

	return (
		<div className="space-y-6">
			{/* Event Selector */}
			<Card className="border-border bg-card">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2 text-foreground">
								<Trophy className="w-5 h-5 text-amber-500" />
								Events
							</CardTitle>
							<CardDescription>
								Manage multiple competition events
							</CardDescription>
						</div>
						<Dialog
							open={isCreateDialogOpen}
							onOpenChange={setIsCreateDialogOpen}
						>
							<DialogTrigger asChild>
								<Button size="sm">
									<Plus className="h-4 w-4 mr-1" />
									New Event
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Create New Event</DialogTitle>
									<DialogDescription>
										Set up a new competition event
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4 py-4">
									<div className="space-y-2">
										<Label>Event Name *</Label>
										<Input
											value={newEvent.name}
											onChange={(e) =>
												setNewEvent((prev) => ({
													...prev,
													name: e.target.value,
												}))
											}
											placeholder="e.g., West Coast Swing Championship 2025"
										/>
									</div>
									<div className="space-y-2">
										<Label>Date *</Label>
										<Popover>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className="w-full justify-start text-left font-normal bg-transparent"
												>
													<CalendarIcon className="mr-2 h-4 w-4" />
													{newEvent.date ? (
														format(
															new Date(
																newEvent.date +
																	"T00:00:00",
															),
															"PPP",
														)
													) : (
														<span className="text-muted-foreground">
															Pick a date
														</span>
													)}
												</Button>
											</PopoverTrigger>
											<PopoverContent
												className="w-auto p-0"
												align="start"
											>
												<Calendar
													mode="single"
													selected={
														newEvent.date
															? new Date(
																	newEvent.date +
																		"T00:00:00",
																)
															: undefined
													}
													defaultMonth={
														newEvent.date
															? new Date(
																	newEvent.date +
																		"T00:00:00",
																)
															: undefined
													}
													onSelect={(date) =>
														setNewEvent((prev) => ({
															...prev,
															date: date
																? format(
																		date,
																		"yyyy-MM-dd",
																	)
																: "",
														}))
													}
													classNames={{
														today: "",
													}}
													autoFocus
												/>
											</PopoverContent>
										</Popover>
									</div>
									<div className="space-y-2">
										<Label>Venue *</Label>
										<Input
											value={newEvent.venue}
											onChange={(e) =>
												setNewEvent((prev) => ({
													...prev,
													venue: e.target.value,
												}))
											}
											placeholder="e.g., Grand Ballroom, Los Angeles"
										/>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Male Starting #</Label>
											<div className="flex items-center">
												<span className="text-muted-foreground mr-1">
													#
												</span>
												<Input
													type="number"
													min={0}
													value={
														newEvent.maleStartNumber
													}
													onChange={(e) => {
														const value =
															e.target.value;
														if (value === "") {
															setNewEvent(
																(prev) => ({
																	...prev,
																	maleStartNumber:
																		"",
																}),
															);
														} else {
															const val =
																parseInt(
																	value,
																	10,
																);
															if (
																!isNaN(val) &&
																val >= 0
															) {
																setNewEvent(
																	(prev) => ({
																		...prev,
																		maleStartNumber:
																			val,
																	}),
																);
															}
														}
													}}
													placeholder="e.g. 101"
												/>
											</div>
										</div>
										<div className="space-y-2">
											<Label>Male Ending #</Label>
											<div className="flex items-center">
												<span className="text-muted-foreground mr-1">
													#
												</span>
												<Input
													type="number"
													min={0}
													value={
														newEvent.maleEndNumber
													}
													onChange={(e) => {
														const value =
															e.target.value;
														if (value === "") {
															setNewEvent(
																(prev) => ({
																	...prev,
																	maleEndNumber:
																		"",
																}),
															);
														} else {
															const val =
																parseInt(
																	value,
																	10,
																);
															if (
																!isNaN(val) &&
																val >= 0
															) {
																setNewEvent(
																	(prev) => ({
																		...prev,
																		maleEndNumber:
																			val,
																	}),
																);
															}
														}
													}}
													placeholder="e.g. 199"
												/>
											</div>
										</div>
									</div>
									{newEvent.maleStartNumber !== "" &&
										newEvent.maleEndNumber !== "" && (
											<p className="text-xs text-muted-foreground">
												Male range: #
												{newEvent.maleStartNumber} - #
												{newEvent.maleEndNumber}
											</p>
										)}
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Female Starting #</Label>
											<div className="flex items-center">
												<span className="text-muted-foreground mr-1">
													#
												</span>
												<Input
													type="number"
													min={0}
													value={
														newEvent.femaleStartNumber
													}
													onChange={(e) => {
														const value =
															e.target.value;
														if (value === "") {
															setNewEvent(
																(prev) => ({
																	...prev,
																	femaleStartNumber:
																		"",
																}),
															);
														} else {
															const val =
																parseInt(
																	value,
																	10,
																);
															if (
																!isNaN(val) &&
																val >= 0
															) {
																setNewEvent(
																	(prev) => ({
																		...prev,
																		femaleStartNumber:
																			val,
																	}),
																);
															}
														}
													}}
													placeholder="e.g. 201"
												/>
											</div>
										</div>
										<div className="space-y-2">
											<Label>Female Ending #</Label>
											<div className="flex items-center">
												<span className="text-muted-foreground mr-1">
													#
												</span>
												<Input
													type="number"
													min={0}
													value={
														newEvent.femaleEndNumber
													}
													onChange={(e) => {
														const value =
															e.target.value;
														if (value === "") {
															setNewEvent(
																(prev) => ({
																	...prev,
																	femaleEndNumber:
																		"",
																}),
															);
														} else {
															const val =
																parseInt(
																	value,
																	10,
																);
															if (
																!isNaN(val) &&
																val >= 0
															) {
																setNewEvent(
																	(prev) => ({
																		...prev,
																		femaleEndNumber:
																			val,
																	}),
																);
															}
														}
													}}
													placeholder="e.g. 299"
												/>
											</div>
										</div>
									</div>
									{showNewEventOverlapError && newEventOverlap && (
										<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive mt-2">
											<AlertCircle className="w-4 h-4 shrink-0" />
											<p className="text-[11px] font-semibold">
												Numbers overlap! Male and Female
												ranges must be separate.
											</p>
										</div>
									)}
								</div>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={() =>
											setIsCreateDialogOpen(false)
										}
									>
										Cancel
									</Button>
									<Button
										onClick={handleCreateEvent}
										disabled={isSubmitting}
									>
										{isSubmitting
											? "Creating..."
											: "Create Event"}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Current Event Selector */}
					<div className="space-y-2">
						<Label>Current Event</Label>
						<Select
							value={event.id}
							onValueChange={(value) =>
								onSwitchEvent && onSwitchEvent(value)
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select event" />
							</SelectTrigger>
							<SelectContent>
								{events.map((evt) => (
									<SelectItem key={evt.id} value={evt.id}>
										{evt.name} ({evt.competitorCount}{" "}
										competitors)
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Events List */}
					{events.length > 0 && (
						<div className="space-y-2">
							<Label className="text-sm text-muted-foreground">
								All Events ({events.length})
							</Label>
							<div className="space-y-2 max-h-48 overflow-y-auto">
								{events.map((evt) => (
									<div
										key={evt.id}
										className={`flex items-center justify-between p-3 rounded-lg border ${
											evt.id === event.id
												? "border-primary bg-primary/5"
												: "border-border"
										}`}
									>
										<div className="flex-1 min-w-0">
											<p className="font-medium text-sm truncate">
												{evt.name}
											</p>
											<p className="text-xs text-muted-foreground">
												{new Date(
													evt.date,
												).toLocaleDateString()}{" "}
												• {evt.competitorCount}{" "}
												competitors • {evt.judgeCount}{" "}
												judges
											</p>
										</div>
										<div className="flex items-center gap-1">
											{evt.id !== event.id && (
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8"
													onClick={() =>
														onSwitchEvent &&
														onSwitchEvent(evt.id)
													}
												>
													<ExternalLink className="h-4 w-4" />
												</Button>
											)}
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-destructive hover:text-destructive"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>
															Delete Event?
														</AlertDialogTitle>
														<AlertDialogDescription>
															This will
															permanently delete "
															{evt.name}" and all
															its data. This
															action cannot be
															undone.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>
															Cancel
														</AlertDialogCancel>
														<AlertDialogAction
															onClick={() =>
																handleDeleteEvent(
																	evt.id,
																)
															}
															className="bg-destructive text-destructive-foreground"
														>
															Delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Current Event Settings */}
			<Card className="border-border bg-card">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2 text-foreground">
								<Settings className="w-5 h-5" />
								Event Settings
							</CardTitle>
							<CardDescription>
								Configure current event details
							</CardDescription>
						</div>
						<Dialog
							open={isEditDialogOpen}
							onOpenChange={setIsEditDialogOpen}
						>
							<DialogTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="bg-transparent"
								>
									<Settings className="h-4 w-4 mr-1" />
									Edit
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Edit Event</DialogTitle>
									<DialogDescription>
										Update event details
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4 py-4">
									<div className="space-y-2">
										<Label>Event Name</Label>
										<Input
											value={editedEvent.name}
											onChange={(e) =>
												setEditedEvent((prev) => ({
													...prev,
													name: e.target.value,
												}))
											}
											placeholder="Enter event name"
										/>
									</div>
									<div className="space-y-2">
										<Label>Date</Label>
										<Popover>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className="w-full justify-start text-left font-normal bg-transparent"
												>
													<CalendarIcon className="mr-2 h-4 w-4" />
													{editedEvent.date ? (
														format(
															new Date(
																editedEvent.date +
																	"T00:00:00",
															),
															"PPP",
														)
													) : (
														<span className="text-muted-foreground">
															Pick a date
														</span>
													)}
												</Button>
											</PopoverTrigger>
											<PopoverContent
												className="w-auto p-0"
												align="start"
											>
												<Calendar
													mode="single"
													selected={
														editedEvent.date
															? new Date(
																	editedEvent.date +
																		"T00:00:00",
																)
															: undefined
													}
													defaultMonth={
														editedEvent.date
															? new Date(
																	editedEvent.date +
																		"T00:00:00",
																)
															: undefined
													}
													onSelect={(date) =>
														setEditedEvent(
															(prev) => ({
																...prev,
																date: date
																	? format(
																			date,
																			"yyyy-MM-dd",
																		)
																	: "",
															}),
														)
													}
													classNames={{
														today: "",
													}}
													autoFocus
												/>
											</PopoverContent>
										</Popover>
									</div>
									<div className="space-y-2">
										<Label>Venue</Label>
										<Input
											value={editedEvent.venue}
											onChange={(e) =>
												setEditedEvent((prev) => ({
													...prev,
													venue: e.target.value,
												}))
											}
											placeholder="Enter venue"
										/>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Male Starting #</Label>
											<div className="flex items-center">
												<span className="text-muted-foreground mr-1">
													#
												</span>
												<Input
													type="number"
													min={0}
													value={
														editedEvent.maleStartNumber
													}
													onChange={(e) => {
														const value =
															e.target.value;
														if (value === "") {
															setEditedEvent(
																(prev) => ({
																	...prev,
																	maleStartNumber:
																		"",
																}),
															);
														} else {
															const val =
																parseInt(
																	value,
																	10,
																);
															if (
																!isNaN(val) &&
																val >= 0
															) {
																setEditedEvent(
																	(prev) => ({
																		...prev,
																		maleStartNumber:
																			val,
																	}),
																);
															}
														}
													}}
													placeholder="e.g. 101"
												/>
											</div>
										</div>
										<div className="space-y-2">
											<Label>Male Ending #</Label>
											<div className="flex items-center">
												<span className="text-muted-foreground mr-1">
													#
												</span>
												<Input
													type="number"
													min={0}
													value={
														editedEvent.maleEndNumber
													}
													onChange={(e) => {
														const value =
															e.target.value;
														if (value === "") {
															setEditedEvent(
																(prev) => ({
																	...prev,
																	maleEndNumber:
																		"",
																}),
															);
														} else {
															const val =
																parseInt(
																	value,
																	10,
																);
															if (
																!isNaN(val) &&
																val >= 0
															) {
																setEditedEvent(
																	(prev) => ({
																		...prev,
																		maleEndNumber:
																			val,
																	}),
																);
															}
														}
													}}
													placeholder="e.g. 199"
												/>
											</div>
										</div>
									</div>
									{editedEvent.maleStartNumber !== "" &&
										editedEvent.maleEndNumber !== "" && (
											<p className="text-xs text-muted-foreground">
												Male range: #
												{editedEvent.maleStartNumber} -
												#{editedEvent.maleEndNumber}
											</p>
										)}
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Female Starting #</Label>
											<div className="flex items-center">
												<span className="text-muted-foreground mr-1">
													#
												</span>
												<Input
													type="number"
													min={0}
													value={
														editedEvent.femaleStartNumber
													}
													onChange={(e) => {
														const value =
															e.target.value;
														if (value === "") {
															setEditedEvent(
																(prev) => ({
																	...prev,
																	femaleStartNumber:
																		"",
																}),
															);
														} else {
															const val =
																parseInt(
																	value,
																	10,
																);
															if (
																!isNaN(val) &&
																val >= 0
															) {
																setEditedEvent(
																	(prev) => ({
																		...prev,
																		femaleStartNumber:
																			val,
																	}),
																);
															}
														}
													}}
													placeholder="e.g. 201"
												/>
											</div>
										</div>
										<div className="space-y-2">
											<Label>Female Ending #</Label>
											<div className="flex items-center">
												<span className="text-muted-foreground mr-1">
													#
												</span>
												<Input
													type="number"
													min={0}
													value={
														editedEvent.femaleEndNumber
													}
													onChange={(e) => {
														const value =
															e.target.value;
														if (value === "") {
															setEditedEvent(
																(prev) => ({
																	...prev,
																	femaleEndNumber:
																		"",
																}),
															);
														} else {
															const val =
																parseInt(
																	value,
																	10,
																);
															if (
																!isNaN(val) &&
																val >= 0
															) {
																setEditedEvent(
																	(prev) => ({
																		...prev,
																		femaleEndNumber:
																			val,
																	}),
																);
															}
														}
													}}
													placeholder="e.g. 299"
												/>
											</div>
										</div>
									</div>
									{showEditedEventOverlapError &&
										editedEventOverlap && (
											<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive mt-2">
												<AlertCircle className="w-4 h-4 shrink-0" />
												<p className="text-[11px] font-semibold">
													Numbers overlap! Male and
													Female ranges must be
													separate.
												</p>
											</div>
										)}
								</div>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={() =>
											setIsEditDialogOpen(false)
										}
									>
										Cancel
									</Button>
									<Button
										onClick={handleSaveEvent}
										disabled={isSubmitting}
									>
										{isSubmitting
											? "Saving..."
											: "Save Changes"}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Event Info */}
					<div className="space-y-3">
						<div className="flex items-center gap-3 text-sm">
							<Trophy className="w-4 h-4 text-muted-foreground" />
							<span className="font-medium">{event.name}</span>
						</div>
						<div className="flex items-center gap-3 text-sm">
							<CalendarIcon className="w-4 h-4 text-muted-foreground" />
							<span>
								{new Date(event.date).toLocaleDateString(
									"en-US",
									{
										weekday: "long",
										year: "numeric",
										month: "long",
										day: "numeric",
									},
								)}
							</span>
						</div>
						<div className="flex items-center gap-3 text-sm">
							<MapPin className="w-4 h-4 text-muted-foreground" />
							<span>{event.venue}</span>
						</div>
					</div>

					{/* Competition Structure */}
					<div className="pt-4 border-t border-border">
						<div className="flex items-center justify-between mb-4">
							<div>
								<h4 className="text-sm font-medium text-foreground flex items-center gap-2">
									<Layers className="w-4 h-4 text-violet-500" />
									Competition Structure
								</h4>
								<p className="text-xs text-muted-foreground mt-0.5">
									Configure rounds, scoring & pairing
								</p>
							</div>
							<Button
								size="sm"
								variant="outline"
								className="h-7 text-xs bg-transparent"
								onClick={addRound}
							>
								<Plus className="h-3 w-3 mr-1" />
								Add Round
							</Button>
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
										className={`border rounded-lg overflow-hidden transition-colors ${
											isFinal
												? "border-amber-500/30 bg-amber-500/5"
												: "border-border bg-muted/30"
										}`}
									>
										{/* Round Header */}
										<div
											className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
											onClick={() =>
												toggleRoundExpanded(round.id)
											}
										>
											<GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													<span className="text-sm font-medium">
														Round {round.order}
													</span>
													<span className="text-xs text-muted-foreground">
														{round.name}
													</span>
													{isFinal && (
														<Badge
															variant="outline"
															className="text-[10px] h-4 px-1.5 border-amber-500/50 text-amber-500"
														>
															Final
														</Badge>
													)}
												</div>
												{!isExpanded && (
													<p className="text-[10px] text-muted-foreground">
														{round.numberOfHeats}H ·{" "}
														{
															round.numberOfRotations
														}
														R · {round.scoringMode}{" "}
														·{" "}
														{isFinal
															? "Final"
															: `Top ${round.competitorsAdvancing}`}
													</p>
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
													className="h-6 w-6"
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
													className="h-6 w-6"
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
													className="h-6 w-6 text-destructive hover:text-destructive"
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
											{isExpanded ? (
												<ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
											) : (
												<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
											)}
										</div>

										{/* Round Body (Expanded) */}
										{isExpanded && (
											<div className="px-3 pb-3 space-y-3 border-t border-border/50">
												{/* Name */}
												<div className="pt-3">
													<Label className="text-xs">
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
														className="h-8 text-sm mt-1"
													/>
												</div>

												{/* Heats, Rotations, Advancing */}
												<div
													className={`grid ${isLast ? "grid-cols-2" : "grid-cols-3"} gap-2`}
												>
													<div>
														<Label className="text-xs">
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
															className="h-8 text-sm mt-1"
														/>
													</div>
													<div>
														<Label className="text-xs">
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
															className="h-8 text-sm mt-1"
														/>
													</div>
													{!isLast && (
														<div>
															<Label className="text-xs">
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
																className="h-8 text-sm mt-1"
															/>
															<p className="text-[10px] text-muted-foreground mt-0.5">
																per gender
															</p>
														</div>
													)}
												</div>

												{/* Scoring Mode */}
												<div>
													<Label className="text-xs">
														Scoring Mode
													</Label>
													<div className="flex gap-1 mt-1">
														{(
															[
																"selection",
																"ranking",
																"scoring",
															] as ScoringMode[]
														)
															.filter((mode) =>
																// Hide "selection" for final rounds — finals only support ranking and scoring
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
																	className={`h-7 text-xs flex-1 capitalize ${
																		round.scoringMode !==
																		mode
																			? "bg-transparent text-foreground"
																			: ""
																	}`}
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

												{/* Scoring Categories (only for scoring mode) */}
												{round.scoringMode ===
													"scoring" && (
													<div className="bg-muted/50 rounded-md p-2 space-y-2">
														<div className="flex items-center justify-between">
															<Label className="text-xs text-muted-foreground">
																Scoring
																Categories
															</Label>
															<Button
																size="sm"
																variant="ghost"
																className="h-5 text-[10px] px-1.5"
																onClick={() =>
																	addScoringCategory(
																		round.id,
																	)
																}
															>
																<Plus className="h-2.5 w-2.5 mr-0.5" />
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
																	className="h-7 text-xs flex-1"
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
																	className="h-7 text-xs w-16"
																	title="Weight multiplier"
																/>
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-6 w-6 text-destructive hover:text-destructive"
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
													<Label className="text-xs">
														Pairing
													</Label>
													<div className="flex gap-1 mt-1">
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
																className={`h-7 text-xs flex-1 capitalize ${
																	round.pairingMode !==
																	mode
																		? "bg-transparent text-foreground"
																		: ""
																}`}
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
													<Label className="text-xs">
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
														<SelectTrigger className="h-8 text-xs mt-1">
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

												{/* Finals Judge Mode (for selection/ranking/scoring rounds) */}
												{(round.scoringMode ===
													"selection" ||
													round.scoringMode ===
														"ranking" ||
													round.scoringMode ===
														"scoring") && (
													<div>
														<Label className="text-xs">
															Judge-Competitor
															Matching
														</Label>
														<div className="flex gap-1 mt-1">
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
																	className={`h-7 text-xs flex-1 ${
																		(round.finalsJudgeMode ||
																			"cross_gender") !==
																		mode
																			? "bg-transparent text-foreground"
																			: ""
																	}`}
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
														<p className="text-[10px] text-muted-foreground mt-1">
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

						{configHasChanges && (
							<div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
								<AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
								<div className="flex-1">
									<p className="text-xs font-medium text-amber-500">
										Unsaved Changes
									</p>
									<p className="text-[10px] text-muted-foreground">
										The changes to your competition
										structure won't be visible to judges
										until you save.
									</p>
								</div>
							</div>
						)}

						{/* Save / Reset Buttons */}
						<div className="flex gap-2 mt-3">
							<Button
								size="sm"
								className={`flex-1 h-9 text-xs font-semibold shadow-sm transition-all ${
									configHasChanges
										? "bg-amber-500 hover:bg-amber-600 text-white animate-pulse-subtle"
										: ""
								}`}
								onClick={handleSaveConfig}
								disabled={isSavingConfig || !configHasChanges}
							>
								<Save className="h-3.5 w-3.5 mr-1.5" />
								{isSavingConfig
									? "Saving..."
									: configHasChanges
										? "Save Configuration"
										: "Structure Saved"}
							</Button>
							{configHasChanges && (
								<Button
									size="sm"
									variant="outline"
									className="h-8 text-xs bg-transparent"
									onClick={handleRevertConfig}
									title="Revert to saved configuration"
								>
									<X className="h-3 w-3" />
								</Button>
							)}
							<Button
								size="sm"
								variant="outline"
								className="h-8 text-xs bg-transparent"
								onClick={handleResetConfig}
								title="Reset to default 3-round structure"
							>
								<RotateCcw className="h-3 w-3" />
							</Button>
						</div>
					</div>

					{/* Quick Links */}
					<div className="space-y-3">
						<h4 className="text-sm font-medium text-foreground">
							Quick Links
						</h4>

						{/* Registration Link */}
						<div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium">
									Registration
								</p>
								<p className="text-xs text-muted-foreground truncate">
									{registrationLink}
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={() =>
									copyLink(registrationLink, "Registration")
								}
							>
								{copiedLink === registrationLink ? (
									<Check className="h-4 w-4 text-emerald-500" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</Button>
							<Dialog
								open={isQRDialogOpen}
								onOpenChange={setIsQRDialogOpen}
							>
								<DialogTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8"
									>
										<QrCode className="h-4 w-4" />
									</Button>
								</DialogTrigger>
								<DialogContent className="sm:max-w-md">
									<DialogHeader>
										<DialogTitle>
											Registration QR Code
										</DialogTitle>
										<DialogDescription>
											Competitors can scan this QR code to
											register for {event.name}
										</DialogDescription>
									</DialogHeader>
									<div className="flex flex-col items-center py-6">
										<img
											src={getQRCodeUrl(registrationLink)}
											alt="Registration QR Code"
											className="w-48 h-48 rounded-lg border"
										/>
										<p className="text-sm text-muted-foreground mt-4 text-center break-all">
											{registrationLink}
										</p>
									</div>
									<DialogFooter>
										<Button
											variant="outline"
											onClick={() =>
												setIsQRDialogOpen(false)
											}
										>
											Close
										</Button>
										<Button
											onClick={() =>
												copyLink(
													registrationLink,
													"Registration",
												)
											}
										>
											<Copy className="w-4 h-4 mr-2" />
											Copy Link
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</div>

						{/* Display Link */}
						<div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium">
									Display / Projector
								</p>
								<p className="text-xs text-muted-foreground truncate">
									{displayLink}
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={() => copyLink(displayLink, "Display")}
							>
								{copiedLink === displayLink ? (
									<Check className="h-4 w-4 text-emerald-500" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={() =>
									window.open(displayLink, "_blank")
								}
							>
								<Link className="h-4 w-4" />
							</Button>
						</div>

						{/* Export All Data */}
						<div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium">
									Export All Data
								</p>
								<p className="text-xs text-muted-foreground">
									Excel file with embedded images
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={handleExportAll}
								title="Export as Excel with embedded images"
							>
								<Download className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{/* Danger Zone */}
					<div className="pt-4 border-t border-border">
						<h4 className="text-sm font-medium text-destructive mb-3">
							Danger Zone
						</h4>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant="destructive"
									size="sm"
									className="w-full"
								>
									<RefreshCw className="h-4 w-4 mr-2" />
									Reset Event Data
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										Reset Event Data?
									</AlertDialogTitle>
									<AlertDialogDescription>
										This will clear all competitions,
										rotations, rounds, heats and votes for "
										{event.name}". The event itself will
										remain. This action cannot be undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>
										Cancel
									</AlertDialogCancel>
									<AlertDialogAction
										onClick={handleResetEvent}
										className="bg-destructive text-destructive-foreground"
									>
										<Trash2 className="h-4 w-4 mr-2" />
										Reset Data
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</CardContent>
			</Card>

			{/* Rebuild Round Confirmation Dialog */}
			<AlertDialog
				open={isRebuildDialogOpen}
				onOpenChange={setIsRebuildDialogOpen}
			>
				<AlertDialogContent className="max-w-md">
					<AlertDialogHeader>
						<div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
							<RefreshCw className="h-6 w-6 text-amber-500" />
						</div>
						<AlertDialogTitle>
							Apply Structures Now?
						</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="space-y-3">
								<p>
									Your competition structure has been saved.
									To apply these changes (heats, rotations,
									pairings) to the current round, we need to
									re-generate the heats.
								</p>
								<div className="p-3 bg-muted rounded-lg text-xs space-y-2">
									<p className="font-semibold text-foreground">
										What happens next:
									</p>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>
											Current heats for{" "}
											<strong>
												{getRoundName(
													event,
													event.currentRound,
												)}
											</strong>{" "}
											will be deleted
										</li>
										<li>
											New heats will be created using your
											new settings
										</li>
										<li>
											All previous rounds' data will
											remain safe
										</li>
									</ul>
								</div>
								<p className="text-amber-500 font-medium">
									Note: This will reset the current round's
									progress!
								</p>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="mt-6">
						<AlertDialogCancel
							onClick={() => setIsRebuildDialogOpen(false)}
						>
							Later
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleRebuildRound}
							className="bg-amber-500 hover:bg-amber-600 text-white"
						>
							Apply & Regenerate
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
