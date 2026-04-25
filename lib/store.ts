// Global state management for competition data
import type {
	Event,
	Competitor,
	Judge,
	Heat,
	Vote,
	Gender,
	RoundType,
	Couple,
} from "./types";

const STORAGE_KEY = "jackjill_event_data";

// Demo data for testing
const createDemoData = (): Event => {
	const maleCompetitors: Competitor[] = Array.from(
		{ length: 15 },
		(_, i) => ({
			id: `male-${i + 1}`,
			number: 100 + i + 1,
			name: [
				"James Wilson",
				"Michael Chen",
				"David Garcia",
				"Robert Kim",
				"Daniel Martinez",
				"William Johnson",
				"Thomas Anderson",
				"Christopher Lee",
				"Matthew Brown",
				"Anthony Davis",
				"Joshua Taylor",
				"Andrew White",
				"Ryan Harris",
				"Brandon Clark",
				"Kevin Lewis",
			][i],
			gender: "male" as Gender,
			photoUrl: `/placeholder.svg?height=200&width=200&query=professional male latin dancer portrait ${
				i + 1
			}`,
			voteCount: 0,
			eliminated: false,
		}),
	);

	const femaleCompetitors: Competitor[] = Array.from(
		{ length: 15 },
		(_, i) => ({
			id: `female-${i + 1}`,
			number: 200 + i + 1,
			name: [
				"Sarah Johnson",
				"Emily Williams",
				"Jessica Brown",
				"Ashley Davis",
				"Amanda Miller",
				"Stephanie Wilson",
				"Jennifer Moore",
				"Nicole Taylor",
				"Samantha Anderson",
				"Rachel Thomas",
				"Lauren Jackson",
				"Megan White",
				"Brittany Harris",
				"Kayla Martin",
				"Christina Thompson",
			][i],
			gender: "female" as Gender,
			photoUrl: `/placeholder.svg?height=200&width=200&query=professional female latin dancer portrait ${
				i + 1
			}`,
			voteCount: 0,
			eliminated: false,
		}),
	);

	const maleJudges: Judge[] = [
		{
			id: "judge-m1",
			name: "John Smith",
			gender: "male",
			photoUrl: "/male-judge-1.jpg",
			token: "mj-token-1",
			pin: "1234",
		},
		{
			id: "judge-m2",
			name: "Carlos Rodriguez",
			gender: "male",
			photoUrl: "/male-judge-2.jpg",
			token: "mj-token-2",
			pin: "2345",
		},
		{
			id: "judge-m3",
			name: "Alex Thompson",
			gender: "male",
			photoUrl: "/male-judge-3.jpg",
			token: "mj-token-3",
			pin: "3456",
		},
	];

	const femaleJudges: Judge[] = [
		{
			id: "judge-f1",
			name: "Maria Santos",
			gender: "female",
			photoUrl: "/female-judge-1.jpg",
			token: "fj-token-1",
			pin: "4567",
		},
		{
			id: "judge-f2",
			name: "Lisa Park",
			gender: "female",
			photoUrl: "/female-judge-2.jpg",
			token: "fj-token-2",
			pin: "5678",
		},
		{
			id: "judge-f3",
			name: "Emma Rodriguez",
			gender: "female",
			photoUrl: "/female-judge-3.jpg",
			token: "fj-token-3",
			pin: "6789",
		},
	];

	return {
		id: "demo-event-1",
		name: "West Coast Swing Championship 2025",
		date: "2025-01-15",
		venue: "Grand Ballroom, Los Angeles",
		status: "active",
		currentRound: "round1",
		currentHeat: 1,
		currentRotation: 1,
		votingOpen: false,
		competitors: [...maleCompetitors, ...femaleCompetitors],
		judges: [...maleJudges, ...femaleJudges],
		heats: [],
		votes: [],
		pairingHistory: [],
		maleStartNumber: 101,
		maleEndNumber: 199,
		femaleStartNumber: 201,
		femaleEndNumber: 299,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
};

export const getEventData = (): Event => {
	if (typeof window === "undefined") return createDemoData();

	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		try {
			return JSON.parse(stored);
		} catch {
			return createDemoData();
		}
	}
	const demoData = createDemoData();
	localStorage.setItem(STORAGE_KEY, JSON.stringify(demoData));
	return demoData;
};

