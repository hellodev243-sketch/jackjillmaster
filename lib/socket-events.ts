// Socket.IO Event Contracts for Jack & Jill Competition System
// All GCS CRUD operations are handled via WebSocket events

import type {
	Competitor,
	CompAssistant,
	Judge,
	Heat,
	Vote,
	Event,
	EventSummary,
	RoundType,
	Gender,
} from "./types";

// ============================================
// CLIENT -> SERVER EVENTS (Requests)
// ============================================

export interface ClientToServerEvents {
	// Admin Authentication
	"admin:login": (
		data: { email: string; password: string },
		callback: (response: AuthResponse) => void,
	) => void;
	"admin:logout": (callback: (response: BaseResponse) => void) => void;

	// Event Operations
	"event:list": (callback: (response: EventsListResponse) => void) => void;
	"event:get": (
		data: { eventId: string },
		callback: (response: EventResponse) => void,
	) => void;
	"event:create": (
		data: CreateEventData,
		callback: (response: EventResponse) => void,
	) => void;
	"event:update": (
		data: { eventId: string; updates: Partial<Event> },
		callback: (response: EventResponse) => void,
	) => void;
	"event:delete": (
		data: { eventId: string },
		callback: (response: BaseResponse) => void,
	) => void;
	"event:seed": (
		data: { eventId: string },
		callback: (response: EventResponse) => void,
	) => void;

	// Competitor Operations
	"competitor:list": (
		data: { eventId: string },
		callback: (response: CompetitorsResponse) => void,
	) => void;
	"competitor:register": (
		data: RegisterCompetitorData,
		callback: (response: CompetitorResponse) => void,
	) => void;
	"competitor:update": (
		data: {
			eventId: string;
			competitorId: string;
			updates: Partial<Competitor> & {
				photoData?: string;
				photoType?: string;
			};
		},
		callback: (response: CompetitorResponse) => void,
	) => void;
	"competitor:delete": (
		data: { eventId: string; competitorId: string },
		callback: (response: BaseResponse) => void,
	) => void;
	"competitor:uploadPhoto": (
		data: UploadPhotoData,
		callback: (response: PhotoUploadResponse) => void,
	) => void;
	"competitor:deletePhoto": (
		data: { eventId: string; competitorId: string },
		callback: (response: BaseResponse) => void,
	) => void;

	// Comp Assistant Operations (competition assistants - appear in results but cannot be voted for)
	"compAssistant:create": (
		data: CreateCompAssistantData,
		callback: (response: CompAssistantResponse) => void,
	) => void;
	"compAssistant:update": (
		data: {
			eventId: string;
			compAssistantId: string;
			updates: Partial<CompAssistant> & {
				photoData?: string;
				photoType?: string;
			};
		},
		callback: (response: CompAssistantResponse) => void,
	) => void;
	"compAssistant:delete": (
		data: { eventId: string; compAssistantId: string },
		callback: (response: BaseResponse) => void,
	) => void;

	// Judge Operations
	"judge:list": (
		data: { eventId: string },
		callback: (response: JudgesResponse) => void,
	) => void;
	"judge:create": (
		data: CreateJudgeData,
		callback: (response: JudgeResponse) => void,
	) => void;
	"judge:update": (
		data: { eventId: string; judgeId: string; updates: Partial<Judge> },
		callback: (response: JudgeResponse) => void,
	) => void;
	"judge:delete": (
		data: { eventId: string; judgeId: string },
		callback: (response: BaseResponse) => void,
	) => void;
	"judge:auth": (
		data: { token: string; pin?: string },
		callback: (response: JudgeAuthResponse) => void,
	) => void;

	// Round & Heat Operations
	"round:generatePairings": (
		data: { eventId: string; round: RoundType },
		callback: (response: HeatsResponse) => void,
	) => void;
	"round:openVoting": (
		data: { eventId: string; heatId: string },
		callback: (response: BaseResponse) => void,
	) => void;
	"round:closeVoting": (
		data: { eventId: string; heatId: string },
		callback: (response: BaseResponse) => void,
	) => void;
	"round:nextHeat": (
		data: { eventId: string },
		callback: (response: EventResponse) => void,
	) => void;
	"round:nextRotation": (
		data: { eventId: string },
		callback: (response: EventResponse) => void,
	) => void;
	"round:advance": (
		data: { eventId: string },
		callback: (response: EventResponse) => void,
	) => void;
	"round:setTieUp": (
		data: {
			eventId: string;
			round: RoundType;
			gender: Gender;
			competitorIds: string[];
		},
		callback: (response: EventResponse) => void,
	) => void;
	"admin:round:rebuild": (
		data: { eventId: string },
		callback: (response: EventResponse) => void,
	) => void;

