import ExcelJS from "exceljs";
import type { Event, Vote, RoundType } from "./types";
import {
	getRoundName,
	getCompetitorsAdvancing,
	isFinalRound,
	getRoundConfigForType,
	getScoringMode,
	calculateRankings,
} from "./competition-config";

/**
 * Export event data to Excel with embedded images
 */
export async function exportToExcel(
	event: Event,
	votes: Vote[],
): Promise<void> {
	const workbook = new ExcelJS.Workbook();

	// Set workbook properties
	workbook.creator = "Jack & Jill Competition";
	workbook.lastModifiedBy = "Jack & Jill Admin";
	workbook.created = new Date();
	workbook.modified = new Date();

	// Create worksheets
	const competitorsSheet = workbook.addWorksheet("Competitors", {
		views: [{ state: "frozen", xSplit: 0, ySplit: 5 }],
	});
	const judgesSheet = workbook.addWorksheet("Judges", {
		views: [{ state: "frozen", xSplit: 0, ySplit: 5 }],
	});
	const resultsSheet = workbook.addWorksheet("Results", {
		views: [{ state: "frozen", xSplit: 0, ySplit: 5 }],
	});

	// Add event info and competitors
	await addCompetitorsSheet(competitorsSheet, event, workbook, votes);

	// Add judges
	await addJudgesSheet(judgesSheet, event, workbook);

	// Add results (including history)
	await addResultsSheet(resultsSheet, event, votes, workbook);

	// Generate and download
	const buffer = await workbook.xlsx.writeBuffer();
	downloadExcel(
		buffer,
		`${sanitizeFilename(event.name)}_full_export_${new Date().toISOString().split("T")[0]}.xlsx`,
	);
}

/**
 * Export only the Competitors sheet
 */
export async function exportCompetitorsExcel(
	event: Event,
	votes: Vote[],
): Promise<void> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = "Jack & Jill Competition";
	workbook.created = new Date();

	const sheet = workbook.addWorksheet("Competitors", {
		views: [{ state: "frozen", xSplit: 0, ySplit: 5 }],
	});
	await addCompetitorsSheet(sheet, event, workbook, votes);

	const buffer = await workbook.xlsx.writeBuffer();
	downloadExcel(
		buffer,
		`${sanitizeFilename(event.name)}_competitors_${new Date().toISOString().split("T")[0]}.xlsx`,
	);
}

/**
 * Export only the Judges sheet
 */
export async function exportJudgesExcel(event: Event): Promise<void> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = "Jack & Jill Competition";
	workbook.created = new Date();

	const sheet = workbook.addWorksheet("Judges", {
		views: [{ state: "frozen", xSplit: 0, ySplit: 5 }],
	});
	await addJudgesSheet(sheet, event, workbook);

	const buffer = await workbook.xlsx.writeBuffer();
	downloadExcel(
		buffer,
		`${sanitizeFilename(event.name)}_judges_${new Date().toISOString().split("T")[0]}.xlsx`,
	);
}

/**
 * Export only the Results sheet
 */
export async function exportResultsExcel(
	event: Event,
	votes: Vote[],
): Promise<void> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = "Jack & Jill Competition";
	workbook.created = new Date();

	const sheet = workbook.addWorksheet("Results", {
		views: [{ state: "frozen", xSplit: 0, ySplit: 5 }],
	});
	await addResultsSheet(sheet, event, votes, workbook);

	const buffer = await workbook.xlsx.writeBuffer();
	downloadExcel(
		buffer,
		`${sanitizeFilename(event.name)}_results_${new Date().toISOString().split("T")[0]}.xlsx`,
	);
}

/**
 * Add competitors sheet with images
 */
