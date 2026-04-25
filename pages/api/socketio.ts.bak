// Socket.IO API Route - Runs on same port as Next.js (works with Cloud Run)
import { Server as SocketIOServer } from "socket.io";
import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import type { Socket as NetSocket } from "net";
import bcrypt from "bcryptjs";
import { gcsClient, gcsHelpers } from "@/lib/gcs-client";
import { GCS_PATHS } from "@/lib/gcs-config";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData,
	RegisterCompetitorData,
	CreateJudgeData,
	SubmitVoteData,
	UploadPhotoData,
} from "@/lib/socket-events";
import type {
	Event,
	Competitor,
	Judge,
	Heat,
	Vote,
	RoundType,
	Gender,
	Couple,
	FinalsCouple,
	Rotation,
} from "@/lib/types";

interface SocketServer extends HTTPServer {
	io?: SocketIOServer<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>;
}

interface SocketWithIO extends NetSocket {
	server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
	socket: SocketWithIO;
}

const DEFAULT_EVENT_ID = "demo-event-1";

export const config = {
	api: {
		bodyParser: false,
	},
};

// Helper functions
async function loadEventFromGCS(eventId: string): Promise<Event | null> {
	try {
		return (await gcsHelpers.getEventMetadata(eventId)) as Event | null;
	} catch (error) {
		console.error(`[GCS] Error loading event ${eventId}:`, error);
		return null;
	}
}

