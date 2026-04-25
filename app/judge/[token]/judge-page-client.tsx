"use client";

import { useState, useEffect, useRef } from "react";
import { JudgeHeader } from "@/components/judge/judge-header";
import { ScoringForm } from "@/components/judge/scoring-form";
import { FinalsVoting } from "@/components/judge/finals-voting";
import { PinEntry } from "@/components/judge/pin-entry";
import { useSocket } from "@/hooks/use-socket";
import type { JudgeSession, Vote, Competitor, Judge } from "@/lib/types";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
	getRoundName,
	getCurrentRoundConfig,
	isFinalRound,
	getCompetitionConfig,
	getFinalsJudgeMode,
	getScoringMode,
} from "@/lib/competition-config";

// REST API authentication function
async function authenticateJudgeAPI(
	token: string,
	pin?: string,
): Promise<{ judge: Judge; eventId: string } | { needsPin: true } | null> {
	try {
		const response = await fetch("/api/judge/auth", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token, pin }),
		});
		const data = await response.json();

		if (data.success && data.judge && data.eventId) {
			return { judge: data.judge, eventId: data.eventId };
		}
		if (data.needsPin) {
			return { needsPin: true };
		}
		return null;
	} catch (error) {
		console.error("[API] Judge auth error:", error);
		return null;
	}
}