async function addCompetitorsSheet(
	sheet: ExcelJS.Worksheet,
	event: Event,
	workbook: ExcelJS.Workbook,
	votes: Vote[] = [],
): Promise<void> {
	const { competitors, name, date, venue } = event;

	// Build per-round vote maps by recalculating from actual votes
	const rounds = event.competitionConfig?.rounds || [];
	const roundVoteMaps = new Map<string, Map<string, number>>();
	for (const roundConfig of rounds) {
		const roundId = roundConfig.id;
		const roundVotes = votes.filter((v) => v.round === roundId);
		const rankings = calculateRankings(
			event,
			competitors,
			roundVotes,
			"male",
			roundId,
			true,
		);
		const femaleRankings = calculateRankings(
			event,
			competitors,
			roundVotes,
			"female",
			roundId,
			true,
		);
		const map = new Map<string, number>();
		for (const r of [...rankings, ...femaleRankings]) {
			map.set(r.id, r.voteCount);
		}
		roundVoteMaps.set(roundId, map);
	}

	// Formatting date
	const formattedDate = new Date(date).toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	// Table Headers - dynamic based on competition rounds
	const roundHeaders = rounds.map((r) => r.name || r.id);
	const headers = [
		"Photo",
		"No.",
		"Competitor Name",
		"Gender Role",
		...roundHeaders.map((rName) => `${rName}`),
		"Total",
		"Status",
	];
	const totalColumns = headers.length;
	const lastCol = String.fromCharCode(64 + totalColumns); // e.g. 'I' for 9 columns

	// Event title banner
	sheet.mergeCells(`A1:${lastCol}1`);
	const titleCell = sheet.getCell("A1");
	titleCell.value = `${name} - Competitor List`;
	titleCell.font = { size: 22, bold: true, color: { argb: "FFFFFFFF" } };
	titleCell.alignment = { horizontal: "center", vertical: "middle" };
	titleCell.fill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FF1F2937" }, // Gray-800
	};
	sheet.getRow(1).height = 45;

	// Add date & venue row
	sheet.mergeCells(`A2:${lastCol}2`);
	const subHeaderCell = sheet.getCell("A2");
	subHeaderCell.value = `📅 ${formattedDate}  |  📍 ${venue}`;
	subHeaderCell.font = { size: 14, color: { argb: "FFFFFFFF" } };
	subHeaderCell.alignment = { horizontal: "center", vertical: "middle" };
	subHeaderCell.fill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FF374151" }, // Gray-700
	};
	sheet.getRow(2).height = 25;

	// Statistics row
	sheet.mergeCells(`A3:${lastCol}3`);
	const statsCell = sheet.getCell("A3");
	const maleCount = competitors.filter((c) => c.gender === "male").length;
	const femaleCount = competitors.filter((c) => c.gender === "female").length;
	statsCell.value = `Total: ${competitors.length}  |  Leads (Male): ${maleCount}  |  Follows (Female): ${femaleCount}`;
	statsCell.font = { size: 11, italic: true, color: { argb: "FF9CA3AF" } };
	statsCell.alignment = { horizontal: "center", vertical: "middle" };
	sheet.getRow(3).height = 20;

	// Separator
	sheet.getRow(4).height = 10;

	const headerRow = sheet.getRow(5);
	headers.forEach((header, index) => {
		const cell = headerRow.getCell(index + 1);
		cell.value = header;
		cell.font = { bold: true, color: { argb: "FF1F2937" } };
		cell.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFF59E0B" }, // Amber-500
		};
		cell.alignment = { horizontal: "center", vertical: "middle" };
		cell.border = {
			top: { style: "medium" },
			left: { style: "thin" },
			bottom: { style: "medium" },
			right: { style: "thin" },
		};
	});
	headerRow.height = 30;

	// Define column settings
	sheet.getColumn(1).width = 16; // Photo
	sheet.getColumn(2).width = 10; // No.
	sheet.getColumn(3).width = 30; // Name
	sheet.getColumn(4).width = 15; // Role
	for (let r = 0; r < rounds.length; r++) {
		sheet.getColumn(5 + r).width = 14; // Round columns
	}
	sheet.getColumn(5 + rounds.length).width = 12; // Total
	sheet.getColumn(6 + rounds.length).width = 15; // Status

	// List by Gender (Leads first, then Follows)
	const sortedComp = [
		...competitors
			.filter((c) => c.gender === "male")
			.sort((a, b) => a.number - b.number),
		...competitors
			.filter((c) => c.gender === "female")
			.sort((a, b) => a.number - b.number),
	];

	for (let i = 0; i < sortedComp.length; i++) {
		const comp = sortedComp[i];
		const rowIndex = i + 6;
		const row = sheet.getRow(rowIndex);
		row.height = 85;

		// Image Handling
		let imageProcessed = false;
		if (comp.photoUrl && !comp.photoUrl.includes("placeholder")) {
			try {
				const imgBuffer = await loadImageAsBuffer(comp.photoUrl);
				if (imgBuffer) {
					const imgId = workbook.addImage({
						buffer: imgBuffer as any,
						extension: "jpeg",
					});
					sheet.addImage(imgId, {
						tl: { col: 0, row: rowIndex - 1 },
						ext: { width: 100, height: 100 },
						editAs: "oneCell",
					});
					imageProcessed = true;
				}
			} catch (e) {
				console.error("Image loading failed:", comp.name, e);
			}
		}

		if (!imageProcessed) {
			const cell = row.getCell(1);
			cell.value = "👤";
			cell.alignment = { horizontal: "center", vertical: "middle" };
			cell.font = { size: 24 };
		}

		// Data Insertion
		row.getCell(2).value = comp.number;
		row.getCell(3).value = comp.name;
		row.getCell(4).value =
			comp.gender === "male" ? "Lead (Male)" : "Follow (Female)";

		// Per-round votes (recalculated from actual votes)
		let totalVotes = 0;
		for (let r = 0; r < rounds.length; r++) {
			const roundId = rounds[r].id;
			const roundMap = roundVoteMaps.get(roundId);
			const roundVoteCount = roundMap?.get(comp.id) || 0;
			row.getCell(5 + r).value = roundVoteCount;
			totalVotes += roundVoteCount;
		}

		const totalCol = 5 + rounds.length;
		const statusCol = 6 + rounds.length;
		row.getCell(totalCol).value = totalVotes;
		row.getCell(statusCol).value = comp.eliminated
			? "ELIMINATED"
			: "ACTIVE";

		// Styling for data cells
		for (let col = 1; col <= totalColumns; col++) {
			const cell = row.getCell(col);
			cell.alignment = { horizontal: "center", vertical: "middle" };
			cell.border = {
				bottom: { style: "thin", color: { argb: "FFEEEEEE" } },
				left: { style: "thin", color: { argb: "FFEEEEEE" } },
				right: { style: "thin", color: { argb: "FFEEEEEE" } },
			};

			// Status Styling
			if (col === statusCol) {
				cell.font = {
					bold: true,
					color: { argb: comp.eliminated ? "FF991B1B" : "FF065F46" },
				};
				cell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: {
						argb: comp.eliminated ? "FFFEE2E2" : "FFD1FAE5",
					},
				};
			}

			// Role Coloring
			if (col === 4) {
				const isMale = comp.gender === "male";
				cell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: isMale ? "FFEFF6FF" : "FFFFF1F2" },
				};
				cell.font = {
					color: { argb: isMale ? "FF1D4ED8" : "FFBE123C" },
				};
			}

			// Zebra Striping
			if (i % 2 !== 0 && col !== statusCol && col !== 4) {
				cell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FFF9FAFB" },
				};
			}
		}
	}
}