	// Voting Operations
	"vote:submit": (
		data: SubmitVoteData,
		callback: (response: VoteResponse) => void,
	) => void;
	"vote:list": (
		data: { eventId: string; round?: RoundType },
		callback: (response: VotesResponse) => void,
	) => void;

	// Results Operations
	"results:get": (
		data: { eventId: string; round?: RoundType },
		callback: (response: ResultsResponse) => void,
	) => void;
	"results:publish": (
		data: { eventId: string },
		callback: (response: BaseResponse) => void,
	) => void;

	// Data Management
	"data:reset": (
		data: { eventId: string },
		callback: (response: BaseResponse) => void,
	) => void;
	"data:seed": (
		data: { eventId?: string },
		callback: (response: EventResponse) => void,
	) => void;
	"data:deleteAll": (callback: (response: BaseResponse) => void) => void;

	// Display Control (admin -> display page via server broadcast)
	"display:zoom": (data: { eventId: string; zoomLevel: number }) => void;
	"display:slide": (data: { eventId: string; slide: string }) => void;
	"display:showArrows": (data: { eventId: string; show: boolean }) => void;
	"display:action": (data: {
		eventId: string;
		action: string;
		payload?: any;
	}) => void;
}

// ============================================
// SERVER -> CLIENT EVENTS (Broadcasts)
// ============================================

export interface ServerToClientEvents {
	// Real-time updates broadcast to all connected clients
	"event:created": (data: { event: Event }) => void;
	"event:updated": (data: { eventId: string; event: Event }) => void;
	"event:deleted": (data: { eventId: string; eventName?: string }) => void;
	"event:metadataUpdated": (data: {
		eventId: string;
		name: string;
		date: string;
		venue: string;
		status: string;
		competitorCount: number;
		judgeCount: number;
	}) => void;
	// Admin-only event with full vote data (not filtered)
	"admin:event:updated": (data: { eventId: string; event: Event }) => void;
	"competitor:added": (data: {
		eventId: string;
		competitor: Competitor;
	}) => void;
	"competitor:updated": (data: {
		eventId: string;
		competitor: Competitor;
	}) => void;
	"competitor:removed": (data: {
		eventId: string;
		competitorId: string;
		deletedNumber?: number;
		gender?: Gender;
	}) => void;
	// Comp Assistant broadcasts
	"compAssistant:added": (data: {
		eventId: string;
		compAssistant: CompAssistant;
	}) => void;
	"compAssistant:updated": (data: {
		eventId: string;
		compAssistant: CompAssistant;
	}) => void;
	"compAssistant:removed": (data: {
		eventId: string;
		compAssistantId: string;
	}) => void;
	"registration:limitReached": (data: {
		eventId: string;
		gender: Gender;
		currentCount: number;
		maxCount: number;
		message: string;
	}) => void;
	"judge:added": (data: { eventId: string; judge: Judge }) => void;
	"judge:updated": (data: { eventId: string; judge: Judge }) => void;
	"judge:removed": (data: { eventId: string; judgeId: string }) => void;
	"heat:updated": (data: { eventId: string; heat: Heat }) => void;
	"heat:changed": (data: {
		eventId: string;
		currentHeat: number;
		currentRound: RoundType;
		currentRotation: number;
		votingOpen: boolean;
		totalHeats?: number;
		totalRotations?: number;
	}) => void;
	"voting:opened": (data: {
		eventId: string;
		heatId: string;
		rotation?: number;
	}) => void;
	"voting:closed": (data: { eventId: string; heatId: string }) => void;
	"vote:received": (data: {
		eventId: string;
		judgeId: string;
		heatId: string;
	}) => void;
	"rotation:changed": (data: {
		eventId: string;
		heatId: string;
		rotation: number;
		totalRotations: number;
	}) => void;
	"round:advanced": (data: { eventId: string; newRound: RoundType }) => void;
	"tieup:set": (data: {
		eventId: string;
		round: RoundType;
		gender: Gender;
		competitorIds: string[];
	}) => void;
	"results:published": (data: { eventId: string; round: RoundType }) => void;
	"data:reset": (data: { eventId: string }) => void;

