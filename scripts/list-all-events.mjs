// Script to list all events and their vote data in GCS
// Run with: node scripts/list-all-events.mjs

import { Storage } from "@google-cloud/storage";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUCKET_NAME = "jack_jill_data";

async function listAllEvents() {
	console.log("Listing all events in GCS bucket...\n");

	const storage = new Storage({
		projectId: "jackjill-481622",
		keyFilename: path.resolve(__dirname, "..", "gcs_key.json"),
	});

	const bucket = storage.bucket(BUCKET_NAME);

	// List all files
	const [files] = await bucket.getFiles({ prefix: "events/" });

	// Find all metadata files
	const metadataFiles = files.filter((f) =>
		f.name.endsWith("/metadata.json")
	);

	console.log(`Found ${metadataFiles.length} events:\n`);

	for (const file of metadataFiles) {
		const [content] = await file.download();
		const metadata = JSON.parse(content.toString());

		console.log(`========== ${metadata.id || file.name} ==========`);
		console.log(`Name: ${metadata.name}`);
		console.log(`Date: ${metadata.date}`);
		console.log(`Current Round: ${metadata.currentRound}`);
		console.log(`Current Heat: ${metadata.currentHeat}`);
		console.log(`Competitors: ${metadata.competitors?.length || 0}`);
		console.log(`Votes: ${metadata.votes?.length || 0}`);

		if (metadata.votes?.length > 0) {
			// Show vote summary
			const votesByHeat = {};
			for (const vote of metadata.votes) {
				const key = `${vote.round}-${vote.heatId}`;
				if (!votesByHeat[key]) votesByHeat[key] = 0;
				votesByHeat[key]++;
			}
			console.log("Votes by heat:", votesByHeat);
		}
		console.log("");
	}
}

listAllEvents().catch(console.error);
