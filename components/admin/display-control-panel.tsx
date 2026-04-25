"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { WelcomeSlide } from "@/components/display/welcome-slide";
import { JudgesSlide } from "@/components/display/judges-slide";
import { CompetitorsSlide } from "@/components/display/competitors-slide";
import { FlowSlide } from "@/components/display/flow-slide";
import { LiveStatusSlide } from "@/components/display/live-status-slide";
import { PairingSlide } from "@/components/display/pairing-slide";
import { ResultsSlide } from "@/components/display/results-slide";
import { FinalsPairingSlide } from "@/components/display/finals-pairing-slide";
import { IndividualDancersSlide } from "@/components/display/individual-dancers-slide";
import { FinalsResultsSlide } from "@/components/display/finals-results-slide";
import { WinnerSlide } from "@/components/display/winner-slide";
import { CelebrationSlide } from "@/components/display/celebration-slide";
import { Button } from "@/components/ui/button";
import {
	getCompetitionConfig,
	getSortedRounds,
	isFinalRound,
	getFinalsJudgeMode,
	getScoringMode,
	calculateRankings as libCalculateRankings,
} from "@/lib/competition-config";
import type { Competitor, Vote, RoundType, Event, Heat } from "@/lib/types";
import {
	ChevronLeft,
	ChevronRight,
	AlertCircle,
	MonitorPlay,
	Maximize,
	Minimize,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Socket } from "socket.io-client";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "@/lib/socket-events";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface DisplayControlPanelProps {
	event: Event;
	refreshEvent: () => Promise<void>;
	socket?: TypedSocket | null;
}