export const saveEventData = (event: Event): void => {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
};

export const resetEventData = (): Event => {
	const demoData = createDemoData();
	if (typeof window !== "undefined") {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(demoData));
	}
	return demoData;
};

// Pairing engine - ensures no repeat pairings
export const generatePairings = (
	males: Competitor[],
	females: Competitor[],
	pairingHistory: { maleId: string; femaleId: string }[],
): Couple[] => {
	const couples: Couple[] = [];
	const usedMales = new Set<string>();
	const usedFemales = new Set<string>();
	const historySet = new Set(
		pairingHistory.map((p) => `${p.maleId}-${p.femaleId}`),
	);

	// Shuffle arrays for randomness
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

	// Handle any remaining unpaired (fallback with warning)
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
};

// Split couples into heats of 5
export const splitIntoHeats = (couples: Couple[], round: RoundType): Heat[] => {
	const heats: Heat[] = [];
	const heatSize = 5;

	for (let i = 0; i < couples.length; i += heatSize) {
		const heatCouples = couples.slice(i, i + heatSize).map((c, idx) => ({
			...c,
			heatNumber: heats.length + 1,
			round,
		}));

		heats.push({
			id: `heat-${round}-${heats.length + 1}`,
			number: heats.length + 1,
			round,
			couples: heatCouples,
			rotations: [],
			currentRotation: 1,
			totalRotations: round === "round1" ? 3 : 2,
			votingStatus: "closed",
			judgesSubmitted: [],
		});
	}

	return heats;
};

// Calculate rankings and get top competitors
// For Round 1 and Round 2: Each selection counts as 1 vote (regardless of rank)
// For Finals with ranking mode: Sum actual rank values (lower total = better)
export const calculateRankings = (
	competitors: Competitor[],
	votes: Vote[],
	gender: Gender,
	useWeightedScoring: boolean = false,
	targetRound?: RoundType,
	scoringMode: string = "selection",
): Competitor[] => {
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
				} else if (useWeightedScoring) {
					// Legacy: For finals: Rank 1 = 6 points, Rank 2 = 5 points, etc.
					const points = 7 - r.rank;
					voteCountMap.set(
						r.competitorId,
						(voteCountMap.get(r.competitorId) || 0) + points,
					);
				} else {
					// For qualifiers/semi-finals: Each selection counts as 1 vote
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
				// Use per-round stored votes if available and no votes in current filter
				let voteCount = voteCountMap.get(c.id) || 0;
				if (voteCount === 0 && targetRound) {
					// Fall back to stored per-round votes
					if (
						targetRound === "round1" &&
						c.round1Votes !== undefined
					) {
						voteCount = c.round1Votes;
					} else if (
						targetRound === "round2" &&
						c.round2Votes !== undefined
					) {
						voteCount = c.round2Votes;
					} else if (
						targetRound === "finals" &&
						c.finalsPoints !== undefined
					) {
						voteCount = c.finalsPoints;
					}
				}
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
};

export const registerCompetitor = (data: {
	name: string;
	gender: Gender;
	photoUrl?: string;
}): Competitor | null => {
	const event = getEventData();

	// Calculate next number based on gender
	const genderCompetitors = event.competitors.filter(
		(c) => c.gender === data.gender,
	);
	const baseNumber = data.gender === "male" ? 100 : 200;
	const nextNumber = baseNumber + genderCompetitors.length + 1;

	const newCompetitor: Competitor = {
		id: `${data.gender}-${Date.now()}`,
		number: nextNumber,
		name: data.name,
		gender: data.gender,
		photoUrl:
			data.photoUrl ||
			`/placeholder.svg?height=200&width=200&query=professional ${data.gender} latin dancer portrait`,
		voteCount: 0,
		eliminated: false,
	};

	event.competitors.push(newCompetitor);
	saveEventData(event);

	return newCompetitor;
};