/**
 * Add judges sheet with images
 */
async function addJudgesSheet(
	sheet: ExcelJS.Worksheet,
	event: Event,
	workbook: ExcelJS.Workbook,
): Promise<void> {
	const { judges, name } = event;

	// Header Background
	sheet.mergeCells("A1:E1");
	const titleCell = sheet.getCell("A1");
	titleCell.value = `${name} - Official Judges Team`;
	titleCell.font = { size: 20, bold: true, color: { argb: "FFFFFFFF" } };
	titleCell.alignment = { horizontal: "center", vertical: "middle" };
	titleCell.fill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FF111827" }, // Gray-900
	};
	sheet.getRow(1).height = 40;

	// Table Headers
	const headers = [
		"Photo",
		"Judge Name",
		"Gender",
		"Access PIN",
		"Security Token",
	];
	const headerRow = sheet.getRow(3);
	headers.forEach((header, idx) => {
		const cell = headerRow.getCell(idx + 1);
		cell.value = header;
		cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
		cell.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FF6366F1" }, // Indigo-500
		};
		cell.alignment = { horizontal: "center", vertical: "middle" };
	});
	headerRow.height = 30;

	sheet.getColumn(1).width = 16;
	sheet.getColumn(2).width = 30;
	sheet.getColumn(3).width = 15;
	sheet.getColumn(4).width = 12;
	sheet.getColumn(5).width = 45;

	for (let i = 0; i < judges.length; i++) {
		const judge = judges[i];
		const rowIndex = i + 4;
		const row = sheet.getRow(rowIndex);
		row.height = 80;

		let hasImg = false;
		if (judge.photoUrl && !judge.photoUrl.includes("placeholder")) {
			try {
				const buf = await loadImageAsBuffer(judge.photoUrl);
				if (buf) {
					const id = workbook.addImage({
						buffer: buf as any,
						extension: "jpeg",
					});
					sheet.addImage(id, {
						tl: { col: 0, row: rowIndex - 1 },
						ext: { width: 80, height: 80 },
					});
					hasImg = true;
				}
			} catch (e) {}
		}

		if (!hasImg) {
			const c = row.getCell(1);
			c.value = "⚖️";
			c.alignment = { horizontal: "center", vertical: "middle" };
			c.font = { size: 24 };
		}

		row.getCell(2).value = judge.name;
		row.getCell(3).value =
			judge.gender === "male" ? "Male Judge" : "Female Judge";
		row.getCell(4).value = judge.pin || "None";
		row.getCell(5).value = judge.token;

		for (let col = 2; col <= 5; col++) {
			const cell = row.getCell(col);
			cell.alignment = { horizontal: "center", vertical: "middle" };
			cell.border = {
				bottom: { style: "thin", color: { argb: "FFEEEEEE" } },
			};
			if (i % 2 !== 0) {
				cell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FFF9FAFB" },
				};
			}
		}
	}
}

