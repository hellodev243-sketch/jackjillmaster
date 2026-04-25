// Competition Configuration Utilities
// Provides defaults, validation, and helpers for the dynamic competition configuration system

import type {
	CompetitionConfig,
	RoundConfig,
	ScoringCategory,
	ScoringMode,
	PairingMode,
	AnnouncementStyle,
	FinalsJudgeMode,
	Event,
	RoundType,
	Competitor,
	Vote,
	Gender,
} from "./types";

// ============================================
// DEFAULT SCORING CATEGORIES
// ============================================

export const DEFAULT_SCORING_CATEGORIES: ScoringCategory[] = [
	{
		id: "technique",
		name: "Technique",
		minScore: 1,
		maxScore: 100,
		weight: 1.0,
	},
	{
		id: "musicality",
		name: "Musicality",
		minScore: 1,
		maxScore: 100,
		weight: 1.0,
	},
	{
		id: "charisma",
		name: "Charisma",
		minScore: 1,
		maxScore: 100,
		weight: 1.0,
	},
	{
		id: "connection",
		name: "Connection",
		minScore: 1,
		maxScore: 100,
		weight: 1.0,
	},
];

// ============================================
// DEFAULT ROUND CONFIGURATIONS
// ============================================

/** Creates the standard 3-round config matching the current hardcoded behavior */
export function createDefaultConfig(): CompetitionConfig {
	return {
		rounds: [
			{
				id: "round-1",
				name: "Qualifier",
				order: 1,
				numberOfHeats: 2,
				numberOfRotations: 3,
				competitorsAdvancing: 10,
				scoringMode: "selection",
				pairingMode: "automatic",
				announcementStyle: "winners_only",
			},
			{
				id: "round-2",
				name: "Semi Final",
				order: 2,
				numberOfHeats: 1,
				numberOfRotations: 2,
				competitorsAdvancing: 6,
				scoringMode: "selection",
				pairingMode: "automatic",
				announcementStyle: "winners_only",
			},
			{
				id: "round-3",
				name: "Final",
				order: 3,
				numberOfHeats: 2,
				numberOfRotations: 2,
				competitorsAdvancing: 0, // 0 = final round, no advancement
				scoringMode: "ranking",
				pairingMode: "automatic",
				announcementStyle: "top_3_only",
				finalsJudgeMode: "cross_gender",
			},
		],
		updatedAt: new Date().toISOString(),
	};
}

/** Creates a single new round with sensible defaults */
export function createDefaultRound(order: number): RoundConfig {
	return {
		id: `round-${Date.now()}-${order}`,
		name: `Round ${order}`,
		order,
		numberOfHeats: 1,
		numberOfRotations: 2,
		competitorsAdvancing: 6,
		scoringMode: "selection",
		pairingMode: "automatic",
		announcementStyle: "winners_only",
	};
}

// ============================================
// CONFIG RESOLUTION HELPERS
// ============================================

/**
 * Returns the competition config for an event.
 * Falls back to default 3-round config if not configured.
 */
export function getCompetitionConfig(event: Event): CompetitionConfig {
	if (
		event.competitionConfig &&
		event.competitionConfig.rounds &&
		event.competitionConfig.rounds.length > 0
	) {
		return event.competitionConfig;
	}
	return createDefaultConfig();
}

/**
 * Maps a legacy RoundType to a round config index.
 * round1 → 0, round2 → 1, finals → last round
 */
export function legacyRoundToIndex(
	round: RoundType,
	totalRounds: number,
): number {
	if (totalRounds === 0) return 0;

	switch (round) {
		case "round1":
			return 0;
		case "round2":
			return Math.min(1, totalRounds - 1);
		case "finals":
			return totalRounds - 1;
		default:
			// If not a legacy string, it might be an index already or a dynamic ID
			const numeric = parseInt(round);
			if (!isNaN(numeric))
				return Math.max(0, Math.min(numeric, totalRounds - 1));
			return 0; // Default to first round for any other strings if no exact match found
	}
}

/**
 * Maps a round config index back to a legacy RoundType.
 * This allows backward compatibility with existing code that uses RoundType.
 */
export function indexToLegacyRound(
	index: number,
	totalRounds: number,
): RoundType {
	if (index === 0) return "round1";
	if (index === totalRounds - 1 && totalRounds > 1) return "finals";
	return "round2";
}

/**
 * Gets the RoundConfig for the current round of an event.
 */
export function getCurrentRoundConfig(event: Event): RoundConfig {
	return getRoundConfigForType(event, event.currentRound);
}

