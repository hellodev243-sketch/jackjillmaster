// Script to check GCS votes data
// Run with: node scripts/check-votes.mjs

import { Storage } from "@google-cloud/storage";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUCKET_NAME = "jack_jill_data";
const EVENT_ID = "demo-event-1";

async function checkVotes() {
	console.log("Checking GCS votes data...\n");

	const storage = new Storage({
		projectId: "jackjill-481622",
		keyFilename: path.resolve(__dirname, "..", "gcs_key.json"),
	});

	const bucket = storage.bucket(BUCKET_NAME);

	// Check votes for each round
	const rounds = ["round1", "round2", "finals"];

	for (const round of rounds) {
		console.log(`\n========== ${round.toUpperCase()} ==========`);

		// Check votes.json
		const votesFile = bucket.file(
			`events/${EVENT_ID}/rounds/${round}/votes.json`
		);
		const [votesExists] = await votesFile.exists();

		if (votesExists) {
			const [votesContent] = await votesFile.download();
			const votes = JSON.parse(votesContent.toString());
			console.log(
				`\nVotes file found: ${
					votes.length || Object.keys(votes).length
				} entries`
			);
			console.log(JSON.stringify(votes, null, 2));
		} else {
			console.log(`No votes.json found for ${round}`);
		}

		// Check heats.json
		const heatsFile = bucket.file(
			`events/${EVENT_ID}/rounds/${round}/heats.json`
		);
		const [heatsExists] = await heatsFile.exists();

		if (heatsExists) {
			const [heatsContent] = await heatsFile.download();
			const heats = JSON.parse(heatsContent.toString());
			console.log(`\nHeats file found:`);
			console.log(JSON.stringify(heats, null, 2));
		}

		// Check results.json
		const resultsFile = bucket.file(
			`events/${EVENT_ID}/rounds/${round}/results.json`
		);
		const [resultsExists] = await resultsFile.exists();

		if (resultsExists) {
			const [resultsContent] = await resultsFile.download();
			const results = JSON.parse(resultsContent.toString());
			console.log(`\nResults file found:`);
			console.log(JSON.stringify(results, null, 2));
		}
	}

	// Also check metadata for current state
	console.log("\n========== EVENT METADATA ==========");
	const metadataFile = bucket.file(`events/${EVENT_ID}/metadata.json`);
	const [metadataExists] = await metadataFile.exists();

	if (metadataExists) {
		const [metadataContent] = await metadataFile.download();
		const metadata = JSON.parse(metadataContent.toString());
		console.log(`Event: ${metadata.name}`);
		console.log(`Current Round: ${metadata.currentRound}`);
		console.log(`Current Heat: ${metadata.currentHeat}`);
		console.log(`Voting Open: ${metadata.votingOpen}`);

		// Show votes from metadata if present
		if (metadata.votes && metadata.votes.length > 0) {
			console.log(`\nVotes in metadata: ${metadata.votes.length}`);
			console.log(JSON.stringify(metadata.votes, null, 2));
		}
	}
}

checkVotes().catch(console.error);
