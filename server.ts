import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import bcrypt from "bcryptjs";
import { gcsClient, gcsHelpers } from "./lib/gcs-client";
import { GCS_PATHS } from "./lib/gcs-config";
import {
	getRotationsForRound,
	getHeatsForRound,
	getScoringMode,
	getFinalsJudgeMode,
	getCompetitorsAdvancing,
	legacyRoundToIndex,
	indexToLegacyRound,
	isFinalRound,
	getRoundConfigForType,
	getRoundName,
	getCompetitionConfig,
	getSortedRounds,
	calculateRankings,
	getCurrentRoundConfig,
} from "./lib/competition-config";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData,
	RegisterCompetitorData,
	CreateJudgeData,
	SubmitVoteData,
	UploadPhotoData,
	CreateEventData,
} from "./lib/socket-events";
import type {
	Event,
	EventSummary,
	Competitor,
	Judge,
	Heat,
	Vote,
	RoundType,
	Gender,
	Couple,
	FinalsCouple,
	Rotation,
} from "./lib/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const port = parseInt(process.env.PORT || "8080", 10);

console.log(`> Starting server...`);
console.log(`> Environment: ${dev ? "development" : "production"}`);
console.log(`> Port: ${port}, Hostname: ${hostname}`);
console.log(`> PORT env var: ${process.env.PORT}`);

const DEFAULT_EVENT_ID = "demo-event-1";

// Helper functions
async function loadEventFromGCS(eventId: string): Promise<Event | null> {
	try {
		return (await gcsHelpers.getEventMetadata(eventId)) as Event | null;
	} catch (error) {
		console.error(`[GCS] Error loading event ${eventId}:`, error);
		return null;
	}
}

// Retry with exponential backoff for GCS rate limit (429) errors
async function saveEventToGCS(eventId: string, event: Event): Promise<void> {
	event.updatedAt = new Date().toISOString();
	const maxRetries = 8;
	let delay = 200; // start at 200ms

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			await gcsHelpers.saveEventMetadata(eventId, event);
			return;
		} catch (error: any) {
			const is429 =
				error?.code === 429 ||
				error?.message?.includes("429") ||
				error?.message?.includes("rateLimitExceeded") ||
				error?.message?.includes("Retry limit exceeded");

			if (is429 && attempt < maxRetries) {
				const jitter = Math.random() * delay * 0.5;
				const waitTime = delay + jitter;
				console.log(
					`[GCS] Rate limited on ${eventId}, retry ${attempt + 1}/${maxRetries} in ${Math.round(waitTime)}ms`,
				);
				await new Promise((r) => setTimeout(r, waitTime));
				delay = Math.min(delay * 2, 10000); // cap at 10s
			} else {
				console.error(
					`[GCS] Save failed for ${eventId} after ${attempt + 1} attempts:`,
					error,
				);
				throw error;
			}
		}
	}
}

async function listAllEvents(): Promise<EventSummary[]> {
	try {
		const events = (await gcsHelpers.listEvents()) as Event[];
		return events.map((e) => ({
			id: e.id,
			name: e.name,
			date: e.date,
			venue: e.venue,
			status: e.status || "active",
			competitorCount: e.competitors?.length || 0,
			judgeCount: e.judges?.length || 0,
			createdAt: e.createdAt || new Date().toISOString(),
			adminId: e.adminId,
		}));
	} catch (error) {
		console.error("[GCS] Error listing events:", error);
		return [];
	}
}

function generatePairings(
	males: Competitor[],
	females: Competitor[],
	pairingHistory: { maleId: string; femaleId: string }[],
): Couple[] {
	const couples: Couple[] = [];
	const usedMales = new Set<string>();
	const usedFemales = new Set<string>();
	const historySet = new Set(
		pairingHistory.map((p) => `${p.maleId}-${p.femaleId}`),
	);

	const shuffledMales = [...males].sort(() => Math.random() - 0.5);
	const shuffledFemales = [...females].sort(() => Math.random() - 0.5);

	for (const male of shuffledMales) {
		for (const female of shuffledFemales) {
			if (usedFemales.has(female.id)) continue;
			if (historySet.has(`${male.id}-${female.id}`)) continue;
			couples.push({
				id: `couple-${male.id}-${female.id}`,
				maleCompetitor: male,
				femaleCompetitor: female,
				heatNumber: 0,
				round: "round1",
			});
			usedMales.add(male.id);
			usedFemales.add(female.id);
			break;
		}
	}

	const unpairedMales = shuffledMales.filter((m) => !usedMales.has(m.id));
	const unpairedFemales = shuffledFemales.filter(
		(f) => !usedFemales.has(f.id),
	);

	for (
		let i = 0;
		i < Math.min(unpairedMales.length, unpairedFemales.length);
		i++
	) {
		couples.push({
			id: `couple-${unpairedMales[i].id}-${unpairedFemales[i].id}`,
			maleCompetitor: unpairedMales[i],
			femaleCompetitor: unpairedFemales[i],
			heatNumber: 0,
			round: "round1",
		});
	}
	return couples;
}

// Helper functions for heats replaced by dynamic config.

// Generate rotations for a heat - females rotate to different male partners
function generateRotationsForHeat(
	event: Event,
	males: Competitor[],
	females: Competitor[],
	heatNumber: number,
	round: RoundType,
): Rotation[] {
	const totalRotations = getRotationsForRound(event, round);
	const rotations: Rotation[] = [];

	const heatMales = [...males];
	const heatFemales = [...females];

	const roundConfig = getCompetitionConfig(event).rounds.find(
		(r) => r.id === round,
	);
	const isNoPairing = roundConfig?.pairingMode === "none";

	// If no pairing, each rotation just shows everyone
	if (isNoPairing) {
		for (let rotation = 1; rotation <= totalRotations; rotation++) {
			rotations.push({
				number: rotation,
				couples: [],
				maleCompetitors: heatMales,
				femaleCompetitors: heatFemales,
			});
		}
		return rotations;
	}

	// For pairing: rotate so that everyone eventually dances if possible
	const maxCount = Math.max(heatMales.length, heatFemales.length);
	const minCount = Math.min(heatMales.length, heatFemales.length);

	for (let rotation = 1; rotation <= totalRotations; rotation++) {
		const couples: Couple[] = [];

		if (minCount > 0) {
			// If imbalanced, we shift the larger group so different people get paired in each rotation
			const largerGroupIsMales = heatMales.length > heatFemales.length;

			for (let i = 0; i < minCount; i++) {
				let maleIdx, femaleIdx;

				if (largerGroupIsMales) {
					// Shift males through the rotations
					maleIdx =
						(i + (rotation - 1) * minCount) % heatMales.length;
					femaleIdx = i;
				} else {
					// Shift females through the rotations
					maleIdx = i;
					femaleIdx =
						(i + (rotation - 1) * minCount) % heatFemales.length;
				}

				const male = heatMales[maleIdx];
				const female = heatFemales[femaleIdx];

				if (male && female) {
					couples.push({
						id: `couple-h${heatNumber}-r${rotation}-${male.id}-${female.id}`,
						maleCompetitor: male,
						femaleCompetitor: female,
						heatNumber,
						round,
						rotation,
					});
				}
			}
		}

		rotations.push({
			number: rotation,
			couples,
			maleCompetitors: heatMales, // Always include everyone so they can be judged
			femaleCompetitors: heatFemales,
		});
	}

	return rotations;
}

// Generate heats with rotations for a round dynamically
function generateHeatsWithRotations(
	event: Event,
	males: Competitor[],
	females: Competitor[],
	round: RoundType,
): Heat[] {
	const heats: Heat[] = [];
	const totalRotations = getRotationsForRound(event, round);
	const numberOfHeats = Math.max(1, getHeatsForRound(event, round));

	const shuffledMales = [...males].sort(() => Math.random() - 0.5);
	const shuffledFemales = [...females].sort(() => Math.random() - 0.5);

	for (let i = 0; i < numberOfHeats; i++) {
		// More robust distribution: use floor of industrial range to ensure sum equals length
		const maleStart = Math.floor(
			(i * shuffledMales.length) / numberOfHeats,
		);
		const maleEnd = Math.floor(
			((i + 1) * shuffledMales.length) / numberOfHeats,
		);
		const femaleStart = Math.floor(
			(i * shuffledFemales.length) / numberOfHeats,
		);
		const femaleEnd = Math.floor(
			((i + 1) * shuffledFemales.length) / numberOfHeats,
		);

		const heatMales = shuffledMales.slice(maleStart, maleEnd);
		const heatFemales = shuffledFemales.slice(femaleStart, femaleEnd);

		if (heatMales.length > 0 || heatFemales.length > 0) {
			const heatRotations = generateRotationsForHeat(
				event,
				heatMales,
				heatFemales,
				i + 1,
				round,
			);

			heats.push({
				id: `heat-${round}-${i + 1}`,
				number: i + 1,
				round,
				couples: heatRotations[0]?.couples || [],
				maleCompetitors: heatMales,
				femaleCompetitors: heatFemales,
				rotations: heatRotations,
				currentRotation: 1,
				totalRotations,
				votingStatus: "closed",
				judgesSubmitted: [],
			});
		}
	}

	return heats;
}