/**
 * Gets the RoundConfig for a specific legacy RoundType.
 */
export function getRoundConfigForType(
	event: Event,
	round: RoundType,
): RoundConfig {
	const config = getCompetitionConfig(event);
	const exactMatch = config.rounds.find((r) => r.id === round);
	if (exactMatch) return exactMatch;

	const roundIndex = legacyRoundToIndex(round, config.rounds.length);
	return config.rounds[roundIndex] || config.rounds[0];
}

/**
 * Gets all round configs sorted by order.
 */
export function getSortedRounds(config: CompetitionConfig): RoundConfig[] {
	if (!config || !config.rounds) return [];
	return [...config.rounds].sort((a, b) => a.order - b.order);
}

/**
 * Checks if a round is the final round (only the last round in config order).
 */
export function isFinalRound(
	roundConfig: RoundConfig,
	config: CompetitionConfig,
): boolean {
	const sorted = getSortedRounds(config);
	return sorted[sorted.length - 1]?.id === roundConfig.id;
}

/**
 * Gets the number of rotations for a round, using config or falling back to legacy defaults.
 */
export function getRotationsForRound(event: Event, round: RoundType): number {
	const roundConfig = getRoundConfigForType(event, round);
	return roundConfig.numberOfRotations;
}

/**
 * Gets the number of heats for a round from config.
 */
export function getHeatsForRound(event: Event, round: RoundType): number {
	const roundConfig = getRoundConfigForType(event, round);
	return roundConfig.numberOfHeats;
}

/**
 * Gets the scoring mode for a round.
 */
export function getScoringMode(event: Event, round: RoundType): ScoringMode {
	const roundConfig = getRoundConfigForType(event, round);
	return roundConfig.scoringMode;
}

/**
 * Gets the pairing mode for a round.
 */
export function getPairingMode(event: Event, round: RoundType): PairingMode {
	const roundConfig = getRoundConfigForType(event, round);
	return roundConfig.pairingMode;
}

/**
 * Gets the finals judge mode for a round.
 */
export function getFinalsJudgeMode(
	event: Event,
	round: RoundType,
): FinalsJudgeMode {
	const roundConfig = getRoundConfigForType(event, round);
	return roundConfig.finalsJudgeMode || "cross_gender";
}

/**
 * Gets the announcement style for a round.
 */
export function getAnnouncementStyle(
	event: Event,
	round: RoundType,
): AnnouncementStyle {
	const roundConfig = getRoundConfigForType(event, round);
	return roundConfig.announcementStyle;
}

/**
 * Gets how many competitors advance from a round (per gender).
 */
export function getCompetitorsAdvancing(
	event: Event,
	round: RoundType,
): number {
	const roundConfig = getRoundConfigForType(event, round);
	return roundConfig.competitorsAdvancing;
}

/**
 * Gets the round name for display purposes.
 */
export function getRoundName(event: Event, round: RoundType): string {
	const roundConfig = getRoundConfigForType(event, round);
	return roundConfig.name;
}

/**
 * Calculates how many competitors a judge should select in a single heat.
 * For multiple heats, the target advancement is distributed.
 */
/**
 * Calculates how many competitors a judge should select in a single heat.
 * For multiple heats, the target advancement is distributed.
 */
export function getSelectionsForJudge(
	event: Event,
	round: RoundType,
	heatNumber: number = 1,
	heatSize?: number,
): number {
	const roundConfig = getRoundConfigForType(event, round);
	if (!roundConfig) return 5;

	const config = getCompetitionConfig(event);
	const isFinal = isFinalRound(roundConfig, config);

	// Only treat as a final ranking round if advancement is explicitly 0
	// If the user has set an advancing number (like 15), they are in a selection phase
	if (roundConfig.competitorsAdvancing === 0) {
		return heatSize || 6;
	}

	if (roundConfig.numberOfHeats <= 1) {
		return roundConfig.competitorsAdvancing;
	}

	// Distribute total advancement across heats using the same math as heat slice distribution
	// Heat 0 = Math.floor(1 * total / heats) - Math.floor(0 * total / heats)
	// Heat 1 = Math.floor(2 * total / heats) - Math.floor(1 * total / heats)
	const i = heatNumber - 1;
	const startIdx = Math.floor(
		(i * roundConfig.competitorsAdvancing) / roundConfig.numberOfHeats,
	);
	const endIdx = Math.floor(
		((i + 1) * roundConfig.competitorsAdvancing) /
			roundConfig.numberOfHeats,
	);

	return endIdx - startIdx;
}