/**
 * Add Results sheet
 */
async function addResultsSheet(
	sheet: ExcelJS.Worksheet,
	event: Event,
	votes: Vote[],
	workbook: ExcelJS.Workbook,
): Promise<void> {
	const { competitors, competitionConfig } = event;
	const config = competitionConfig || {
		rounds: [],
		updatedAt: new Date().toISOString(),
	};

	// Header for Results
	sheet.mergeCells("A1:F1");
	const titleCell = sheet.getCell("A1");
	titleCell.value = `${event.name} - Competition Results`;
	titleCell.font = { size: 22, bold: true, color: { argb: "FFFFFFFF" } };
	titleCell.alignment = { horizontal: "center", vertical: "middle" };
	titleCell.fill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FF991B1B" }, // Red-800 for results
	};
	sheet.getRow(1).height = 45;

	let currentRow = 3;

	// Iterate through rounds in config order
	const roundsToProcess = config.rounds.map((r) => r.id);

	for (const roundId of roundsToProcess) {
		const roundVotes = votes.filter((v) => v.round === roundId);
		const roundName = getRoundName(event, roundId as RoundType);
		const cutoff = getCompetitorsAdvancing(event, roundId as RoundType);
		const roundConfig = getRoundConfigForType(event, roundId as RoundType);
		const useWeighted = isFinalRound(roundConfig, config);
		const scoringMode = getScoringMode(event, roundId as RoundType);
		const scoreColumnLabel =
			scoringMode === "scoring"
				? "Total points"
				: scoringMode === "ranking"
					? "Total Rank"
					: "Votes";

		// Round Header
		sheet.mergeCells(`A${currentRow}:F${currentRow}`);
		const rhCell = sheet.getCell(`A${currentRow}`);
		rhCell.value = roundName.toUpperCase();
		rhCell.font = { bold: true, size: 14, color: { argb: "FF374151" } };
		rhCell.alignment = { horizontal: "left" };
		rhCell.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFF3F4F6" },
		};
		sheet.getRow(currentRow).height = 25;
		currentRow++;

		// Subheaders for Gender Sections
		const genders: ("male" | "female")[] = ["male", "female"];

		for (const gender of genders) {
			sheet.getCell(`A${currentRow}`).value =
				gender === "male" ? "LEADS" : "FOLLOWS";
			sheet.getCell(`A${currentRow}`).font = {
				bold: true,
				color: { argb: gender === "male" ? "FF1D4ED8" : "FFBE123C" },
			};
			currentRow++;

			// Data Headers
			const dataHeaders = [
				"Rank",
				"No.",
				"Name",
				scoreColumnLabel,
				"Result",
			];
			const dr = sheet.getRow(currentRow);
			dataHeaders.forEach((h, i) => {
				const c = dr.getCell(i + 1);
				c.value = h;
				c.font = { bold: true, size: 10 };
				c.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FFE5E7EB" },
				};
				c.alignment = { horizontal: "center" };
			});
			currentRow++;

			const rankings = calculateRankings(
				event,
				competitors,
				roundVotes,
				gender,
				roundId as RoundType,
				true,
			);

			rankings.forEach((comp, idx) => {
				const r = sheet.getRow(currentRow);
				const rank = idx + 1;
				const advances = useWeighted ? rank <= 6 : rank <= cutoff;

				r.getCell(1).value = rank;
				r.getCell(2).value = comp.number;
				r.getCell(3).value = comp.name;
				r.getCell(4).value = comp.voteCount;
				r.getCell(5).value = advances ? "ADVANCED" : "ELIMINATED";

				// Styling
				for (let col = 1; col <= 5; col++) {
					const c = r.getCell(col);
					c.alignment = { horizontal: "center" };
					if (col === 5) {
						c.font = {
							bold: true,
							color: { argb: advances ? "FF047857" : "FFB91C1C" },
						};
					}
				}
				currentRow++;
			});
			currentRow++; // Gap
		}
		currentRow += 2; // Gap between rounds
	}

	sheet.getColumn(1).width = 10;
	sheet.getColumn(2).width = 10;
	sheet.getColumn(3).width = 30;
	sheet.getColumn(4).width = 15;
	sheet.getColumn(5).width = 15;
}

