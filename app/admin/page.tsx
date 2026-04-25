"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { RoundControl } from "@/components/admin/round-control";
import { DisplayControlPanel } from "@/components/admin/display-control-panel";
import { CompetitorsPanel } from "@/components/admin/competitors-panel";
import { CompAssistantsPanel } from "@/components/admin/comp-assistants-panel";
import { JudgesPanel } from "@/components/admin/judges-panel";
import { HeatsPanel } from "@/components/admin/heats-panel";
import { ResultsPanel } from "@/components/admin/results-panel";
import { EventSettingsPanel } from "@/components/admin/event-settings-panel";
import { AdminRemotePanel } from "@/components/admin/admin-remote-panel";
import { EventDeletedModal } from "@/components/event-deleted-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSocket } from "@/hooks/use-socket";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Notification } from "@/components/admin/notification-bell";
import type {
	Gender,
	Competitor,
	Judge,
	Event,
	CompAssistant,
} from "@/lib/types";

function AdminPageContent() {
	const [baseUrl, setBaseUrl] = useState("");
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [currentEventId, setCurrentEventId] =
		useState<string>("demo-event-1");
	const [showResetDialog, setShowResetDialog] = useState(false);
	const [showSyncAlert, setShowSyncAlert] = useState(false);
	const isAutoRebuilding = useRef(false);
	const router = useRouter();
	const searchParams = useSearchParams();

	// Get event ID from URL or use default
	useEffect(() => {
		const eventParam = searchParams?.get("event");
		if (eventParam) {
			setCurrentEventId(eventParam);
		}
	}, [searchParams]);

	const {
		event,
		events,
		isLoading,
		isConnected,
		socket,
		deletedEventInfo,
		clearDeletedEventInfo,
		listEvents,
		createEvent,
		updateEvent,
		rebuildRound,
		deleteEvent,
		seedEventData,
		registerCompetitor,
		updateCompetitor,
		deleteCompetitor,
		createCompAssistant,
		updateCompAssistant,
		deleteCompAssistant,
		createJudge,
		updateJudge,
		deleteJudge,
		generatePairings,
		openVoting,
		closeVoting,
		nextHeat,
		nextRotation,
		advanceRound,
		setTieUp,
		publishResults,
		seedData,
		resetData,
		refreshEvent,
	} = useSocket(currentEventId, true); // isAdmin = true for admin page

	useEffect(() => {
		const authStatus = sessionStorage.getItem("adminAuthenticated");
		if (authStatus !== "true") {
			router.push("/admin/login");
			return;
		}
		setIsAuthenticated(true);
		setBaseUrl(window.location.origin);
	}, [router]);

	// Load events list on mount
	useEffect(() => {
		if (isConnected) {
			listEvents();
		}
	}, [isConnected, listEvents]);

	const addNotification = useCallback(
		(data: Omit<Notification, "id" | "timestamp" | "read">) => {
			const notification: Notification = {
				...data,
				id: `notif-${Date.now()}`,
				timestamp: new Date(),
				read: false,
			};
			setNotifications((prev) => [notification, ...prev].slice(0, 50));
		},
		[],
	);

	const handleMarkNotificationAsRead = useCallback((id: string) => {
		setNotifications((prev) =>
			prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
		);
	}, []);

	const handleMarkAllNotificationsAsRead = useCallback(() => {
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
	}, []);

	const handleClearNotifications = useCallback(() => {
		setNotifications([]);
	}, []);

	// Detect config structural changes and auto-rebuild silently
	useEffect(() => {
		if (isAutoRebuilding.current) return; // Prevent re-entry from rebuild updating event
		if (event?.competitionConfig && event.heats.length > 0) {
			const currentRoundHeats = event.heats.filter(
				(h) => h.round === event.currentRound,
			);
			const roundConfig = event.competitionConfig.rounds.find(
				(r) => r.id === event.currentRound,
			);

			// Don't auto-rebuild if the round config doesn't exist (e.g., just advanced)
			if (!roundConfig) {
				setShowSyncAlert(false);
				return;
			}

			const configuredHeats = roundConfig.numberOfHeats || 0;
			const expectedHeats = configuredHeats;

			// Don't auto-rebuild if any heat has been submitted (round is in progress or done)
			const hasSubmittedHeats = currentRoundHeats.some(
				(h) => h.votingStatus === "submitted",
			);

			if (
				currentRoundHeats.length > 0 &&
				expectedHeats > 0 &&
				currentRoundHeats.length !== expectedHeats &&
				!hasSubmittedHeats
			) {
				// Check if voting is active — if so, we can't auto-rebuild
				const hasVotingStarted = currentRoundHeats.some(
					(h) => h.votingStatus !== "closed",
				);
				if (hasVotingStarted) {
					setShowSyncAlert(true);
				} else {
					// Auto-rebuild silently (with guard to prevent loop)
					setShowSyncAlert(false);
					isAutoRebuilding.current = true;
					rebuildRound()
						.then((result) => {
							if (result) {
								toast.success(
									"Heats synced automatically with new structure",
								);
							}
						})
						.catch(() => {
							// Silently ignore rebuild failures
						})
						.finally(() => {
							// Reset guard after a delay to allow event state to settle
							setTimeout(() => {
								isAutoRebuilding.current = false;
							}, 2000);
						});
				}
			} else {
				setShowSyncAlert(false);
			}
		}
	}, [event?.competitionConfig, event?.heats, event?.currentRound]);

	// Listen for real-time events and create notifications
	useEffect(() => {
		if (!socket) return;

		// Admin-specific: Listen for full event updates with vote data
		const handleAdminEventUpdated = ({
			eventId: evtId,
			event: updatedEvent,
		}: {
			eventId: string;
			event: Event;
		}) => {
			if (evtId === currentEventId) {
				// Use the full event data for admin (includes real-time vote counts)
				// This is handled by the socket hook, but we need to ensure admin gets unfiltered data
			}
		};

		const handleCompetitorAdded = ({
			eventId: evtId,
			competitor,
		}: {
			eventId: string;
			competitor: Competitor;
		}) => {
			// Only show notification if it's for the current event
			if (evtId === currentEventId || !currentEventId) {
				addNotification({
					type: "competitor_registered",
					title: "New Registration",
					message: `${competitor.name} (#${competitor.number}) registered as ${competitor.gender}`,
				});
				toast.success(`New competitor: ${competitor.name}`);
			}
		};

		const handleVoteReceived = ({
			judgeId,
		}: {
			judgeId: string;
			heatId: string;
		}) => {
			const judge = event?.judges.find((j) => j.id === judgeId);
			addNotification({
				type: "vote_submitted",
				title: "Vote Submitted",
				message: `${judge?.name || "A judge"} submitted their vote`,
			});
			toast.info(`${judge?.name || "A judge"} submitted their vote`);
		};

		const handleJudgeAdded = ({ judge }: { judge: Judge }) => {
			addNotification({
				type: "judge_connected",
				title: "Judge Added",
				message: `${judge.name} added as ${judge.gender} judge`,
			});
		};

		const handleVotingOpened = ({
			heatId,
		}: {
			eventId: string;
			heatId: string;
		}) => {
			const heat = event?.heats.find((h) => h.id === heatId);
			addNotification({
				type: "round_complete",
				title: "Voting Opened",
				message: `Voting is now open for Heat ${heat?.number || ""}`,
			});
			toast.success(`🗳️ Voting opened for Heat ${heat?.number || ""}`);
		};

		const handleVotingClosed = ({
			heatId,
		}: {
			eventId: string;
			heatId: string;
		}) => {
			const heat = event?.heats.find((h) => h.id === heatId);
			addNotification({
				type: "round_complete",
				title: "Voting Closed",
				message: `Voting closed for Heat ${heat?.number || ""}`,
			});
			toast.info(`🔒 Voting closed for Heat ${heat?.number || ""}`);
		};

		const handleRoundAdvanced = ({
			newRound,
		}: {
			eventId: string;
			newRound: string;
		}) => {
			const roundName =
				newRound === "round2"
					? "Semi-Finals"
					: newRound === "finals"
						? "Finals"
						: "Round 1";
			addNotification({
				type: "round_complete",
				title: "Round Advanced",
				message: `Competition advanced to ${roundName}`,
			});
			toast.success(`🎉 Advanced to ${roundName}!`);
		};

		const handleResultsPublished = ({
			round,
		}: {
			eventId: string;
			round: string;
		}) => {
			const roundName =
				round === "round1"
					? "Round 1"
					: round === "round2"
						? "Semi-Finals"
						: "Finals";
			addNotification({
				type: "round_complete",
				title: "Results Published",
				message: `${roundName} results are now live`,
			});
			toast.success(`📊 ${roundName} results published!`);
		};

		socket.on("admin:event:updated", handleAdminEventUpdated);
		socket.on("competitor:added", handleCompetitorAdded);
		socket.on("vote:received", handleVoteReceived);
		socket.on("judge:added", handleJudgeAdded);
		socket.on("voting:opened", handleVotingOpened);
		socket.on("voting:closed", handleVotingClosed);
		socket.on("round:advanced", handleRoundAdvanced);
		socket.on("results:published", handleResultsPublished);

		return () => {
			socket.off("admin:event:updated", handleAdminEventUpdated);
			socket.off("competitor:added", handleCompetitorAdded);
			socket.off("vote:received", handleVoteReceived);
			socket.off("judge:added", handleJudgeAdded);
			socket.off("voting:opened", handleVotingOpened);
			socket.off("voting:closed", handleVotingClosed);
			socket.off("round:advanced", handleRoundAdvanced);
			socket.off("results:published", handleResultsPublished);
		};
	}, [socket, event?.judges, event?.heats, addNotification, currentEventId]);

	// Switch event handler
	const handleSwitchEvent = useCallback(
		(eventId: string) => {
			setCurrentEventId(eventId);
			router.push(`/admin?event=${eventId}`);
		},
		[router],
	);

	if (!isAuthenticated) return null;

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-primary" />
			</div>
		);
	}

	if (!event) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground mb-4">
						No event data found
					</p>
					<button
						onClick={() => seedData()}
						className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
					>
						Initialize Event Data
					</button>
				</div>
			</div>
		);
	}

	const currentHeat = event.heats.find(
		(h) => h.number === event.currentHeat && h.round === event.currentRound,
	);

	const handleReset = async () => {
		setShowResetDialog(true);
	};

	const confirmReset = async () => {
		await resetData();
		toast.success("Data reset successfully");
		setShowResetDialog(false);
	};

	const handleOpenVoting = async () => {
		if (currentHeat) {
			const success = await openVoting(currentHeat.id);
			if (success) {
				toast.success("Voting opened");
			} else {
				toast.error("Failed to open voting");
			}
		} else {
			toast.error("No heat available. Please generate pairings first.");
		}
	};

	const handleCloseVoting = async () => {
		if (currentHeat) {
			const result = await closeVoting(currentHeat.id);
			if (result.success) {
				toast.success("Voting closed");
			} else {
				toast.error(result.error || "Failed to close voting");
			}
		} else {
			toast.error("No heat available");
		}
	};

	const handleNextHeat = async () => {
		const result = await nextHeat();
		if (result.success) {
			toast.success("Advanced to next heat");
		} else {
			toast.error(result.error || "Failed to advance to next heat");
		}
	};

	const handleNextRotation = async () => {
		const result = await nextRotation();
		if (result.success) {
			toast.success("Advanced to next rotation");
		} else {
			toast.error(result.error || "Failed to advance rotation");
		}
	};

	const handleSyncRebuild = async () => {
		try {
			const result: any = await rebuildRound();
			if (result && result.id) {
				toast.success("Pairings rebuilt to match new structure");
				setShowSyncAlert(false);
			} else {
				// Handle specific error if we can catch it or if result is null
				toast.error(
					"Failed to rebuild round. Check if voting is already open.",
				);
			}
		} catch (error: any) {
			toast.error(error.message || "Failed to rebuild round");
		}
	};

	const handleGeneratePairings = async () => {
		try {
			const success = await generatePairings(event.currentRound);
			if (success) {
				toast.success("Pairings generated");
				setShowSyncAlert(false);
			} else {
				toast.error(
					"Failed to generate pairings. Check if competitors are added.",
				);
			}
		} catch (error: any) {
			toast.error(error.message || "Failed to generate pairings");
		}
	};

	const handlePublishResults = async () => {
		const success = await publishResults();
		if (success) {
			toast.success("Results published");
		}
	};

	const handleAdvanceRound = async () => {
		const result = await advanceRound();
		if (result.success) {
			toast.success("Advanced to next round");
			addNotification({
				type: "round_complete",
				title: "Round Complete",
				message: `Advanced to next round`,
			});
		} else {
			toast.error(result.error || "Failed to advance round");
		}
	};

	// Competitor CRUD handlers
	const handleAddCompetitor = async (
		name: string,
		gender: Gender,
		photoData?: string,
		photoType?: string,
	) => {
		return registerCompetitor(name, gender, photoData, photoType);
	};

	const handleUpdateCompetitor = async (
		competitorId: string,
		updates: Partial<Competitor> & {
			photoData?: string;
			photoType?: string;
		},
	) => {
		return updateCompetitor(competitorId, updates);
	};

	const handleDeleteCompetitor = async (competitorId: string) => {
		return deleteCompetitor(competitorId);
	};

	const handleImportCompetitorsCSV = async (
		data: { number?: number; name: string; gender: Gender }[],
	) => {
		let successCount = 0;
		let failureCount = 0;
		const failures: string[] = [];

		// Show initial toast
		toast.info(`Starting import of ${data.length} competitors...`);

		for (const item of data) {
			try {
				console.log(
					`[Import] Attempting to register: ${item.name} (${
						item.gender
					}) ${item.number ? `#${item.number}` : "(auto-number)"}`,
				);

				const result = await registerCompetitor(
					item.name,
					item.gender,
					undefined,
					undefined,
					item.number,
				);

				if (result) {
					successCount++;
					console.log(
						`[Import] Success: ${item.name} registered as #${result.number}`,
					);
					toast.success(`✓ ${item.name} (#${result.number})`);
				} else {
					failureCount++;
					failures.push(item.name);
					console.log(
						`[Import] Failed: ${item.name} - no result returned`,
					);
					toast.error(`✗ ${item.name}: Registration failed`);
				}
			} catch (error) {
				failureCount++;
				failures.push(item.name);
				console.error(
					`[Import] Error registering ${item.name}:`,
					error,
				);

				// Extract meaningful error message
				let errorMessage = "Unknown error";
				if (error instanceof Error) {
					errorMessage = error.message;
				} else if (typeof error === "string") {
					errorMessage = error;
				} else if (
					error &&
					typeof error === "object" &&
					"message" in error
				) {
					errorMessage = String(error.message);
				}

				toast.error(`✗ ${item.name}: ${errorMessage}`);
			}
		}

		// Show summary toast
		if (successCount > 0 && failureCount === 0) {
			toast.success(
				`🎉 Successfully imported all ${successCount} competitors!`,
			);
		} else if (successCount > 0 && failureCount > 0) {
			toast.warning(
				`⚠️ Imported ${successCount} competitors, ${failureCount} failed. Check individual error messages above.`,
			);
		} else if (failureCount > 0) {
			toast.error(
				`❌ Failed to import all ${failureCount} competitors. Check error messages above.`,
			);
		}

		return successCount > 0;
	};

	const handleSortCompetitorsByNumber = async (gender: Gender) => {
		// This function just triggers a UI sort - no renumbering needed
		// The actual sorting is handled by the display component
		toast.success(
			`${
				gender === "male" ? "Male" : "Female"
			} competitors sorted by number`,
		);
		return true;
	};

	// Comp Assistant CRUD handlers
	const handleAddCompAssistant = async (
		name: string,
		number: number,
		gender: Gender,
		photoData?: string,
		photoType?: string,
	) => {
		return createCompAssistant(name, number, gender, photoData, photoType);
	};

	const handleUpdateCompAssistant = async (
		compAssistantId: string,
		updates: Partial<CompAssistant> & {
			photoData?: string;
			photoType?: string;
		},
	) => {
		return updateCompAssistant(compAssistantId, updates);
	};

	const handleDeleteCompAssistant = async (compAssistantId: string) => {
		return deleteCompAssistant(compAssistantId);
	};

	// Judge CRUD handlers
	const handleAddJudge = async (
		name: string,
		gender: Gender,
		pin?: string,
		photoData?: string,
		photoType?: string,
	) => {
		return createJudge(name, gender, pin, photoData, photoType);
	};

	const handleUpdateJudge = async (
		judgeId: string,
		updates: Partial<Judge>,
	) => {
		return updateJudge(judgeId, updates);
	};

	const handleDeleteJudge = async (judgeId: string) => {
		return deleteJudge(judgeId);
	};

	const handleImportJudgesCSV = async (
		data: { name: string; gender: Gender; pin?: string }[],
	) => {
		let success = true;
		for (const item of data) {
			const result = await createJudge(item.name, item.gender, item.pin);
			if (!result) success = false;
		}
		return success;
	};

	// Event handlers
	const handleUpdateEvent = async (updates: Partial<Event>) => {
		const success = await updateEvent(updates);
		return success;
	};

	const handleResetEvent = async () => {
		await resetData();
		toast.success("Event data reset successfully");
	};

	const handleCreateEvent = async (
		name: string,
		date: string,
		venue: string,
		maleStartNumber?: number,
		maleEndNumber?: number,
		femaleStartNumber?: number,
		femaleEndNumber?: number,
	) => {
		return createEvent(
			name,
			date,
			venue,
			maleStartNumber,
			maleEndNumber,
			femaleStartNumber,
			femaleEndNumber,
		);
	};

	const handleDeleteEvent = async (eventId: string) => {
		return deleteEvent(eventId);
	};

	const handleSeedEventData = async (eventId: string) => {
		return seedEventData(eventId);
	};

	const handleRefreshEvents = async () => {
		await listEvents();
	};

	return (
		<div className="min-h-screen bg-background">
			<AdminHeader
				event={event}
				onReset={handleReset}
				notifications={notifications}
				onMarkNotificationAsRead={handleMarkNotificationAsRead}
				onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
				onClearNotifications={handleClearNotifications}
			/>

			{!isConnected && (
				<div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 text-center text-sm text-yellow-500">
					Reconnecting to server...
				</div>
			)}

			<main className="max-w-7xl mx-auto p-4">
				<Tabs defaultValue="control" className="space-y-6">
					<TabsList>
						<TabsTrigger value="control">Round Control</TabsTrigger>
						<TabsTrigger value="heats">
							Heats & Pairings
						</TabsTrigger>
						<TabsTrigger value="results">Results</TabsTrigger>
						<TabsTrigger value="competitors">
							Competitors ({event.competitors.length})
						</TabsTrigger>
						<TabsTrigger value="assistants">
							Assistants ({(event.compAssistants || []).length})
						</TabsTrigger>
						<TabsTrigger value="judges">
							Judges ({event.judges.length})
						</TabsTrigger>
						<TabsTrigger value="settings">Settings</TabsTrigger>
					</TabsList>

					{showSyncAlert && (
						<div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-amber-500/20 rounded-lg">
									<Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
								</div>
								<div>
									<p className="font-bold text-foreground">
										Competition Structure Changed!
									</p>
									<p className="text-sm text-muted-foreground">
										Voting is currently active, so heats
										cannot be auto-synced. Close voting
										first, then click Re-generate.
									</p>
								</div>
							</div>
							<div className="flex gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowSyncAlert(false)}
								>
									Ignore
								</Button>
								<Button
									size="sm"
									onClick={handleSyncRebuild}
									disabled={event.heats
										.filter(
											(h) =>
												h.round === event.currentRound,
										)
										.some(
											(h) => h.votingStatus !== "closed",
										)}
								>
									Re-generate Pairings
								</Button>
							</div>
						</div>
					)}

					<TabsContent
						value="control"
						forceMount
						className="data-[state=inactive]:hidden space-y-6"
					>
						<div className="grid gap-6 lg:grid-cols-2">
							<RoundControl
								event={event}
								onOpenVoting={handleOpenVoting}
								onCloseVoting={handleCloseVoting}
								onNextHeat={handleNextHeat}
								onNextRotation={handleNextRotation}
								onGeneratePairings={handleGeneratePairings}
								onPublishResults={handlePublishResults}
								onAdvanceRound={handleAdvanceRound}
								onNavigateDisplay={(slide) => {
									socket?.emit("display:slide", {
										eventId: event.id,
										slide,
									});
								}}
							/>
							<AdminRemotePanel event={event} socket={socket} />
						</div>
					</TabsContent>

					<TabsContent value="heats">
						<HeatsPanel
							heats={event.heats.filter(
								(h) => h.round === event.currentRound,
							)}
							currentHeat={event.currentHeat}
							currentRotation={event.currentRotation || 1}
							totalJudges={event.judges.length}
						/>
					</TabsContent>

					<TabsContent value="results">
						<ResultsPanel
							competitors={event.competitors}
							votes={event.votes}
							currentRound={event.currentRound}
							event={event}
							onSetTieUp={setTieUp}
						/>
					</TabsContent>

					<TabsContent value="competitors">
						<CompetitorsPanel
							competitors={event.competitors}
							competitionStarted={event.heats.length > 0}
							eventId={event.id}
							event={event}
							votes={event.votes}
							onAdd={handleAddCompetitor}
							onUpdate={handleUpdateCompetitor}
							onDelete={handleDeleteCompetitor}
							onImportCSV={handleImportCompetitorsCSV}
							onSortByNumber={handleSortCompetitorsByNumber}
						/>
					</TabsContent>

					<TabsContent value="assistants">
						<CompAssistantsPanel
							compAssistants={event.compAssistants || []}
							competitionStarted={event.heats.length > 0}
							maleStartNumber={event.maleStartNumber}
							maleEndNumber={event.maleEndNumber}
							femaleStartNumber={event.femaleStartNumber}
							femaleEndNumber={event.femaleEndNumber}
							eventId={event.id}
							onAdd={handleAddCompAssistant}
							onUpdate={handleUpdateCompAssistant}
							onDelete={handleDeleteCompAssistant}
						/>
					</TabsContent>

					<TabsContent value="judges">
						<JudgesPanel
							judges={event.judges}
							currentHeat={currentHeat || null}
							baseUrl={baseUrl}
							votes={event.votes}
							competitors={event.competitors}
							event={event}
							onAdd={handleAddJudge}
							onUpdate={handleUpdateJudge}
							onDelete={handleDeleteJudge}
							onImportCSV={handleImportJudgesCSV}
						/>
					</TabsContent>

					<TabsContent
						value="settings"
						forceMount
						className="data-[state=inactive]:hidden"
					>
						<div className="max-w-2xl">
							<EventSettingsPanel
								event={event}
								events={events}
								baseUrl={baseUrl}
								socket={socket}
								onUpdateEvent={handleUpdateEvent}
								onRebuildRound={rebuildRound}
								onResetEvent={handleResetEvent}
								onCreateEvent={handleCreateEvent}
								onDeleteEvent={handleDeleteEvent}
								onSeedEventData={handleSeedEventData}
								onSwitchEvent={handleSwitchEvent}
								onRefreshEvents={handleRefreshEvents}
							/>
						</div>
					</TabsContent>
				</Tabs>
			</main>

			{/* Event Deleted Modal */}
			<EventDeletedModal
				isOpen={!!deletedEventInfo}
				eventName={deletedEventInfo?.eventName}
				onClose={clearDeletedEventInfo}
			/>

			{/* Reset Data Confirmation Dialog */}
			<AlertDialog
				open={showResetDialog}
				onOpenChange={setShowResetDialog}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Reset All Data</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to reset all data? This will
							clear all competitions, rotations, rounds, heats and
							votes. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmReset}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Reset Data
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

export default function AdminPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-background flex items-center justify-center">
					<Loader2 className="w-8 h-8 animate-spin text-primary" />
				</div>
			}
		>
			<AdminPageContent />
		</Suspense>
	);
}