/**
 * Gets all round names as a map for backward-compatible display.
 */
export function getRoundNames(event: Event): Record<RoundType, string> {
	const config = getCompetitionConfig(event);
	const sorted = getSortedRounds(config);
	const names: Record<string, string> = {
		round1: "Round 1 - Qualifiers",
		round2: "Round 2 - Semi-Finals",
		finals: "Finals",
	};

	if (sorted.length >= 1) names.round1 = sorted[0].name;
	if (sorted.length >= 2) names.round2 = sorted[1].name;
	if (sorted.length >= 3) names.finals = sorted[sorted.length - 1].name;

	return names as Record<RoundType, string>;
}

// ============================================
// VALIDATION
// ============================================

export interface ConfigValidationError {
	field: string;
	message: string;
}

export function validateConfig(
	config: CompetitionConfig,
): ConfigValidationError[] {
	const errors: ConfigValidationError[] = [];

	if (!config.rounds || config.rounds.length === 0) {
		errors.push({
			field: "rounds",
			message: "At least one round is required",
		});
		return errors;
	}

	config.rounds.forEach((round, index) => {
		if (!round.name || round.name.trim() === "") {
			errors.push({
				field: `rounds[${index}].name`,
				message: `Round ${index + 1} must have a name`,
			});
		}
		if (round.numberOfHeats < 1) {
			errors.push({
				field: `rounds[${index}].numberOfHeats`,
				message: `Round ${index + 1} must have at least 1 heat`,
			});
		}
		if (round.numberOfRotations < 1) {
			errors.push({
				field: `rounds[${index}].numberOfRotations`,
				message: `Round ${index + 1} must have at least 1 rotation`,
			});
		}
		if (round.competitorsAdvancing < 0) {
			errors.push({
				field: `rounds[${index}].competitorsAdvancing`,
				message: `Advancing count cannot be negative`,
			});
		}
		if (
			round.scoringMode === "scoring" &&
			(!round.scoringCategories || round.scoringCategories.length === 0)
		) {
			errors.push({
				field: `rounds[${index}].scoringCategories`,
				message: `Round ${index + 1} uses scoring mode but has no categories`,
			});
		}
	});

	// Check for duplicate order values
	const orders = config.rounds.map((r) => r.order);
	const uniqueOrders = new Set(orders);
	if (uniqueOrders.size !== orders.length) {
		errors.push({
			field: "rounds",
			message: "Round orders must be unique",
		});
	}

	return errors;
}

/**
 * Unified Ranking Calculation
 * Supports Selection, Ranking, and Scoring modes dynamically.
 */
export function calculateRankings(
	event: Event,
	competitors: Competitor[],
	votes: Vote[],
	gender: Gender,
	round: RoundType,
	includeEliminated: boolean = false,
): Competitor[] {
	const scoringMode = getScoringMode(event, round);

	// Filter out comp assistants from main rankings
	const genderCompetitors = competitors.filter(
		(c) =>
			c.gender === gender &&
			(includeEliminated || !c.eliminated) &&
			!c.isCompAssistant,
	);
	const voteCountMap = new Map<string, number>();
	genderCompetitors.forEach((c) => {
		voteCountMap.set(c.id, 0);
	});

	votes.forEach((vote) => {
		if (vote.round !== round) return; // Only count votes for target round

		vote.rankings.forEach((r: any) => {
			const competitor = competitors.find((c) => c.id === r.competitorId);
			if (competitor?.gender === gender && !competitor.isCompAssistant) {
				if (scoringMode === "scoring" && r.scores) {
					// Sum up all category scores for this competitor
					const totalScore = Object.values(r.scores).reduce(
						(sum: number, score: any) => sum + (score || 0),
						0,
					);
					voteCountMap.set(
						r.competitorId,
						(voteCountMap.get(r.competitorId) || 0) +
							(totalScore as number),
					);
				} else if (scoringMode === "ranking") {
					// For ranking mode: Sum the actual rank values (lower total = better)
					voteCountMap.set(
						r.competitorId,
						(voteCountMap.get(r.competitorId) || 0) + r.rank,
					);
				} else {
					// For selection mode: Each selection counts as 1 vote
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
			.map((c) => {
				const voteCount = voteCountMap.get(c.id) || 0;

				return {
					...c,
					voteCount,
				};
			})
			// For ranking mode: lowest total rank = best (ascending)
			// For selection/scoring: highest = best (descending)
			.sort((a, b) =>
				scoringMode === "ranking"
					? a.voteCount - b.voteCount
					: b.voteCount - a.voteCount,
			)
	);
}