async function saveEventToGCS(eventId: string, event: Event): Promise<void> {
	await gcsHelpers.saveEventMetadata(eventId, event);
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

// Get number of rotations for each round
function getRotationsForRound(round: RoundType): number {
	switch (round) {
		case "round1":
			return 3; // Qualifiers: 3 rotations
		case "round2":
			return 2; // Semi-finals: 2 rotations
		case "finals":
			return 2; // Finals: 2 rotations
		default:
			return 3;
	}
}

function splitIntoHeats(couples: Couple[], round: RoundType): Heat[] {
	const heats: Heat[] = [];
	const heatSize = 5;
	const totalRotations = getRotationsForRound(round);

	for (let i = 0; i < couples.length; i += heatSize) {
		const heatCouples = couples.slice(i, i + heatSize).map((c) => ({
			...c,
			heatNumber: heats.length + 1,
			round,
		}));
		heats.push({
			id: `heat-${round}-${heats.length + 1}`,
			number: heats.length + 1,
			round,
			couples: heatCouples,
			rotations: [{ number: 1, couples: heatCouples }],
			currentRotation: 1,
			totalRotations,
			votingStatus: "closed",
			judgesSubmitted: [],
		});
	}
	return heats;
}

// Generate rotations for a heat - females rotate to different male partners
function generateRotationsForHeat(
	males: Competitor[],
	females: Competitor[],
	heatNumber: number,
	round: RoundType,
): Rotation[] {
	const totalRotations = getRotationsForRound(round);
	const rotations: Rotation[] = [];

	// Ensure we have equal numbers (use minimum)
	const count = Math.min(males.length, females.length);
	const heatMales = males.slice(0, count);
	const heatFemales = females.slice(0, count);

	for (let rotation = 1; rotation <= totalRotations; rotation++) {
		const couples: Couple[] = [];

		for (let i = 0; i < count; i++) {
			// Rotate females: shift by (rotation - 1) positions
			const femaleIndex = (i + rotation - 1) % count;
			couples.push({
				id: `couple-h${heatNumber}-r${rotation}-${heatMales[i].id}-${heatFemales[femaleIndex].id}`,
				maleCompetitor: heatMales[i],
				femaleCompetitor: heatFemales[femaleIndex],
				heatNumber,
				round,
				rotation,
			});
		}

		rotations.push({
			number: rotation,
			couples,
		});
	}

	return rotations;
}

// Generate heats with rotations for a round
function generateHeatsWithRotations(
	males: Competitor[],
	females: Competitor[],
	round: RoundType,
): Heat[] {
	const heats: Heat[] = [];
	const totalRotations = getRotationsForRound(round);

	// Round 2 (Semi-finals) has only 1 heat with all competitors
	// Round 1 splits into 2 heats
	if (round === "round2") {
		// Semi-finals: 1 heat with all competitors, 2 rotations
		const shuffledMales = [...males].sort(() => Math.random() - 0.5);
		const shuffledFemales = [...females].sort(() => Math.random() - 0.5);
		const heatRotations = generateRotationsForHeat(
			shuffledMales,
			shuffledFemales,
			1,
			round,
		);

		heats.push({
			id: `heat-${round}-1`,
			number: 1,
			round,
			couples: heatRotations[0]?.couples || [],
			rotations: heatRotations,
			currentRotation: 1,
			totalRotations,
			votingStatus: "closed",
			judgesSubmitted: [],
		});
	} else {
		// Round 1: Split competitors into 2 heats (half in each)
		const halfMales = Math.ceil(males.length / 2);
		const halfFemales = Math.ceil(females.length / 2);

		// Shuffle for randomness
		const shuffledMales = [...males].sort(() => Math.random() - 0.5);
		const shuffledFemales = [...females].sort(() => Math.random() - 0.5);

		// Heat 1
		const heat1Males = shuffledMales.slice(0, halfMales);
		const heat1Females = shuffledFemales.slice(0, halfFemales);
		const heat1Rotations = generateRotationsForHeat(
			heat1Males,
			heat1Females,
			1,
			round,
		);

		heats.push({
			id: `heat-${round}-1`,
			number: 1,
			round,
			couples: heat1Rotations[0]?.couples || [], // Current rotation couples
			rotations: heat1Rotations,
			currentRotation: 1,
			totalRotations,
			votingStatus: "closed",
			judgesSubmitted: [],
		});

		// Heat 2
		const heat2Males = shuffledMales.slice(halfMales);
		const heat2Females = shuffledFemales.slice(halfFemales);

		if (heat2Males.length > 0 && heat2Females.length > 0) {
			const heat2Rotations = generateRotationsForHeat(
				heat2Males,
				heat2Females,
				2,
				round,
			);

			heats.push({
				id: `heat-${round}-2`,
				number: 2,
				round,
				couples: heat2Rotations[0]?.couples || [],
				rotations: heat2Rotations,
				currentRotation: 1,
				totalRotations,
				votingStatus: "closed",
				judgesSubmitted: [],
			});
		}
	}

	return heats;
}

// Generate finals heats where competitors are judged by judges of the SAME gender
// Male finalists are judged by male judges (Heat 1 - goes first)
// Female finalists are judged by female judges (Heat 2 - goes second)
// Each heat has 2 rotations
function generateFinalsHeats(
	competitors: Competitor[],
	judges: Judge[],
): Heat[] {
	const heats: Heat[] = [];
	const totalRotations = 2; // Finals have 2 rotations

	const maleFinalists = competitors.filter(
		(c) => c.gender === "male" && !c.eliminated,
	);
	const femaleFinalists = competitors.filter(
		(c) => c.gender === "female" && !c.eliminated,
	);
	const maleJudges = judges.filter((j) => j.gender === "male");
	const femaleJudges = judges.filter((j) => j.gender === "female");

	// Heat 1: Male finalists judged by female judges (FIRST)
	const maleFinalsRotations: Rotation[] = [];
	const shuffledMaleJudgesForMales = [...femaleJudges].sort(
		() => Math.random() - 0.5,
	);

	for (let rotation = 1; rotation <= totalRotations; rotation++) {
		const finalsCouples: FinalsCouple[] = [];
		for (let i = 0; i < maleFinalists.length; i++) {
			// Rotate judges
			const judgeIndex =
				(i + rotation - 1) % shuffledMaleJudgesForMales.length;
			const judge =
				shuffledMaleJudgesForMales[judgeIndex] ||
				shuffledMaleJudgesForMales[
					i % shuffledMaleJudgesForMales.length
				];
			finalsCouples.push({
				id: `finals-couple-h1-r${rotation}-${maleFinalists[i].id}-${judge.id}`,
				competitor: maleFinalists[i],
				judge: judge,
				heatNumber: 1,
				round: "finals",
				rotation,
			});
		}
		maleFinalsRotations.push({
			number: rotation,
			couples: [],
			finalsCouples,
		});
	}

	heats.push({
		id: "heat-finals-1",
		number: 1,
		round: "finals",
		couples: [],
		rotations: maleFinalsRotations,
		currentRotation: 1,
		totalRotations,
		finalsCouples: maleFinalsRotations[0]?.finalsCouples || [],
		finalistGender: "male",
		maleCompetitors: maleFinalists,
		femaleCompetitors: [],
		votingStatus: "closed",
		judgesSubmitted: [],
	});

	// Heat 2: Female finalists judged by male judges (SECOND)
	const femaleFinalsRotations: Rotation[] = [];
	const shuffledFemaleJudgesForFemales = [...maleJudges].sort(
		() => Math.random() - 0.5,
	);

	for (let rotation = 1; rotation <= totalRotations; rotation++) {
		const finalsCouples: FinalsCouple[] = [];
		for (let i = 0; i < femaleFinalists.length; i++) {
			// Rotate judges
			const judgeIndex =
				(i + rotation - 1) % shuffledFemaleJudgesForFemales.length;
			const judge =
				shuffledFemaleJudgesForFemales[judgeIndex] ||
				shuffledFemaleJudgesForFemales[
					i % shuffledFemaleJudgesForFemales.length
				];
			finalsCouples.push({
				id: `finals-couple-h2-r${rotation}-${femaleFinalists[i].id}-${judge.id}`,
				competitor: femaleFinalists[i],
				judge: judge,
				heatNumber: 2,
				round: "finals",
				rotation,
			});
		}
		femaleFinalsRotations.push({
			number: rotation,
			couples: [],
			finalsCouples,
		});
	}

	heats.push({
		id: "heat-finals-2",
		number: 2,
		round: "finals",
		couples: [],
		rotations: femaleFinalsRotations,
		currentRotation: 1,
		totalRotations,
		finalsCouples: femaleFinalsRotations[0]?.finalsCouples || [],
		finalistGender: "female",
		maleCompetitors: [],
		femaleCompetitors: femaleFinalists,
		votingStatus: "closed",
		judgesSubmitted: [],
	});

	return heats;
}

// Calculate rankings with weighted scoring for finals
// For Round 1 and Round 2: Each selection counts as 1 vote (regardless of rank)
// For Round 1, Round 2, and Finals: Each selection counts as 1 vote (regardless of rank)
// For ranking mode: Sum actual rank values (lower total = better)
// Only scoring mode (with categories) uses actual score values
function calculateRankings(
	competitors: Competitor[],
	votes: Vote[],
	gender: Gender,
	useWeightedScoring: boolean = false,
	scoringMode: string = "selection",
): Competitor[] {
	const genderCompetitors = competitors.filter(
		(c) => c.gender === gender && !c.eliminated,
	);
	const voteCountMap = new Map<string, number>();
	genderCompetitors.forEach((c) => {
		voteCountMap.set(c.id, 0);
	});
	votes.forEach((vote) => {
		vote.rankings.forEach((r) => {
			const competitor = competitors.find((c) => c.id === r.competitorId);
			if (competitor?.gender === gender) {
				if (scoringMode === "ranking") {
					// For ranking mode: Sum actual rank values (lower total = better)
					voteCountMap.set(
						r.competitorId,
						(voteCountMap.get(r.competitorId) || 0) + r.rank,
					);
				} else {
					// Each selection counts as 1 vote
					voteCountMap.set(
						r.competitorId,
						(voteCountMap.get(r.competitorId) || 0) + 1,
					);
				}
			}
		});
	});
	return (
		genderCompetitors
			.map((c) => ({
				...c,
				voteCount: voteCountMap.get(c.id) || 0,
			}))
			// For ranking mode: lowest total rank = best (ascending)
			// For selection/scoring: highest = best (descending)
			.sort((a, b) =>
				scoringMode === "ranking"
					? a.voteCount - b.voteCount
					: b.voteCount - a.voteCount,
			)
	);
}

function createEmptyEvent(): Event {
	const now = new Date().toISOString();
	return {
		id: DEFAULT_EVENT_ID,
		name: "West Coast Swing Championship 2025",
		date: "2025-01-15",
		venue: "Grand Ballroom, Los Angeles",
		status: "active",
		currentRound: "round1",
		currentHeat: 1,
		currentRotation: 1,
		votingOpen: false,
		competitors: [],
		judges: [],
		heats: [],
		votes: [],
		pairingHistory: [],
		createdAt: now,
		updatedAt: now,
	};
}

// Filter event data for public/judge clients
// Hide vote counts and detailed vote data until the round is complete
function filterEventForPublic(event: Event): Event {
	// Check if all heats in the current round have completed voting
	const currentRoundHeats = event.heats.filter(
		(h) => h.round === event.currentRound,
	);
	const currentRoundComplete =
		currentRoundHeats.length > 0 &&
		currentRoundHeats.every((h) => h.votingStatus === "submitted");

	// Check if previous rounds are complete (for historical results)
	const round1Heats = event.heats.filter((h) => h.round === "round1");
	const round1Complete =
		round1Heats.length > 0 &&
		round1Heats.every((h) => h.votingStatus === "submitted");

	const round2Heats = event.heats.filter((h) => h.round === "round2");
	const round2Complete =
		round2Heats.length > 0 &&
		round2Heats.every((h) => h.votingStatus === "submitted");

	// If current round is complete, show full data
	if (currentRoundComplete) {
		return event;
	}

	// If viewing historical results (previous rounds complete), show those vote counts
	// but hide current round vote counts
	return {
		...event,
		competitors: event.competitors.map((c) => ({
			...c,
			// Keep round1Votes if Round 1 is complete
			round1Votes: round1Complete ? c.round1Votes : undefined,
			// Keep round2Votes if Round 2 is complete
			round2Votes: round2Complete ? c.round2Votes : undefined,
			// Keep finalsPoints if finals are complete (same as currentRoundComplete for finals)
			finalsPoints: currentRoundComplete ? c.finalsPoints : undefined,
			// Hide current voteCount during active round
			voteCount: 0,
		})),
	};
}

export default function handler(
	req: NextApiRequest,
	res: NextApiResponseWithSocket,
) {
	if (res.socket.server.io) {
		console.log("[Socket.IO] Already running on this server");
		res.end();
		return;
	}

	console.log("[Socket.IO] Initializing on Next.js server (same port)...");

	const io = new SocketIOServer<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>(res.socket.server as HTTPServer, {
		path: "/api/socketio",
		addTrailingSlash: false,
		cors: {
			origin: "*",
			methods: ["GET", "POST"],
		},
		transports: ["websocket", "polling"],
	});

	res.socket.server.io = io;

	// Helper function to broadcast event updates to all clients in the room
	const broadcastEventUpdate = (eventId: string, event: Event) => {
		io.to(eventId).emit("event:updated", { eventId, event });
		io.to(eventId).emit("admin:event:updated", { eventId, event });
	};

	io.on("connection", (socket) => {
		console.log(`[Socket.IO] Client connected: ${socket.id}`);
		socket.join(DEFAULT_EVENT_ID);

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
				callback({ success: false, error: "Authentication failed" });
			}
		});

		socket.on("admin:logout", (callback) => {
			socket.data.isAdmin = false;
			callback({ success: true });
		});

		// EVENT OPERATIONS
		socket.on("event:list", async (callback) => {
			try {
				const events = await gcsHelpers.listEvents();
				const summaries = (events as Event[]).map((e) => ({
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
				callback({ success: true, events: summaries });
			} catch (error) {
				callback({ success: false, error: "Failed to list events" });
			}
		});

		socket.on("event:get", async ({ eventId }, callback) => {
			try {
				const event = await loadEventFromGCS(eventId);
				if (!event) {
					callback({ success: false, error: "Event not found" });
					return;
				}
				socket.join(eventId);
				callback({ success: true, event });
			} catch (error) {
				callback({ success: false, error: "Failed to load event" });
			}
		});

		socket.on("event:update", async ({ eventId, updates }, callback) => {
			try {
				const event = await loadEventFromGCS(eventId);
				if (!event) {
					callback({ success: false, error: "Event not found" });
					return;
				}
				const updatedEvent = { ...event, ...updates };
				await saveEventToGCS(eventId, updatedEvent);
				broadcastEventUpdate(eventId, updatedEvent);
				callback({ success: true, event: updatedEvent });
			} catch (error) {
				callback({ success: false, error: "Failed to update event" });
			}
		});

		socket.on(
			"event:create",
			async (
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
				callback,
			) => {
				try {
					const now = new Date().toISOString();
					const eventId = `event-${Date.now()}`;
					const event: Event = {
						id: eventId,
						name,
						date,
						venue,
						status: "active",
						currentRound: "round1",
						currentHeat: 1,
						currentRotation: 1,
						votingOpen: false,
						competitors: [],
						judges: [],
						heats: [],
						votes: [],
						pairingHistory: [],
						maleStartNumber,
						maleEndNumber,
						femaleStartNumber,
						femaleEndNumber,
						adminId,
						competitionConfig,
						createdAt: now,
						updatedAt: now,
					};
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

		socket.on("event:delete", async ({ eventId }, callback) => {
			try {
				await gcsHelpers.deleteEventData(eventId);
				io.emit("event:deleted", { eventId });
				callback({ success: true });
			} catch (error) {
				callback({ success: false, error: "Failed to delete event" });
			}
		});

		socket.on("event:seed", async ({ eventId }, callback) => {
			try {
				let event = await loadEventFromGCS(eventId);
				if (!event) {
					callback({ success: false, error: "Event not found" });
					return;
				}
				// Add sample data
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

				maleNames.forEach((name, i) => {
					event!.competitors.push({
						id: `male-${Date.now()}-${i}`,
						number: 101 + i,
						name,
						gender: "male",
						photoUrl: `/placeholder.svg?height=200&width=200&query=professional male latin dancer portrait ${i}`,
						voteCount: 0,
						eliminated: false,
					});
				});
				femaleNames.forEach((name, i) => {
					event!.competitors.push({
						id: `female-${Date.now()}-${i}`,
						number: 201 + i,
						name,
						gender: "female",
						photoUrl: `/placeholder.svg?height=200&width=200&query=professional female latin dancer portrait ${i}`,
						voteCount: 0,
						eliminated: false,
					});
				});

				event.judges = [
					{
						id: "judge-m1",
						name: "Carlos Rodriguez",
						gender: "male",
						photoUrl: "/male-judge-1.jpg",
						token: `mj-token-${eventId}-1`,
						pin: "1234",
					},
					{
						id: "judge-m2",
						name: "Marcus Thompson",
						gender: "male",
						photoUrl: "/male-judge-2.jpg",
						token: `mj-token-${eventId}-2`,
					},
					{
						id: "judge-f1",
						name: "Maria Santos",
						gender: "female",
						photoUrl: "/female-judge-1.jpg",
						token: `fj-token-${eventId}-1`,
						pin: "5678",
					},
					{
						id: "judge-f2",
						name: "Lisa Park",
						gender: "female",
						photoUrl: "/female-judge-2.jpg",
						token: `fj-token-${eventId}-2`,
					},
				];

				event.updatedAt = new Date().toISOString();
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
						callback({ success: false, error: "Event not found" });
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
						typeof rawBaseNumber === "number" ? rawBaseNumber : 0;
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
							const poolIndex = deletedPool.indexOf(customNumber);
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

							io.to(eventId).emit("registration:limitReached", {
								eventId,
								gender,
								currentCount: genderCompetitors.length,
								maxCount:
									maxCompetitors || genderCompetitors.length,
								message: errorMessage,
							});

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
						const ext = photoType.includes("png") ? "png" : "jpg";
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
				try {
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
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
							if (!event.deletedMaleNumbers.includes(oldNumber)) {
								event.deletedMaleNumbers.push(oldNumber);
							}
							// Remove new number from deleted pool if it was there
							const poolIndex = event.deletedMaleNumbers.indexOf(
								updates.number,
							);
							if (poolIndex !== -1) {
								event.deletedMaleNumbers.splice(poolIndex, 1);
							}
						} else {
							if (!event.deletedFemaleNumbers) {
								event.deletedFemaleNumbers = [];
							}
							if (
								!event.deletedFemaleNumbers.includes(oldNumber)
							) {
								event.deletedFemaleNumbers.push(oldNumber);
							}
							const poolIndex =
								event.deletedFemaleNumbers.indexOf(
									updates.number,
								);
							if (poolIndex !== -1) {
								event.deletedFemaleNumbers.splice(poolIndex, 1);
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
						callback({ success: false, error: "Event not found" });
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
						if (!event.deletedMaleNumbers.includes(deletedNumber)) {
							event.deletedMaleNumbers.push(deletedNumber);
						}
					} else {
						if (!event.deletedFemaleNumbers) {
							event.deletedFemaleNumbers = [];
						}
						if (
							!event.deletedFemaleNumbers.includes(deletedNumber)
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
						callback({ success: false, error: "Event not found" });
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
					const photoUrl = await gcsClient.getSignedUrl(photoPath, {
						action: "read",
						expiresIn: 86400,
					});
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
						callback({ success: false, error: "Event not found" });
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
				callback({ success: false, error: "Failed to load judges" });
			}
		});

		socket.on("judge:create", async (data: CreateJudgeData, callback) => {
			try {
				const { eventId, name, gender, pin, photoUrl } = data;
				const event = await loadEventFromGCS(eventId);
				if (!event) {
					callback({ success: false, error: "Event not found" });
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
				const token = `${gender.charAt(0)}j-token-${Date.now()}`;
				const newJudge: Judge = {
					id: judgeId,
					name: name.trim(),
					gender,
					photoUrl: photoUrl || `/${gender}-judge-${imageNumber}.jpg`,
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
				callback({ success: false, error: "Failed to create judge" });
			}
		});

		socket.on(
			"judge:update",
			async ({ eventId, judgeId, updates }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
						return;
					}
					const index = event.judges.findIndex(
						(j) => j.id === judgeId,
					);
					if (index === -1) {
						callback({ success: false, error: "Judge not found" });
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

		socket.on("judge:delete", async ({ eventId, judgeId }, callback) => {
			try {
				const event = await loadEventFromGCS(eventId);
				if (!event) {
					callback({ success: false, error: "Event not found" });
					return;
				}
				event.judges = event.judges.filter((j) => j.id !== judgeId);
				await saveEventToGCS(eventId, event);
				io.to(eventId).emit("judge:removed", { eventId, judgeId });
				// Also emit globally for Settings page to update event counts
				io.emit("judge:removed", { eventId, judgeId });
				callback({ success: true });
			} catch (error) {
				callback({ success: false, error: "Failed to delete judge" });
			}
		});

		socket.on("judge:auth", async ({ token, pin }, callback) => {
			try {
				// Search all events for the judge token
				const events = (await gcsHelpers.listEvents()) as Event[];
				for (const event of events) {
					const judge = event.judges.find((j) => j.token === token);
					if (judge) {
						if (judge.pin && judge.pin !== pin) {
							callback({ success: false, error: "Invalid PIN" });
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
				callback({ success: false, error: "Authentication failed" });
			}
		});

		// ROUND & HEAT OPERATIONS
		socket.on(
			"round:generatePairings",
			async ({ eventId, round }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
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

					// Include ALL assistants in the pairings - they dance with competitors
					// Assistants are mixed into the heats to balance the numbers
					const males = [...regularMales, ...maleAssistants];
					const females = [...regularFemales, ...femaleAssistants];

					// Use new rotation-based heat generation
					const heats = generateHeatsWithRotations(
						males,
						females,
						round,
					);

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

		socket.on("round:openVoting", async ({ eventId, heatId }, callback) => {
			try {
				const event = await loadEventFromGCS(eventId);
				if (!event) {
					callback({ success: false, error: "Event not found" });
					return;
				}
				const heatIndex = event.heats.findIndex((h) => h.id === heatId);
				if (heatIndex === -1) {
					callback({ success: false, error: "Heat not found" });
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
				callback({ success: false, error: "Failed to open voting" });
			}
		});

		// Next rotation within current heat
		socket.on("round:nextRotation", async ({ eventId }, callback) => {
			try {
				const event = await loadEventFromGCS(eventId);
				if (!event) {
					callback({ success: false, error: "Event not found" });
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
					getRotationsForRound(event.currentRound);

				if (event.currentRotation < totalRotations) {
					// Move to next rotation (voting stays open during rotation)
					event.currentRotation += 1;
					// Keep votingOpen as is - rotation happens during voting

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
				} else {
					callback({
						success: false,
						error: "Already at last rotation",
					});
				}
			} catch (error) {
				callback({
					success: false,
					error: "Failed to advance rotation",
				});
			}
		});

		socket.on(
			"round:closeVoting",
			async ({ eventId, heatId }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
						return;
					}
					const heatIndex = event.heats.findIndex(
						(h) => h.id === heatId,
					);
					if (heatIndex === -1) {
						callback({ success: false, error: "Heat not found" });
						return;
					}
					event.heats[heatIndex].votingStatus = "submitted";
					event.votingOpen = false;
					await saveEventToGCS(eventId, event);
					io.to(eventId).emit("voting:closed", { eventId, heatId });
					broadcastEventUpdate(eventId, event);
					callback({ success: true });
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
				callback({ success: false, error: "Failed to advance heat" });
			}
		});

		socket.on(
			"round:setTieUp",
			async ({ eventId, round, gender, competitorIds }, callback) => {
				try {
					const event = await loadEventFromGCS(eventId);
					if (!event) {
						callback({ success: false, error: "Event not found" });
						return;
					}

					// Store tie-up selection based on round and gender
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
					callback({ success: false, error: "Failed to set tie-up" });
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
				const cutoff = event.currentRound === "round1" ? 10 : 6;
				const nextRound: RoundType =
					event.currentRound === "round1" ? "round2" : "finals";

				// Filter votes by current round only
				const roundVotes = event.votes.filter(
					(v) => v.round === event.currentRound,
				);

				// Check if tie-up selections exist for current round
				const tieUpMale =
					event.currentRound === "round1"
						? event.tieUpRound1Male
						: event.tieUpRound2Male;
				const tieUpFemale =
					event.currentRound === "round1"
						? event.tieUpRound1Female
						: event.tieUpRound2Female;

				let advancingMales: Set<string>;
				let advancingFemales: Set<string>;

				if (tieUpMale && tieUpMale.length > 0) {
					// Use tie-up selection for males
					advancingMales = new Set(tieUpMale);
				} else {
					// Use points-based ranking for males
					const maleRankings = calculateRankings(
						event.competitors,
						roundVotes,
						"male",
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
						event.competitors,
						roundVotes,
						"female",
					);
					advancingFemales = new Set(
						femaleRankings.slice(0, cutoff).map((c) => c.id),
					);
				}

				// Calculate rankings for points display (even if using tie-up)
				const maleRankings = calculateRankings(
					event.competitors,
					roundVotes,
					"male",
				);
				const femaleRankings = calculateRankings(
					event.competitors,
					roundVotes,
					"female",
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

					// Save current round votes to the per-round field
					if (event.currentRound === "round1") {
						updatedCompetitor.round1Votes = currentVoteCount;
					} else if (event.currentRound === "round2") {
						updatedCompetitor.round2Votes = currentVoteCount;
					}

					return updatedCompetitor;
				});

				let newHeats: Heat[];

				if (nextRound === "finals") {
					// Finals: competitors are judged by judges of same gender (2 rotations)
					newHeats = generateFinalsHeats(
						event.competitors,
						event.judges,
					);
				} else {
					// Semi-finals: use rotation-based heat generation (2 rotations)
					const advancingMaleCompetitors = event.competitors.filter(
						(c) => c.gender === "male" && !c.eliminated,
					);
					const advancingFemaleCompetitors = event.competitors.filter(
						(c) => c.gender === "female" && !c.eliminated,
					);
					newHeats = generateHeatsWithRotations(
						advancingMaleCompetitors,
						advancingFemaleCompetitors,
						nextRound,
					);
				}

				// Keep heats from previous rounds and add new heats for the next round
				event.heats = [
					...event.heats.filter((h) => h.round !== nextRound),
					...newHeats,
				];
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
				callback({ success: false, error: "Failed to advance round" });
			}
		});

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
				const heatIndex = event.heats.findIndex((h) => h.id === heatId);
				if (!event.heats[heatIndex].judgesSubmitted.includes(judgeId)) {
					event.heats[heatIndex].judgesSubmitted.push(judgeId);
				}
				await saveEventToGCS(eventId, event);

				// Broadcast vote received notification (without vote details)
				io.to(eventId).emit("vote:received", {
					eventId,
					judgeId,
					heatId,
				});

				// Broadcast full event to all clients
				broadcastEventUpdate(eventId, event);

				callback({ success: true, vote });
			} catch (error) {
				callback({ success: false, error: "Failed to submit vote" });
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
					event.competitors,
					votes,
					"male",
				);
				const femaleRankings = calculateRankings(
					event.competitors,
					votes,
					"female",
				);
				callback({ success: true, maleRankings, femaleRankings });
			} catch (error) {
				callback({ success: false, error: "Failed to load results" });
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
					event.competitors,
					roundVotes,
					"male",
				);
				const femaleRankings = calculateRankings(
					event.competitors,
					roundVotes,
					"female",
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
					// Reset event but preserve competitors, judges, comp assistants, and number ranges
					const now = new Date().toISOString();
					// Reset all competitor vote counts and elimination status
					const resetCompetitors = event.competitors.map((c) => ({
						...c,
						voteCount: 0,
						round1Votes: undefined,
						round2Votes: undefined,
						finalsPoints: undefined,
						eliminated: false,
					}));
					const resetEvent: Event = {
						id: event.id,
						name: event.name,
						date: event.date,
						venue: event.venue,
						status: "active",
						currentRound: "round1",
						currentHeat: 1,
						currentRotation: 1,
						votingOpen: false,
						competitors: resetCompetitors,
						compAssistants: event.compAssistants || [],
						judges: event.judges,
						heats: [],
						votes: [],
						pairingHistory: [],
						maleStartNumber: event.maleStartNumber,
						maleEndNumber: event.maleEndNumber,
						femaleStartNumber: event.femaleStartNumber,
						femaleEndNumber: event.femaleEndNumber,
						deletedMaleNumbers: [],
						deletedFemaleNumbers: [],
						tieUpRound1Male: [],
						tieUpRound1Female: [],
						tieUpRound2Male: [],
						tieUpRound2Female: [],
						tieUpFinalsMale: [],
						tieUpFinalsFemale: [],
						competitionConfig: event.competitionConfig,
						adminId: event.adminId,
						createdAt: event.createdAt || now,
						updatedAt: now,
					};
					await saveEventToGCS(eventId, resetEvent);
					io.to(eventId).emit("event:updated", {
						eventId,
						event: resetEvent,
					});
				}
				callback({ success: true, message: "Event data reset" });
			} catch (error) {
				callback({ success: false, error: "Failed to reset data" });
			}
		});

		socket.on("data:deleteAll", async (callback) => {
			try {
				await gcsHelpers.deleteAllSampleData();
				callback({ success: true, message: "All sample data deleted" });
			} catch (error) {
				callback({
					success: false,
					error: "Failed to delete all data",
				});
			}
		});

		socket.on("data:seed", async ({ eventId }, callback) => {
			try {
				const targetEventId = eventId || DEFAULT_EVENT_ID;
				const event = createEmptyEvent();
				event.id = targetEventId;
				await saveEventToGCS(targetEventId, event);
				callback({ success: true, event });
			} catch (error) {
				callback({ success: false, error: "Failed to seed data" });
			}
		});

		socket.on("disconnect", () => {
			console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
		});
	});

	console.log(
		"[Socket.IO] Server initialized successfully on same port as Next.js",
	);
	res.end();
}
