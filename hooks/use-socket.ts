"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "@/lib/socket-events";
import type {
	Event,
	EventSummary,
	Competitor,
	Judge,
	RoundType,
	Gender,
} from "@/lib/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const DEFAULT_EVENT_ID = "demo-event-1";

// Dynamic URL detection - works for localhost, Cloud Run, and any deployment
function getSocketUrl(): string {
	if (typeof window === "undefined") return "";
	if (process.env.NEXT_PUBLIC_SOCKET_URL) {
		return process.env.NEXT_PUBLIC_SOCKET_URL;
	}
	const protocol = window.location.protocol === "https:" ? "https:" : "http:";
	const host = window.location.host;
	return `${protocol}//${host}`;
}

// REST API helpers
async function fetchEventFromAPI(
	eventId: string,
	isAdmin?: boolean,
): Promise<Event | null> {
	try {
		const adminParam = isAdmin ? "&admin=true" : "";
		const response = await fetch(
			`/api/event?eventId=${eventId}${adminParam}`,
		);
		const data = await response.json();
		return data.success ? data.event : null;
	} catch (error) {
		console.error("[API] Error fetching event:", error);
		return null;
	}
}

async function registerCompetitorAPI(
	eventId: string,
	name: string,
	gender: Gender,
	photoData?: string,
	photoType?: string,
	number?: number,
): Promise<Competitor | null> {
	try {
		const response = await fetch("/api/competitors/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				eventId,
				name,
				gender,
				photoData,
				photoType,
				number,
			}),
		});
		const data = await response.json();

		if (data.success) {
			return data.competitor;
		} else {
			// Throw error with the specific message from the server
			const errorMessage = data.error || "Registration failed";
			throw new Error(errorMessage);
		}
	} catch (error) {
		console.error("[API] Error registering competitor:", error);
		// Re-throw the error so it can be caught by the caller
		if (error instanceof Error) {
			throw error;
		} else {
			throw new Error("Network error during registration");
		}
	}
}

async function adminLoginAPI(
	email: string,
	password: string,
): Promise<{ success: boolean; admin?: any }> {
	try {
		const response = await fetch("/api/admin/auth", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});
		const data = await response.json();
		if (data.success && data.authenticated) {
			return { success: true, admin: data.admin };
		}
		return { success: false };
	} catch (error) {
		console.error("[API] Error logging in:", error);
		return { success: false };
	}
}

async function fetchEventsFromAPI(): Promise<EventSummary[]> {
	try {
		const response = await fetch("/api/events");
		const data = await response.json();
		return data.success ? data.events : [];
	} catch (error) {
		console.error("[API] Error fetching events:", error);
		return [];
	}
}