// Generate finals heats based on dynamic judge mode configuration
function generateFinalsHeats(
	event: Event,
	competitors: Competitor[],
	judges: Judge[],
	round: RoundType,
): Heat[] {
	const heats: Heat[] = [];
	const totalRotations = getRotationsForRound(event, round);
	const judgeMode = getFinalsJudgeMode(event, round);
	// The configured heats value is the TOTAL heats, split across genders
	const totalConfiguredHeats = Math.max(1, getHeatsForRound(event, round));
	const numberOfHeatsPerGender = Math.max(
		1,
		Math.ceil(totalConfiguredHeats / 2),
	);

	const maleFinalists = competitors.filter(
		(c) => c.gender === "male" && !c.eliminated && !c.isCompAssistant,
	);
	const femaleFinalists = competitors.filter(
		(c) => c.gender === "female" && !c.eliminated && !c.isCompAssistant,
	);
	const maleJudges = judges.filter((j) => j.gender === "male");
	const femaleJudges = judges.filter((j) => j.gender === "female");

	const judgesForMales =
		judgeMode === "same_gender" ? maleJudges : femaleJudges;
	const judgesForFemales =
		judgeMode === "same_gender" ? femaleJudges : maleJudges;

	const createFinalsHeat = (
		finalists: Competitor[],
		judgePool: Judge[],
		gender: Gender,
		heatNumber: number,
	) => {
		const rotations: Rotation[] = [];
		const shuffledJudges = [...judgePool].sort(() => Math.random() - 0.5);

		for (let rotation = 1; rotation <= totalRotations; rotation++) {
			const finalsCouples: FinalsCouple[] = [];
			for (let i = 0; i < finalists.length; i++) {
				const judgeIndex =
					(i + rotation - 1) % Math.max(1, shuffledJudges.length);
				const judge =
					shuffledJudges[judgeIndex] ||
					shuffledJudges[i % Math.max(1, shuffledJudges.length)];
				finalsCouples.push({
					id: `finals-couple-h${heatNumber}-r${rotation}-${finalists[i].id}-${judge?.id || "no-judge"}`,
					competitor: finalists[i],
					judge: judge,
					heatNumber,
					round: round as "finals",
					rotation,
				});
			}
			rotations.push({ number: rotation, couples: [], finalsCouples });
		}

		return {
			id: `heat-finals-${heatNumber}`,
			number: heatNumber,
			round: round as "finals",
			couples: [],
			rotations,
			currentRotation: 1,
			totalRotations,
			finalsCouples: rotations[0]?.finalsCouples || [],
			finalistGender: gender,
			maleCompetitors: gender === "male" ? finalists : [],
			femaleCompetitors: gender === "female" ? finalists : [],
			votingStatus: "closed" as const,
			judgesSubmitted: [],
		};
	};

	let heatCounter = 1;

	// Create heats for males
	if (maleFinalists.length > 0) {
		for (let i = 0; i < numberOfHeatsPerGender; i++) {
			const start = Math.floor(
				(i * maleFinalists.length) / numberOfHeatsPerGender,
			);
			const end = Math.floor(
				((i + 1) * maleFinalists.length) / numberOfHeatsPerGender,
			);
			const slice = maleFinalists.slice(start, end);
			if (slice.length > 0) {
				heats.push(
					createFinalsHeat(
						slice,
						judgesForMales,
						"male",
						heatCounter++,
					),
				);
			}
		}
	}

	// Create heats for females
	if (femaleFinalists.length > 0) {
		for (let i = 0; i < numberOfHeatsPerGender; i++) {
			const start = Math.floor(
				(i * femaleFinalists.length) / numberOfHeatsPerGender,
			);
			const end = Math.floor(
				((i + 1) * femaleFinalists.length) / numberOfHeatsPerGender,
			);
			const slice = femaleFinalists.slice(start, end);
			if (slice.length > 0) {
				heats.push(
					createFinalsHeat(
						slice,
						judgesForFemales,
						"female",
						heatCounter++,
					),
				);
			}
		}
	}

	return heats;
}

function createEmptyEvent(
	id: string,
	name: string,
	date: string,
	venue: string,
	maleStartNumber?: number,
	maleEndNumber?: number,
	femaleStartNumber?: number,
	femaleEndNumber?: number,
	competitionConfig?: any,
): Event {
	const now = new Date().toISOString();
	
	let firstRoundId: RoundType = "round1";
	if (competitionConfig && competitionConfig.rounds && competitionConfig.rounds.length > 0) {
		const sorted = [...competitionConfig.rounds].sort((a: any, b: any) => a.order - b.order);
		firstRoundId = sorted[0].id as RoundType;
	}

	return {
		id,
		name,
		date,
		venue,
		status: "active",
		currentRound: firstRoundId,
		currentHeat: 1,
		currentRotation: 1,
		votingOpen: false,
		competitors: [],
		compAssistants: [],
		judges: [],
		heats: [],
		votes: [],
		pairingHistory: [],
		maleStartNumber,
		maleEndNumber,
		femaleStartNumber,
		femaleEndNumber,
		competitionConfig,
		createdAt: now,
		updatedAt: now,
	};
}

function createResetEvent(
	id: string,
	name: string,
	date: string,
	venue: string,
	competitors: any[],
	judges: any[],
	maleStartNumber?: number,
	maleEndNumber?: number,
	femaleStartNumber?: number,
	femaleEndNumber?: number,
	createdAt?: string,
	compAssistants?: any[],
	adminId?: string,
	competitionConfig?: any,
): Event {
	const now = new Date().toISOString();
	// Reset all competitor vote counts and elimination status
	const resetCompetitors = competitors.map((c) => ({
		...c,
		voteCount: 0,
		round1Votes: undefined,
		round2Votes: undefined,
		finalsPoints: undefined,
		eliminated: false,
	}));
	return {
		id,
		name,
		date,
		venue,
		status: "active",
		currentRound: "round1",
		currentHeat: 1,
		currentRotation: 1,
		votingOpen: false,
		competitors: resetCompetitors, // Preserve existing competitors with reset votes
		compAssistants: compAssistants || [], // Preserve existing comp assistants
		judges, // Preserve existing judges
		heats: [], // Clear all heats
		votes: [], // Clear all votes
		pairingHistory: [], // Clear pairing history
		maleStartNumber,
		maleEndNumber,
		femaleStartNumber,
		femaleEndNumber,
		deletedMaleNumbers: [], // Reset deleted numbers pool
		deletedFemaleNumbers: [], // Reset deleted numbers pool
		// Clear tie-up advancement tracking
		tieUpRound1Male: [],
		tieUpRound1Female: [],
		tieUpRound2Male: [],
		tieUpRound2Female: [],
		tieUpFinalsMale: [],
		tieUpFinalsFemale: [],
		createdAt: createdAt || now,
		updatedAt: now,
		adminId,
		competitionConfig,
	};
}