export function JudgePageClient({ token }: { token: string }) {
	const [eventId, setEventId] = useState<string | undefined>(undefined);
	const [judgeData, setJudgeData] = useState<Judge | null>(null);
	const authAttempted = useRef(false);

	const { event, isLoading, isConnected, submitVote, refreshEvent } =
		useSocket(eventId);

	const [session, setSession] = useState<JudgeSession | null>(null);
	const [needsPin, setNeedsPin] = useState(false);
	const [pinError, setPinError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Authenticate using REST API on mount
	useEffect(() => {
		if (authAttempted.current) return;
		authAttempted.current = true;

		const doAuth = async () => {
			try {
				const result = await authenticateJudgeAPI(token);

				if (result === null) {
					setError(
						"Invalid judge link. Please contact the competition manager.",
					);
					setLoading(false);
					return;
				}

				if ("needsPin" in result) {
					setNeedsPin(true);
					setLoading(false);
					return;
				}

				// Successfully authenticated
				setEventId(result.eventId);
				setJudgeData(result.judge);
				setSession({
					judgeId: result.judge.id,
					judge: result.judge,
					eventId: result.eventId,
					authenticated: true,
				});
				setLoading(false);
			} catch (err) {
				setError("Authentication failed. Please try again.");
				setLoading(false);
			}
		};

		doAuth();
	}, [token]);

	// Update judge data in session when event updates (without resetting auth)
	useEffect(() => {
		if (!session?.authenticated || !event) return;

		const updatedJudge = event.judges.find((j) => j.token === token);
		if (updatedJudge && updatedJudge.id === session.judgeId) {
			setSession((prev) =>
				prev ? { ...prev, judge: updatedJudge } : null,
			);
		}
	}, [event, token, session?.authenticated, session?.judgeId]);

	const handlePinSubmit = async (pin: string) => {
		// Re-authenticate with PIN using REST API
		const result = await authenticateJudgeAPI(token, pin);

		if (result === null) {
			setPinError("Invalid PIN. Please try again.");
			return;
		}

		if ("needsPin" in result) {
			setPinError("Invalid PIN. Please try again.");
			return;
		}

		setEventId(result.eventId);
		setJudgeData(result.judge);
		setSession({
			judgeId: result.judge.id,
			judge: result.judge,
			eventId: result.eventId,
			authenticated: true,
		});
		setNeedsPin(false);
		setPinError(null);
	};

	const handleVoteSubmit = async (vote: Vote) => {
		if (!event || !session) return;

		const success = await submitVote(
			vote.judgeId,
			vote.heatId,
			vote.round,
			vote.rankings,
		);

		if (success) {
			toast.success("Vote submitted successfully!");
		} else {
			toast.error("Failed to submit vote. Please try again.");
		}
	};

	// Poll for updates when not connected via socket
	useEffect(() => {
		if (!session || isConnected) return;

		const interval = setInterval(() => {
			refreshEvent();
		}, 3000);

		return () => clearInterval(interval);
	}, [session, isConnected, refreshEvent]);

	// Track previous voting state to show appropriate toasts
	const [prevVotingOpen, setPrevVotingOpen] = useState<boolean | null>(null);
	const [prevHeat, setPrevHeat] = useState<number | null>(null);
	const [prevRound, setPrevRound] = useState<string | null>(null);

	// Show toast when voting opens/closes or heat/round changes
	useEffect(() => {
		if (!session || !event) return;

		// Voting state changed
		if (prevVotingOpen !== null && prevVotingOpen !== event.votingOpen) {
			if (event.votingOpen) {
				toast.success("🗳️ Voting is now OPEN! Submit your rankings.", {
					duration: 5000,
				});
			} else {
				toast.info("🔒 Voting is now CLOSED.", {
					duration: 3000,
				});
			}
		}

		// Heat changed
		if (prevHeat !== null && prevHeat !== event.currentHeat) {
			toast.info(`📢 Now on Heat ${event.currentHeat}`, {
				duration: 3000,
			});
		}

		// Round changed
		if (prevRound !== null && prevRound !== event.currentRound) {
			const roundName = getRoundName(event, event.currentRound);
			toast.success(`🎉 Advanced to ${roundName}!`, {
				duration: 5000,
			});
		}

		setPrevVotingOpen(event.votingOpen);
		setPrevHeat(event.currentHeat);
		setPrevRound(event.currentRound);
	}, [
		event?.votingOpen,
		event?.currentHeat,
		event?.currentRound,
		session,
		prevVotingOpen,
		prevHeat,
		prevRound,
	]);

	if (loading || isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
				<AlertCircle className="w-16 h-16 text-destructive mb-4" />
				<h1 className="text-xl font-semibold text-foreground mb-2">
					Access Denied
				</h1>
				<p className="text-center text-muted-foreground">{error}</p>
			</div>
		);
	}

	if (needsPin) {
		return <PinEntry onSubmit={handlePinSubmit} error={pinError} />;
	}

	if (!session || !event) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const currentHeat = event.heats.find(
		(h) => h.number === event.currentHeat && h.round === event.currentRound,
	);

	const existingVote = currentHeat
		? event.votes.find(
				(v) =>
					v.judgeId === session.judgeId &&
					v.heatId === currentHeat.id,
			) || null
		: null;

	// Get competitors for current heat based on judge's gender and the round's judge mode
	const judgeMode = getFinalsJudgeMode(event, event.currentRound);

	let heatCompetitors: Competitor[] = [];

	if (currentHeat) {
		// 1. Prioritize explicit gender lists (handles imbalances and No Pairing mode)
		const maleList = currentHeat.maleCompetitors || [];
		const femaleList = currentHeat.femaleCompetitors || [];

		if (maleList.length > 0 || femaleList.length > 0) {
			if (judgeMode === "same_gender") {
				heatCompetitors =
					session.judge.gender === "male" ? maleList : femaleList;
			} else {
				// Cross Gender
				heatCompetitors =
					session.judge.gender === "male" ? femaleList : maleList;
			}
		}
		// 2. Fallback to couples if lists are missing (backward compatibility)
		else if (currentHeat.couples && currentHeat.couples.length > 0) {
			heatCompetitors = currentHeat.couples.flatMap((c) => {
				if (judgeMode === "same_gender") {
					return session.judge.gender === "male"
						? [c.maleCompetitor]
						: [c.femaleCompetitor];
				}
				return session.judge.gender === "male"
					? [c.femaleCompetitor]
					: [c.maleCompetitor];
			});
		}
	}

	// Get unique competitors (remove duplicates from rotations)
	const uniqueHeatCompetitors = Array.from(
		new Map(heatCompetitors.map((c) => [c.id, c])).values(),
	);

	// Check if this is the final round
	const isFinal = isFinalRound(
		getCurrentRoundConfig(event),
		getCompetitionConfig(event),
	);

	// Check the scoring mode for the current round
	const currentScoringMode = getScoringMode(event, event.currentRound);
	// Use FinalsVoting only for finals with selection/ranking mode
	// If finals use "scoring" mode, use ScoringForm instead
	const useFinalsVoting = isFinal && currentScoringMode !== "scoring";

	// For finals, get all non-eliminated finalists assigned to THIS heat
	// If there are multiple heats in finals, we must ONLY show the people in this heat
	const finalists = useFinalsVoting ? uniqueHeatCompetitors : [];

	const roundHeats = event.heats.filter(
		(h) => h.round === event.currentRound,
	);
	const totalHeats = roundHeats.length;

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="h-[100dvh] flex flex-col bg-background overflow-hidden"
		>
			<JudgeHeader
				judge={session.judge}
				currentHeat={currentHeat || null}
				roundName={getRoundName(event, event.currentRound)}
				totalHeats={totalHeats}
				votingOpen={event.votingOpen}
			/>

			<div className="flex-1 overflow-y-auto">
				{currentHeat ? (
					useFinalsVoting ? (
						<FinalsVoting
							key={`finals-${currentHeat.id}`}
							judge={session.judge}
							finalists={finalists}
							onSubmit={handleVoteSubmit}
							existingVote={existingVote}
							votingOpen={event.votingOpen}
							currentHeat={currentHeat}
							event={event}
						/>
					) : (
						<ScoringForm
							key={`scoring-${currentHeat.id}`}
							judge={session.judge}
							heat={currentHeat}
							competitors={uniqueHeatCompetitors}
							compAssistants={[]}
							onSubmit={handleVoteSubmit}
							existingVote={existingVote}
							votingOpen={event.votingOpen}
							event={event}
						/>
					)
				) : (
					<div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
						<AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
						<h2 className="text-xl font-semibold text-foreground mb-2">
							No Active Heat
						</h2>
						<p className="text-muted-foreground">
							Waiting for the competition manager to start the
							next heat.
						</p>
					</div>
				)}
			</div>
		</motion.div>
	);
}
