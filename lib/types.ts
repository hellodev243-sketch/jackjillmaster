// Core types for the Jack & Jill Competition System

export type Gender = "male" | "female";
export type RoundType = string;
export type VotingStatus = "closed" | "open" | "submitted";
export type EventStatus = "draft" | "active" | "completed" | "archived";

// ============================================
// FLEXIBLE COMPETITION CONFIGURATION TYPES
// ============================================

/** Scoring mode for each round */
export type ScoringMode = "selection" | "ranking" | "scoring";

/** Pairing mode for each round */
export type PairingMode = "automatic" | "none";

/** Announcement style after each round */
export type AnnouncementStyle =
	| "all_with_ranking"
	| "winners_and_eliminated"
	| "winners_only"
	| "top_3_only";

/** Finals judge-competitor gender assignment */
export type FinalsJudgeMode = "same_gender" | "cross_gender";

/** Scoring category for multi-criteria scoring mode */
export interface ScoringCategory {
	id: string;
	name: string; // e.g. "Technique", "Musicality", "Charisma", "Connection"
	minScore: number; // default 1
	maxScore: number; // default 100
	weight: number; // default 1.0 (multiplier)
}

/** Per-round configuration — fully dynamic */
export interface RoundConfig {
	id: string;
	name: string; // e.g. "Qualifier", "Quarter Final", "Semi Final", "Final"
	order: number; // 1, 2, 3, 4...
	numberOfHeats: number; // 1, 2, 3, or more
	numberOfRotations: number; // 1, 2, 3, or more
	competitorsAdvancing: number; // how many advance per gender (0 = final round)
	scoringMode: ScoringMode;
	scoringCategories?: ScoringCategory[]; // only for "scoring" mode
	pairingMode: PairingMode;
	announcementStyle: AnnouncementStyle;
	finalsJudgeMode?: FinalsJudgeMode; // judge-competitor gender matching
}

/** Full competition configuration stored on the event */
export interface CompetitionConfig {
	rounds: RoundConfig[];
	updatedAt: string;
}

// ============================================
// CORE DATA TYPES
// ============================================

export interface Competitor {
	id: string;
	number: number;
	name: string;
	gender: Gender;
	photoUrl: string;
	voteCount: number; // Current round vote count (for backward compatibility)
	// Per-round vote tracking to preserve historical data
	round1Votes?: number; // Votes from Round 1 (Qualifiers)
	round2Votes?: number; // Votes from Round 2 (Semi-Finals)
	finalsPoints?: number; // Weighted points from Finals (1st=6pts, 2nd=5pts, etc.)
	// Dynamic per-round votes (keyed by round config id)
	roundVotes?: Record<string, number>;
	eliminated: boolean;
	isCompAssistant?: boolean; // True if this is a competition assistant (not a real competitor)
}

// Competition Assistant - appears in results but cannot be voted for
export interface CompAssistant {
	id: string;
	number: number; // Admin-assigned number (any non-negative, outside contestant ranges)
	name: string;
	gender: Gender;
	photoUrl: string;
}

export interface Judge {
	id: string;
	name: string;
	gender: Gender;
	photoUrl: string;
	token: string;
	pin?: string;
}

export interface Couple {
	id: string;
	maleCompetitor: Competitor;
	femaleCompetitor: Competitor;
	heatNumber: number;
	round: RoundType;
	rotation?: number; // Which rotation within the heat (1, 2, or 3)
}

// Finals pairing: competitor is judged by judge of same gender
export interface FinalsCouple {
	id: string;
	competitor: Competitor;
	judge: Judge;
	heatNumber: number;
	round: RoundType;
	rotation?: number;
}

export interface FinalsHeat {
	id: string;
	number: number;
	round: RoundType;
	finalistGender: Gender; // Which gender of finalists is dancing
	couples: FinalsCouple[];
	votingStatus: VotingStatus;
	judgesSubmitted: string[];
}