/**
 * Export vote log to a beautifully styled Excel file
 */
export async function exportVoteLogExcel(
	event: Event,
	votes: Vote[],
): Promise<void> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = "Jack & Jill Competition";
	workbook.created = new Date();

	const sheet = workbook.addWorksheet("Vote Log", {
		views: [{ state: "frozen", xSplit: 0, ySplit: 5 }],
	});

	const { judges, competitors, name, date, venue } = event;
	const rounds = event.competitionConfig?.rounds || [];

	// Lookup maps
	const judgeMap = new Map(judges.map((j) => [j.id, j]));
	const compMap = new Map(competitors.map((c) => [c.id, c]));

	const formattedDate = new Date(date).toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	// Title banner
	sheet.mergeCells("A1:H1");
	const titleCell = sheet.getCell("A1");
	titleCell.value = `${name} - Vote Log`;
	titleCell.font = { size: 20, bold: true, color: { argb: "FFFFFFFF" } };
	titleCell.alignment = { horizontal: "center", vertical: "middle" };
	titleCell.fill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FF1F2937" },
	};
	sheet.getRow(1).height = 40;

	// Sub-header
	sheet.mergeCells("A2:H2");
	const subCell = sheet.getCell("A2");
	subCell.value = `📅 ${formattedDate}  |  📍 ${venue}  |  ${votes.length} vote submissions`;
	subCell.font = { size: 12, color: { argb: "FFFFFFFF" } };
	subCell.alignment = { horizontal: "center", vertical: "middle" };
	subCell.fill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FF374151" },
	};
	sheet.getRow(2).height = 25;

	// Stats row
	sheet.mergeCells("A3:H3");
	const statsCell = sheet.getCell("A3");
	const totalEntries = votes.reduce((sum, v) => sum + v.rankings.length, 0);
	const uniqueJudges = new Set(votes.map((v) => v.judgeId)).size;
	const uniqueRounds = new Set(votes.map((v) => v.round)).size;
	statsCell.value = `${totalEntries} entries  |  ${uniqueJudges} judges  |  ${uniqueRounds} rounds`;
	statsCell.font = { size: 11, italic: true, color: { argb: "FF9CA3AF" } };
	statsCell.alignment = { horizontal: "center", vertical: "middle" };
	sheet.getRow(3).height = 20;

	// Separator
	sheet.getRow(4).height = 8;

	// Headers
	const headers = [
		"Judge",
		"Heat",
		"Round",
		"Competitor",
		"No.",
		"Gender",
		"Rank / Score",
		"Submitted At",
	];
	const headerRow = sheet.getRow(5);
	headers.forEach((h, i) => {
		const cell = headerRow.getCell(i + 1);
		cell.value = h;
		cell.font = { bold: true, color: { argb: "FF1F2937" } };
		cell.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FF6366F1" },
		};
		cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
		cell.alignment = { horizontal: "center", vertical: "middle" };
		cell.border = {
			top: { style: "medium" },
			left: { style: "thin" },
			bottom: { style: "medium" },
			right: { style: "thin" },
		};
	});
	headerRow.height = 28;

	sheet.getColumn(1).width = 22; // Judge
	sheet.getColumn(2).width = 18; // Heat
	sheet.getColumn(3).width = 18; // Round
	sheet.getColumn(4).width = 25; // Competitor
	sheet.getColumn(5).width = 8; // No.
	sheet.getColumn(6).width = 12; // Gender
	sheet.getColumn(7).width = 14; // Rank/Score
	sheet.getColumn(8).width = 24; // Submitted At

	// Sort votes by round order, then judge, then heat
	const roundOrder = new Map(rounds.map((r, i) => [r.id, i]));
	const sortedVotes = [...votes].sort((a, b) => {
		const ra = roundOrder.get(a.round) ?? 999;
		const rb = roundOrder.get(b.round) ?? 999;
		if (ra !== rb) return ra - rb;
		if (a.judgeId !== b.judgeId) return a.judgeId.localeCompare(b.judgeId);
		return a.heatId.localeCompare(b.heatId);
	});

	let currentRow = 6;
	let prevRound = "";

	for (const vote of sortedVotes) {
		const judge = judgeMap.get(vote.judgeId);
		const judgeName = judge?.name || vote.judgeId;
		const roundConfig = rounds.find((r) => r.id === vote.round);
		const roundName = roundConfig?.name || vote.round;
		const submittedDate = new Date(vote.submittedAt);
		const formattedTime = submittedDate.toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});

		// Round separator row
		if (vote.round !== prevRound) {
			if (prevRound !== "") {
				currentRow++; // gap
			}
			const sepRow = sheet.getRow(currentRow);
			sheet.mergeCells(`A${currentRow}:H${currentRow}`);
			const sepCell = sepRow.getCell(1);
			sepCell.value = `▸ ${roundName.toUpperCase()}`;
			sepCell.font = {
				bold: true,
				size: 11,
				color: { argb: "FF4F46E5" },
			};
			sepCell.fill = {
				type: "pattern",
				pattern: "solid",
				fgColor: { argb: "FFEEF2FF" },
			};
			sepRow.height = 22;
			currentRow++;
			prevRound = vote.round;
		}

		for (const ranking of vote.rankings) {
			const comp = compMap.get(ranking.competitorId);
			const compName = comp?.name || ranking.competitorId;
			const compNumber = comp?.number || "-";
			const compGender =
				comp?.gender === "male"
					? "Lead"
					: comp?.gender === "female"
						? "Follow"
						: "-";

			// Format rank/score
			let rankDisplay: string;
			if (ranking.scores && Object.keys(ranking.scores).length > 0) {
				const total = Object.values(ranking.scores).reduce(
					(s, v) => s + (v || 0),
					0,
				);
				rankDisplay = `${total} pts`;
			} else {
				rankDisplay = `Rank ${ranking.rank}`;
			}

			const row = sheet.getRow(currentRow);
			row.getCell(1).value = judgeName;
			row.getCell(2).value = vote.heatId;
			row.getCell(3).value = roundName;
			row.getCell(4).value = compName;
			row.getCell(5).value = compNumber;
			row.getCell(6).value = compGender;
			row.getCell(7).value = rankDisplay;
			row.getCell(8).value = formattedTime;

			const rowIdx = currentRow - 6;
			for (let col = 1; col <= 8; col++) {
				const cell = row.getCell(col);
				cell.alignment = { horizontal: "center", vertical: "middle" };
				cell.border = {
					bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
					left: { style: "thin", color: { argb: "FFE5E7EB" } },
					right: { style: "thin", color: { argb: "FFE5E7EB" } },
				};

				// Gender coloring
				if (col === 6) {
					const isMale = comp?.gender === "male";
					cell.fill = {
						type: "pattern",
						pattern: "solid",
						fgColor: { argb: isMale ? "FFEFF6FF" : "FFFFF1F2" },
					};
					cell.font = {
						color: { argb: isMale ? "FF1D4ED8" : "FFBE123C" },
					};
				}
				// Zebra striping
				else if (rowIdx % 2 !== 0) {
					cell.fill = {
						type: "pattern",
						pattern: "solid",
						fgColor: { argb: "FFF9FAFB" },
					};
				}
			}

			currentRow++;
		}
	}

	const buffer = await workbook.xlsx.writeBuffer();
	downloadExcel(
		buffer,
		`${sanitizeFilename(name)}_vote_log_${new Date().toISOString().split("T")[0]}.xlsx`,
	);
}

