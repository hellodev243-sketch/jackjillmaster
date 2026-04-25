"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
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
import { FinalsDanceWithSlide } from "@/components/display/finals-dance-with-slide";
import { WinnerSlide } from "@/components/display/winner-slide";
import { CelebrationSlide } from "@/components/display/celebration-slide";
import { EventDeletedModal } from "@/components/event-deleted-modal";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/hooks/use-socket";
import {
	getRoundName,
	getFinalsJudgeMode,
	getSortedRounds,
	isFinalRound,
	getCompetitionConfig,
	calculateRankings as libCalculateRankings,
} from "@/lib/competition-config";
import type { Competitor, Vote, RoundType, Event } from "@/lib/types";
import {
	ChevronLeft,
	ChevronRight,
	Maximize,
	Minimize,
	Monitor,
	Loader2,
	AlertCircle,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
function calculateRankings(
	competitors: Competitor[],
	votes: Vote[],
	gender: "male" | "female",
	includeEliminated: boolean = false,
	useWeightedScoring: boolean = false,
	targetRound?: RoundType,
	event?: Event,
): Competitor[] {
	if (event && targetRound) {
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
	const voteCountMap = new Map<string, number>();
	genderCompetitors.forEach((c) => voteCountMap.set(c.id, 0));
	votes.forEach((vote) => {
		vote.rankings.forEach((r) => {
			const competitor = competitors.find((c) => c.id === r.competitorId);
			if (competitor?.gender === gender) {
				if (useWeightedScoring) {
					const points = 7 - r.rank;
					voteCountMap.set(
						r.competitorId,
						(voteCountMap.get(r.competitorId) || 0) + points,
					);
				} else {
					voteCountMap.set(
						r.competitorId,
						(voteCountMap.get(r.competitorId) || 0) + 1,
					);
				}
			}
		});
	});
	return genderCompetitors
		.map((c) => ({ ...c, voteCount: voteCountMap.get(c.id) || 0 }))
		.sort((a, b) => b.voteCount - a.voteCount);
}

type SlideType = string;
function DisplayPageContent() {
	const searchParams = useSearchParams();
	const eventId = searchParams?.get("event") || undefined;

	const {
		event,
		isLoading,
		socket,
		deletedEventInfo,
		clearDeletedEventInfo,
		refreshEvent,
	} = useSocket(eventId);
	const [currentSlide, setCurrentSlide] = useState<SlideType>("welcome");
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [showControls, setShowControls] = useState(true);
	const [showArrows, setShowArrows] = useState(true);
	const [zoomLevel, setZoomLevel] = useState(150);

	// Initialize display state from persisted event data
	useEffect(() => {
		if (!event?.displayState) return;
		if (event.displayState.currentSlide) {
			setCurrentSlide(event.displayState.currentSlide);
		}
		if (event.displayState.zoomLevel !== undefined) {
			setZoomLevel(event.displayState.zoomLevel);
		}
		if (event.displayState.showArrows !== undefined) {
			setShowArrows(event.displayState.showArrows);
		}
	}, [event?.id]); // Only on initial event load, not every update

	const zoomIn = useCallback(
		() => setZoomLevel((z) => Math.min(z + 10, 200)),
		[],
	);
	const zoomOut = useCallback(
		() => setZoomLevel((z) => Math.max(z - 10, 50)),
		[],
	);
	const zoomReset = useCallback(() => setZoomLevel(150), []);

	const config = useMemo(
		() => (event ? getCompetitionConfig(event) : null),
		[event],
	);
	const sortedRounds = useMemo(
		() => (config ? getSortedRounds(config) : []),
		[config],
	);

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

			if (!config) return slide;

			for (const round of sortedRounds) {
				const name = round.name || `Round ${round.order}`;
				const scoringMode = round.scoringMode || "selection";
				const modeLabel =
					scoringMode === "scoring"
						? "Scoring"
						: scoringMode === "ranking"
							? "Ranking"
							: "Selection";

				if (slide === `pairing-${round.id}`)
					return `${name} Pairings (M/F)`;
				if (slide === `live-${round.id}`)
					return `${name} Live (${modeLabel})`;
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
		const base: SlideType[] = [
			"welcome",
			"males",
			"females",
			"judges",
			"flow",
		];
		if (!config) return base;

		const roundSlides: SlideType[] = [];
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

	// Socket event listeners for real-time updates
	useEffect(() => {
		if (!socket) return;

		const handleVotingOpened = () => {
			toast.success("🗳️ Voting is now OPEN!", { duration: 5000 });
		};
		const handleVotingClosed = () => {
			toast.info("🔒 Voting is now CLOSED", { duration: 3000 });
		};
		const handleRoundAdvanced = ({
			newRound,
		}: {
			eventId: string;
			newRound: string;
		}) => {
			if (!event) return;
			const roundName = getRoundName(event, newRound);
			toast.success(`🎉 Advanced to ${roundName}!`, { duration: 5000 });
		};
		const handleResultsPublished = ({
			round,
		}: {
			eventId: string;
			round: string;
		}) => {
			if (!event) return;
			const roundName = getRoundName(event, round);
			toast.success(`📊 ${roundName} results published!`, {
				duration: 5000,
			});
		};

		socket.on("voting:opened", handleVotingOpened);
		socket.on("voting:closed", handleVotingClosed);
		socket.on("round:advanced", handleRoundAdvanced);
		socket.on("results:published", handleResultsPublished);

		return () => {
			socket.off("voting:opened", handleVotingOpened);
			socket.off("voting:closed", handleVotingClosed);
			socket.off("round:advanced", handleRoundAdvanced);
			socket.off("results:published", handleResultsPublished);
		};
	}, [socket, event]);

	// Listen for display control events from admin panel
	useEffect(() => {
		if (!socket) return;

		const handleZoom = ({
			zoomLevel: newZoom,
		}: {
			eventId: string;
			zoomLevel: number;
		}) => {
			setZoomLevel(newZoom);
			toast.info(`🔍 Zoom: ${newZoom}%`, { duration: 1000 });
		};
		const handleSlide = ({ slide }: { eventId: string; slide: string }) => {
			setCurrentSlide(slide);
		};
		const handleShowArrows = ({
			show,
		}: {
			eventId: string;
			show: boolean;
		}) => {
			setShowArrows(show);
			toast.info(show ? "Arrows enabled" : "Arrows hidden", {
				duration: 1500,
			});
		};

		socket.on("display:zoom", handleZoom);
		socket.on("display:slide", handleSlide);
		socket.on("display:showArrows", handleShowArrows);

		// Forward display:action to a custom DOM event so slide components can listen
		const handleAction = ({
			action,
			payload,
		}: {
			eventId: string;
			action: string;
			payload?: any;
		}) => {
			console.log(
				`[DisplayPage] Socket action received: ${action}`,
				payload ? "with payload" : "",
			);
			window.dispatchEvent(
				new CustomEvent("display-action", {
					detail: { action, payload },
				}),
			);
		};
		socket.on("display:action", handleAction);

		return () => {
			socket.off("display:zoom", handleZoom);
			socket.off("display:slide", handleSlide);
			socket.off("display:showArrows", handleShowArrows);
			socket.off("display:action", handleAction);
		};
	}, [socket]);

	// Auto-navigate on results published
	useEffect(() => {
		if (!socket) return;
		const handleResultsPublishedNavigation = async ({
			round,
		}: {
			eventId: string;
			round: string;
		}) => {
			await refreshEvent();
			setCurrentSlide(`results-${round}-male`);
		};
		socket.on("results:published", handleResultsPublishedNavigation);
		return () => {
			socket.off("results:published", handleResultsPublishedNavigation);
		};
	}, [socket, refreshEvent]);

	const nextSlide = useCallback(() => {
		const currentIndex = effectiveSlideOrder.indexOf(currentSlide);
		const nextIndex = (currentIndex + 1) % effectiveSlideOrder.length;
		setCurrentSlide(effectiveSlideOrder[nextIndex]);
	}, [currentSlide, effectiveSlideOrder]);

	const prevSlide = useCallback(() => {
		const currentIndex = effectiveSlideOrder.indexOf(currentSlide);
		const prevIndex =
			(currentIndex - 1 + effectiveSlideOrder.length) %
			effectiveSlideOrder.length;
		setCurrentSlide(effectiveSlideOrder[prevIndex]);
	}, [currentSlide, effectiveSlideOrder]);

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
			} else if (e.key === "f") {
				toggleFullscreen();
			} else if (e.key === "c") {
				setShowControls((prev) => !prev);
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
	}, [nextSlide, prevSlide, zoomIn, zoomOut, zoomReset]);

	const toggleFullscreen = async () => {
		if (!document.fullscreenElement) {
			await document.documentElement.requestFullscreen();
			setIsFullscreen(true);
		} else {
			await document.exitFullscreen();
			setIsFullscreen(false);
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-primary" />
			</div>
		);
	}

	if (!event) return null;

	// Helper: check if a round has been reached (has heats or current round order >= this round)
	const isRoundReached = (roundId: string): boolean => {
		if (event.heats.some((h) => h.round === roundId)) return true;
		const targetRound = sortedRounds.find((r) => r.id === roundId);
		const currentRound = sortedRounds.find(
			(r) => r.id === event.currentRound,
		);
		if (targetRound && currentRound) {
			return currentRound.order >= targetRound.order;
		}
		return false;
	};

	// Helper: check if a round has completed voting
	const isRoundComplete = (roundId: string): boolean => {
		const heats = event.heats.filter((h) => h.round === roundId);
		return (
			heats.length > 0 &&
			heats.every((h) => h.votingStatus === "submitted")
		);
	};

	// Placeholder for slides not yet available
	const notAvailableYet = (label: string) => (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="text-center"
			>
				<AlertCircle className="w-20 h-20 text-muted-foreground/30 mx-auto mb-6" />
				<h2 className="text-3xl font-bold text-muted-foreground mb-4">
					{label}
				</h2>
				<p className="text-xl text-muted-foreground/60">
					This will be available when the round starts
				</p>
			</motion.div>
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

	const renderSlide = (event: Event) => {
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
				const finalsRound = sortedRounds.find(
					(r) => config && isFinalRound(r, config),
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
					event.competitors,
					finalsVotes,
					gender,
					false,
					true,
					finalsRoundId,
					event,
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
				const finalsRound = sortedRounds.find(
					(r) => config && isFinalRound(r, config),
				);
				const finalsRoundId = finalsRound?.id || "finals";
				if (!isRoundComplete(finalsRoundId))
					return notAvailableYet("Celebration");
				const finalsVotes = event.votes.filter(
					(v) => v.round === finalsRoundId,
				);
				let maleRankings = calculateRankings(
					event.competitors,
					finalsVotes,
					"male",
					false,
					true,
					finalsRoundId,
					event,
				);
				let femaleRankings = calculateRankings(
					event.competitors,
					finalsVotes,
					"female",
					false,
					true,
					finalsRoundId,
					event,
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
			const isFinal_ = config ? isFinalRound(round, config) : false;
			const roundId = round.id;

			// Pairing slide for non-final rounds
			if (currentSlide === `pairing-${roundId}` && !isFinal_) {
				if (!isRoundReached(roundId))
					return notAvailableYet(`Heat Pairings R${round.order}`);
				const heat = event.heats.find(
					(h) =>
						h.number === event.currentHeat && h.round === roundId,
				);
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

			// Finals individual slides (when no pairing is selected)
			if (currentSlide === `finals-individuals-male-${roundId}` && isFinal_) {
				if (!isRoundReached(roundId))
					return notAvailableYet("Finals Competitors (M)");
				const finalists = event.competitors
					.filter((c) => c.gender === "male" && !c.eliminated)
					.sort((a, b) => b.voteCount - a.voteCount);
				return (
					<FinalsDanceWithSlide
						competitors={finalists}
						judges={event.judges}
						gender="male"
						roundName={round.name || "Finals Pairing"}
						currentHeat={event.heats.find(
							(h) =>
								h.round === roundId &&
								h.finalistGender === "male",
						)}
						judgeMode={getFinalsJudgeMode(event, roundId)}
					/>
				);
			}
			if (currentSlide === `finals-individuals-female-${roundId}` && isFinal_) {
				if (!isRoundReached(roundId))
					return notAvailableYet("Finals Competitors (F)");
				const finalists = event.competitors
					.filter((c) => c.gender === "female" && !c.eliminated)
					.sort((a, b) => b.voteCount - a.voteCount);
				return (
					<FinalsDanceWithSlide
						competitors={finalists}
						judges={event.judges}
						gender="female"
						roundName={round.name || "Finals Pairing"}
						currentHeat={event.heats.find(
							(h) =>
								h.round === roundId &&
								h.finalistGender === "female",
						)}
						judgeMode={getFinalsJudgeMode(event, roundId)}
					/>
				);
			}
			// Live status per round
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
						event.competitors,
						finalsVotes,
						gender,
						false,
						true,
						roundId,
						event,
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
					event.competitors,
					roundVotes,
					gender as "male" | "female",
					true,
					false,
					roundId,
					event,
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
		<div className="min-h-screen bg-background relative overflow-auto">
			<div
				className="min-h-screen bg-background"
				style={{
					transform: `scale(${zoomLevel / 100})`,
					transformOrigin: "center top",
					transition: "transform 0.2s ease",
					width: `${10000 / zoomLevel}%`,
					marginLeft: `${(100 - 10000 / zoomLevel) / 2}%`,
				}}
			>
				<AnimatePresence mode="wait">
					<motion.div
						key={currentSlide}
						initial={{ opacity: 0, x: 50 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -50 }}
						transition={{ duration: 0.3 }}
					>
						{renderSlide(event)}
					</motion.div>
				</AnimatePresence>
			</div>

			{/* Controls */}
			{showControls && (
				<motion.div
					className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 bg-card/90 backdrop-blur rounded-xl border border-border shadow-xl z-50"
					initial={{ y: 100, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					transition={{ delay: 0.5 }}
				>
					{showArrows && (
						<Button
							variant="outline"
							size="icon"
							onClick={prevSlide}
							className="bg-transparent h-8 w-8"
						>
							<ChevronLeft className="w-4 h-4" />
						</Button>
					)}
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground min-w-[120px] text-center">
							{getSlideLabel(currentSlide)}
						</span>
					</div>
					{showArrows && (
						<Button
							variant="outline"
							size="icon"
							onClick={nextSlide}
							className="bg-transparent"
						>
							<ChevronRight className="w-5 h-5" />
						</Button>
					)}
					<div className="w-px h-6 bg-border" />
					<Button
						variant="outline"
						size="icon"
						onClick={toggleFullscreen}
						className="bg-transparent"
					>
						{isFullscreen ? (
							<Minimize className="w-5 h-5" />
						) : (
							<Maximize className="w-5 h-5" />
						)}
					</Button>
					<div className="w-px h-6 bg-border" />
					<Button
						variant="outline"
						size="icon"
						onClick={zoomOut}
						className="bg-transparent h-8 w-8"
						disabled={zoomLevel <= 50}
					>
						<ZoomOut className="w-4 h-4" />
					</Button>
					<button
						onClick={zoomReset}
						className="text-xs text-muted-foreground min-w-[40px] text-center hover:text-foreground transition-colors"
					>
						{zoomLevel}%
					</button>
					<Button
						variant="outline"
						size="icon"
						onClick={zoomIn}
						className="bg-transparent h-8 w-8"
						disabled={zoomLevel >= 200}
					>
						<ZoomIn className="w-4 h-4" />
					</Button>
					<div className="w-px h-6 bg-border" />
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							// Navigate to the live status of the current round
							const liveSlide = `live-${event.currentRound}`;
							if (effectiveSlideOrder.includes(liveSlide)) {
								setCurrentSlide(liveSlide);
							} else {
								// Fallback: find any live slide
								const anyLive = effectiveSlideOrder.find((s) =>
									s.startsWith("live-"),
								);
								if (anyLive) setCurrentSlide(anyLive);
							}
						}}
						className="bg-transparent gap-2"
					>
						<Monitor className="w-4 h-4" />
						Live
					</Button>
				</motion.div>
			)}

			{/* Slide selector */}
			{showControls && (
				<motion.div
					className="fixed top-2 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-3 p-3 bg-card/95 backdrop-blur-md rounded-lg border border-primary/20 max-w-[95%] w-fit z-50 shadow-2xl"
					initial={{ y: -100, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
				>
					{effectiveSlideOrder.map((slide) => (
						<button
							key={slide}
							onClick={() => setCurrentSlide(slide)}
							className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md transition-all duration-200 uppercase tracking-tighter ${
								currentSlide === slide
									? "bg-primary text-black shadow-md scale-105"
									: "text-zinc-500 hover:text-zinc-200 hover:bg-muted"
							}`}
						>
							{getSlideLabel(slide)}
						</button>
					))}
				</motion.div>
			)}

			{/* Keyboard hints */}
			{showControls && (
				<div className="fixed bottom-6 right-6 text-[10px] text-muted-foreground/60 space-y-1 z-50 font-medium">
					<p>
						<span className="text-primary font-bold">
							Arrow keys
						</span>
						: Navigate
					</p>
					<p>
						<span className="text-primary font-bold">F</span>:
						Fullscreen
					</p>
					<p>
						<span className="text-primary font-bold">C</span>:
						Controls
					</p>
					<p>
						<span className="text-primary font-bold">+/-</span>:
						Zoom
					</p>
				</div>
			)}

			<EventDeletedModal
				isOpen={!!deletedEventInfo}
				eventName={deletedEventInfo?.eventName}
				onClose={clearDeletedEventInfo}
			/>
		</div>
	);
}

export default function DisplayPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-background flex items-center justify-center">
					<Loader2 className="w-8 h-8 animate-spin text-primary" />
				</div>
			}
		>
			<DisplayPageContent />
		</Suspense>
	);
}
