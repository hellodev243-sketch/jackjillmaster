// Script to seed sample data via API POST methods
// Run with: npx ts-node scripts/seed-sample-data.ts

import { Storage } from "@google-cloud/storage";
import path from "path";

const BUCKET_NAME = "jack_jill_data";
const EVENT_ID = "demo-event-1";

interface Competitor {
	id: string;
	number: number;
	name: string;
	gender: "male" | "female";
	photoUrl: string;
	voteCount: number;
	eliminated: boolean;
}

interface Judge {
	id: string;
	name: string;
	gender: "male" | "female";
	photoUrl: string;
	token: string;
	pin?: string;
}

interface Event {
	id: string;
	name: string;
	date: string;
	venue: string;
	currentRound: "round1" | "round2" | "finals";
	currentHeat: number;
	votingOpen: boolean;
	competitors: Competitor[];
	judges: Judge[];
	heats: unknown[];
	votes: unknown[];
	pairingHistory: { maleId: string; femaleId: string }[];
}

const MALE_NAMES = [
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
];

const FEMALE_NAMES = [
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
];

async function seedSampleData() {
	console.log("Seeding sample data...");

	// Create competitors
	const maleCompetitors: Competitor[] = MALE_NAMES.map((name, i) => ({
		id: `male-${i + 1}`,
		number: 101 + i,
		name,
		gender: "male",
		photoUrl: `/placeholder.svg?height=200&width=200&query=professional male latin dancer portrait ${
			i + 1
		}`,
		voteCount: 0,
		eliminated: false,
	}));

	const femaleCompetitors: Competitor[] = FEMALE_NAMES.map((name, i) => ({
		id: `female-${i + 1}`,
		number: 201 + i,
		name,
		gender: "female",
		photoUrl: `/placeholder.svg?height=200&width=200&query=professional female latin dancer portrait ${
			i + 1
		}`,
		voteCount: 0,
		eliminated: false,
	}));

	// Create judges
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

	const event: Event = {
		id: EVENT_ID,
		name: "West Coast Swing Championship 2025",
		date: "2025-01-15",
		venue: "Grand Ballroom, Los Angeles",
		currentRound: "round1",
		currentHeat: 1,
		votingOpen: false,
		competitors: [...maleCompetitors, ...femaleCompetitors],
		judges: [...maleJudges, ...femaleJudges],
		heats: [],
		votes: [],
		pairingHistory: [],
	};

	// Initialize GCS
	const storage = new Storage({
		projectId: "jackjill-481622",
		keyFilename: path.resolve(process.cwd(), "gcs_key.json"),
	});

	const bucket = storage.bucket(BUCKET_NAME);
	const file = bucket.file(`events/${EVENT_ID}/metadata.json`);

	// Upload event data
	await file.save(JSON.stringify(event, null, 2), {
		contentType: "application/json",
		metadata: {
			cacheControl: "no-cache",
		},
	});

	console.log("✅ Sample data seeded successfully!");
	console.log(`   Event: ${event.name}`);
	console.log(
		`   Competitors: ${event.competitors.length} (${maleCompetitors.length} male, ${femaleCompetitors.length} female)`
	);
	console.log(
		`   Judges: ${event.judges.length} (${maleJudges.length} male, ${femaleJudges.length} female)`
	);
	console.log(
		`   Stored at: gs://${BUCKET_NAME}/events/${EVENT_ID}/metadata.json`
	);
}

seedSampleData().catch(console.error);