/**
 * Load image using server-side GCS download (bypasses CORS completely)
 */
async function loadImageAsBuffer(url: string): Promise<Uint8Array | null> {
	if (!url || url.includes("placeholder")) return null;

	try {
		const gcsPath = extractGcsPath(url);
		if (!gcsPath) return null;

		const response = await fetch(
			`/api/download-image?path=${encodeURIComponent(gcsPath)}`,
		);
		if (!response.ok) return null;

		const arrayBuffer = await response.arrayBuffer();
		return new Uint8Array(arrayBuffer);
	} catch (error) {
		console.error("Error loading image:", error);
		return null;
	}
}

function extractGcsPath(url: string): string | null {
	try {
		const urlObj = new URL(url);
		if (urlObj.hostname === "storage.googleapis.com") {
			const pathParts = urlObj.pathname.split("/");
			pathParts.shift(); // Remove empty string
			pathParts.shift(); // Remove bucket name
			return pathParts.join("/");
		}
		return null;
	} catch {
		return null;
	}
}

function sanitizeFilename(filename: string): string {
	return filename.replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
}

function downloadExcel(buffer: ArrayBuffer, filename: string): void {
	const blob = new Blob([buffer], {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	});
	const link = document.createElement("a");
	if (link.download !== undefined) {
		const url = URL.createObjectURL(blob);
		link.setAttribute("href", url);
		link.setAttribute("download", filename);
		link.click();
		URL.revokeObjectURL(url);
	}
}
