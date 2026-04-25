// Script to verify GCS votes data and calculate totals
// Run with: node scripts/verify-votes.mjs

import { Storage } from "@google-cloud/storage";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUCKET_NAME = "jack_jill_data";
const EVENT_ID = "event-1766254839540";

async function verifyVotes() {
	console.log("Verifying GCS votes data...\n");

	const storage = new Storage({
		projectId: "jackjill-481622",
		keyFilename: path.resolve(__dirname, "..", "gcs_key.json"),
	});

	const bucket = storage.bucket(BUCKET_NAME);

	// Get metadata
	const metadataFile = bucket.file(`events/${EVENT_ID}/metadata.json`);
	const [metadataContent] = await metadataFile.download();
	const metadata = JSON.parse(metadataContent.toString());

	console.log(`Event: ${metadata.name}`);
	console.log(`Total Votes: ${metadata.votes?.length || 0}`);
	console.log(`Total Competitors: ${metadata.competitors?.length || 0}`);

	// Create competitor number lookup
	const competitorMap = {};
	if (metadata.competitors) {
		for (const c of metadata.competitors) {
			competitorMap[c.id] = {
				number: c.number,
				name: c.name,
				gender: c.gender,
			};
		}
	}

	// Group votes by round and heat
	const votesByRoundHeat = {};
	if (metadata.votes) {
		for (const vote of metadata.votes) {
			const key = `${vote.round}-${vote.heatId}`;
			if (!votesByRoundHeat[key]) {
				votesByRoundHeat[key] = [];
			}
			votesByRoundHeat[key].push(vote);
		}
	}

	// Calculate totals per competitor per round/heat
	console.log("\n========== VOTE BREAKDOWN ==========\n");

	for (const [key, votes] of Object.entries(votesByRoundHeat)) {
		console.log(`\n--- ${key} (${votes.length} votes) ---`);

		// Calculate points per competitor
		const pointsByCompetitor = {};
		const pointsByGender = { male: {}, female: {} };

		for (const vote of votes) {
			console.log(`\nJudge: ${vote.judgeId}`);
			for (const ranking of vote.rankings) {
				const comp = competitorMap[ranking.competitorId];
				if (comp) {
					const num = comp.number;
					if (!pointsByCompetitor[num]) {
						pointsByCompetitor[num] = {
							points: 0,
							name: comp.name,
							gender: comp.gender,
						};
					}
					pointsByCompetitor[num].points += ranking.points;

					// Track by gender
					if (!pointsByGender[comp.gender][num]) {
						pointsByGender[comp.gender][num] = {
							points: 0,
							name: comp.name,
						};
					}
					pointsByGender[comp.gender][num].points += ranking.points;

					console.log(
						`  #${num} (${comp.name}): Rank ${ranking.rank} = ${ranking.points} pts`
					);
				} else {
					console.log(
						`  Unknown competitor: ${ranking.competitorId}`
					);
				}
			}
		}

		// Show totals by gender
		console.log("\n--- MALE TOTALS ---");
		const maleEntries = Object.entries(pointsByGender.male).sort(
			(a, b) => b[1].points - a[1].points
		);
		for (const [num, data] of maleEntries) {
			console.log(`  #${num} = ${data.points} pts`);
		}

		console.log("\n--- FEMALE TOTALS ---");
		const femaleEntries = Object.entries(pointsByGender.female).sort(
			(a, b) => b[1].points - a[1].points
		);
		for (const [num, data] of femaleEntries) {
			console.log(`  #${num} = ${data.points} pts`);
		}
	}

	// Show overall totals from competitor data
	console.log("\n\n========== COMPETITOR STORED TOTALS ==========\n");

	const males =
		metadata.competitors
			?.filter((c) => c.gender === "male")
			.sort((a, b) => b.totalPoints - a.totalPoints) || [];
	const females =
		metadata.competitors
			?.filter((c) => c.gender === "female")
			.sort((a, b) => b.totalPoints - a.totalPoints) || [];

	console.log("--- MALES (from competitor data) ---");
	for (const c of males) {
		console.log(
			`  #${c.number} (${c.name}): ${c.totalPoints} pts, ${c.voteCount} votes`
		);
	}

	console.log("\n--- FEMALES (from competitor data) ---");
	for (const c of females) {
		console.log(
			`  #${c.number} (${c.name}): ${c.totalPoints} pts, ${c.voteCount} votes`
		);
	}
}

verifyVotes().catch(console.error);