function calculateRankings(
	event: Event,
	competitors: Competitor[],
	votes: Vote[],
	gender: "male" | "female",
	includeEliminated: boolean = false,
	useWeightedScoring: boolean = false,
	targetRound?: RoundType,
): Competitor[] {
	if (targetRound) {
		return libCalculateRankings(
			event,
			competitors,
			votes,
			gender,
			targetRound,
			includeEliminated,
		);
	}
	const genderCompetitors = competitors.filter(
		(c) => c.gender === gender && (includeEliminated || !c.eliminated),
	);
	// Fallback: sort descending (legacy behavior when no targetRound)
	return genderCompetitors.sort((a, b) => b.voteCount - a.voteCount);
}
export function DisplayControlPanel({
	event,
	refreshEvent,
	socket,
}: DisplayControlPanelProps) {
	// Local state for instant UI, synced from GCS-persisted event data
	const [currentSlide, setCurrentSlide] = useState<string>(
		event.displayState?.currentSlide || "welcome",
	);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [zoomLevel, setZoomLevel] = useState(
		event.displayState?.zoomLevel || 150,
	);
	const [showArrows, setShowArrows] = useState(
		event.displayState?.showArrows !== false,
	);
	const containerRef = useRef<HTMLDivElement>(null);

	// Sync from persisted event data (covers tab switch, refresh)
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

	// Listen for real-time socket events
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
		// Forward display:action to DOM event for slide components in embedded preview
		const onAction = ({
			action,
			payload,
		}: {
			eventId: string;
			action: string;
			payload?: any;
		}) => {
			window.dispatchEvent(
				new CustomEvent("display-action", {
					detail: { action, payload },
				}),
			);
		};
		socket.on("display:action", onAction);
		return () => {
			socket.off("display:slide", onSlide);
			socket.off("display:zoom", onZoom);
			socket.off("display:showArrows", onArrows);
			socket.off("display:action", onAction);
		};
	}, [socket]);

	const zoomIn = useCallback(() => {
		const newZ = Math.min(zoomLevel + 10, 200);
		setZoomLevel(newZ);
		socket?.emit("display:zoom", { eventId: event.id, zoomLevel: newZ });
	}, [socket, event.id, zoomLevel]);
	const zoomOut = useCallback(() => {
		const newZ = Math.max(zoomLevel - 10, 50);
		setZoomLevel(newZ);
		socket?.emit("display:zoom", { eventId: event.id, zoomLevel: newZ });
	}, [socket, event.id, zoomLevel]);
	const zoomReset = useCallback(() => {
		setZoomLevel(150);
		socket?.emit("display:zoom", { eventId: event.id, zoomLevel: 150 });
	}, [socket, event.id]);

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

			// Dynamic round-based slides
			for (const round of sortedRounds) {
				const name = round.name || `Round ${round.order}`;
				const scoringMode = round.scoringMode || "selection";
				const modeLabel =
					scoringMode === "scoring"
						? "Scoring"
						: scoringMode === "ranking"
							? "Ranking"
							: "Selection";

				if (slide === `pairing-${round.id}`) {
					return `${name} Pairings (M/F)`;
				}
				if (slide === `live-${round.id}`) {
					return `${name} Live (${modeLabel})`;
				}
				if (slide === `live-male-${round.id}`) {
					return `${name} Live (M)`;
				}
				if (slide === `live-female-${round.id}`) {
					return `${name} Live (F)`;
				}
				if (slide === `finals-male-${round.id}`) {
					return `${name} Pairings (M)`;
				}
				if (slide === `finals-female-${round.id}`) {
					return `${name} Pairings (F)`;
				}
				if (slide === `finals-individuals-male-${round.id}`) {
					return `${name} Competitors (M)`;
				}
				if (slide === `finals-individuals-female-${round.id}`) {
					return `${name} Competitors (F)`;
				}
				if (slide === `results-${round.id}-male`) {
					return `${name} Results (M)`;
				}
				if (slide === `results-${round.id}-female`) {
					return `${name} Results (F)`;
				}
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

	const nextSlide = useCallback(() => {
		const currentIndex = effectiveSlideOrder.indexOf(currentSlide);
		const nextIndex = (currentIndex + 1) % effectiveSlideOrder.length;
		const newSlide = effectiveSlideOrder[nextIndex];
		setCurrentSlide(newSlide);
		socket?.emit("display:slide", { eventId: event.id, slide: newSlide });
	}, [currentSlide, effectiveSlideOrder, socket, event.id]);

	const prevSlide = useCallback(() => {
		const currentIndex = effectiveSlideOrder.indexOf(currentSlide);
		const prevIndex =
			(currentIndex - 1 + effectiveSlideOrder.length) %
			effectiveSlideOrder.length;
		const newSlide = effectiveSlideOrder[prevIndex];
		setCurrentSlide(newSlide);
		socket?.emit("display:slide", { eventId: event.id, slide: newSlide });
	}, [currentSlide, effectiveSlideOrder, socket, event.id]);

	const toggleFullscreen = useCallback(async () => {
		if (!containerRef.current) return;
		if (!document.fullscreenElement) {
			try {
				await containerRef.current.requestFullscreen();
				setIsFullscreen(true);
			} catch (err) {
				console.error(
					`Error attempting to enable full-screen mode: ${err}`,
				);
			}
		} else {
			await document.exitFullscreen();
			setIsFullscreen(false);
		}
	}, []);

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () =>
			document.removeEventListener(
				"fullscreenchange",
				handleFullscreenChange,
			);
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore keyboard shortcuts when typing in an input or textarea
			const tag = (e.target as HTMLElement)?.tagName;
			if (
				tag === "INPUT" ||
				tag === "TEXTAREA" ||
				(e.target as HTMLElement)?.isContentEditable
			) {
				return;
			}
			if (e.key === "ArrowRight" || e.key === " ") {
				e.preventDefault();
				nextSlide();
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				prevSlide();
			} else if (e.key.toLowerCase() === "f") {
				e.preventDefault();
				toggleFullscreen();
			} else if (e.key === "+" || e.key === "=") {
				e.preventDefault();
				zoomIn();
			} else if (e.key === "-" || e.key === "_") {
				e.preventDefault();
				zoomOut();
			} else if (e.key === "0") {
				e.preventDefault();
				zoomReset();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [nextSlide, prevSlide, toggleFullscreen, zoomIn, zoomOut, zoomReset]);

	// Helper: find heats for a specific round
	const getHeatsForRound = (roundId: string) =>
		event.heats.filter((h) => h.round === roundId);

	// Helper: get current heat for a round
	const getCurrentHeatForRound = (roundId: string): Heat | undefined =>
		event.heats.find(
			(h) => h.number === event.currentHeat && h.round === roundId,
		);

	// Helper: check if a round has been reached (has heats or current round order >= this round)
	const isRoundReached = (roundId: string): boolean => {
		// If this round has heats, it's been reached
		if (event.heats.some((h) => h.round === roundId)) return true;
		// Check by round order: current round order >= target round order
		const targetRound = sortedRounds.find((r) => r.id === roundId);
		const currentRound = sortedRounds.find(
			(r) => r.id === event.currentRound,
		);
		if (targetRound && currentRound) {
			return currentRound.order >= targetRound.order;
		}
		return false;
	};

	// Helper: check if a round has completed voting (all heats submitted)
	const isRoundComplete = (roundId: string): boolean => {
		const heats = getHeatsForRound(roundId);
		return (
			heats.length > 0 &&
			heats.every((h) => h.votingStatus === "submitted")
		);
	};

	// Placeholder for slides not yet available
	const notAvailableYet = (label: string) => (
		<div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center">
			<AlertCircle className="w-16 h-16 text-muted-foreground/30 mb-4" />
			<h2 className="text-xl font-bold text-muted-foreground mb-2">
				{label}
			</h2>
			<p className="text-sm text-muted-foreground/60">
				This will be available when the round starts
			</p>
		</div>
	);

	// Helper: apply tie-up ordering
	const applyTieUp = (
		rankings: Competitor[],
		roundId: string,
		gender: "male" | "female",
	): Competitor[] => {
		let tieUpIds: string[] | undefined =
			gender === "male"
				? event.tieUpData?.[roundId]?.male
				: event.tieUpData?.[roundId]?.female;
		if (!tieUpIds || tieUpIds.length === 0) {
			if (roundId === "round1")
				tieUpIds =
					gender === "male"
						? event.tieUpRound1Male
						: event.tieUpRound1Female;
			else if (roundId === "round2")
				tieUpIds =
					gender === "male"
						? event.tieUpRound2Male
						: event.tieUpRound2Female;
			else
				tieUpIds =
					gender === "male"
						? event.tieUpFinalsMale
						: event.tieUpFinalsFemale;
		}
		if (tieUpIds && tieUpIds.length > 0) {
			const map = new Map(rankings.map((c) => [c.id, c]));
			const tied = tieUpIds
				.map((id) => map.get(id))
				.filter(Boolean) as Competitor[];
			const rest = rankings.filter((c) => !tieUpIds!.includes(c.id));
			return [...tied, ...rest];
		}
		return rankings;
	};

	const renderSlide = () => {
		// Static slides
		switch (currentSlide) {
			case "welcome":
				return <WelcomeSlide event={event} />;
			case "judges":
				return <JudgesSlide judges={event.judges} />;
			case "males":
				return (
					<CompetitorsSlide
						competitors={event.competitors}
						gender="male"
					/>
				);
			case "females":
				return (
					<CompetitorsSlide
						competitors={event.competitors}
						gender="female"
					/>
				);
			case "flow":
				return <FlowSlide event={event} />;
			case "winner-male":
			case "winner-female": {
				const gender =
					currentSlide === "winner-male" ? "male" : "female";
				const finalsRound = sortedRounds.find((r) =>
					isFinalRound(r, config),
				);
				const finalsRoundId = finalsRound?.id || "finals";
				if (!isRoundComplete(finalsRoundId))
					return notAvailableYet(
						`Winner (${gender === "male" ? "M" : "F"})`,
					);
				const finalsVotes = event.votes.filter(
					(v) => v.round === finalsRoundId,
				);
				let rankings = calculateRankings(
					event,
					event.competitors,
					finalsVotes,
					gender,
					false,
					true,
					finalsRoundId,
				);
				rankings = applyTieUp(rankings, finalsRoundId, gender);
				const winner = rankings[0] || null;
				if (!winner)
					return notAvailableYet(
						`Winner (${gender === "male" ? "M" : "F"})`,
					);
				return (
					<WinnerSlide
						winner={winner}
						gender={gender}
						totalVotingJudges={
							event.judges.filter(
								(j) =>
									j.gender ===
									(gender === "male" ? "female" : "male"),
							).length
						}
						event={event}
					/>
				);
			}
			case "celebration": {
				const finalsRound = sortedRounds.find((r) =>
					isFinalRound(r, config),
				);
				const finalsRoundId = finalsRound?.id || "finals";
				if (!isRoundComplete(finalsRoundId))
					return notAvailableYet("Celebration");
				const finalsVotes = event.votes.filter(
					(v) => v.round === finalsRoundId,
				);
				let maleRankings = calculateRankings(
					event,
					event.competitors,
					finalsVotes,
					"male",
					false,
					true,
					finalsRoundId,
				);
				let femaleRankings = calculateRankings(
					event,
					event.competitors,
					finalsVotes,
					"female",
					false,
					true,
					finalsRoundId,
				);
				maleRankings = applyTieUp(maleRankings, finalsRoundId, "male");
				femaleRankings = applyTieUp(
					femaleRankings,
					finalsRoundId,
					"female",
				);
				if (!maleRankings[0] || !femaleRankings[0])
					return notAvailableYet("Celebration");
				return (
					<CelebrationSlide
						maleWinner={maleRankings[0]}
						femaleWinner={femaleRankings[0]}
						eventName={event.name}
					/>
				);
			}
		}

		// Dynamic round-based slides
		for (const round of sortedRounds) {
			const isFinal_ = isFinalRound(round, config);
			const roundId = round.id;

			// Pairing slide for non-final rounds
			if (currentSlide === `pairing-${roundId}` && !isFinal_) {
				if (!isRoundReached(roundId))
					return notAvailableYet(`Heat Pairings R${round.order}`);
				const heat = getCurrentHeatForRound(roundId);
				if (!heat)
					return notAvailableYet(`Heat Pairings R${round.order}`);
				const isSameGender = round.finalsJudgeMode === "same_gender";
				if (round.pairingMode === "none" || isSameGender) {
					return (
						<IndividualDancersSlide
							heat={heat}
							currentRotation={event.currentRotation || 1}
						/>
					);
				}
				return (
					<PairingSlide
						heat={heat}
						currentRotation={event.currentRotation || 1}
					/>
				);
			}

			// Finals pairing slides
			if (currentSlide === `finals-male-${roundId}` && isFinal_) {
				if (!isRoundReached(roundId))
					return notAvailableYet("Heat Pairings Final (M)");
				const finalists = event.competitors
					.filter((c) => c.gender === "male" && !c.eliminated)
					.sort((a, b) => b.voteCount - a.voteCount);
				return (
					<FinalsPairingSlide
						finalists={finalists}
						judges={event.judges}
						gender="male"
						currentHeat={event.heats.find(
							(h) =>
								h.round === roundId &&
								h.finalistGender === "male",
						)}
						judgeMode={getFinalsJudgeMode(event, roundId)}
					/>
				);
			}
			if (currentSlide === `finals-female-${roundId}` && isFinal_) {
				if (!isRoundReached(roundId))
					return notAvailableYet("Heat Pairings Final (F)");
				const finalists = event.competitors
					.filter((c) => c.gender === "female" && !c.eliminated)
					.sort((a, b) => b.voteCount - a.voteCount);
				return (
					<FinalsPairingSlide
						finalists={finalists}
						judges={event.judges}
						gender="female"
						currentHeat={event.heats.find(
							(h) =>
								h.round === roundId &&
								h.finalistGender === "female",
						)}
						judgeMode={getFinalsJudgeMode(event, roundId)}
					/>
				);
			}

			// Finals individual slides (when pairing mode is "none")
			if (
				currentSlide === `finals-individuals-male-${roundId}` &&
				isFinal_
			) {
				if (!isRoundReached(roundId))
					return notAvailableYet("Final Competitors (M)");
				const maleFinalists = event.competitors
					.filter((c) => c.gender === "male" && !c.eliminated)
					.sort((a, b) => a.number - b.number);
				return (
					<IndividualDancersSlide
						competitors={maleFinalists}
						gender="male"
						title="Male Finalists"
					/>
				);
			}
			if (
				currentSlide === `finals-individuals-female-${roundId}` &&
				isFinal_
			) {
				if (!isRoundReached(roundId))
					return notAvailableYet("Final Competitors (F)");
				const femaleFinalists = event.competitors
					.filter((c) => c.gender === "female" && !c.eliminated)
					.sort((a, b) => a.number - b.number);
				return (
					<IndividualDancersSlide
						competitors={femaleFinalists}
						gender="female"
						title="Female Finalists"
					/>
				);
			}
			// Live status slide per round
			if (currentSlide === `live-${roundId}`) {
				if (!isRoundReached(roundId))
					return notAvailableYet(
						`Live Status ${isFinal_ ? "Final" : `R${round.order}`}`,
					);
				return <LiveStatusSlide event={event} />;
			}

			// Live status slides for finals (separate male/female)
			if (
				currentSlide === `live-male-${roundId}` ||
				currentSlide === `live-female-${roundId}`
			) {
				if (!isRoundReached(roundId))
					return notAvailableYet(
						`Live Status Final (${currentSlide.includes("-male-") ? "M" : "F"})`,
					);
				return <LiveStatusSlide event={event} />;
			}

			// Results slides
			if (
				currentSlide === `results-${roundId}-male` ||
				currentSlide === `results-${roundId}-female`
			) {
				const gender = currentSlide.endsWith("-male")
					? "male"
					: "female";
				const genderLabel = gender === "male" ? "M" : "F";

				// Check if round has completed voting before showing results
				if (!isRoundComplete(roundId)) {
					const label = isFinal_
						? `Final Results (${genderLabel})`
						: `Winner R${round.order} (${genderLabel})`;
					return notAvailableYet(label);
				}

				if (isFinal_) {
					const finalsVotes = event.votes.filter(
						(v) => v.round === roundId,
					);
					let rankings = calculateRankings(
						event,
						event.competitors,
						finalsVotes,
						gender,
						false,
						true,
						roundId,
					);
					rankings = applyTieUp(rankings, roundId, gender);

					let tieUpIds: string[] | undefined =
						gender === "male"
							? event.tieUpData?.[roundId]?.male
							: event.tieUpData?.[roundId]?.female;
					if (!tieUpIds || tieUpIds.length === 0) {
						tieUpIds =
							gender === "male"
								? event.tieUpFinalsMale
								: event.tieUpFinalsFemale;
					}

					return (
						<FinalsResultsSlide
							event={event}
							finalists={rankings}
							gender={gender as "male" | "female"}
							totalVotingJudges={
								event.judges.filter(
									(j) =>
										j.gender ===
										(gender === "male" ? "female" : "male"),
								).length
							}
							tieUpIds={tieUpIds}
							round={roundId}
						/>
					);
				}

				// Non-final results
				const roundVotes = event.votes.filter(
					(v) => v.round === roundId,
				);
				let rankings = calculateRankings(
					event,
					event.competitors,
					roundVotes,
					gender as "male" | "female",
					true,
					false,
					roundId,
				);

				let tieUpIds: string[] | undefined =
					gender === "male"
						? event.tieUpData?.[roundId]?.male
						: event.tieUpData?.[roundId]?.female;
				if (!tieUpIds || tieUpIds.length === 0) {
					if (roundId === "round1")
						tieUpIds =
							gender === "male"
								? event.tieUpRound1Male
								: event.tieUpRound1Female;
					else if (roundId === "round2")
						tieUpIds =
							gender === "male"
								? event.tieUpRound2Male
								: event.tieUpRound2Female;
				}

				return (
					<ResultsSlide
						event={event}
						competitors={rankings}
						compAssistants={event.compAssistants}
						gender={gender as "male" | "female"}
						round={roundId}
						tieUpIds={tieUpIds}
					/>
				);
			}
		}

		return <WelcomeSlide event={event} />;
	};

	return (
		<div
			ref={containerRef}
			className={`relative group bg-background flex flex-col transition-all duration-500 ${
				isFullscreen
					? "fixed inset-0 z-100 h-screen w-screen rounded-none border-none"
					: "rounded-3xl border border-border shadow-2xl h-[600px]"
			}`}
		>
			{!isFullscreen && (
				<div className="bg-card/30 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between z-10 transition-all">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-primary/10 rounded-lg">
							<MonitorPlay className="w-5 h-5 text-primary" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-foreground uppercase tracking-tight">
								Embedded Display Preview
							</h3>
							<p className="text-xs text-muted-foreground font-medium">
								Controlling: {getSlideLabel(currentSlide)}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-4">
						<div className="flex -space-x-2">
							{effectiveSlideOrder.map((slide) => (
								<div
									key={slide}
									className={`w-2.5 h-1.5 rounded-full transition-all ${currentSlide === slide ? "bg-primary w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
									title={getSlideLabel(slide)}
								/>
							))}
						</div>
					</div>
				</div>
			)}

			<div className="flex-1 relative overflow-auto bg-background">
				<AnimatePresence mode="wait">
					<motion.div
						key={currentSlide}
						initial={{ opacity: 0, scale: 0.98 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 1.02 }}
						transition={{ duration: 0.3 }}
						className="w-full"
					>
						<div
							className="transition-all duration-500"
							style={{
								transform: isFullscreen
									? `scale(${zoomLevel / 100})`
									: `scale(${(zoomLevel / 100) * 0.65})`,
								transformOrigin: "top center",
							}}
						>
							{renderSlide()}
						</div>
					</motion.div>
				</AnimatePresence>

				{showArrows && (
					<div className="absolute inset-y-0 left-0 flex items-center px-4 pointer-events-none">
						<Button
							variant="ghost"
							size="icon"
							onClick={prevSlide}
							className="h-20 w-20 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-xl border border-white/20 text-white transition-all opacity-0 group-hover:opacity-100 pointer-events-auto shadow-2xl scale-110"
						>
							<ChevronLeft className="h-10 w-10" />
						</Button>
					</div>
				)}
				{showArrows && (
					<div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
						<Button
							variant="ghost"
							size="icon"
							onClick={nextSlide}
							className="h-20 w-20 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-xl border border-white/20 text-white transition-all opacity-0 group-hover:opacity-100 pointer-events-auto shadow-2xl scale-110"
						>
							<ChevronRight className="h-10 w-10" />
						</Button>
					</div>
				)}
			</div>

			{!isFullscreen && (
				<div className="bg-card/80 backdrop-blur-md border-t border-border p-6 flex items-center justify-between z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] transition-all">
					<div className="flex items-center gap-6">
						<div className="flex flex-col">
							<span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">
								Current Slide
							</span>
							<div className="px-4 py-1.5 bg-primary text-black rounded-lg text-sm font-black uppercase tracking-tight shadow-lg shadow-primary/20">
								{getSlideLabel(currentSlide)}
							</div>
						</div>
						<div className="h-10 w-px bg-border" />
						<div className="flex flex-col">
							<span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">
								Progress
							</span>
							<span className="text-xl font-black text-foreground tabular-nums tracking-tighter">
								{effectiveSlideOrder.indexOf(currentSlide) + 1}{" "}
								<span className="text-muted-foreground font-black opacity-30 text-base">
									/ {effectiveSlideOrder.length}
								</span>
							</span>
						</div>
					</div>
					<div className="flex items-center gap-8">
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								onClick={zoomOut}
								disabled={zoomLevel <= 50}
								className="bg-background/50 backdrop-blur border-border/50 h-8 w-8 shadow-lg hover:bg-accent"
							>
								<ZoomOut className="w-4 h-4 text-primary" />
							</Button>
							<button
								onClick={zoomReset}
								className="text-xs font-bold text-muted-foreground min-w-[44px] text-center hover:text-foreground transition-colors"
							>
								{zoomLevel}%
							</button>
							<Button
								variant="outline"
								size="icon"
								onClick={zoomIn}
								disabled={zoomLevel >= 200}
								className="bg-background/50 backdrop-blur border-border/50 h-8 w-8 shadow-lg hover:bg-accent"
							>
								<ZoomIn className="w-4 h-4 text-primary" />
							</Button>
						</div>
						<div className="h-10 w-px bg-border" />
						<div className="flex flex-col items-end gap-2">
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={toggleFullscreen}
									className="bg-background/50 backdrop-blur border-border/50 gap-2 font-bold px-4 h-10 shadow-lg hover:bg-accent group-hover:border-primary/30 transition-all"
								>
									{isFullscreen ? (
										<>
											<Minimize className="w-4 h-4 text-primary" />
											Exit Fullscreen
										</>
									) : (
										<>
											<Maximize className="w-4 h-4 text-primary" />
											Fullscreen
										</>
									)}
								</Button>
								<div className="h-10 w-px bg-border mx-2" />
								<div className="flex flex-col items-center">
									<kbd className="flex items-center justify-center w-8 h-8 font-sans text-xs font-bold bg-muted border-2 border-border rounded-lg shadow-sm">
										←
									</kbd>
									<span className="text-[8px] font-black uppercase mt-1 text-muted-foreground/60 tracking-tighter">
										Prev
									</span>
								</div>
								<div className="flex flex-col items-center">
									<kbd className="flex items-center justify-center w-8 h-8 font-sans text-xs font-bold bg-muted border-2 border-border rounded-lg shadow-sm">
										→
									</kbd>
									<span className="text-[8px] font-black uppercase mt-1 text-muted-foreground/60 tracking-tighter">
										Next
									</span>
								</div>
								<div className="flex flex-col items-center">
									<kbd className="flex items-center justify-center w-8 h-8 font-sans text-xs font-bold bg-muted border-2 border-border rounded-lg shadow-sm">
										F
									</kbd>
									<span className="text-[8px] font-black uppercase mt-1 text-muted-foreground/60 tracking-tighter">
										Toggle
									</span>
								</div>
								<div className="flex flex-col items-center">
									<kbd className="flex items-center justify-center px-3 h-8 font-sans text-xs font-bold bg-muted border-2 border-border rounded-lg shadow-sm">
										SPACE
									</kbd>
									<span className="text-[8px] font-black uppercase mt-1 text-muted-foreground/60 tracking-tighter">
										Next
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
