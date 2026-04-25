"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
	ChevronLeft,
	ChevronRight,
	MonitorPlay,
	ZoomIn,
	ZoomOut,
	Eye,
	Radio,
	Play,
	SkipForward,
	SkipBack,
	RotateCcw,
	Sparkles,
	ListOrdered,
	Shuffle,
	CheckCircle,
} from "lucide-react";
import type { Event } from "@/lib/types";
import type { Socket } from "socket.io-client";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "@/lib/socket-events";
import {
	getCompetitionConfig,
	getSortedRounds,
	isFinalRound,
} from "@/lib/competition-config";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface AdminRemotePanelProps {
	event: Event;
	socket?: TypedSocket | null;
}

export function AdminRemotePanel({ event, socket }: AdminRemotePanelProps) {
	// Local state for instant UI, initialized from GCS-persisted event data
	const [currentSlide, setCurrentSlide] = useState(
		event.displayState?.currentSlide || "welcome",
	);
	const [zoomLevel, setZoomLevel] = useState(
		event.displayState?.zoomLevel || 150,
	);
	const [showArrows, setShowArrows] = useState(
		event.displayState?.showArrows !== false,
	);

	// Keep in sync with persisted event data (covers tab switch, refresh)
	const persistedSlide = event.displayState?.currentSlide;
	const persistedZoom = event.displayState?.zoomLevel;
	const persistedArrows = event.displayState?.showArrows;

	useEffect(() => {
		if (persistedSlide) setCurrentSlide(persistedSlide);
	}, [persistedSlide]);
	useEffect(() => {
		if (persistedZoom !== undefined) setZoomLevel(persistedZoom);
	}, [persistedZoom]);
	useEffect(() => {
		if (persistedArrows !== undefined) setShowArrows(persistedArrows);
	}, [persistedArrows]);

	// Also listen for real-time socket events for instant sync
	useEffect(() => {
		if (!socket) return;
		const onSlide = ({ slide }: { eventId: string; slide: string }) =>
			setCurrentSlide(slide);
		const onZoom = ({
			zoomLevel: z,
		}: {
			eventId: string;
			zoomLevel: number;
		}) => setZoomLevel(z);
		const onArrows = ({ show }: { eventId: string; show: boolean }) =>
			setShowArrows(show);
		socket.on("display:slide", onSlide);
		socket.on("display:zoom", onZoom);
		socket.on("display:showArrows", onArrows);
		return () => {
			socket.off("display:slide", onSlide);
			socket.off("display:zoom", onZoom);
			socket.off("display:showArrows", onArrows);
		};
	}, [socket]);

	const config = useMemo(() => getCompetitionConfig(event), [event]);
	const sortedRounds = useMemo(() => getSortedRounds(config), [config]);

	const getSlideLabel = useCallback(
		(slide: string) => {
			const baseLabels: Record<string, string> = {
				welcome: "Welcome",
				males: "Male Dancers",
				females: "Female Dancers",
				judges: "Judges",
				flow: "Competition Flow",
				"winner-male": "Winner (M)",
				"winner-female": "Winner (F)",
				celebration: "Celebration",
			};
			if (baseLabels[slide]) return baseLabels[slide];
			for (const round of sortedRounds) {
				const name = round.name || `Round ${round.order}`;
				if (slide === `pairing-${round.id}`)
					return `${name} Pairings (M/F)`;
				if (slide === `live-${round.id}`) {
					const mode =
						round.scoringMode === "scoring"
							? "Scoring"
							: round.scoringMode === "ranking"
								? "Ranking"
								: "Selection";
					return `${name} Live (${mode})`;
				}
				if (slide === `live-male-${round.id}`)
					return `${name} Live (M)`;
				if (slide === `live-female-${round.id}`)
					return `${name} Live (F)`;
				if (slide === `finals-male-${round.id}`)
					return `${name} Pairings (M)`;
				if (slide === `finals-female-${round.id}`)
					return `${name} Pairings (F)`;
				if (slide === `finals-individuals-male-${round.id}`)
					return `${name} Pairings (M)`;
				if (slide === `finals-individuals-female-${round.id}`)
					return `${name} Pairings (F)`;
				if (slide === `results-${round.id}-male`)
					return `${name} Results (M)`;
				if (slide === `results-${round.id}-female`)
					return `${name} Results (F)`;
			}
			return slide;
		},
		[sortedRounds, config],
	);

	const effectiveSlideOrder = useMemo(() => {
		const base = ["welcome", "males", "females", "judges", "flow"];
		const roundSlides: string[] = [];
		const lastRoundIndex = sortedRounds.length - 1;
		for (let i = 0; i < sortedRounds.length; i++) {
			const round = sortedRounds[i];
			const isFinal_ = isFinalRound(round, config);
			const isLastRound = i === lastRoundIndex;
			if (isFinal_) {
				const hasPairing = round.pairingMode !== "none";
				if (hasPairing) {
					roundSlides.push(
						`finals-male-${round.id}`,
						`finals-female-${round.id}`,
					);
				} else {
					// No pairing — show individual finalists and judges
					roundSlides.push(
						`finals-individuals-male-${round.id}`,
						`finals-individuals-female-${round.id}`,
					);
				}
				roundSlides.push(
					`results-${round.id}-male`,
					`results-${round.id}-female`,
				);
				if (isLastRound) {
					roundSlides.push(
						"winner-male",
						"winner-female",
						"celebration",
					);
				}
			} else {
				roundSlides.push(
					`pairing-${round.id}`,
					`live-${round.id}`,
					`results-${round.id}-male`,
					`results-${round.id}-female`,
				);
			}
		}
		return [...base, ...roundSlides];
	}, [sortedRounds, config]);

	const currentIndex = effectiveSlideOrder.indexOf(currentSlide);

	const emitSlide = useCallback(
		(slide: string) => {
			setCurrentSlide(slide); // instant local update
			socket?.emit("display:slide", { eventId: event.id, slide });
		},
		[socket, event.id],
	);

	const nextSlide = useCallback(() => {
		const idx = (currentIndex + 1) % effectiveSlideOrder.length;
		const slide = effectiveSlideOrder[idx];
		emitSlide(slide);
		toast.info(`▶ ${getSlideLabel(slide)}`, { duration: 1500 });
	}, [currentIndex, effectiveSlideOrder, emitSlide, getSlideLabel]);

	const prevSlide = useCallback(() => {
		const idx =
			(currentIndex - 1 + effectiveSlideOrder.length) %
			effectiveSlideOrder.length;
		const slide = effectiveSlideOrder[idx];
		emitSlide(slide);
		toast.info(`◀ ${getSlideLabel(slide)}`, { duration: 1500 });
	}, [currentIndex, effectiveSlideOrder, emitSlide, getSlideLabel]);

	const handleZoom = useCallback(
		(newZoom: number) => {
			setZoomLevel(newZoom);
			socket?.emit("display:zoom", {
				eventId: event.id,
				zoomLevel: newZoom,
			});
			toast.info(`🔍 Zoom: ${newZoom}%`, { duration: 1000 });
		},
		[socket, event.id],
	);

	const handleToggleArrows = useCallback(
		(show: boolean) => {
			setShowArrows(show);
			socket?.emit("display:showArrows", { eventId: event.id, show });
			toast.info(
				show ? "Arrows visible on display" : "Arrows hidden on display",
				{ duration: 1500 },
			);
		},
		[socket, event.id],
	);

	const [interactionIndex, setInteractionIndex] = useState(0);
	const [interactionPhase, setInteractionPhase] = useState("intro");
	const [shuffleSeed, setShuffleSeed] = useState(0);

	// Reset interaction state when slide changes
	useEffect(() => {
		setInteractionIndex(0);
		setInteractionPhase("intro");
		setShuffleSeed(Date.now());
	}, [currentSlide]);

	const emitAction = useCallback(
		(action: string, payload?: any) => {
			socket?.emit("display:action", {
				eventId: event.id,
				action,
				payload,
			} as any);
		},
		[socket, event.id],
	);

	const handleInteraction = useCallback(
		(
			type:
				| "next"
				| "prev"
				| "reveal"
				| "finish"
				| "startOver"
				| "orderly"
				| "random",
		) => {
			let newIndex = interactionIndex;
			let newPhase = interactionPhase;
			let newSeed = shuffleSeed;

			if (type === "reveal") {
				newPhase = "reveal";
			} else if (type === "finish") {
				newPhase = "finish";
			} else if (type === "startOver") {
				newPhase = "intro";
				newIndex = 0;
			} else if (type === "orderly") {
				newPhase = "reveal";
				newIndex = 0;
			} else if (type === "random") {
				newPhase = "reveal";
				newIndex = 0;
				newSeed = Date.now();
				setShuffleSeed(newSeed);
			} else if (type === "next") {
				newIndex = interactionIndex + 1;
				if (interactionPhase === "intro") newPhase = "reveal";
			} else if (type === "prev") {
				newIndex = Math.max(0, interactionIndex - 1);
			}

			setInteractionIndex(newIndex);
			setInteractionPhase(newPhase);

			// Send action to display
			// For next/prev, don't send index payload — let the display handle its own bounds and finish
			if (type === "next" || type === "prev") {
				emitAction(type);
			} else {
				const payload: Record<string, any> = {
					index: newIndex,
					phase: newPhase,
				};
				if (type === "random") {
					payload.seed = newSeed;
				}
				emitAction(type, payload);
			}
		},
		[interactionIndex, interactionPhase, shuffleSeed, emitAction],
	);

	// Determine if current slide has interactive content
	const isInteractiveSlide =
		currentSlide.startsWith("pairing-") ||
		currentSlide.startsWith("finals-male-") ||
		currentSlide.startsWith("finals-female-") ||
		currentSlide.startsWith("results-") ||
		currentSlide.startsWith("live-");

	return (
		<div className="border border-border rounded-xl bg-card overflow-hidden">
			{/* Header */}
			<div className="px-5 py-4 border-b border-border bg-card/50 flex items-center gap-3">
				<div className="p-2 bg-primary/10 rounded-lg">
					<MonitorPlay className="w-5 h-5 text-primary" />
				</div>
				<div className="flex-1">
					<h3 className="text-sm font-bold text-foreground uppercase tracking-tight">
						Display Remote
					</h3>
					<p className="text-xs text-muted-foreground">
						Control all connected display screens
					</p>
				</div>
				<div className="flex items-center gap-1.5 text-xs text-emerald-500">
					<Radio className="w-3 h-3 animate-pulse" />
					<span className="font-medium">Live</span>
				</div>
			</div>

			{/* Navigation */}
			<div className="p-5 border-b border-border">
				<p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-3">
					Navigation
				</p>
				<div className="flex items-center gap-3">
					<Button
						variant="outline"
						onClick={prevSlide}
						className="flex-1 h-12 bg-transparent gap-2 font-semibold"
					>
						<ChevronLeft className="w-5 h-5" /> Prev
					</Button>
					<div className="text-center min-w-[60px]">
						<p className="text-2xl font-black text-foreground tabular-nums">
							{currentIndex + 1}
						</p>
						<p className="text-[10px] text-muted-foreground">
							of {effectiveSlideOrder.length}
						</p>
					</div>
					<Button
						onClick={nextSlide}
						className="flex-1 h-12 bg-primary text-primary-foreground gap-2 font-semibold"
					>
						Next <ChevronRight className="w-5 h-5" />
					</Button>
				</div>
				<div className="mt-3 px-3 py-2 bg-muted/50 rounded-lg text-center">
					<p className="text-xs text-muted-foreground">Now showing</p>
					<p className="text-sm font-bold text-foreground">
						{getSlideLabel(currentSlide)}
					</p>
				</div>
			</div>

			{/* Settings */}
			<div className="p-5 border-b border-border">
				<p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-3">
					Settings
				</p>
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Eye className="w-4 h-4 text-muted-foreground" />
							<span className="text-sm text-foreground">
								Show arrows on display
							</span>
						</div>
						<Switch
							checked={showArrows}
							onCheckedChange={handleToggleArrows}
						/>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-sm text-foreground flex items-center gap-2">
							<ZoomIn className="w-4 h-4 text-muted-foreground" />{" "}
							Zoom
						</span>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8 bg-transparent"
								onClick={() =>
									handleZoom(Math.max(zoomLevel - 10, 50))
								}
								disabled={zoomLevel <= 50}
							>
								<ZoomOut className="w-3.5 h-3.5" />
							</Button>
							<button
								onClick={() => handleZoom(100)}
								className="text-xs font-bold text-muted-foreground min-w-[40px] text-center hover:text-foreground transition-colors"
							>
								{zoomLevel}%
							</button>
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8 bg-transparent"
								onClick={() =>
									handleZoom(Math.min(zoomLevel + 10, 200))
								}
								disabled={zoomLevel >= 200}
							>
								<ZoomIn className="w-3.5 h-3.5" />
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Slide Actions — contextual controls for interactive slides */}
			{isInteractiveSlide && (
				<div className="p-5 border-b border-border">
					<p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-3">
						Slide Actions
					</p>
					<div className="grid grid-cols-2 gap-2">
						<Button
							variant="outline"
							size="sm"
							className="bg-transparent gap-2"
							onClick={() => {
								handleInteraction("reveal");
								toast.info("▶ Reveal", { duration: 1000 });
							}}
						>
							<Sparkles className="w-4 h-4 text-amber-500" />
							Reveal
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="bg-transparent gap-2"
							onClick={() => {
								handleInteraction("finish");
								toast.info("✓ Finish / View All", {
									duration: 1000,
								});
							}}
						>
							<CheckCircle className="w-4 h-4 text-emerald-500" />
							Finish
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="bg-transparent gap-2"
							onClick={() => {
								handleInteraction("prev");
							}}
						>
							<SkipBack className="w-4 h-4" />
							Prev Item
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="bg-transparent gap-2"
							onClick={() => {
								handleInteraction("next");
							}}
						>
							<SkipForward className="w-4 h-4" />
							Next Item
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="bg-transparent gap-2"
							onClick={() => {
								handleInteraction("orderly");
								toast.info("Orderly reveal", {
									duration: 1000,
								});
							}}
						>
							<ListOrdered className="w-4 h-4 text-amber-500" />
							Orderly
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="bg-transparent gap-2"
							onClick={() => {
								handleInteraction("random");
								toast.info("Random reveal", { duration: 1000 });
							}}
						>
							<Shuffle className="w-4 h-4 text-purple-500" />
							Random
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="bg-transparent gap-2 col-span-2"
							onClick={() => {
								handleInteraction("startOver");
								toast.info("↺ Start Over", { duration: 1000 });
							}}
						>
							<RotateCcw className="w-4 h-4" />
							Start Over
						</Button>
					</div>
				</div>
			)}

			{/* Slide List */}
			<div className="p-5">
				<p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-3">
					Slides
				</p>
				<div className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-hide">
					{effectiveSlideOrder.map((slide, idx) => {
						const isActive = slide === currentSlide;
						return (
							<button
								key={slide}
								onClick={() => emitSlide(slide)}
								className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all text-sm ${
									isActive
										? "bg-primary/15 border border-primary/30 text-foreground"
										: "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
								}`}
							>
								<span
									className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
										isActive
											? "bg-primary text-primary-foreground"
											: "bg-muted text-muted-foreground"
									}`}
								>
									{idx + 1}
								</span>
								<span className="truncate font-medium">
									{getSlideLabel(slide)}
								</span>
								{isActive && (
									<span className="ml-auto shrink-0 w-2 h-2 rounded-full bg-primary animate-pulse" />
								)}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