function generateSampleData(event: Event): Event {
	const now = new Date().toISOString();
	// Sample competitors
	const maleNames = [
		"James Wilson",
		"Michael Chen",
		"David Rodriguez",
		"Robert Kim",
		"William Park",
		"Daniel Lee",
		"Christopher Martinez",
		"Matthew Thompson",
		"Andrew Garcia",
		"Joshua Brown",
		"Ryan Davis",
		"Brandon Miller",
	];
	const femaleNames = [
		"Sarah Johnson",
		"Emily Williams",
		"Jessica Taylor",
		"Ashley Anderson",
		"Amanda Thomas",
		"Stephanie Jackson",
		"Nicole White",
		"Jennifer Harris",
		"Elizabeth Martin",
		"Megan Robinson",
		"Lauren Clark",
		"Rachel Lewis",
	];

	// Use event's configured starting numbers
	// If not set, default to 0 (first competitor will be #0)
	const rawMaleStart = event.maleStartNumber;
	const rawFemaleStart = event.femaleStartNumber;
	const maleStartNumber = typeof rawMaleStart === "number" ? rawMaleStart : 0;
	const femaleStartNumber =
		typeof rawFemaleStart === "number" ? rawFemaleStart : 0;

	const competitors: Competitor[] = [];
	maleNames.forEach((name, i) => {
		competitors.push({
			id: `male-${Date.now()}-${i}`,
			number: maleStartNumber + i,
			name,
			gender: "male",
			photoUrl: `/placeholder.svg?height=200&width=200&query=professional male latin dancer portrait ${i}`,
			voteCount: 0,
			eliminated: false,
		});
	});
	femaleNames.forEach((name, i) => {
		competitors.push({
			id: `female-${Date.now()}-${i}`,
			number: femaleStartNumber + i,
			name,
			gender: "female",
			photoUrl: `/placeholder.svg?height=200&width=200&query=professional female latin dancer portrait ${i}`,
			voteCount: 0,
			eliminated: false,
		});
	});

	// Sample judges
	const judges: Judge[] = [
		{
			id: "judge-m1",
			name: "Carlos Rodriguez",
			gender: "male",
			photoUrl: "/male-judge-1.jpg",
			token: `mj-token-${event.id}-1`,
			pin: "1234",
		},
		{
			id: "judge-m2",
			name: "Marcus Thompson",
			gender: "male",
			photoUrl: "/male-judge-2.jpg",
			token: `mj-token-${event.id}-2`,
		},
		{
			id: "judge-f1",
			name: "Maria Santos",
			gender: "female",
			photoUrl: "/female-judge-1.jpg",
			token: `fj-token-${event.id}-1`,
			pin: "5678",
		},
		{
			id: "judge-f2",
			name: "Lisa Park",
			gender: "female",
			photoUrl: "/female-judge-2.jpg",
			token: `fj-token-${event.id}-2`,
		},
	];

	return {
		...event,
		competitors,
		judges,
		updatedAt: now,
	};
}

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
	.then(() => {
		const httpServer = createServer((req, res) => {
			const parsedUrl = parse(req.url!, true);
			handle(req, res, parsedUrl);
		});

		// Initialize Socket.IO - WebSocket only for Cloud Run compatibility
		const io = new SocketIOServer<
			ClientToServerEvents,
			ServerToClientEvents,
			InterServerEvents,
			SocketData
		>(httpServer, {
			path: "/api/socketio",
			addTrailingSlash: false,
			cors: {
				origin: "*",
				methods: ["GET", "POST"],
			},
			// WebSocket-only for Cloud Run (no sticky sessions for polling)
			transports: ["websocket"],
			allowUpgrades: false,
			pingTimeout: 60000,
			pingInterval: 25000,
			maxHttpBufferSize: 1e8,
		});

		console.log("[Socket.IO] Initializing WebSocket server...");

		// Helper function to broadcast event updates to all clients in the room
		const broadcastEventUpdate = (eventId: string, event: Event) => {
			io.to(eventId).emit("event:updated", { eventId, event });
			io.to(eventId).emit("admin:event:updated", { eventId, event });
		};

		io.on("connection", (socket) => {
			console.log(`[Socket.IO] Client connected: ${socket.id}`);

			// ADMIN AUTHENTICATION
			socket.on("admin:login", async ({ email, password }, callback) => {
				try {
					const credentials = await gcsHelpers.getAdminCredentials();
					if (!credentials) {
						callback({
							success: false,
							error: "Admin credentials not configured",
						});
						return;
					}
					if (email !== credentials.email) {
						callback({
							success: false,
							error: "Invalid email or password",
						});
						return;
					}
					const isValid = await bcrypt.compare(
						password,
						credentials.passwordHash,
					);
					if (!isValid) {
						callback({
							success: false,
							error: "Invalid email or password",
						});
						return;
					}
					socket.data.isAdmin = true;
					callback({ success: true, authenticated: true });
				} catch (error) {
					console.error("[Socket.IO] Admin login error:", error);
					callback({
						success: false,
						error: "Authentication failed",
					});
				}
			});

			socket.on("admin:logout", (callback) => {
				socket.data.isAdmin = false;
				callback({ success: true });
			});

			// EVENT OPERATIONS
			socket.on("event:list", async (callback) => {
				try {
					const events = await listAllEvents();
					callback({ success: true, events });
				} catch (error) {
					callback({
						success: false,
						error: "Failed to list events",
					});
				}
			});

			socket.on("event:get", async ({ eventId }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
						return;
					}
					// Join the event room for real-time updates
					socket.join(eventId);
					console.log(
						`[Socket.IO] Socket ${socket.id} joined room ${eventId}`,
					);
					callback({ success: true, event });
				} catch (error) {
					callback({ success: false, error: "Failed to load event" });
				}
			});

			socket.on(
				"event:create",
				async (data: CreateEventData, callback) => {
					try {
						const {
							name,
							date,
							venue,
							maleStartNumber,
							maleEndNumber,
							femaleStartNumber,
							femaleEndNumber,
							adminId,
							competitionConfig,
						} = data as CreateEventData & { adminId?: string };
						const eventId = `event-${Date.now()}`;
						const event = createEmptyEvent(
							eventId,
							name,
							date,
							venue,
							maleStartNumber,
							maleEndNumber,
							femaleStartNumber,
							femaleEndNumber,
							competitionConfig,
						);
						// Associate event with admin who created it
						if (adminId) {
							event.adminId = adminId;
						}
						await saveEventToGCS(eventId, event);
						io.emit("event:created", { event });
						callback({ success: true, event });
					} catch (error) {
						callback({
							success: false,
							error: "Failed to create event",
						});
					}
				},
			);

			socket.on(
				"event:update",
				async ({ eventId, updates }, callback) => {
					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}
						const updatedEvent = { ...event, ...updates };

						// 🟢 SAFE AUTO-SYNC: If config changed, try to sync existing heats
						if (updates.competitionConfig) {
							// Check if the current round still exists in the new config
							const newConfig =
								getCompetitionConfig(updatedEvent);
							const currentRoundExists = newConfig.rounds.some(
								(r) => r.id === updatedEvent.currentRound,
							);

							// Only run auto-sync if the current round exists in the new config
							// If it doesn't exist, don't reset — the admin will handle it manually
							if (currentRoundExists) {
								const roundConfig = newConfig.rounds.find(
									(r) => r.id === updatedEvent.currentRound,
								)!;
								const currentRoundHeats =
									updatedEvent.heats.filter(
										(h) =>
											h.round ===
											updatedEvent.currentRound,
									);
								const hasVotes = currentRoundHeats.some(
									(h) =>
										(h.judgesSubmitted &&
											h.judgesSubmitted.length > 0) ||
										h.votingStatus !== "closed",
								);

								// If NO VOTES, we can safely perform a full rebuild to match new structure
								if (!hasVotes) {
									console.log(
										`[Socket] Config changed and no votes in ${updatedEvent.currentRound}. Auto-rebuilding...`,
									);

									const config =
										getCompetitionConfig(updatedEvent);
									const isFinal =
										roundConfig.competitorsAdvancing ===
											0 ||
										roundConfig.id ===
											config.rounds[
												config.rounds.length - 1
											].id;

									const regularMales =
										updatedEvent.competitors.filter(
											(c) =>
												c.gender === "male" &&
												!c.eliminated &&
												!c.isCompAssistant,
										);
									const regularFemales =
										updatedEvent.competitors.filter(
											(c) =>
												c.gender === "female" &&
												!c.eliminated &&
												!c.isCompAssistant,
										);
									const maleAssistants =
										(updatedEvent.currentRound ===
											"round1" ||
											updatedEvent.currentRound ===
												config.rounds[0].id) &&
										updatedEvent.compAssistants
											? updatedEvent.compAssistants
													.filter(
														(ca) =>
															ca.gender ===
															"male",
													)
													.map(
														(ca) =>
															({
																id: ca.id,
																number: ca.number,
																name: ca.name,
																gender: ca.gender,
																photoUrl:
																	ca.photoUrl,
																voteCount: 0,
																eliminated: false,
																isCompAssistant: true,
															}) as Competitor,
													)
											: [];
									const femaleAssistants =
										(updatedEvent.currentRound ===
											"round1" ||
											updatedEvent.currentRound ===
												config.rounds[0].id) &&
										updatedEvent.compAssistants
											? updatedEvent.compAssistants
													.filter(
														(ca) =>
															ca.gender ===
															"female",
													)
													.map(
														(ca) =>
															({
																id: ca.id,
																number: ca.number,
																name: ca.name,
																gender: ca.gender,
																photoUrl:
																	ca.photoUrl,
																voteCount: 0,
																eliminated: false,
																isCompAssistant: true,
															}) as Competitor,
													)
											: [];

									const activeMales = [
										...regularMales,
										...maleAssistants,
									];
									const activeFemales = [
										...regularFemales,
										...femaleAssistants,
									];

									let newHeats: Heat[];
									if (isFinal) {
										newHeats = generateFinalsHeats(
											updatedEvent,
											updatedEvent.competitors,
											updatedEvent.judges,
											updatedEvent.currentRound,
										);
									} else {
										newHeats = generateHeatsWithRotations(
											updatedEvent,
											activeMales,
											activeFemales,
											updatedEvent.currentRound,
										);
									}

									// Replace heats for this round
									updatedEvent.heats = [
										...updatedEvent.heats.filter(
											(h) =>
												h.round !==
												updatedEvent.currentRound,
										),
										...newHeats,
									];

									// Reset position
									updatedEvent.currentHeat = 1;
									updatedEvent.currentRotation = 1;
									updatedEvent.votingOpen = false;
								} else {
									// 🟠 LIGHT SYNC: If votes exist, we only match structural counts to prevent data loss
									const targetRotations =
										roundConfig.numberOfRotations || 1;
									currentRoundHeats.forEach((h) => {
										h.totalRotations = targetRotations;
									});
									updatedEvent.currentRotation = Math.min(
										updatedEvent.currentRotation || 1,
										targetRotations,
									);
									updatedEvent.currentHeat = Math.min(
										updatedEvent.currentHeat || 1,
										Math.max(1, currentRoundHeats.length),
									);
								}

								// Don't override currentRound — it's already correct
							}
						}

						await saveEventToGCS(eventId, updatedEvent);
						broadcastEventUpdate(eventId, updatedEvent);

						// Force progress broadcast
						const roundCfg = getRoundConfigForType(
							updatedEvent,
							updatedEvent.currentRound,
						);
						io.to(eventId).emit("heat:changed", {
							eventId,
							currentHeat: updatedEvent.currentHeat,
							currentRound: updatedEvent.currentRound,
							currentRotation: updatedEvent.currentRotation,
							votingOpen: updatedEvent.votingOpen,
							totalHeats: roundCfg.numberOfHeats,
							totalRotations: roundCfg.numberOfRotations,
						});

						// Also broadcast globally for event metadata changes (name, date, venue)
						// so all clients can update their event lists
						(io as any).emit("event:metadataUpdated", {
							eventId,
							name: updatedEvent.name,
							date: updatedEvent.date,
							venue: updatedEvent.venue,
							status: updatedEvent.status,
							competitorCount:
								updatedEvent.competitors?.length || 0,
							judgeCount: updatedEvent.judges?.length || 0,
						});

						callback({ success: true, event: updatedEvent });
					} catch (error) {
						callback({
							success: false,
							error: "Failed to update event",
						});
					}
				},
			);

			socket.on("event:delete", async ({ eventId }, callback) => {
				try {
					// Get event name before deleting for notification
					const event = await loadEventFromGCS(eventId);
					const eventName = event?.name;
					await gcsHelpers.deleteEventData(eventId);
					io.emit("event:deleted", { eventId, eventName });
					callback({ success: true });
				} catch (error) {
					callback({
						success: false,
						error: "Failed to delete event",
					});
				}
			});

			socket.on("event:seed", async ({ eventId }, callback) => {
				try {
					let event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
						return;
					}
					event = generateSampleData(event);
					await saveEventToGCS(eventId, event);
					broadcastEventUpdate(eventId, event);
					callback({ success: true, event });
				} catch (error) {
					callback({
						success: false,
						error: "Failed to seed event data",
					});
				}
			});

			// COMPETITOR OPERATIONS
			socket.on("competitor:list", async ({ eventId }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					callback({
						success: true,
						competitors: event?.competitors || [],
					});
				} catch (error) {
					callback({
						success: false,
						error: "Failed to load competitors",
					});
				}
			});

			socket.on(
				"competitor:register",
				async (data: RegisterCompetitorData, callback) => {
					try {
						const {
							eventId,
							name,
							gender,
							number: customNumber,
							photoData,
							photoType,
						} = data;
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}

						// Check if competition has started (heats have been generated)
						if (event.heats.length > 0) {
							callback({
								success: false,
								error: "Cannot add competitors after competition has started",
							});
							return;
						}

						// Get gender-specific settings
						const genderCompetitors = event.competitors.filter(
							(c) => c.gender === gender,
						);
						const rawBaseNumber =
							gender === "male"
								? event.maleStartNumber
								: event.femaleStartNumber;
						const baseNumber =
							typeof rawBaseNumber === "number"
								? rawBaseNumber
								: 0;
						const endNumber =
							gender === "male"
								? event.maleEndNumber
								: event.femaleEndNumber;

						// Calculate max allowed competitors based on number range
						const maxCompetitors =
							typeof endNumber === "number"
								? endNumber - baseNumber + 1
								: undefined;

						// Check if we've reached the limit BEFORE assigning number
						if (
							maxCompetitors !== undefined &&
							genderCompetitors.length >= maxCompetitors
						) {
							const genderLabel =
								gender === "male"
									? "Lead (Male)"
									: "Follow (Female)";
							const errorMessage = `Registration limit reached! Maximum ${maxCompetitors} ${genderLabel} competitors allowed (numbers ${baseNumber} to ${endNumber}). Please contact the event organizer.`;

							// Broadcast limit reached notification to all clients in the event room
							io.to(eventId).emit("registration:limitReached", {
								eventId,
								gender,
								currentCount: genderCompetitors.length,
								maxCount: maxCompetitors,
								message: errorMessage,
							});

							callback({
								success: false,
								error: errorMessage,
							});
							return;
						}

						// Use custom number if provided, otherwise auto-generate
						let competitorNumber: number;
						if (customNumber !== undefined) {
							// Check if number is already taken
							const existingWithNumber = event.competitors.find(
								(c) => c.number === customNumber,
							);
							if (existingWithNumber) {
								callback({
									success: false,
									error: `Competitor number ${customNumber} is already taken`,
								});
								return;
							}
							// Validate custom number is within range
							if (
								typeof endNumber === "number" &&
								(customNumber < baseNumber ||
									customNumber > endNumber)
							) {
								callback({
									success: false,
									error: `Competitor number must be between ${baseNumber} and ${endNumber}`,
								});
								return;
							}
							competitorNumber = customNumber;
							// Remove from deleted pool if it was there
							const deletedPool =
								gender === "male"
									? event.deletedMaleNumbers
									: event.deletedFemaleNumbers;
							if (deletedPool) {
								const poolIndex =
									deletedPool.indexOf(customNumber);
								if (poolIndex !== -1) {
									deletedPool.splice(poolIndex, 1);
								}
							}
						} else {
							// Check for reusable deleted numbers first
							const deletedPool =
								gender === "male"
									? event.deletedMaleNumbers
									: event.deletedFemaleNumbers;

							if (deletedPool && deletedPool.length > 0) {
								// Sort and use the smallest available deleted number
								deletedPool.sort((a, b) => a - b);
								competitorNumber = deletedPool.shift()!;
								// Update the pool in the event
								if (gender === "male") {
									event.deletedMaleNumbers = deletedPool;
								} else {
									event.deletedFemaleNumbers = deletedPool;
								}
							} else {
								// No deleted numbers available, generate new one
								// Find the highest existing number for this gender
								const existingNumbers = genderCompetitors.map(
									(c) => c.number,
								);
								if (existingNumbers.length === 0) {
									competitorNumber = baseNumber;
								} else {
									const maxExisting = Math.max(
										...existingNumbers,
									);
									competitorNumber = maxExisting + 1;
								}
							}

							// Final check: ensure number doesn't exceed end limit
							if (
								typeof endNumber === "number" &&
								competitorNumber > endNumber
							) {
								const genderLabel =
									gender === "male"
										? "Lead (Male)"
										: "Follow (Female)";
								const errorMessage = `Registration limit reached! Maximum ${genderLabel} competitor limit reached (numbers ${baseNumber} to ${endNumber}). Please contact the event organizer.`;

								io.to(eventId).emit(
									"registration:limitReached",
									{
										eventId,
										gender,
										currentCount: genderCompetitors.length,
										maxCount:
											maxCompetitors ||
											genderCompetitors.length,
										message: errorMessage,
									},
								);

								callback({
									success: false,
									error: errorMessage,
								});
								return;
							}
						}

						const competitorId = `${gender}-${Date.now()}`;
						let photoUrl = `/placeholder.svg?height=200&width=200&query=professional ${gender} latin dancer portrait`;

						if (photoData && photoType) {
							const buffer = Buffer.from(photoData, "base64");
							const ext = photoType.includes("png")
								? "png"
								: "jpg";
							const photoPath = GCS_PATHS.competitorPhoto(
								eventId,
								competitorId,
							).replace(".jpg", `.${ext}`);
							await gcsClient.uploadFile(photoPath, buffer, {
								contentType: photoType,
							});
							photoUrl = await gcsClient.getSignedUrl(photoPath, {
								action: "read",
								expiresIn: 86400,
							});
						}

						const newCompetitor: Competitor = {
							id: competitorId,
							number: competitorNumber,
							name: name.trim(),
							gender,
							photoUrl,
							voteCount: 0,
							eliminated: false,
						};

						event.competitors.push(newCompetitor);
						await saveEventToGCS(eventId, event);

						// Log room members for debugging
						const room = io.sockets.adapter.rooms.get(eventId);
						console.log(
							`[Socket.IO] Broadcasting competitor:added to room ${eventId}, members: ${
								room ? room.size : 0
							}`,
						);

						io.to(eventId).emit("competitor:added", {
							eventId,
							competitor: newCompetitor,
						});
						// Also emit globally for Settings page to update event counts
						io.emit("competitor:added", {
							eventId,
							competitor: newCompetitor,
						});
						callback({ success: true, competitor: newCompetitor });
					} catch (error) {
						callback({
							success: false,
							error: "Failed to register competitor",
						});
					}
				},
			);

			socket.on(
				"competitor:update",
				async ({ eventId, competitorId, updates }, callback) => {
					console.log("[Socket.IO] competitor:update received:", {
						eventId,
						competitorId,
						updateKeys: Object.keys(updates || {}),
						hasPhotoData: !!(updates as any)?.photoData,
						photoDataLength: (updates as any)?.photoData?.length,
						photoType: (updates as any)?.photoType,
					});

					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}
						const index = event.competitors.findIndex(
							(c) => c.id === competitorId,
						);
						if (index === -1) {
							callback({
								success: false,
								error: "Competitor not found",
							});
							return;
						}

						const currentCompetitor = event.competitors[index];

						// Handle number change validation
						if (
							updates.number !== undefined &&
							updates.number !== currentCompetitor.number
						) {
							// Check if new number is already taken by another competitor
							const existingWithNumber = event.competitors.find(
								(c) =>
									c.number === updates.number &&
									c.id !== competitorId,
							);
							if (existingWithNumber) {
								callback({
									success: false,
									error: `Competitor number ${updates.number} is already taken by ${existingWithNumber.name}`,
								});
								return;
							}

							// Validate number is within range for the competitor's gender
							const gender = currentCompetitor.gender;
							const baseNumber =
								gender === "male"
									? event.maleStartNumber
									: event.femaleStartNumber;
							const endNumber =
								gender === "male"
									? event.maleEndNumber
									: event.femaleEndNumber;

							if (
								typeof baseNumber === "number" &&
								updates.number < baseNumber
							) {
								callback({
									success: false,
									error: `Number must be at least ${baseNumber} for ${
										gender === "male" ? "Lead" : "Follow"
									} competitors`,
								});
								return;
							}
							if (
								typeof endNumber === "number" &&
								updates.number > endNumber
							) {
								callback({
									success: false,
									error: `Number must not exceed ${endNumber} for ${
										gender === "male" ? "Lead" : "Follow"
									} competitors`,
								});
								return;
							}

							// Add old number to deleted pool for reuse
							const oldNumber = currentCompetitor.number;
							if (gender === "male") {
								if (!event.deletedMaleNumbers) {
									event.deletedMaleNumbers = [];
								}
								if (
									!event.deletedMaleNumbers.includes(
										oldNumber,
									)
								) {
									event.deletedMaleNumbers.push(oldNumber);
								}
								// Remove new number from deleted pool if it was there
								const poolIndex =
									event.deletedMaleNumbers.indexOf(
										updates.number,
									);
								if (poolIndex !== -1) {
									event.deletedMaleNumbers.splice(
										poolIndex,
										1,
									);
								}
							} else {
								if (!event.deletedFemaleNumbers) {
									event.deletedFemaleNumbers = [];
								}
								if (
									!event.deletedFemaleNumbers.includes(
										oldNumber,
									)
								) {
									event.deletedFemaleNumbers.push(oldNumber);
								}
								const poolIndex =
									event.deletedFemaleNumbers.indexOf(
										updates.number,
									);
								if (poolIndex !== -1) {
									event.deletedFemaleNumbers.splice(
										poolIndex,
										1,
									);
								}
							}
						}

						// Handle photo update if photoData is provided in updates
						if (
							(updates as any).photoData &&
							(updates as any).photoType
						) {
							const { photoData, photoType } = updates as any;
							console.log(
								`[Socket.IO] Uploading new photo for competitor ${competitorId}, type: ${photoType}`,
							);

							try {
								// Delete old photo first
								await gcsHelpers.deleteCompetitorPhoto(
									eventId,
									competitorId,
								);

								// Upload new photo
								const buffer = Buffer.from(photoData, "base64");
								const ext = photoType.includes("png")
									? "png"
									: "jpg";
								const photoPath = GCS_PATHS.competitorPhoto(
									eventId,
									competitorId,
								).replace(".jpg", `.${ext}`);

								console.log(
									`[Socket.IO] Uploading photo to path: ${photoPath}`,
								);

								await gcsClient.uploadFile(photoPath, buffer, {
									contentType: photoType,
								});

								const photoUrl = await gcsClient.getSignedUrl(
									photoPath,
									{
										action: "read",
										expiresIn: 86400,
									},
								);

								console.log(
									`[Socket.IO] Photo uploaded successfully, URL: ${photoUrl.substring(
										0,
										100,
									)}...`,
								);

								updates.photoUrl = photoUrl;
							} catch (photoError) {
								console.error(
									`[Socket.IO] Photo upload error:`,
									photoError,
								);
								callback({
									success: false,
									error: "Failed to upload photo",
								});
								return;
							}

							// Remove photoData and photoType from updates as they shouldn't be stored
							delete (updates as any).photoData;
							delete (updates as any).photoType;
						}

						event.competitors[index] = {
							...event.competitors[index],
							...updates,
						};
						await saveEventToGCS(eventId, event);
						io.to(eventId).emit("competitor:updated", {
							eventId,
							competitor: event.competitors[index],
						});
						callback({
							success: true,
							competitor: event.competitors[index],
						});
					} catch (error) {
						callback({
							success: false,
							error: "Failed to update competitor",
						});
					}
				},
			);

			socket.on(
				"competitor:delete",
				async ({ eventId, competitorId }, callback) => {
					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}

						// Check if competition has started (heats have been generated)
						if (event.heats.length > 0) {
							callback({
								success: false,
								error: "Cannot delete competitors after competition has started",
							});
							return;
						}

						// Find the competitor to get their number and gender before deletion
						const competitorToDelete = event.competitors.find(
							(c) => c.id === competitorId,
						);
						if (!competitorToDelete) {
							callback({
								success: false,
								error: "Competitor not found",
							});
							return;
						}

						const deletedNumber = competitorToDelete.number;
						const deletedGender = competitorToDelete.gender;

						// Add the deleted number to the appropriate pool for reuse
						if (deletedGender === "male") {
							if (!event.deletedMaleNumbers) {
								event.deletedMaleNumbers = [];
							}
							// Only add if not already in pool
							if (
								!event.deletedMaleNumbers.includes(
									deletedNumber,
								)
							) {
								event.deletedMaleNumbers.push(deletedNumber);
							}
						} else {
							if (!event.deletedFemaleNumbers) {
								event.deletedFemaleNumbers = [];
							}
							if (
								!event.deletedFemaleNumbers.includes(
									deletedNumber,
								)
							) {
								event.deletedFemaleNumbers.push(deletedNumber);
							}
						}

						event.competitors = event.competitors.filter(
							(c) => c.id !== competitorId,
						);
						await saveEventToGCS(eventId, event);
						await gcsHelpers.deleteCompetitorPhoto(
							eventId,
							competitorId,
						);
						io.to(eventId).emit("competitor:removed", {
							eventId,
							competitorId,
							deletedNumber,
							gender: deletedGender,
						});
						// Also emit globally for Settings page to update event counts
						io.emit("competitor:removed", {
							eventId,
							competitorId,
							deletedNumber,
							gender: deletedGender,
						});
						callback({ success: true });
					} catch (error) {
						callback({
							success: false,
							error: "Failed to delete competitor",
						});
					}
				},
			);

			socket.on(
				"competitor:uploadPhoto",
				async (data: UploadPhotoData, callback) => {
					try {
						const { eventId, competitorId, photoData, photoType } =
							data;
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}
						const index = event.competitors.findIndex(
							(c) => c.id === competitorId,
						);
						if (index === -1) {
							callback({
								success: false,
								error: "Competitor not found",
							});
							return;
						}
						await gcsHelpers.deleteCompetitorPhoto(
							eventId,
							competitorId,
						);
						const buffer = Buffer.from(photoData, "base64");
						const ext = photoType.includes("png") ? "png" : "jpg";
						const photoPath = GCS_PATHS.competitorPhoto(
							eventId,
							competitorId,
						).replace(".jpg", `.${ext}`);
						await gcsClient.uploadFile(photoPath, buffer, {
							contentType: photoType,
						});
						const photoUrl = await gcsClient.getSignedUrl(
							photoPath,
							{
								action: "read",
								expiresIn: 86400,
							},
						);
						event.competitors[index].photoUrl = photoUrl;
						await saveEventToGCS(eventId, event);
						io.to(eventId).emit("competitor:updated", {
							eventId,
							competitor: event.competitors[index],
						});
						callback({ success: true, photoUrl });
					} catch (error) {
						callback({
							success: false,
							error: "Failed to upload photo",
						});
					}
				},
			);

			socket.on(
				"competitor:deletePhoto",
				async ({ eventId, competitorId }, callback) => {
					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}
						const index = event.competitors.findIndex(
							(c) => c.id === competitorId,
						);
						if (index === -1) {
							callback({
								success: false,
								error: "Competitor not found",
							});
							return;
						}
						await gcsHelpers.deleteCompetitorPhoto(
							eventId,
							competitorId,
						);
						event.competitors[index].photoUrl =
							`/placeholder.svg?height=200&width=200&query=professional ${event.competitors[index].gender} latin dancer portrait`;
						await saveEventToGCS(eventId, event);
						io.to(eventId).emit("competitor:updated", {
							eventId,
							competitor: event.competitors[index],
						});
						callback({ success: true });
					} catch (error) {
						callback({
							success: false,
							error: "Failed to delete photo",
						});
					}
				},
			);

			// JUDGE OPERATIONS
			socket.on("judge:list", async ({ eventId }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					callback({ success: true, judges: event?.judges || [] });
				} catch (error) {
					callback({
						success: false,
						error: "Failed to load judges",
					});
				}
			});

			// COMP ASSISTANT OPERATIONS
			socket.on("compAssistant:create", async (data: any, callback) => {
				try {
					const {
						eventId,
						name,
						number,
						gender,
						photoData,
						photoType,
					} = data;
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({
							success: false,
							error: "Event not found",
						});
						return;
					}

					// Check if competition has started (heats have been generated)
					if (event.heats.length > 0) {
						callback({
							success: false,
							error: "Cannot add comp assistants after competition has started",
						});
						return;
					}

					// Validate number is non-negative
					if (number < 0) {
						callback({
							success: false,
							error: "Comp Assistant number cannot be negative",
						});
						return;
					}

					// Check if number is within contestant ranges (not allowed)
					const maleStart = event.maleStartNumber;
					const maleEnd = event.maleEndNumber;
					const femaleStart = event.femaleStartNumber;
					const femaleEnd = event.femaleEndNumber;

					if (
						typeof maleStart === "number" &&
						typeof maleEnd === "number" &&
						number >= maleStart &&
						number <= maleEnd
					) {
						callback({
							success: false,
							error: `Number ${number} is within the male contestant range (${maleStart}-${maleEnd}). Please use a different number.`,
						});
						return;
					}

					if (
						typeof femaleStart === "number" &&
						typeof femaleEnd === "number" &&
						number >= femaleStart &&
						number <= femaleEnd
					) {
						callback({
							success: false,
							error: `Number ${number} is within the female contestant range (${femaleStart}-${femaleEnd}). Please use a different number.`,
						});
						return;
					}

					// Check if number is already taken by another comp assistant
					if (!event.compAssistants) {
						event.compAssistants = [];
					}
					const existingAssistant = event.compAssistants.find(
						(ca) => ca.number === number,
					);
					if (existingAssistant) {
						callback({
							success: false,
							error: `Number ${number} is already taken by another Comp Assistant`,
						});
						return;
					}

					// Check if number is taken by a competitor
					const existingCompetitor = event.competitors.find(
						(c) => c.number === number,
					);
					if (existingCompetitor) {
						callback({
							success: false,
							error: `Number ${number} is already taken by a competitor`,
						});
						return;
					}

					const compAssistantId = `comp-assistant-${Date.now()}`;
					let photoUrl = `/placeholder.svg?height=200&width=200&query=professional ${gender} latin dancer portrait assistant`;

					if (photoData && photoType) {
						const buffer = Buffer.from(photoData, "base64");
						const ext = photoType.includes("png") ? "png" : "jpg";
						const photoPath = GCS_PATHS.compAssistantPhoto(
							eventId,
							compAssistantId,
						).replace(".jpg", `.${ext}`);
						await gcsClient.uploadFile(photoPath, buffer, {
							contentType: photoType,
						});
						photoUrl = await gcsClient.getSignedUrl(photoPath, {
							action: "read",
							expiresIn: 86400,
						});
					}

					const newCompAssistant = {
						id: compAssistantId,
						number,
						name: name.trim(),
						gender,
						photoUrl,
					};

					event.compAssistants.push(newCompAssistant);
					await saveEventToGCS(eventId, event);

					io.to(eventId).emit("compAssistant:added", {
						eventId,
						compAssistant: newCompAssistant,
					});
					callback({
						success: true,
						compAssistant: newCompAssistant,
					});
				} catch (error) {
					console.error(
						"[Socket.IO] compAssistant:create error:",
						error,
					);
					callback({
						success: false,
						error: "Failed to create comp assistant",
					});
				}
			});

			socket.on(
				"compAssistant:update",
				async ({ eventId, compAssistantId, updates }, callback) => {
					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}

						if (!event.compAssistants) {
							callback({
								success: false,
								error: "Comp Assistant not found",
							});
							return;
						}

						const index = event.compAssistants.findIndex(
							(ca) => ca.id === compAssistantId,
						);
						if (index === -1) {
							callback({
								success: false,
								error: "Comp Assistant not found",
							});
							return;
						}

						const currentAssistant = event.compAssistants[index];

						// Validate number change if provided
						if (
							updates.number !== undefined &&
							updates.number !== currentAssistant.number
						) {
							// Check non-negative
							if (updates.number < 0) {
								callback({
									success: false,
									error: "Comp Assistant number cannot be negative",
								});
								return;
							}

							// Check not in contestant ranges
							const maleStart = event.maleStartNumber;
							const maleEnd = event.maleEndNumber;
							const femaleStart = event.femaleStartNumber;
							const femaleEnd = event.femaleEndNumber;

							if (
								typeof maleStart === "number" &&
								typeof maleEnd === "number" &&
								updates.number >= maleStart &&
								updates.number <= maleEnd
							) {
								callback({
									success: false,
									error: `Number ${updates.number} is within the male contestant range (${maleStart}-${maleEnd}).`,
								});
								return;
							}

							if (
								typeof femaleStart === "number" &&
								typeof femaleEnd === "number" &&
								updates.number >= femaleStart &&
								updates.number <= femaleEnd
							) {
								callback({
									success: false,
									error: `Number ${updates.number} is within the female contestant range (${femaleStart}-${femaleEnd}).`,
								});
								return;
							}

							// Check not taken by another comp assistant
							const existingAssistant = event.compAssistants.find(
								(ca) =>
									ca.number === updates.number &&
									ca.id !== compAssistantId,
							);
							if (existingAssistant) {
								callback({
									success: false,
									error: `Number ${updates.number} is already taken by another Comp Assistant`,
								});
								return;
							}

							// Check not taken by a competitor
							const existingCompetitor = event.competitors.find(
								(c) => c.number === updates.number,
							);
							if (existingCompetitor) {
								callback({
									success: false,
									error: `Number ${updates.number} is already taken by a competitor`,
								});
								return;
							}
						}

						// Handle photo update
						if (
							(updates as any).photoData &&
							(updates as any).photoType
						) {
							const { photoData, photoType } = updates as any;
							try {
								await gcsHelpers.deleteCompAssistantPhoto(
									eventId,
									compAssistantId,
								);

								const buffer = Buffer.from(photoData, "base64");
								const ext = photoType.includes("png")
									? "png"
									: "jpg";
								const photoPath = GCS_PATHS.compAssistantPhoto(
									eventId,
									compAssistantId,
								).replace(".jpg", `.${ext}`);

								await gcsClient.uploadFile(photoPath, buffer, {
									contentType: photoType,
								});

								const photoUrl = await gcsClient.getSignedUrl(
									photoPath,
									{
										action: "read",
										expiresIn: 86400,
									},
								);

								updates.photoUrl = photoUrl;
							} catch (photoError) {
								console.error(
									"[Socket.IO] Comp Assistant photo upload error:",
									photoError,
								);
								callback({
									success: false,
									error: "Failed to upload photo",
								});
								return;
							}

							delete (updates as any).photoData;
							delete (updates as any).photoType;
						}

						event.compAssistants[index] = {
							...event.compAssistants[index],
							...updates,
						};
						await saveEventToGCS(eventId, event);

						io.to(eventId).emit("compAssistant:updated", {
							eventId,
							compAssistant: event.compAssistants[index],
						});
						callback({
							success: true,
							compAssistant: event.compAssistants[index],
						});
					} catch (error) {
						console.error(
							"[Socket.IO] compAssistant:update error:",
							error,
						);
						callback({
							success: false,
							error: "Failed to update comp assistant",
						});
					}
				},
			);

			socket.on(
				"compAssistant:delete",
				async ({ eventId, compAssistantId }, callback) => {
					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}

						// Check if competition has started (heats have been generated)
						if (event.heats.length > 0) {
							callback({
								success: false,
								error: "Cannot delete comp assistants after competition has started",
							});
							return;
						}

						if (!event.compAssistants) {
							callback({
								success: false,
								error: "Comp Assistant not found",
							});
							return;
						}

						const assistantToDelete = event.compAssistants.find(
							(ca) => ca.id === compAssistantId,
						);
						if (!assistantToDelete) {
							callback({
								success: false,
								error: "Comp Assistant not found",
							});
							return;
						}

						event.compAssistants = event.compAssistants.filter(
							(ca) => ca.id !== compAssistantId,
						);
						await saveEventToGCS(eventId, event);
						await gcsHelpers.deleteCompAssistantPhoto(
							eventId,
							compAssistantId,
						);

						io.to(eventId).emit("compAssistant:removed", {
							eventId,
							compAssistantId,
						});
						io.emit("compAssistant:removed", {
							eventId,
							compAssistantId,
						});
						callback({ success: true });
					} catch (error) {
						console.error(
							"[Socket.IO] compAssistant:delete error:",
							error,
						);
						callback({
							success: false,
							error: "Failed to delete comp assistant",
						});
					}
				},
			);

			socket.on(
				"judge:create",
				async (data: CreateJudgeData, callback) => {
					try {
						const {
							eventId,
							name,
							gender,
							pin,
							photoData,
							photoType,
						} = data;
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}

						// Count existing judges of same gender to determine which image to use (1, 2, 3, 1, 2, 3...)
						const sameGenderCount = event.judges.filter(
							(j) => j.gender === gender,
						).length;
						const imageNumber = (sameGenderCount % 3) + 1;

						const judgeId = `judge-${gender.charAt(0)}${
							sameGenderCount + 1
						}`;
						const token = `${gender.charAt(
							0,
						)}j-token-${eventId}-${Date.now()}`;

						let photoUrl = `/${gender}-judge-${imageNumber}.jpg`;

						if (photoData && photoType) {
							const buffer = Buffer.from(photoData, "base64");
							const ext = photoType.includes("png")
								? "png"
								: "jpg";
							const photoPath = `events/${eventId}/judges/${judgeId}.${ext}`;
							await gcsClient.uploadFile(photoPath, buffer, {
								contentType: photoType,
							});
							photoUrl = await gcsClient.getSignedUrl(photoPath, {
								action: "read",
								expiresIn: 86400,
							});
						}

						const newJudge: Judge = {
							id: judgeId,
							name: name.trim(),
							gender,
							photoUrl,
							token,
							pin,
						};
						event.judges.push(newJudge);
						await saveEventToGCS(eventId, event);
						io.to(eventId).emit("judge:added", {
							eventId,
							judge: newJudge,
						});
						// Also emit globally for Settings page to update event counts
						io.emit("judge:added", {
							eventId,
							judge: newJudge,
						});
						callback({ success: true, judge: newJudge });
					} catch (error) {
						callback({
							success: false,
							error: "Failed to create judge",
						});
					}
				},
			);

			socket.on(
				"judge:update",
				async ({ eventId, judgeId, updates }, callback) => {
					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}
						const index = event.judges.findIndex(
							(j) => j.id === judgeId,
						);
						if (index === -1) {
							callback({
								success: false,
								error: "Judge not found",
							});
							return;
						}
						event.judges[index] = {
							...event.judges[index],
							...updates,
						};
						await saveEventToGCS(eventId, event);
						io.to(eventId).emit("judge:updated", {
							eventId,
							judge: event.judges[index],
						});
						callback({ success: true, judge: event.judges[index] });
					} catch (error) {
						callback({
							success: false,
							error: "Failed to update judge",
						});
					}
				},
			);

			socket.on(
				"judge:delete",
				async ({ eventId, judgeId }, callback) => {
					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}
						event.judges = event.judges.filter(
							(j) => j.id !== judgeId,
						);
						await saveEventToGCS(eventId, event);
						io.to(eventId).emit("judge:removed", {
							eventId,
							judgeId,
						});
						// Also emit globally for Settings page to update event counts
						io.emit("judge:removed", { eventId, judgeId });
						callback({ success: true });
					} catch (error) {
						callback({
							success: false,
							error: "Failed to delete judge",
						});
					}
				},
			);

			socket.on("judge:auth", async ({ token, pin }, callback) => {
				try {
					// Search all events for the judge token
					const events = (await gcsHelpers.listEvents()) as Event[];
					for (const event of events) {
						const judge = event.judges.find(
							(j) => j.token === token,
						);
						if (judge) {
							if (judge.pin && judge.pin !== pin) {
								callback({
									success: false,
									error: "Invalid PIN",
								});
								return;
							}
							socket.join(event.id);
							callback({
								success: true,
								authenticated: true,
								judge,
								eventId: event.id,
							});
							return;
						}
					}
					callback({ success: false, error: "Invalid judge token" });
				} catch (error) {
					callback({
						success: false,
						error: "Authentication failed",
					});
				}
			});

			// ROUND & HEAT OPERATIONS
			socket.on(
				"round:generatePairings",
				async ({ eventId, round }, callback) => {
					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}
						// Get regular competitors (not assistants)
						const regularMales = event.competitors.filter(
							(c) =>
								c.gender === "male" &&
								!c.eliminated &&
								!c.isCompAssistant,
						);
						const regularFemales = event.competitors.filter(
							(c) =>
								c.gender === "female" &&
								!c.eliminated &&
								!c.isCompAssistant,
						);

						// Convert ALL comp assistants to Competitor objects for pairing
						// Assistants are included in Round 1 to dance with competitors
						const maleAssistants: Competitor[] =
							round === "round1" && event.compAssistants
								? event.compAssistants
										.filter((ca) => ca.gender === "male")
										.map((ca) => ({
											id: ca.id,
											number: ca.number,
											name: ca.name,
											gender: ca.gender,
											photoUrl: ca.photoUrl,
											voteCount: 0,
											eliminated: false,
											isCompAssistant: true,
										}))
								: [];

						const femaleAssistants: Competitor[] =
							round === "round1" && event.compAssistants
								? event.compAssistants
										.filter((ca) => ca.gender === "female")
										.map((ca) => ({
											id: ca.id,
											number: ca.number,
											name: ca.name,
											gender: ca.gender,
											photoUrl: ca.photoUrl,
											voteCount: 0,
											eliminated: false,
											isCompAssistant: true,
										}))
								: [];

						const roundConfig = getRoundConfigForType(event, round);
						const config = getCompetitionConfig(event);
						const isFinals = isFinalRound(roundConfig, config);

						let heats: Heat[];
						if (isFinals) {
							heats = generateFinalsHeats(
								event,
								event.competitors,
								event.judges,
								round,
							);
						} else {
							// Include ALL assistants in the pairings - they dance with competitors
							// Assistants are mixed into the heats to balance the numbers
							const males = [...regularMales, ...maleAssistants];
							const females = [
								...regularFemales,
								...femaleAssistants,
							];

							heats = generateHeatsWithRotations(
								event,
								males,
								females,
								round,
							);
						}

						event.heats = [
							...event.heats.filter((h) => h.round !== round),
							...heats,
						];
						event.currentHeat = 1;
						event.currentRotation = 1;
						event.currentRound = round;
						await saveEventToGCS(eventId, event);
						broadcastEventUpdate(eventId, event);
						// Also broadcast heat:changed for judge clients to update immediately
						io.to(eventId).emit("heat:changed", {
							eventId,
							currentHeat: event.currentHeat,
							currentRound: event.currentRound,
							currentRotation: event.currentRotation,
							votingOpen: event.votingOpen,
						});
						callback({ success: true, heats });
					} catch (error) {
						callback({
							success: false,
							error: "Failed to generate pairings",
						});
					}
				},
			);

			// Next rotation within current heat
			socket.on("round:nextRotation", async ({ eventId }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
						return;
					}

					// Validate: voting must be open for rotation changes
					if (!event.votingOpen) {
						callback({
							success: false,
							error: "Open voting before advancing to the next rotation",
						});
						return;
					}

					const currentHeat = event.heats.find(
						(h) =>
							h.number === event.currentHeat &&
							h.round === event.currentRound,
					);

					if (!currentHeat) {
						callback({
							success: false,
							error: "Current heat not found",
						});
						return;
					}

					const totalRotations =
						currentHeat.totalRotations ||
						getRotationsForRound(event, event.currentRound);

					if (event.currentRotation >= totalRotations) {
						callback({
							success: false,
							error: "Already at last rotation",
						});
						return;
					}

					// Move to next rotation (voting stays open during rotation)
					event.currentRotation += 1;

					// Update current heat's couples to the new rotation
					const heatIndex = event.heats.findIndex(
						(h) => h.id === currentHeat.id,
					);
					if (heatIndex !== -1 && currentHeat.rotations) {
						const newRotation = currentHeat.rotations.find(
							(r) => r.number === event.currentRotation,
						);
						if (newRotation) {
							event.heats[heatIndex].couples =
								newRotation.couples;
							event.heats[heatIndex].currentRotation =
								event.currentRotation;
							if (newRotation.finalsCouples) {
								event.heats[heatIndex].finalsCouples =
									newRotation.finalsCouples;
							}
						}
					}

					await saveEventToGCS(eventId, event);
					io.to(eventId).emit("rotation:changed", {
						eventId,
						heatId: currentHeat.id,
						rotation: event.currentRotation,
						totalRotations,
					});
					broadcastEventUpdate(eventId, event);
					callback({ success: true, event });
				} catch (error) {
					callback({
						success: false,
						error: "Failed to advance rotation",
					});
				}
			});

			socket.on(
				"round:openVoting",
				async ({ eventId, heatId }, callback) => {
					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}
						const heatIndex = event.heats.findIndex(
							(h) => h.id === heatId,
						);
						if (heatIndex === -1) {
							callback({
								success: false,
								error: "Heat not found",
							});
							return;
						}
						event.heats[heatIndex].votingStatus = "open";
						event.votingOpen = true;
						await saveEventToGCS(eventId, event);
						io.to(eventId).emit("voting:opened", {
							eventId,
							heatId,
							rotation: event.currentRotation,
						});
						broadcastEventUpdate(eventId, event);
						callback({ success: true });
					} catch (error) {
						callback({
							success: false,
							error: "Failed to open voting",
						});
					}
				},
			);

			socket.on(
				"round:closeVoting",
				async ({ eventId, heatId }, callback) => {
					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}
						const heatIndex = event.heats.findIndex(
							(h) => h.id === heatId,
						);
						if (heatIndex === -1) {
							callback({
								success: false,
								error: "Heat not found",
							});
							return;
						}

						// Close voting — admin can close at any time
						// Only mark as "submitted" if all judges have voted
						const heat = event.heats[heatIndex];
						const currentRoundConfig = getCurrentRoundConfig(event);
						const isFinalsRound = isFinalRound(
							currentRoundConfig,
							getCompetitionConfig(event),
						);
						const finalistGender = heat.finalistGender;
						const judgeMode = getFinalsJudgeMode(
							event,
							event.currentRound,
						);
						const expectedJudges =
							isFinalsRound && finalistGender
								? event.judges.filter((j) =>
										judgeMode === "same_gender"
											? j.gender === finalistGender
											: j.gender !== finalistGender,
									).length
								: event.judges.length;
						const allSubmitted =
							heat.judgesSubmitted.length >= expectedJudges;

						event.heats[heatIndex].votingStatus = allSubmitted
							? "submitted"
							: "closed";
						event.votingOpen = false;
						await saveEventToGCS(eventId, event);
						io.to(eventId).emit("voting:closed", {
							eventId,
							heatId,
						});
						broadcastEventUpdate(eventId, event);
						callback({
							success: true,
						});
					} catch (error) {
						callback({
							success: false,
							error: "Failed to close voting",
						});
					}
				},
			);

			socket.on("round:nextHeat", async ({ eventId }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
						return;
					}

					// Validate: voting must be closed
					if (event.votingOpen) {
						callback({
							success: false,
							error: "Close voting before advancing to the next heat",
						});
						return;
					}

					// Validate: all judges must have submitted for the current heat
					const currentHeat = event.heats.find(
						(h) =>
							h.number === event.currentHeat &&
							h.round === event.currentRound,
					);
					if (
						currentHeat &&
						currentHeat.votingStatus !== "submitted"
					) {
						const currentRoundConfig = getCurrentRoundConfig(event);
						const isFinalsRound = isFinalRound(
							currentRoundConfig,
							getCompetitionConfig(event),
						);
						const finalistGender = currentHeat.finalistGender;
						const judgeMode = getFinalsJudgeMode(
							event,
							event.currentRound,
						);
						const expectedJudges =
							isFinalsRound && finalistGender
								? event.judges.filter((j) =>
										judgeMode === "same_gender"
											? j.gender === finalistGender
											: j.gender !== finalistGender,
									).length
								: event.judges.length;

						callback({
							success: false,
							error: `Not all judges have submitted (${currentHeat.judgesSubmitted.length}/${expectedJudges}). All judges must submit before advancing to the next heat.`,
						});
						return;
					}

					const roundHeats = event.heats.filter(
						(h) => h.round === event.currentRound,
					);
					if (event.currentHeat < roundHeats.length) {
						event.currentHeat += 1;
						event.currentRotation = 1; // Reset rotation for new heat
						event.votingOpen = false;

						// Update the new heat's current rotation couples
						const newHeat = roundHeats.find(
							(h) => h.number === event.currentHeat,
						);
						if (
							newHeat &&
							newHeat.rotations &&
							newHeat.rotations.length > 0
						) {
							const heatIndex = event.heats.findIndex(
								(h) => h.id === newHeat.id,
							);
							if (heatIndex !== -1) {
								event.heats[heatIndex].currentRotation = 1;
								event.heats[heatIndex].couples =
									newHeat.rotations[0].couples;
								if (newHeat.rotations[0].finalsCouples) {
									event.heats[heatIndex].finalsCouples =
										newHeat.rotations[0].finalsCouples;
								}
							}
						}

						await saveEventToGCS(eventId, event);
					}
					// Broadcast full event update
					broadcastEventUpdate(eventId, event);
					// Also broadcast specific heat change event for judge clients
					io.to(eventId).emit("heat:changed", {
						eventId,
						currentHeat: event.currentHeat,
						currentRound: event.currentRound,
						currentRotation: event.currentRotation,
						votingOpen: event.votingOpen,
					});
					callback({ success: true, event });
				} catch (error) {
					callback({
						success: false,
						error: "Failed to advance heat",
					});
				}
			});

			socket.on(
				"round:setTieUp",
				async ({ eventId, round, gender, competitorIds }, callback) => {
					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}

						// Store tie-up selection dynamically
						if (!event.tieUpData) event.tieUpData = {};
						if (!event.tieUpData[round])
							event.tieUpData[round] = { male: [], female: [] };

						if (gender === "male") {
							event.tieUpData[round].male = competitorIds;
						} else {
							event.tieUpData[round].female = competitorIds;
						}

						// Store legacy for backward compatibility
						if (round === "round1") {
							if (gender === "male") {
								event.tieUpRound1Male = competitorIds;
							} else {
								event.tieUpRound1Female = competitorIds;
							}
						} else if (round === "round2") {
							if (gender === "male") {
								event.tieUpRound2Male = competitorIds;
							} else {
								event.tieUpRound2Female = competitorIds;
							}
						} else if (round === "finals") {
							if (gender === "male") {
								event.tieUpFinalsMale = competitorIds;
							} else {
								event.tieUpFinalsFemale = competitorIds;
							}
						}

						await saveEventToGCS(eventId, event);
						io.to(eventId).emit("tieup:set", {
							eventId,
							round,
							gender,
							competitorIds,
						});
						broadcastEventUpdate(eventId, event);
						callback({ success: true, event });
					} catch (error) {
						callback({
							success: false,
							error: "Failed to set tie-up",
						});
					}
				},
			);

			socket.on("round:advance", async ({ eventId }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
						return;
					}

					// Validate: all heats in the current round must have been submitted
					const roundHeats = event.heats.filter(
						(h) => h.round === event.currentRound,
					);
					if (roundHeats.length === 0) {
						callback({
							success: false,
							error: "No heats found for the current round",
						});
						return;
					}
					const unsubmittedHeats = roundHeats.filter(
						(h) => h.votingStatus !== "submitted",
					);
					if (unsubmittedHeats.length > 0) {
						callback({
							success: false,
							error: `${unsubmittedHeats.length} heat(s) have not completed voting. All heats must be submitted before advancing.`,
						});
						return;
					}

					const cutoff = getCompetitorsAdvancing(
						event,
						event.currentRound,
					);
					const config = getCompetitionConfig(event);
					const sortedRounds = getSortedRounds(config);
					const currentIndex = sortedRounds.findIndex(
						(r) => r.id === event.currentRound,
					);
					const nextRoundConfig = sortedRounds[currentIndex + 1];
					const nextRound: RoundType = nextRoundConfig
						? nextRoundConfig.id
						: "complete";

					// Filter votes by current round only
					const roundVotes = event.votes.filter(
						(v) => v.round === event.currentRound,
					);

					// Check if tie-up selections exist for current round
					const tieUpData = (event.tieUpData?.[event.currentRound] ||
						{}) as { male?: string[]; female?: string[] };
					const tieUpMale = tieUpData.male?.length
						? tieUpData.male
						: event.currentRound === "round1"
							? event.tieUpRound1Male
							: event.currentRound === "round2"
								? event.tieUpRound2Male
								: undefined;
					const tieUpFemale = tieUpData.female?.length
						? tieUpData.female
						: event.currentRound === "round1"
							? event.tieUpRound1Female
							: event.currentRound === "round2"
								? event.tieUpRound2Female
								: undefined;

					let advancingMales: Set<string>;
					let advancingFemales: Set<string>;

					if (tieUpMale && tieUpMale.length > 0) {
						// Use tie-up selection for males
						advancingMales = new Set(tieUpMale);
					} else {
						// Use points-based ranking for males
						const maleRankings = calculateRankings(
							event,
							event.competitors,
							roundVotes,
							"male",
							event.currentRound,
						);
						advancingMales = new Set(
							maleRankings.slice(0, cutoff).map((c) => c.id),
						);
					}

					if (tieUpFemale && tieUpFemale.length > 0) {
						// Use tie-up selection for females
						advancingFemales = new Set(tieUpFemale);
					} else {
						// Use points-based ranking for females
						const femaleRankings = calculateRankings(
							event,
							event.competitors,
							roundVotes,
							"female",
							event.currentRound,
						);
						advancingFemales = new Set(
							femaleRankings.slice(0, cutoff).map((c) => c.id),
						);
					}

					// Calculate rankings for points display (even if using tie-up)
					const maleRankings = calculateRankings(
						event,
						event.competitors,
						roundVotes,
						"male",
						event.currentRound,
					);
					const femaleRankings = calculateRankings(
						event,
						event.competitors,
						roundVotes,
						"female",
						event.currentRound,
					);

					// Preserve per-round vote counts before updating competitors
					event.competitors = event.competitors.map((c) => {
						const ranking =
							c.gender === "male"
								? maleRankings.find((r) => r.id === c.id)
								: femaleRankings.find((r) => r.id === c.id);
						const advances =
							c.gender === "male"
								? advancingMales.has(c.id)
								: advancingFemales.has(c.id);
						const currentVoteCount =
							ranking?.voteCount || c.voteCount || 0;

						// Store votes in the appropriate per-round field
						const updatedCompetitor = {
							...c,
							voteCount: currentVoteCount,
							eliminated: !advances,
						};

						// Save current round votes to the per-round field dynamically
						if (!updatedCompetitor.roundVotes)
							updatedCompetitor.roundVotes = {};
						updatedCompetitor.roundVotes[event.currentRound] =
							currentVoteCount;

						// Save to legacy fields for backward compatibility
						if (event.currentRound === "round1") {
							updatedCompetitor.round1Votes = currentVoteCount;
						} else if (event.currentRound === "round2") {
							updatedCompetitor.round2Votes = currentVoteCount;
						}

						return updatedCompetitor;
					});

					let newHeats: Heat[] | undefined;

					if (
						nextRoundConfig &&
						nextRoundConfig.competitorsAdvancing === 0
					) {
						// Finals: competitors are judged by judges of same gender (2 rotations)
						newHeats = generateFinalsHeats(
							event,
							event.competitors,
							event.judges,
							nextRound,
						);
					} else if (nextRoundConfig) {
						// Semi-finals: use rotation-based heat generation (2 rotations)
						const advancingMaleCompetitors =
							event.competitors.filter(
								(c) => c.gender === "male" && !c.eliminated,
							);
						const advancingFemaleCompetitors =
							event.competitors.filter(
								(c) => c.gender === "female" && !c.eliminated,
							);
						newHeats = generateHeatsWithRotations(
							event,
							advancingMaleCompetitors,
							advancingFemaleCompetitors,
							nextRound,
						);
					}

					if (newHeats) {
						// Keep heats from previous rounds and add new heats for the next round
						event.heats = [
							...event.heats.filter((h) => h.round !== nextRound),
							...newHeats,
						];
					}
					event.currentRound = nextRound;
					event.currentHeat = 1;
					event.currentRotation = 1;
					event.votingOpen = false;
					// Keep votes from previous rounds - do NOT clear them
					// event.votes = []; // REMOVED: This was clearing all votes including previous rounds
					await saveEventToGCS(eventId, event);
					io.to(eventId).emit("round:advanced", {
						eventId,
						newRound: nextRound,
					});
					broadcastEventUpdate(eventId, event);
					// Also broadcast heat:changed for judge clients
					io.to(eventId).emit("heat:changed", {
						eventId,
						currentHeat: event.currentHeat,
						currentRound: event.currentRound,
						currentRotation: event.currentRotation,
						votingOpen: event.votingOpen,
					});
					callback({ success: true, event });
				} catch (error) {
					callback({
						success: false,
						error: "Failed to advance round",
					});
				}
			});

			socket.on(
				"admin:round:rebuild",
				async (
					{ eventId }: { eventId: string },
					callback: (response: any) => void,
				) => {
					try {
						const event = await loadEventFromGCS(eventId);
						if (!event) {
							callback({
								success: false,
								error: "Event not found",
							});
							return;
						}

						// Safety check: Don't rebuild if any heat in the current round already has status "open" or "submitted"
						const currentRoundHeats = event.heats.filter(
							(h) => h.round === event.currentRound,
						);
						const hasVotingStarted = currentRoundHeats.some(
							(h) => h.votingStatus !== "closed",
						);

						if (hasVotingStarted) {
							callback({
								success: false,
								error: "Cannot rebuild round: voting has already started or completed for some heats. Please reset heat status to 'closed' before rebuilding.",
							});
							return;
						}

						const roundConfig = getRoundConfigForType(
							event,
							event.currentRound,
						);

						if (!roundConfig) {
							callback({
								success: false,
								error: "Current round configuration not found",
							});
							return;
						}

						// Safely detect if this is a final round using the helper
						const config = getCompetitionConfig(event);
						const isFinal =
							roundConfig.competitorsAdvancing === 0 ||
							roundConfig.id ===
								config.rounds[config.rounds.length - 1].id;

						// Get regular competitors (not assistants)
						const regularMales = event.competitors.filter(
							(c) =>
								c.gender === "male" &&
								!c.eliminated &&
								!c.isCompAssistant,
						);
						const regularFemales = event.competitors.filter(
							(c) =>
								c.gender === "female" &&
								!c.eliminated &&
								!c.isCompAssistant,
						);

						// Map assistants if we are in round 1 (Qualifiers)
						const maleAssistants =
							(event.currentRound === "round1" ||
								event.currentRound === config.rounds[0].id) &&
							event.compAssistants
								? event.compAssistants
										.filter((ca) => ca.gender === "male")
										.map(
											(ca) =>
												({
													id: ca.id,
													number: ca.number,
													name: ca.name,
													gender: ca.gender,
													photoUrl: ca.photoUrl,
													voteCount: 0,
													eliminated: false,
													isCompAssistant: true,
												}) as Competitor,
										)
								: [];

						const femaleAssistants =
							(event.currentRound === "round1" ||
								event.currentRound === config.rounds[0].id) &&
							event.compAssistants
								? event.compAssistants
										.filter((ca) => ca.gender === "female")
										.map(
											(ca) =>
												({
													id: ca.id,
													number: ca.number,
													name: ca.name,
													gender: ca.gender,
													photoUrl: ca.photoUrl,
													voteCount: 0,
													eliminated: false,
													isCompAssistant: true,
												}) as Competitor,
										)
								: [];

						const activeMales = [
							...regularMales,
							...maleAssistants,
						];
						const activeFemales = [
							...regularFemales,
							...femaleAssistants,
						];

						let newHeats: Heat[];
						if (isFinal) {
							newHeats = generateFinalsHeats(
								event,
								event.competitors,
								event.judges,
								event.currentRound,
							);
						} else {
							newHeats = generateHeatsWithRotations(
								event,
								activeMales,
								activeFemales,
								event.currentRound,
							);
						}

						// Replace only the heats for the current round
						event.heats = [
							...event.heats.filter(
								(h) => h.round !== event.currentRound,
							),
							...newHeats,
						];

						// Update current state to start of this rebuilt round
						event.currentRound = roundConfig.id; // Map to the actual config ID
						event.currentHeat = 1;
						event.currentRotation = 1;
						event.votingOpen = false;

						await saveEventToGCS(eventId, event);
						broadcastEventUpdate(eventId, event);

						// Notify clients that everything has been reset for this round
						io.to(eventId).emit("heat:changed", {
							eventId,
							currentHeat: event.currentHeat,
							currentRound: event.currentRound,
							currentRotation: event.currentRotation,
							votingOpen: event.votingOpen,
							totalHeats: newHeats.length,
						});

						callback({ success: true, event });
					} catch (error) {
						console.error("[Socket] Rebuild round error:", error);
						callback({
							success: false,
							error: "Failed to rebuild round",
						});
					}
				},
			);

			// VOTING OPERATIONS
			socket.on("vote:submit", async (data: SubmitVoteData, callback) => {
				try {
					const { eventId, judgeId, heatId, round, rankings } = data;
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
						return;
					}
					const heat = event.heats.find((h) => h.id === heatId);
					if (!heat || heat.votingStatus !== "open") {
						callback({
							success: false,
							error: "Voting is not open for this heat",
						});
						return;
					}
					event.votes = event.votes.filter(
						(v) => !(v.judgeId === judgeId && v.heatId === heatId),
					);
					const vote: Vote = {
						judgeId,
						heatId,
						round,
						rankings,
						submittedAt: new Date().toISOString(),
					};
					event.votes.push(vote);
					const heatIndex = event.heats.findIndex(
						(h) => h.id === heatId,
					);
					if (
						!event.heats[heatIndex].judgesSubmitted.includes(
							judgeId,
						)
					) {
						event.heats[heatIndex].judgesSubmitted.push(judgeId);
					}
					await saveEventToGCS(eventId, event);
					io.to(eventId).emit("vote:received", {
						eventId,
						judgeId,
						heatId,
					});
					broadcastEventUpdate(eventId, event);
					callback({ success: true, vote });
				} catch (error) {
					callback({
						success: false,
						error: "Failed to submit vote",
					});
				}
			});

			socket.on("vote:list", async ({ eventId, round }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
						return;
					}
					const votes = round
						? event.votes.filter((v) => v.round === round)
						: event.votes;
					callback({ success: true, votes });
				} catch (error) {
					callback({ success: false, error: "Failed to load votes" });
				}
			});

			// RESULTS OPERATIONS
			socket.on("results:get", async ({ eventId, round }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
						return;
					}
					const votes = round
						? event.votes.filter((v) => v.round === round)
						: event.votes;
					const maleRankings = calculateRankings(
						event,
						event.competitors,
						votes,
						"male",
						round || event.currentRound,
					);
					const femaleRankings = calculateRankings(
						event,
						event.competitors,
						votes,
						"female",
						round || event.currentRound,
					);
					callback({ success: true, maleRankings, femaleRankings });
				} catch (error) {
					callback({
						success: false,
						error: "Failed to load results",
					});
				}
			});

			socket.on("results:publish", async ({ eventId }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
						return;
					}
					// Filter votes by current round only
					const roundVotes = event.votes.filter(
						(v) => v.round === event.currentRound,
					);
					const maleRankings = calculateRankings(
						event,
						event.competitors,
						roundVotes,
						"male",
						event.currentRound,
					);
					const femaleRankings = calculateRankings(
						event,
						event.competitors,
						roundVotes,
						"female",
						event.currentRound,
					);
					event.competitors = event.competitors.map((c) => {
						const ranking =
							c.gender === "male"
								? maleRankings.find((r) => r.id === c.id)
								: femaleRankings.find((r) => r.id === c.id);
						return ranking
							? {
									...c,
									voteCount: ranking.voteCount,
								}
							: c;
					});
					// Mark all heats in the current round as submitted so display shows results
					event.heats = event.heats.map((h) =>
						h.round === event.currentRound
							? { ...h, votingStatus: "submitted" as const }
							: h,
					);
					event.votingOpen = false;
					await saveEventToGCS(eventId, event);
					io.to(eventId).emit("results:published", {
						eventId,
						round: event.currentRound,
					});
					broadcastEventUpdate(eventId, event);
					callback({ success: true });
				} catch (error) {
					callback({
						success: false,
						error: "Failed to publish results",
					});
				}
			});

			// DATA MANAGEMENT
			socket.on("data:reset", async ({ eventId }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (event) {
						// Reset event but preserve competitors, judges, and comp assistants
						const resetEvent = createResetEvent(
							event.id,
							event.name,
							event.date,
							event.venue,
							event.competitors, // Preserve competitors
							event.judges, // Preserve judges
							event.maleStartNumber,
							event.maleEndNumber,
							event.femaleStartNumber,
							event.femaleEndNumber,
							event.createdAt,
							event.compAssistants, // Preserve comp assistants
							event.adminId, // Preserve adminId
							event.competitionConfig, // Preserve competitionConfig
						);
						await saveEventToGCS(eventId, resetEvent);
						broadcastEventUpdate(eventId, resetEvent);
					}
					callback({ success: true, message: "Event data reset" });
				} catch (error) {
					callback({ success: false, error: "Failed to reset data" });
				}
			});

			socket.on("data:deleteAll", async (callback) => {
				try {
					await gcsHelpers.deleteAllSampleData();
					callback({ success: true, message: "All data deleted" });
				} catch (error) {
					callback({
						success: false,
						error: "Failed to delete all data",
					});
				}
			});

			socket.on("data:seed", async ({ eventId }, callback) => {
				try {
					// If eventId provided, seed that event; otherwise create demo event
					const targetEventId = eventId || DEFAULT_EVENT_ID;
					let event = await loadEventFromGCS(targetEventId);

					if (!event) {
						// Create new event if doesn't exist
						event = createEmptyEvent(
							targetEventId,
							"West Coast Swing Championship 2025",
							"2025-01-15",
							"Grand Ballroom, Los Angeles",
						);
					}

					event = generateSampleData(event);
					await saveEventToGCS(targetEventId, event);
					socket.join(targetEventId);
					broadcastEventUpdate(targetEventId, event);
					callback({ success: true, event });
				} catch (error) {
					callback({ success: false, error: "Failed to seed data" });
				}
			});

			socket.on("disconnect", () => {
				console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
			});

			// DISPLAY CONTROL (admin -> all display pages, persisted on event)
			socket.on("display:zoom", async ({ eventId, zoomLevel }) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (event) {
						if (!event.displayState) event.displayState = {};
						event.displayState.zoomLevel = zoomLevel;
						await saveEventToGCS(eventId, event);
						broadcastEventUpdate(eventId, event);
					}
				} catch (e) {
					/* best effort persist */
				}
				io.to(eventId).emit("display:zoom", { eventId, zoomLevel });
			});

			socket.on("display:slide", async ({ eventId, slide }) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (event) {
						if (!event.displayState) event.displayState = {};
						event.displayState.currentSlide = slide;
						await saveEventToGCS(eventId, event);
						broadcastEventUpdate(eventId, event);
					}
				} catch (e) {
					/* best effort persist */
				}
				io.to(eventId).emit("display:slide", { eventId, slide });
			});

			socket.on("display:showArrows", async ({ eventId, show }) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (event) {
						if (!event.displayState) event.displayState = {};
						event.displayState.showArrows = show;
						await saveEventToGCS(eventId, event);
						broadcastEventUpdate(eventId, event);
					}
				} catch (e) {
					/* best effort persist */
				}
				io.to(eventId).emit("display:showArrows", { eventId, show });
			});

			socket.on("display:action", ({ eventId, action, payload }) => {
				io.to(eventId).emit("display:action", {
					eventId,
					action,
					payload,
				});
			});
		});

		// Start server
		httpServer
			.once("error", (err) => {
				console.error("Server error:", err);
				process.exit(1);
			})
			.listen(port, hostname, () => {
				console.log(`> Ready on http://${hostname}:${port}`);
				console.log("> WebSocket server is running");
			});
	})
	.catch((err) => {
		console.error("Failed to prepare Next.js app:", err);
		process.exit(1);
	});