export function useSocket(eventId?: string, isAdmin?: boolean) {
	const [socket, setSocket] = useState<TypedSocket | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [event, setEvent] = useState<Event | null>(null);
	const [events, setEvents] = useState<EventSummary[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [deletedEventInfo, setDeletedEventInfo] = useState<{
		eventId: string;
		eventName?: string;
	} | null>(null);
	const socketRef = useRef<TypedSocket | null>(null);
	const currentEventId = useRef<string>(eventId || DEFAULT_EVENT_ID);
	const isAdminRef = useRef<boolean>(isAdmin || false);
	// Track processed events to prevent double-counting from room + global emits
	const processedEventsRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		currentEventId.current = eventId || DEFAULT_EVENT_ID;
	}, [eventId]);

	useEffect(() => {
		isAdminRef.current = isAdmin || false;
	}, [isAdmin]);

	useEffect(() => {
		let mounted = true;
		const targetEventId = eventId || DEFAULT_EVENT_ID;
		const adminMode = isAdmin || false;

		const initConnection = async () => {
			// First, try to load data from REST API immediately
			const [eventData, eventsData] = await Promise.all([
				fetchEventFromAPI(targetEventId, adminMode),
				fetchEventsFromAPI(),
			]);
			if (mounted) {
				if (eventData) setEvent(eventData);
				if (eventsData.length > 0) setEvents(eventsData);
				setIsLoading(false);
			}

			// Then try Socket.IO for real-time updates
			try {
				const socketUrl = getSocketUrl();
				console.log("[Socket] Connecting to:", socketUrl);

				const socketInstance = io(socketUrl, {
					path: "/api/socketio",
					// WebSocket-only for Cloud Run compatibility
					transports: ["websocket"],
					timeout: 20000,
					reconnectionAttempts: 10,
					reconnectionDelay: 1000,
					reconnectionDelayMax: 5000,
					upgrade: false,
					forceNew: false,
				}) as TypedSocket;

				socketRef.current = socketInstance;

				socketInstance.on("connect", () => {
					if (!mounted) return;
					console.log("[Socket] Connected:", socketInstance.id);
					setIsConnected(true);
					// Request event data via socket
					socketInstance.emit(
						"event:get",
						{ eventId: targetEventId },
						(response) => {
							if (response.success && response.event && mounted) {
								setEvent(response.event);
								setIsLoading(false);
							}
						},
					);
				});

				socketInstance.on("disconnect", () => {
					if (!mounted) return;
					console.log("[Socket] Disconnected");
					setIsConnected(false);
				});

				socketInstance.on("connect_error", (error) => {
					if (!mounted) return;
					console.log("[Socket] Connection error:", error.message);
					setIsLoading(false);
				});

				// Real-time event listeners
				socketInstance.on(
					"event:updated",
					({ eventId: updatedEventId, event: updatedEvent }) => {
						if (
							mounted &&
							updatedEventId === currentEventId.current
						) {
							// Update event for all clients (admin and non-admin)
							setEvent(updatedEvent);
						}
					},
				);

				// Admin-only: receive full event data with real-time vote counts
				// (kept for backward compatibility, but event:updated now works for all)
				socketInstance.on(
					"admin:event:updated",
					({ eventId: updatedEventId, event: updatedEvent }) => {
						if (
							mounted &&
							updatedEventId === currentEventId.current &&
							isAdminRef.current
						) {
							// Admin gets full unfiltered event data
							setEvent(updatedEvent);
						}
					},
				);

				socketInstance.on("event:created", ({ event: newEvent }) => {
					if (mounted) {
						setEvents((prev) => [
							...prev,
							{
								id: newEvent.id,
								name: newEvent.name,
								date: newEvent.date,
								venue: newEvent.venue,
								status: newEvent.status,
								competitorCount: newEvent.competitors.length,
								judgeCount: newEvent.judges.length,
								createdAt: newEvent.createdAt,
								adminId: newEvent.adminId,
							},
						]);
					}
				});

				socketInstance.on(
					"event:deleted",
					({ eventId: deletedEventId, eventName }) => {
						if (mounted) {
							setEvents((prev) =>
								prev.filter((e) => e.id !== deletedEventId),
							);
							// If the current event was deleted, set the deleted event info
							if (deletedEventId === currentEventId.current) {
								setDeletedEventInfo({
									eventId: deletedEventId,
									eventName,
								});
								setEvent(null);
							}
						}
					},
				);

				// Listen for global event metadata updates (name, date, venue changes)
				socketInstance.on(
					"event:metadataUpdated",
					({
						eventId: updatedEventId,
						name,
						date,
						venue,
						status,
						competitorCount,
						judgeCount,
					}) => {
						if (mounted) {
							// Update the events list
							setEvents((prev) =>
								prev.map((e) =>
									e.id === updatedEventId
										? {
												...e,
												name,
												date,
												venue,
												status: status as EventSummary["status"],
												competitorCount,
												judgeCount,
											}
										: e,
								),
							);
							// Also update the current event if it matches
							if (updatedEventId === currentEventId.current) {
								setEvent((prev) =>
									prev
										? {
												...prev,
												name,
												date,
												venue,
												status: status as Event["status"],
											}
										: null,
								);
							}
						}
					},
				);

				socketInstance.on(
					"competitor:added",
					({ eventId: evtId, competitor }) => {
						if (mounted) {
							const eventKey = `competitor:${competitor.id}`;
							// Update current event if it matches
							if (evtId === currentEventId.current) {
								setEvent((prev) => {
									if (!prev) return null;
									// Prevent duplicate - check if competitor already exists
									if (
										prev.competitors.some(
											(c) => c.id === competitor.id,
										)
									) {
										return prev;
									}
									return {
										...prev,
										competitors: [
											...prev.competitors,
											competitor,
										],
									};
								});
							}
							// Also update the events list competitor count (prevent double-counting)
							if (!processedEventsRef.current.has(eventKey)) {
								processedEventsRef.current.add(eventKey);
								// Clear after a short delay to allow for future updates
								setTimeout(() => {
									processedEventsRef.current.delete(eventKey);
								}, 1000);
								setEvents((prev) =>
									prev.map((e) =>
										e.id === evtId
											? {
													...e,
													competitorCount:
														e.competitorCount + 1,
												}
											: e,
									),
								);
							}
						}
					},
				);

				socketInstance.on(
					"competitor:updated",
					({ eventId: evtId, competitor }) => {
						console.log("[Socket] competitor:updated received:", {
							eventId: evtId,
							competitorId: competitor.id,
							photoUrl:
								competitor.photoUrl?.substring(0, 50) + "...",
						});
						if (mounted && evtId === currentEventId.current) {
							setEvent((prev) =>
								prev
									? {
											...prev,
											competitors: prev.competitors.map(
												(c) =>
													c.id === competitor.id
														? competitor
														: c,
											),
										}
									: null,
							);
						}
					},
				);

				socketInstance.on(
					"competitor:removed",
					({ eventId: evtId, competitorId }) => {
						if (mounted) {
							const eventKey = `competitor:remove:${competitorId}`;
							// Update current event if it matches
							if (evtId === currentEventId.current) {
								setEvent((prev) =>
									prev
										? {
												...prev,
												competitors:
													prev.competitors.filter(
														(c) =>
															c.id !==
															competitorId,
													),
											}
										: null,
								);
							}
							// Also update the events list competitor count (prevent double-counting)
							if (!processedEventsRef.current.has(eventKey)) {
								processedEventsRef.current.add(eventKey);
								setTimeout(() => {
									processedEventsRef.current.delete(eventKey);
								}, 1000);
								setEvents((prev) =>
									prev.map((e) =>
										e.id === evtId
											? {
													...e,
													competitorCount: Math.max(
														0,
														e.competitorCount - 1,
													),
												}
											: e,
									),
								);
							}
						}
					},
				);

				// Listen for registration limit reached notifications
				socketInstance.on(
					"registration:limitReached",
					({
						eventId: evtId,
						gender,
						currentCount,
						maxCount,
						message,
					}) => {
						if (mounted && evtId === currentEventId.current) {
							console.log(
								`[Socket] Registration limit reached for ${gender}: ${currentCount}/${maxCount}`,
							);
							// The toast will be shown by the component that receives this event
							// This is just for logging and potential future use
						}
					},
				);

				socketInstance.on(
					"judge:added",
					({ eventId: evtId, judge }) => {
						if (mounted) {
							const eventKey = `judge:${judge.id}`;
							// Update current event if it matches
							if (evtId === currentEventId.current) {
								setEvent((prev) => {
									if (!prev) return null;
									// Prevent duplicate - check if judge already exists
									if (
										prev.judges.some(
											(j) => j.id === judge.id,
										)
									) {
										return prev;
									}
									return {
										...prev,
										judges: [...prev.judges, judge],
									};
								});
							}
							// Also update the events list judge count (prevent double-counting)
							if (!processedEventsRef.current.has(eventKey)) {
								processedEventsRef.current.add(eventKey);
								setTimeout(() => {
									processedEventsRef.current.delete(eventKey);
								}, 1000);
								setEvents((prev) =>
									prev.map((e) =>
										e.id === evtId
											? {
													...e,
													judgeCount:
														e.judgeCount + 1,
												}
											: e,
									),
								);
							}
						}
					},
				);

				socketInstance.on(
					"judge:updated",
					({ eventId: evtId, judge }) => {
						if (mounted && evtId === currentEventId.current) {
							setEvent((prev) =>
								prev
									? {
											...prev,
											judges: prev.judges.map((j) =>
												j.id === judge.id ? judge : j,
											),
										}
									: null,
							);
						}
					},
				);

				socketInstance.on(
					"judge:removed",
					({ eventId: evtId, judgeId }) => {
						if (mounted) {
							const eventKey = `judge:remove:${judgeId}`;
							// Update current event if it matches
							if (evtId === currentEventId.current) {
								setEvent((prev) =>
									prev
										? {
												...prev,
												judges: prev.judges.filter(
													(j) => j.id !== judgeId,
												),
											}
										: null,
								);
							}
							// Also update the events list judge count (prevent double-counting)
							if (!processedEventsRef.current.has(eventKey)) {
								processedEventsRef.current.add(eventKey);
								setTimeout(() => {
									processedEventsRef.current.delete(eventKey);
								}, 1000);
								setEvents((prev) =>
									prev.map((e) =>
										e.id === evtId
											? {
													...e,
													judgeCount: Math.max(
														0,
														e.judgeCount - 1,
													),
												}
											: e,
									),
								);
							}
						}
					},
				);

				// Comp Assistant event listeners
				socketInstance.on(
					"compAssistant:added" as any,
					({ eventId: evtId, compAssistant }: any) => {
						if (mounted && evtId === currentEventId.current) {
							setEvent((prev) => {
								if (!prev) return null;
								const compAssistants =
									prev.compAssistants || [];
								if (
									compAssistants.some(
										(ca) => ca.id === compAssistant.id,
									)
								) {
									return prev;
								}
								return {
									...prev,
									compAssistants: [
										...compAssistants,
										compAssistant,
									],
								};
							});
						}
					},
				);

				socketInstance.on(
					"compAssistant:updated" as any,
					({ eventId: evtId, compAssistant }: any) => {
						if (mounted && evtId === currentEventId.current) {
							setEvent((prev) =>
								prev
									? {
											...prev,
											compAssistants: (
												prev.compAssistants || []
											).map((ca) =>
												ca.id === compAssistant.id
													? compAssistant
													: ca,
											),
										}
									: null,
							);
						}
					},
				);

				socketInstance.on(
					"compAssistant:removed" as any,
					({ eventId: evtId, compAssistantId }: any) => {
						if (mounted && evtId === currentEventId.current) {
							setEvent((prev) =>
								prev
									? {
											...prev,
											compAssistants: (
												prev.compAssistants || []
											).filter(
												(ca) =>
													ca.id !== compAssistantId,
											),
										}
									: null,
							);
						}
					},
				);

				socketInstance.on("voting:opened", () => {
					if (mounted)
						setEvent((prev) =>
							prev ? { ...prev, votingOpen: true } : null,
						);
				});

				socketInstance.on("voting:closed", () => {
					if (mounted)
						setEvent((prev) =>
							prev ? { ...prev, votingOpen: false } : null,
						);
				});

				socketInstance.on("rotation:changed", ({ rotation }) => {
					if (mounted)
						setEvent((prev) =>
							prev
								? { ...prev, currentRotation: rotation }
								: null,
						);
				});

				// Listen for heat changes - ensures judge clients update immediately
				socketInstance.on(
					"heat:changed",
					({
						eventId: evtId,
						currentHeat,
						currentRound,
						currentRotation,
						votingOpen,
					}) => {
						if (mounted && evtId === currentEventId.current) {
							console.log(
								`[Socket] Heat changed to ${currentHeat}, round: ${currentRound}`,
							);
							setEvent((prev) =>
								prev
									? {
											...prev,
											currentHeat,
											currentRound,
											currentRotation,
											votingOpen,
										}
									: null,
							);
						}
					},
				);

				// Listen for tie-up updates
				socketInstance.on(
					"tieup:set",
					({ eventId: evtId, round, gender, competitorIds }) => {
						if (mounted && evtId === currentEventId.current) {
							setEvent((prev) => {
								if (!prev) return null;
								const updated = { ...prev };
								if (round === "round1") {
									if (gender === "male") {
										updated.tieUpRound1Male = competitorIds;
									} else {
										updated.tieUpRound1Female =
											competitorIds;
									}
								} else if (round === "round2") {
									if (gender === "male") {
										updated.tieUpRound2Male = competitorIds;
									} else {
										updated.tieUpRound2Female =
											competitorIds;
									}
								} else if (round === "finals") {
									if (gender === "male") {
										updated.tieUpFinalsMale = competitorIds;
									} else {
										updated.tieUpFinalsFemale =
											competitorIds;
									}
								}
								return updated;
							});
						}
					},
				);

				// Listen for round advancement - refresh full event data
				socketInstance.on(
					"round:advanced",
					({ eventId: evtId, newRound }) => {
						if (mounted && evtId === currentEventId.current) {
							console.log(
								`[Socket] Round advanced to ${newRound}`,
							);
							// Request fresh event data to get updated competitors with per-round votes
							socketInstance.emit(
								"event:get",
								{ eventId: evtId },
								(response) => {
									if (
										response.success &&
										response.event &&
										mounted
									) {
										setEvent(response.event);
									}
								},
							);
						}
					},
				);

				setSocket(socketInstance);
			} catch (error) {
				console.log("[Socket] Failed to initialize");
				if (mounted) setIsLoading(false);
			}
		};

		initConnection();

		return () => {
			mounted = false;
			socketRef.current?.disconnect();
		};
	}, [eventId, isAdmin]);

	// Admin authentication
	const adminLogin = useCallback(
		async (
			email: string,
			password: string,
		): Promise<{ success: boolean; admin?: any }> => {
			return adminLoginAPI(email, password);
		},
		[],
	);

	const adminLogout = useCallback(async (): Promise<boolean> => {
		return true;
	}, []);

	// Event operations
	const listEvents = useCallback(async (): Promise<EventSummary[]> => {
		// Try socket first, then REST API
		if (isConnected && socketRef.current) {
			return new Promise((resolve) => {
				socketRef.current!.emit("event:list", (response) => {
					if (response.success && response.events) {
						setEvents(response.events);
						resolve(response.events);
					} else {
						// Fallback to REST API
						fetchEventsFromAPI().then((events) => {
							setEvents(events);
							resolve(events);
						});
					}
				});
			});
		}
		// Use REST API if socket not connected
		const events = await fetchEventsFromAPI();
		setEvents(events);
		return events;
	}, [isConnected]);

	const createEvent = useCallback(
		async (
			name: string,
			date: string,
			venue: string,
			maleStartNumber?: number,
			maleEndNumber?: number,
			femaleStartNumber?: number,
			femaleEndNumber?: number,
			adminId?: string,
			competitionConfig?: any,
		): Promise<Event | null> => {
			if (!isConnected || !socketRef.current) return null;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"event:create",
					{
						name,
						date,
						venue,
						maleStartNumber,
						maleEndNumber,
						femaleStartNumber,
						femaleEndNumber,
						adminId,
						competitionConfig,
					},
					(response) => {
						if (response.success && response.event) {
							resolve(response.event);
						} else {
							resolve(null);
						}
					},
				);
			});
		},
		[isConnected],
	);

	const updateEvent = useCallback(
		async (
			updates: Partial<Event>,
			explicitEventId?: string,
		): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"event:update",
					{
						eventId: explicitEventId || currentEventId.current,
						updates,
					},
					(response) => {
						if (response.success && response.event) {
							setEvent(response.event);
						}
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	const deleteEvent = useCallback(
		async (eventIdToDelete: string): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"event:delete",
					{ eventId: eventIdToDelete },
					(response) => {
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	const seedEventData = useCallback(
		async (eventIdToSeed?: string): Promise<Event | null> => {
			if (!isConnected || !socketRef.current) return null;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"event:seed",
					{ eventId: eventIdToSeed || currentEventId.current },
					(response) => {
						if (response.success && response.event) {
							if (response.event.id === currentEventId.current) {
								setEvent(response.event);
							}
							resolve(response.event);
						} else {
							resolve(null);
						}
					},
				);
			});
		},
		[isConnected],
	);

	const rebuildRound = useCallback(
		async (id?: string): Promise<Event | null> => {
			if (!isConnected || !socketRef.current) return null;
			return new Promise((resolve) => {
				const targetId = id || currentEventId.current;
				socketRef.current!.emit(
					"admin:round:rebuild",
					{ eventId: targetId },
					(response: any) => {
						if (response.success && response.event) {
							if (response.event.id === currentEventId.current) {
								setEvent(response.event);
							}
							resolve(response.event);
						} else {
							resolve(null);
						}
					},
				);
			});
		},
		[isConnected],
	);

	// Competitor operations
	const registerCompetitor = useCallback(
		async (
			name: string,
			gender: Gender,
			photoData?: string,
			photoType?: string,
			number?: number,
		): Promise<Competitor | null> => {
			// Check actual socket connection state (not React state which may be stale)
			const socketConnected = socketRef.current?.connected === true;

			// Use WebSocket if connected (this broadcasts to admin)
			if (socketConnected) {
				console.log("[Socket] Using WebSocket for registration");
				return new Promise((resolve, reject) => {
					// Add timeout to prevent hanging
					const timeout = setTimeout(() => {
						console.log(
							"[Socket] Registration timeout, falling back to REST API",
						);
						registerCompetitorAPI(
							currentEventId.current,
							name,
							gender,
							photoData,
							photoType,
							number,
						)
							.then((result) => {
								if (result) {
									setEvent((prev) =>
										prev
											? {
													...prev,
													competitors: [
														...prev.competitors,
														result,
													],
												}
											: null,
									);
								}
								resolve(result);
							})
							.catch((error) => {
								// Handle API errors by rejecting the promise
								reject(error);
							});
					}, 15000); // 15 second timeout for photo uploads

					socketRef.current!.emit(
						"competitor:register",
						{
							eventId: currentEventId.current,
							name,
							gender,
							number,
							photoData,
							photoType,
						},
						(response) => {
							clearTimeout(timeout);
							if (response.success && response.competitor) {
								console.log(
									"[Socket] Registration successful via WebSocket",
								);
								// Don't update local state here - the broadcast will handle it
								resolve(response.competitor);
							} else {
								console.log(
									"[Socket] Registration failed:",
									response.error,
								);
								// Reject with the specific error message from the server
								const errorMessage =
									response.error || "Registration failed";
								reject(new Error(errorMessage));
							}
						},
					);
				});
			}
			// Fallback to REST API if socket not connected
			console.log(
				"[Socket] Not connected, using REST API for registration",
			);
			try {
				const result = await registerCompetitorAPI(
					currentEventId.current,
					name,
					gender,
					photoData,
					photoType,
					number,
				);
				if (result) {
					setEvent((prev) =>
						prev
							? {
									...prev,
									competitors: [...prev.competitors, result],
								}
							: null,
					);
				}
				return result;
			} catch (error) {
				// Re-throw the error so it can be caught by the import handler
				throw error;
			}
		},
		[], // Remove isConnected dependency since we check socketRef directly
	);

	const uploadCompetitorPhoto = useCallback(
		async (
			competitorId: string,
			photoData: string,
			photoType: string,
		): Promise<string | null> => {
			if (!isConnected || !socketRef.current) return null;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"competitor:uploadPhoto",
					{
						eventId: currentEventId.current,
						competitorId,
						photoData,
						photoType,
					},
					(response) => {
						resolve(
							response.success ? response.photoUrl || null : null,
						);
					},
				);
			});
		},
		[isConnected],
	);

	const deleteCompetitorPhoto = useCallback(
		async (competitorId: string): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"competitor:deletePhoto",
					{
						eventId: currentEventId.current,
						competitorId,
					},
					(response) => {
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	const deleteCompetitor = useCallback(
		async (competitorId: string): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"competitor:delete",
					{
						eventId: currentEventId.current,
						competitorId,
					},
					(response) => {
						if (response.success) {
							setEvent((prev) =>
								prev
									? {
											...prev,
											competitors:
												prev.competitors.filter(
													(c) =>
														c.id !== competitorId,
												),
										}
									: null,
							);
						}
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	const updateCompetitor = useCallback(
		async (
			competitorId: string,
			updates: Partial<Competitor> & {
				photoData?: string;
				photoType?: string;
			},
		): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;

			console.log("[Socket] updateCompetitor called with:", {
				competitorId,
				updateKeys: Object.keys(updates),
				hasPhotoData: !!(updates as any).photoData,
				photoType: (updates as any).photoType,
			});

			return new Promise((resolve) => {
				socketRef.current!.emit(
					"competitor:update",
					{
						eventId: currentEventId.current,
						competitorId,
						updates,
					},
					(response) => {
						console.log(
							"[Socket] updateCompetitor response:",
							response,
						);
						if (response.success && response.competitor) {
							setEvent((prev) =>
								prev
									? {
											...prev,
											competitors: prev.competitors.map(
												(c) =>
													c.id === competitorId
														? response.competitor!
														: c,
											),
										}
									: null,
							);
						}
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	// Judge operations
	const createJudge = useCallback(
		async (
			name: string,
			gender: Gender,
			pin?: string,
			photoData?: string,
			photoType?: string,
		): Promise<Judge | null> => {
			if (!isConnected || !socketRef.current) return null;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"judge:create",
					{
						eventId: currentEventId.current,
						name,
						gender,
						pin,
						photoData,
						photoType,
					},
					(response) => {
						if (response.success && response.judge) {
							setEvent((prev) => {
								if (!prev) return null;
								// Prevent duplicate - check if judge already exists
								if (
									prev.judges.some(
										(j) => j.id === response.judge!.id,
									)
								) {
									return prev;
								}
								return {
									...prev,
									judges: [...prev.judges, response.judge!],
								};
							});
							resolve(response.judge);
						} else {
							resolve(null);
						}
					},
				);
			});
		},
		[isConnected],
	);

	const deleteJudge = useCallback(
		async (judgeId: string): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"judge:delete",
					{
						eventId: currentEventId.current,
						judgeId,
					},
					(response) => {
						if (response.success) {
							setEvent((prev) =>
								prev
									? {
											...prev,
											judges: prev.judges.filter(
												(j) => j.id !== judgeId,
											),
										}
									: null,
							);
						}
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	const updateJudge = useCallback(
		async (judgeId: string, updates: Partial<Judge>): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"judge:update",
					{
						eventId: currentEventId.current,
						judgeId,
						updates,
					},
					(response) => {
						if (response.success && response.judge) {
							setEvent((prev) =>
								prev
									? {
											...prev,
											judges: prev.judges.map((j) =>
												j.id === judgeId
													? response.judge!
													: j,
											),
										}
									: null,
							);
						}
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	const authenticateJudge = useCallback(
		async (
			token: string,
			pin?: string,
		): Promise<{ judge: Judge; eventId: string } | null> => {
			if (!isConnected || !socketRef.current) return null;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"judge:auth",
					{ token, pin },
					(response) => {
						if (
							response.success &&
							response.judge &&
							response.eventId
						) {
							resolve({
								judge: response.judge,
								eventId: response.eventId,
							});
						} else {
							resolve(null);
						}
					},
				);
			});
		},
		[isConnected],
	);

	// Comp Assistant operations
	const createCompAssistant = useCallback(
		async (
			name: string,
			number: number,
			gender: Gender,
			photoData?: string,
			photoType?: string,
		): Promise<any | null> => {
			if (!isConnected || !socketRef.current) {
				console.log(
					"[Socket] Not connected, cannot create comp assistant",
				);
				return null;
			}
			return new Promise((resolve) => {
				// Add timeout to prevent hanging
				const timeout = setTimeout(() => {
					console.log("[Socket] createCompAssistant timeout");
					resolve(null);
				}, 30000); // 30 second timeout for photo uploads

				socketRef.current!.emit(
					"compAssistant:create" as any,
					{
						eventId: currentEventId.current,
						name,
						number,
						gender,
						photoData,
						photoType,
					},
					(response: any) => {
						clearTimeout(timeout);
						console.log(
							"[Socket] createCompAssistant response:",
							response,
						);
						if (response.success && response.compAssistant) {
							setEvent((prev) => {
								if (!prev) return null;
								const compAssistants =
									prev.compAssistants || [];
								if (
									compAssistants.some(
										(ca) =>
											ca.id === response.compAssistant.id,
									)
								) {
									return prev;
								}
								return {
									...prev,
									compAssistants: [
										...compAssistants,
										response.compAssistant,
									],
								};
							});
							resolve(response.compAssistant);
						} else {
							console.log(
								"[Socket] createCompAssistant failed:",
								response.error,
							);
							resolve(null);
						}
					},
				);
			});
		},
		[isConnected],
	);

	const updateCompAssistant = useCallback(
		async (compAssistantId: string, updates: any): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"compAssistant:update" as any,
					{
						eventId: currentEventId.current,
						compAssistantId,
						updates,
					},
					(response: any) => {
						if (response.success && response.compAssistant) {
							setEvent((prev) =>
								prev
									? {
											...prev,
											compAssistants: (
												prev.compAssistants || []
											).map((ca) =>
												ca.id === compAssistantId
													? response.compAssistant
													: ca,
											),
										}
									: null,
							);
						}
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	const deleteCompAssistant = useCallback(
		async (compAssistantId: string): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"compAssistant:delete" as any,
					{
						eventId: currentEventId.current,
						compAssistantId,
					},
					(response: any) => {
						if (response.success) {
							setEvent((prev) =>
								prev
									? {
											...prev,
											compAssistants: (
												prev.compAssistants || []
											).filter(
												(ca) =>
													ca.id !== compAssistantId,
											),
										}
									: null,
							);
						}
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	// Round operations
	const generatePairings = useCallback(
		async (round: RoundType): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"round:generatePairings",
					{
						eventId: currentEventId.current,
						round,
					},
					(response) => {
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	const openVoting = useCallback(
		async (heatId: string): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;

			// Optimistic update - set votingOpen immediately
			setEvent((prev) =>
				prev
					? {
							...prev,
							votingOpen: true,
							heats: prev.heats.map((h) =>
								h.id === heatId
									? { ...h, votingStatus: "open" as const }
									: h,
							),
						}
					: null,
			);

			return new Promise((resolve) => {
				socketRef.current!.emit(
					"round:openVoting",
					{
						eventId: currentEventId.current,
						heatId,
					},
					(response) => {
						if (!response.success) {
							// Revert optimistic update on failure
							setEvent((prev) =>
								prev
									? {
											...prev,
											votingOpen: false,
											heats: prev.heats.map((h) =>
												h.id === heatId
													? {
															...h,
															votingStatus:
																"closed" as const,
														}
													: h,
											),
										}
									: null,
							);
						}
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	const closeVoting = useCallback(
		async (
			heatId: string,
		): Promise<{ success: boolean; error?: string }> => {
			if (!isConnected || !socketRef.current)
				return { success: false, error: "Not connected" };

			return new Promise((resolve) => {
				socketRef.current!.emit(
					"round:closeVoting",
					{
						eventId: currentEventId.current,
						heatId,
					},
					(response) => {
						resolve({
							success: response.success,
							error: response.error,
						});
					},
				);
			});
		},
		[isConnected],
	);

	const nextHeat = useCallback(async (): Promise<{
		success: boolean;
		error?: string;
	}> => {
		if (!isConnected || !socketRef.current)
			return { success: false, error: "Not connected" };
		return new Promise((resolve) => {
			socketRef.current!.emit(
				"round:nextHeat",
				{
					eventId: currentEventId.current,
				},
				(response) => {
					resolve({
						success: response.success,
						error: response.error,
					});
				},
			);
		});
	}, [isConnected]);

	const nextRotation = useCallback(async (): Promise<{
		success: boolean;
		error?: string;
	}> => {
		if (!isConnected || !socketRef.current)
			return { success: false, error: "Not connected" };
		return new Promise((resolve) => {
			socketRef.current!.emit(
				"round:nextRotation",
				{
					eventId: currentEventId.current,
				},
				(response) => {
					resolve({
						success: response.success,
						error: response.error,
					});
				},
			);
		});
	}, [isConnected]);

	const advanceRound = useCallback(async (): Promise<{
		success: boolean;
		error?: string;
	}> => {
		if (!isConnected || !socketRef.current)
			return { success: false, error: "Not connected" };
		return new Promise((resolve) => {
			socketRef.current!.emit(
				"round:advance",
				{
					eventId: currentEventId.current,
				},
				(response) => {
					resolve({
						success: response.success,
						error: response.error,
					});
				},
			);
		});
	}, [isConnected]);

	const setTieUp = useCallback(
		async (
			round: RoundType,
			gender: Gender,
			competitorIds: string[],
		): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"round:setTieUp",
					{
						eventId: currentEventId.current,
						round,
						gender,
						competitorIds,
					},
					(response) => {
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	// Voting operations
	const submitVote = useCallback(
		async (
			judgeId: string,
			heatId: string,
			round: RoundType,
			rankings: {
				competitorId: string;
				rank: 1 | 2 | 3 | 4 | 5 | 6;
				scores?: Record<string, number>;
			}[],
		): Promise<boolean> => {
			if (!isConnected || !socketRef.current) return false;
			return new Promise((resolve) => {
				socketRef.current!.emit(
					"vote:submit",
					{
						eventId: currentEventId.current,
						judgeId,
						heatId,
						round,
						rankings,
					},
					(response) => {
						resolve(response.success);
					},
				);
			});
		},
		[isConnected],
	);

	// Results operations
	const publishResults = useCallback(async (): Promise<boolean> => {
		if (!isConnected || !socketRef.current) return false;
		return new Promise((resolve) => {
			socketRef.current!.emit(
				"results:publish",
				{
					eventId: currentEventId.current,
				},
				(response) => {
					resolve(response.success);
				},
			);
		});
	}, [isConnected]);

	// Data management
	const resetData = useCallback(async (): Promise<boolean> => {
		if (!isConnected || !socketRef.current) return false;
		return new Promise((resolve) => {
			socketRef.current!.emit(
				"data:reset",
				{
					eventId: currentEventId.current,
				},
				(response) => {
					resolve(response.success);
				},
			);
		});
	}, [isConnected]);

	const seedData = useCallback(async (): Promise<Event | null> => {
		if (!isConnected || !socketRef.current) return null;
		return new Promise((resolve) => {
			socketRef.current!.emit(
				"data:seed",
				{ eventId: currentEventId.current },
				(response) => {
					if (response.success && response.event) {
						setEvent(response.event);
						resolve(response.event);
					} else {
						resolve(null);
					}
				},
			);
		});
	}, [isConnected]);

	const deleteAllData = useCallback(async (): Promise<boolean> => {
		if (!isConnected || !socketRef.current) return false;
		return new Promise((resolve) => {
			socketRef.current!.emit("data:deleteAll", (response) => {
				resolve(response.success);
			});
		});
	}, [isConnected]);

	const refreshEvent = useCallback(async (): Promise<void> => {
		const eventData = await fetchEventFromAPI(
			currentEventId.current,
			isAdminRef.current,
		);
		if (eventData) {
			setEvent(eventData);
		}
	}, []);

	const clearDeletedEventInfo = useCallback(() => {
		setDeletedEventInfo(null);
	}, []);

	return {
		socket,
		isConnected,
		isLoading,
		event,
		events,
		deletedEventInfo,
		// Admin
		adminLogin,
		adminLogout,
		// Events
		listEvents,
		createEvent,
		updateEvent,
		rebuildRound,
		deleteEvent,
		seedEventData,
		// Competitors
		registerCompetitor,
		uploadCompetitorPhoto,
		deleteCompetitorPhoto,
		deleteCompetitor,
		updateCompetitor,
		// Comp Assistants
		createCompAssistant,
		updateCompAssistant,
		deleteCompAssistant,
		// Judges
		createJudge,
		deleteJudge,
		updateJudge,
		authenticateJudge,
		// Rounds
		generatePairings,
		openVoting,
		closeVoting,
		nextHeat,
		nextRotation,
		advanceRound,
		setTieUp,
		// Voting
		submitVote,
		// Results
		publishResults,
		// Data management
		resetData,
		seedData,
		deleteAllData,
		refreshEvent,
		clearDeletedEventInfo,
	};
}
