"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
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
import { CreateEventWizard } from "@/components/admin/create-event-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
	Loader2,
	Plus,
	Trophy,
	Users,
	Scale,
	Calendar,
	MapPin,
	Sparkles,
	Layers,
	Radio,
	ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Notification } from "@/components/admin/notification-bell";
import type {
	Gender,
	Competitor,
	Judge,
	Event,
	CompAssistant,
} from "@/lib/types";
import type { AdminProfile } from "@/lib/admin-types";

function DashboardContent() {
	const [baseUrl, setBaseUrl] = useState("");
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [currentEventId, setCurrentEventId] =
		useState<string>("demo-event-1");
	const [showResetDialog, setShowResetDialog] = useState(false);
	const [showSyncAlert, setShowSyncAlert] = useState(false);
	const [activeTab, setActiveTab] = useState("dashboard");
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [showCreateWizard, setShowCreateWizard] = useState(false);
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
	} = useSocket(currentEventId, true);

	useEffect(() => {
		const authStatus = sessionStorage.getItem("adminAuthenticated");
		if (authStatus !== "true") {
			router.push("/admin/login");
			return;
		}
		setIsAuthenticated(true);
		setBaseUrl(window.location.origin);

		// Load admin profile
		const profileStr = sessionStorage.getItem("adminProfile");
		if (profileStr) {
			try {
				setAdminProfile(JSON.parse(profileStr));
			} catch {}
		}
	}, [router]);

	// Load events list on mount
	useEffect(() => {
		if (isConnected) {
			listEvents();
		}
	}, [isConnected, listEvents]);

	// Auto-rebuild logic (same as existing admin page)
	useEffect(() => {
		if (isAutoRebuilding.current) return;
		if (event?.competitionConfig && event.heats.length > 0) {
			const currentRoundHeats = event.heats.filter(
				(h) => h.round === event.currentRound,
			);
			const roundConfig = event.competitionConfig.rounds.find(
				(r) => r.id === event.currentRound,
			);
			if (!roundConfig) {
				setShowSyncAlert(false);
				return;
			}
			const expectedHeats = roundConfig.numberOfHeats || 0;
			const hasSubmittedHeats = currentRoundHeats.some(
				(h) => h.votingStatus === "submitted",
			);
			if (
				currentRoundHeats.length > 0 &&
				expectedHeats > 0 &&
				currentRoundHeats.length !== expectedHeats &&
				!hasSubmittedHeats
			) {
				const hasVotingStarted = currentRoundHeats.some(
					(h) => h.votingStatus !== "closed",
				);
				if (hasVotingStarted) {
					setShowSyncAlert(true);
				} else {
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
						.catch(() => {})
						.finally(() => {
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

	const handleSwitchEvent = useCallback(
		(eventId: string) => {
			setCurrentEventId(eventId);
			const aid = adminProfile?.id;
			router.push(
				`/admin/dashboard?event=${eventId}${aid ? `&adminId=${aid}` : ""}`,
			);
			setActiveTab("control");
		},
		[router, adminProfile],
	);

	const handleLogout = () => {
		sessionStorage.removeItem("adminAuthenticated");
		sessionStorage.removeItem("adminEmail");
		sessionStorage.removeItem("adminProfile");
		router.push("/admin/login");
	};

	if (!isAuthenticated) return null;

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-primary" />
			</div>
		);
	}

	// Handler functions (reused from existing admin page)
	const handleReset = async () => setShowResetDialog(true);
	const confirmReset = async () => {
		const success = await resetData();
		if (success) {
			toast.success("Data reset successfully");
			// Refresh event data to get the updated event from server
			await refreshEvent();
		} else {
			toast.error("Failed to reset data");
		}
		setShowResetDialog(false);
	};

	const handleOpenVoting = async () => {
		if (currentHeat) {
			const success = await openVoting(currentHeat.id);
			if (success) toast.success("Voting opened");
			else toast.error("Failed to open voting");
		} else {
			toast.error("No heat available. Please generate pairings first.");
		}
	};

	const handleCloseVoting = async () => {
		if (currentHeat) {
			const result = await closeVoting(currentHeat.id);
			if (result.success) toast.success("Voting closed");
			else toast.error(result.error || "Failed to close voting");
		}
	};

	const handleNextHeat = async () => {
		const result = await nextHeat();
		if (result.success) toast.success("Advanced to next heat");
		else toast.error(result.error || "Failed to advance to next heat");
	};

	const handleNextRotation = async () => {
		const result = await nextRotation();
		if (result.success) toast.success("Advanced to next rotation");
		else toast.error(result.error || "Failed to advance rotation");
	};

	const handleGeneratePairings = async () => {
		if (!event) return;
		try {
			const success = await generatePairings(event.currentRound);
			if (success) {
				toast.success("Pairings generated");
				setShowSyncAlert(false);
			} else {
				toast.error("Failed to generate pairings.");
			}
		} catch (error: any) {
			toast.error(error.message || "Failed to generate pairings");
		}
	};

	const handlePublishResults = async () => {
		const success = await publishResults();
		if (success) toast.success("Results published");
	};

	const handleAdvanceRound = async () => {
		const result = await advanceRound();
		if (result.success) {
			toast.success("Advanced to next round");
			addNotification({
				type: "round_complete",
				title: "Round Complete",
				message: "Advanced to next round",
			});
		} else {
			toast.error(result.error || "Failed to advance round");
		}
	};

	const handleAddCompetitor = async (
		name: string,
		gender: Gender,
		photoData?: string,
		photoType?: string,
	) => registerCompetitor(name, gender, photoData, photoType);

	const handleUpdateCompetitor = async (
		competitorId: string,
		updates: Partial<Competitor> & {
			photoData?: string;
			photoType?: string;
		},
	) => updateCompetitor(competitorId, updates);

	const handleDeleteCompetitor = async (competitorId: string) =>
		deleteCompetitor(competitorId);

	const handleImportCompetitorsCSV = async (
		data: { number?: number; name: string; gender: Gender }[],
	) => {
		let successCount = 0;
		toast.info(`Starting import of ${data.length} competitors...`);
		for (const item of data) {
			try {
				const result = await registerCompetitor(
					item.name,
					item.gender,
					undefined,
					undefined,
					item.number,
				);
				if (result) {
					successCount++;
					toast.success(`✓ ${item.name} (#${result.number})`);
				}
			} catch (error: any) {
				toast.error(`✗ ${item.name}: ${error.message || "Failed"}`);
			}
		}
		if (successCount > 0) {
			toast.success(`🎉 Imported ${successCount} competitors!`);
		}
		return successCount > 0;
	};

	const handleSortCompetitorsByNumber = async (gender: Gender) => {
		toast.success(
			`${gender === "male" ? "Male" : "Female"} competitors sorted`,
		);
		return true;
	};

	const handleAddCompAssistant = async (
		name: string,
		number: number,
		gender: Gender,
		photoData?: string,
		photoType?: string,
	) => createCompAssistant(name, number, gender, photoData, photoType);

	const handleUpdateCompAssistant = async (
		compAssistantId: string,
		updates: Partial<CompAssistant> & {
			photoData?: string;
			photoType?: string;
		},
	) => updateCompAssistant(compAssistantId, updates);

	const handleDeleteCompAssistant = async (compAssistantId: string) =>
		deleteCompAssistant(compAssistantId);

	const handleAddJudge = async (
		name: string,
		gender: Gender,
		pin?: string,
		photoData?: string,
		photoType?: string,
	) => createJudge(name, gender, pin, photoData, photoType);

	const handleUpdateJudge = async (
		judgeId: string,
		updates: Partial<Judge>,
	) => updateJudge(judgeId, updates);

	const handleDeleteJudge = async (judgeId: string) => deleteJudge(judgeId);

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

	const handleUpdateEvent = async (
		updates: Partial<Event>,
		eventId?: string,
	) => {
		return updateEvent(updates, eventId);
	};

	const handleResetEvent = async () => {
		const success = await resetData();
		if (success) {
			toast.success("Event data reset successfully");
			await refreshEvent();
		} else {
			toast.error("Failed to reset event data");
		}
	};

	const handleCreateEvent = async (
		name: string,
		date: string,
		venue: string,
		maleStartNumber?: number,
		maleEndNumber?: number,
		femaleStartNumber?: number,
		femaleEndNumber?: number,
		competitionConfig?: any,
	) => {
		const result = await createEvent(
			name,
			date,
			venue,
			maleStartNumber,
			maleEndNumber,
			femaleStartNumber,
			femaleEndNumber,
			adminProfile?.id,
			competitionConfig,
		);
		// Switch to the newly created event so subsequent updateEvent calls target it
		if (result) {
			handleSwitchEvent(result.id);
		}
		return result;
	};

	const handleDeleteEvent = async (eventId: string) => deleteEvent(eventId);

	const handleSeedEventData = async (eventId: string) =>
		seedEventData(eventId);

	const handleRefreshEvents = async () => {
		await listEvents();
	};

	// Filter events by current admin
	const urlAdminId = searchParams?.get("adminId");
	const activeAdminId = urlAdminId || adminProfile?.id;

	const filteredEvents = activeAdminId
		? activeAdminId === "legacy-admin"
			? events // Legacy admin sees all events
			: events.filter((e) => e.adminId === activeAdminId)
		: []; // No admin ID = no events (shouldn't happen)

	// Only allow access to events owned by this admin
	const ownedEvent =
		event && activeAdminId
			? activeAdminId === "legacy-admin"
				? event // Legacy admin can access any event
				: event.adminId === activeAdminId
					? event
					: null
			: null;

	const currentHeat = ownedEvent?.heats.find(
		(h) =>
			h.number === ownedEvent.currentHeat &&
			h.round === ownedEvent.currentRound,
	);

	// Dashboard welcome view
	const renderDashboardTab = () => {
		// Show onboarding if no events
		if (filteredEvents.length === 0) {
			return (
				<div className="max-w-3xl mx-auto py-8 space-y-8">
					<div className="text-center space-y-3">
						<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
							<Sparkles className="w-3.5 h-3.5" />
							Welcome to your trial
						</span>
						<h1 className="text-3xl font-bold text-foreground">
							Welcome aboard! 🎉
						</h1>
						<p className="text-muted-foreground max-w-md mx-auto">
							You&apos;re all set to run your first Jack & Jill
							competition. Here&apos;s a quick overview of how
							everything works.
						</p>
					</div>

					<div className="space-y-3">
						{[
							{
								num: "01",
								icon: Trophy,
								title: "Create Your Event",
								desc: "Set up your competition with a name, date, and venue. It takes less than a minute.",
							},
							{
								num: "02",
								icon: Users,
								title: "Add Competitors & Judges",
								desc: "Import or manually add your competitors and assign judges. Share invite links instantly.",
							},
							{
								num: "03",
								icon: Layers,
								title: "Configure Rounds & Pairings",
								desc: "Set up qualifiers, semi-finals, and finals. Choose scoring modes and automatic pairing.",
							},
							{
								num: "04",
								icon: Radio,
								title: "Go Live",
								desc: "Open voting, control rounds in real-time, and publish results — all from one dashboard.",
							},
						].map((s) => {
							const Icon = s.icon;
							return (
								<div
									key={s.num}
									className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors"
								>
									<div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
										<Icon className="w-5 h-5 text-primary" />
									</div>
									<div className="flex-1">
										<h3 className="text-sm font-semibold text-foreground">
											{s.title}
										</h3>
										<p className="text-xs text-muted-foreground mt-0.5">
											{s.desc}
										</p>
									</div>
									<span className="text-xs text-muted-foreground/50 font-mono">
										{s.num}
									</span>
								</div>
							);
						})}
					</div>

					<div className="flex items-center justify-center gap-3">
						<Button
							onClick={() => setShowCreateWizard(true)}
							className="h-11 px-6"
						>
							<Trophy className="w-4 h-4 mr-2" />
							Create Your First Event
							<ChevronRight className="w-4 h-4 ml-1" />
						</Button>
					</div>
				</div>
			);
		}

		const totalCompetitors = filteredEvents.reduce(
			(sum, e) => sum + e.competitorCount,
			0,
		);
		const totalJudges = filteredEvents.reduce(
			(sum, e) => sum + e.judgeCount,
			0,
		);

		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-2xl font-bold text-foreground">
							Dashboard
						</h2>
						<p className="text-sm text-muted-foreground">
							Manage your competitions and events
						</p>
					</div>
					<Button onClick={() => setShowCreateWizard(true)}>
						<Plus className="w-4 h-4 mr-2" />
						New Event
					</Button>
				</div>

				<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
					<Card className="border-border bg-card">
						<CardContent className="p-4">
							<div className="flex items-center justify-between mb-2">
								<Trophy className="w-4 h-4 text-primary" />
								<ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
							</div>
							<p className="text-2xl font-bold text-foreground">
								{filteredEvents.length}
							</p>
							<p className="text-xs text-muted-foreground">
								Total Events
							</p>
						</CardContent>
					</Card>
					<Card className="border-border bg-card">
						<CardContent className="p-4">
							<div className="flex items-center justify-between mb-2">
								<Users className="w-4 h-4 text-primary" />
								<ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
							</div>
							<p className="text-2xl font-bold text-foreground">
								{totalCompetitors}
							</p>
							<p className="text-xs text-muted-foreground">
								Competitors
							</p>
						</CardContent>
					</Card>
					<Card className="border-border bg-card">
						<CardContent className="p-4">
							<div className="flex items-center justify-between mb-2">
								<Scale className="w-4 h-4 text-primary" />
								<ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
							</div>
							<p className="text-2xl font-bold text-foreground">
								{totalJudges}
							</p>
							<p className="text-xs text-muted-foreground">
								Judges
							</p>
						</CardContent>
					</Card>
				</div>

				<div>
					<h3 className="text-lg font-semibold text-foreground mb-3">
						Your Events
					</h3>
					<div className="space-y-3">
						{filteredEvents.map((evt) => (
							<Card
								key={evt.id}
								className={`border-border bg-card hover:border-primary/50 transition-all cursor-pointer group ${
									evt.id === currentEventId
										? "border-primary ring-1 ring-primary/20"
										: ""
								}`}
								onClick={() => handleSwitchEvent(evt.id)}
							>
								<CardContent className="p-4 flex items-center gap-4">
									<div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
										<Trophy className="w-5 h-5 text-primary" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
												{evt.name}
											</h4>
											{evt.id === currentEventId ? (
												<span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
													Active
												</span>
											) : (
												<span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
													not active
												</span>
											)}
										</div>
										<div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
											<span className="flex items-center gap-1">
												<Calendar className="w-3 h-3" />
												{evt.date || "No date"}
											</span>
											<span className="flex items-center gap-1">
												<MapPin className="w-3 h-3" />
												{evt.venue || "No venue"}
											</span>
										</div>
										<div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
											<span>
												{evt.competitorCount}{" "}
												competitors
											</span>
											<span>{evt.judgeCount} judges</span>
										</div>
									</div>
									<ChevronRight className="w-4 h-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="flex min-h-screen bg-background">
			{/* Sidebar */}
			<AdminSidebar
				activeTab={showCreateWizard ? "create-event" : activeTab}
				onTabChange={(tab) => {
					if (tab === "create-event") {
						setShowCreateWizard(true);
					} else {
						setShowCreateWizard(false);
						setActiveTab(tab);
					}
				}}
				adminProfile={adminProfile}
				onLogout={handleLogout}
				collapsed={sidebarCollapsed}
				onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
			/>

			{/* Main Content */}
			<div className="flex-1 flex flex-col min-h-screen overflow-hidden">
				{/* Header (only when event is loaded and not on dashboard/create tab) */}
				{ownedEvent &&
					activeTab !== "dashboard" &&
					!showCreateWizard && (
						<AdminHeader
							event={ownedEvent}
							onReset={handleReset}
							notifications={notifications}
							onMarkNotificationAsRead={
								handleMarkNotificationAsRead
							}
							onMarkAllNotificationsAsRead={
								handleMarkAllNotificationsAsRead
							}
							onClearNotifications={handleClearNotifications}
						/>
					)}

				{!isConnected && (
					<div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 text-center text-sm text-yellow-500">
						Reconnecting to server...
					</div>
				)}

				<main className="flex-1 p-6 overflow-y-auto">
					{/* Create Event Wizard (full page) */}
					{showCreateWizard && (
						<CreateEventWizard
							adminProfile={adminProfile}
							onCreateEvent={handleCreateEvent}
							onUpdateEvent={handleUpdateEvent}
							onCancel={() => {
								setShowCreateWizard(false);
								setActiveTab("dashboard");
							}}
						/>
					)}

					{/* Dashboard Tab */}
					{!showCreateWizard &&
						activeTab === "dashboard" &&
						renderDashboardTab()}

					{/* Event-specific tabs */}
					{!showCreateWizard &&
						activeTab !== "dashboard" &&
						!ownedEvent && (
							<div className="flex items-center justify-center h-64">
								<div className="text-center">
									<p className="text-muted-foreground mb-4">
										No event selected
									</p>
									<Button
										onClick={() =>
											setActiveTab("dashboard")
										}
									>
										Go to Dashboard
									</Button>
								</div>
							</div>
						)}

					{activeTab === "control" && ownedEvent && (
						<div className="space-y-6">
							{showSyncAlert && (
								<div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
									<div className="flex items-center gap-3">
										<div className="p-2 bg-amber-500/20 rounded-lg">
											<Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
										</div>
										<div>
											<p className="font-bold text-foreground">
												Competition Structure Changed!
											</p>
											<p className="text-sm text-muted-foreground">
												Voting is currently active.
												Close voting first, then
												re-generate.
											</p>
										</div>
									</div>
								</div>
							)}
							<div className="grid gap-6 lg:grid-cols-2">
								<RoundControl
									event={ownedEvent}
									onOpenVoting={handleOpenVoting}
									onCloseVoting={handleCloseVoting}
									onNextHeat={handleNextHeat}
									onNextRotation={handleNextRotation}
									onGeneratePairings={handleGeneratePairings}
									onPublishResults={handlePublishResults}
									onAdvanceRound={handleAdvanceRound}
									onNavigateDisplay={(slide) => {
										socket?.emit("display:slide", {
											eventId: ownedEvent.id,
											slide,
										});
									}}
								/>
								<AdminRemotePanel
									event={ownedEvent}
									socket={socket}
								/>
							</div>
						</div>
					)}

					{activeTab === "heats" && ownedEvent && (
						<HeatsPanel
							heats={ownedEvent.heats.filter(
								(h) => h.round === ownedEvent.currentRound,
							)}
							currentHeat={ownedEvent.currentHeat}
							currentRotation={ownedEvent.currentRotation || 1}
							totalJudges={ownedEvent.judges.length}
						/>
					)}

					{activeTab === "results" && ownedEvent && (
						<ResultsPanel
							competitors={ownedEvent.competitors}
							votes={ownedEvent.votes}
							currentRound={ownedEvent.currentRound}
							event={ownedEvent}
							onSetTieUp={setTieUp}
						/>
					)}

					{activeTab === "competitors" && ownedEvent && (
						<CompetitorsPanel
							competitors={ownedEvent.competitors}
							competitionStarted={ownedEvent.heats.length > 0}
							eventId={ownedEvent.id}
							event={ownedEvent}
							votes={ownedEvent.votes}
							onAdd={handleAddCompetitor}
							onUpdate={handleUpdateCompetitor}
							onDelete={handleDeleteCompetitor}
							onImportCSV={handleImportCompetitorsCSV}
							onSortByNumber={handleSortCompetitorsByNumber}
						/>
					)}

					{activeTab === "assistants" && ownedEvent && (
						<CompAssistantsPanel
							compAssistants={ownedEvent.compAssistants || []}
							competitionStarted={ownedEvent.heats.length > 0}
							maleStartNumber={ownedEvent.maleStartNumber}
							maleEndNumber={ownedEvent.maleEndNumber}
							femaleStartNumber={ownedEvent.femaleStartNumber}
							femaleEndNumber={ownedEvent.femaleEndNumber}
							eventId={ownedEvent.id}
							onAdd={handleAddCompAssistant}
							onUpdate={handleUpdateCompAssistant}
							onDelete={handleDeleteCompAssistant}
						/>
					)}

					{activeTab === "judges" && ownedEvent && (
						<JudgesPanel
							judges={ownedEvent.judges}
							currentHeat={currentHeat || null}
							baseUrl={baseUrl}
							votes={ownedEvent.votes}
							competitors={ownedEvent.competitors}
							event={ownedEvent}
							onAdd={handleAddJudge}
							onUpdate={handleUpdateJudge}
							onDelete={handleDeleteJudge}
							onImportCSV={handleImportJudgesCSV}
						/>
					)}

					{activeTab === "settings" && ownedEvent && (
						<div className="max-w-2xl">
							<EventSettingsPanel
								event={ownedEvent}
								events={filteredEvents}
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
					)}
				</main>
			</div>

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

export default function DashboardPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-background flex items-center justify-center">
					<Loader2 className="w-8 h-8 animate-spin text-primary" />
				</div>
			}
		>
			<DashboardContent />
		</Suspense>
	);
}
