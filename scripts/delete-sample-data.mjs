// Script to delete all sample data from GCS
// Run with: node scripts/delete-sample-data.mjs

import { Storage } from "@google-cloud/storage";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUCKET_NAME = "jack_jill_data";

async function deleteSampleData() {
	console.log("Deleting all sample data...");

	// Initialize GCS
	const storage = new Storage({
		projectId: "jackjill-481622",
		keyFilename: path.resolve(__dirname, "..", "gcs_key.json"),
	});

	const bucket = storage.bucket(BUCKET_NAME);

	// Delete all files under events/
	const [files] = await bucket.getFiles({ prefix: "events/" });

	if (files.length === 0) {
		console.log("No sample data found to delete.");
		return;
	}

	console.log(`Found ${files.length} files to delete...`);

	for (const file of files) {
		await file.delete();
		console.log(`   Deleted: ${file.name}`);
	}

	console.log("✅ All sample data deleted successfully!");
}

deleteSampleData().catch(console.error);