	// Display Control (broadcast from admin to display pages)
	"display:zoom": (data: { eventId: string; zoomLevel: number }) => void;
	"display:slide": (data: { eventId: string; slide: string }) => void;
	"display:showArrows": (data: { eventId: string; show: boolean }) => void;
	"display:action": (data: {
		eventId: string;
		action: string;
		payload?: any;
	}) => void;
}

// ============================================
// DATA TYPES FOR EVENTS
// ============================================

export interface BaseResponse {
	success: boolean;
	error?: string;
	message?: string;
}

export interface AuthResponse extends BaseResponse {
	authenticated?: boolean;
	token?: string;
}

export interface EventResponse extends BaseResponse {
	event?: Event;
}

export interface EventsListResponse extends BaseResponse {
	events?: EventSummary[];
}

export interface CompetitorResponse extends BaseResponse {
	competitor?: Competitor;
}

export interface CompetitorsResponse extends BaseResponse {
	competitors?: Competitor[];
}

export interface CompAssistantResponse extends BaseResponse {
	compAssistant?: CompAssistant;
}

export interface CompAssistantsResponse extends BaseResponse {
	compAssistants?: CompAssistant[];
}

export interface JudgeResponse extends BaseResponse {
	judge?: Judge;
}

export interface JudgesResponse extends BaseResponse {
	judges?: Judge[];
}

export interface JudgeAuthResponse extends BaseResponse {
	authenticated?: boolean;
	judge?: Judge;
	eventId?: string;
}

export interface HeatsResponse extends BaseResponse {
	heats?: Heat[];
}

export interface VoteResponse extends BaseResponse {
	vote?: Vote;
}

export interface VotesResponse extends BaseResponse {
	votes?: Vote[];
}

export interface PhotoUploadResponse extends BaseResponse {
	photoUrl?: string;
}

export interface ResultsResponse extends BaseResponse {
	maleRankings?: Competitor[];
	femaleRankings?: Competitor[];
}

// Request data types
export interface CreateEventData {
	name: string;
	date: string;
	venue: string;
	maleStartNumber?: number; // Starting number for male competitors (default: 101)
	maleEndNumber?: number; // Ending number for male competitors (default: 199)
	femaleStartNumber?: number; // Starting number for female competitors (default: 201)
	femaleEndNumber?: number; // Ending number for female competitors (default: 299)
	adminId?: string; // Optional admin ID representing the creator of the event
	competitionConfig?: any; // The structure configuration containing rounds, scoring, etc.
}

export interface RegisterCompetitorData {
	eventId: string;
	name: string;
	gender: Gender;
	number?: number; // Optional custom competitor number
	photoData?: string; // Base64 encoded image
	photoType?: string; // MIME type
}

export interface CreateJudgeData {
	eventId: string;
	name: string;
	gender: Gender;
	pin?: string;
	photoUrl?: string;
	photoData?: string; // Base64 encoded image
	photoType?: string; // MIME type
}

export interface CreateCompAssistantData {
	eventId: string;
	name: string;
	number: number; // Admin-assigned number (any non-negative, outside contestant ranges)
	gender: Gender;
	photoData?: string; // Base64 encoded image
	photoType?: string; // MIME type
}

export interface UploadPhotoData {
	eventId: string;
	competitorId: string;
	photoData: string; // Base64 encoded image
	photoType: string; // MIME type (image/jpeg, image/png)
}

export interface SubmitVoteData {
	eventId: string;
	judgeId: string;
	heatId: string;
	round: RoundType;
	rankings: {
		competitorId: string;
		rank: 1 | 2 | 3 | 4 | 5 | 6;
		scores?: Record<string, number>;
	}[];
}

// ============================================
// SOCKET.IO TYPE DEFINITIONS
// ============================================

export interface InterServerEvents {
	ping: () => void;
}

export interface SocketData {
	userId?: string;
	isAdmin?: boolean;
	eventId?: string;
}