// Rotation within a heat - each rotation has different pairings
export interface Rotation {
	number: number; // 1, 2, or 3
	couples: Couple[];
	finalsCouples?: FinalsCouple[]; // For finals
	maleCompetitors?: Competitor[]; // For "No Pairing" mode
	femaleCompetitors?: Competitor[]; // For "No Pairing" mode
}

export interface Heat {
	id: string;
	number: number;
	round: RoundType;
	couples: Couple[]; // Current rotation's couples (for backward compatibility)
	rotations: Rotation[]; // All rotations for this heat
	currentRotation: number; // Current rotation number (1-based)
	totalRotations: number; // Total rotations for this round (3 for round1, 2 for round2/finals)
	votingStatus: VotingStatus;
	judgesSubmitted: string[];
	// Finals-specific fields
	finalistGender?: Gender; // Which gender of finalists is dancing in this heat
	finalsCouples?: FinalsCouple[]; // Current rotation's finals pairings
	maleCompetitors?: Competitor[]; // For "No Pairing" mode
	femaleCompetitors?: Competitor[]; // For "No Pairing" mode
}

export interface Vote {
	judgeId: string;
	heatId: string;
	round: RoundType;
	rankings: {
		competitorId: string;
		rank: 1 | 2 | 3 | 4 | 5 | 6; // Used for "ranking" or "selection" mode
		scores?: Record<string, number>; // Used for "scoring" mode (categoryId -> score)
	}[];
	submittedAt: string;
}

export interface Event {
	id: string;
	name: string;
	date: string;
	venue: string;
	status: EventStatus;
	currentRound: RoundType;
	currentHeat: number;
	currentRotation: number; // Current rotation within the heat (1-based)
	votingOpen: boolean;
	competitors: Competitor[];
	compAssistants?: CompAssistant[]; // Competition assistants (appear in results but cannot be voted for)
	judges: Judge[];
	heats: Heat[];
	votes: Vote[];
	pairingHistory: { maleId: string; femaleId: string }[];
	// Starting and ending numbers for competitor registration (admin configurable, optional)
	maleStartNumber?: number; // Starting number for male competitors (e.g., 101)
	maleEndNumber?: number; // Ending number for male competitors (e.g., 199), undefined = no limit
	femaleStartNumber?: number; // Starting number for female competitors (e.g., 201)
	femaleEndNumber?: number; // Ending number for female competitors (e.g., 299), undefined = no limit
	// Deleted numbers pool for reuse (to avoid gaps when competitors are deleted)
	deletedMaleNumbers?: number[]; // Pool of deleted male competitor numbers available for reuse
	deletedFemaleNumbers?: number[]; // Pool of deleted female competitor numbers available for reuse
	// Tie-up advancement tracking (Legacy)
	tieUpRound1Male?: string[];
	tieUpRound1Female?: string[];
	tieUpRound2Male?: string[];
	tieUpRound2Female?: string[];
	tieUpFinalsMale?: string[];
	tieUpFinalsFemale?: string[];
	// Dynamic Tie-up advancement tracking
	tieUpData?: Record<string, { male: string[]; female: string[] }>;
	createdAt: string;
	updatedAt: string;
	// Multi-admin support: which admin owns this event
	adminId?: string;
	// Dynamic competition configuration (overrides hardcoded round logic when present)
	competitionConfig?: CompetitionConfig;
	// Display remote control state (synced across all display pages)
	displayState?: {
		currentSlide?: string;
		zoomLevel?: number;
		showArrows?: boolean;
	};
}

// Summary for event list (without full data)
export interface EventSummary {
	id: string;
	name: string;
	date: string;
	venue: string;
	status: EventStatus;
	competitorCount: number;
	judgeCount: number;
	createdAt: string;
	adminId?: string;
}

export interface JudgeSession {
	judgeId: string;
	judge: Judge;
	eventId: string;
	authenticated: boolean;
}
