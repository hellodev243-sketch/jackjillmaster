import ExcelJS from "exceljs";

/**
 * Generate and download a styled XLSX import template for competitors
 */
export async function downloadCompetitorTemplate(): Promise<void> {
	const wb = new ExcelJS.Workbook();
	wb.creator = "Jack & Jill Competition System";
	wb.created = new Date();

	const ws = wb.addWorksheet("Competitors", {
		properties: { defaultColWidth: 22 },
	});

	// ── Row 1: Warning line ──
	ws.mergeCells("A1:C1");
	const warningCell = ws.getCell("A1");
	warningCell.value =
		"DO NOT REMOVE THIS LINE. Removing this will break J&J auto matching for this template.";
	warningCell.font = { bold: true, color: { argb: "FFFF0000" }, size: 11 };
	warningCell.fill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FFFFF0F0" },
	};
	warningCell.alignment = { vertical: "middle", wrapText: true };
	ws.getRow(1).height = 28;

	// ── Row 2: Info line ──
	ws.mergeCells("A2:C2");
	const infoCell = ws.getCell("A2");
	infoCell.value =
		"If removed, the column headers will not automatically match when imported into your event.";
	infoCell.font = { italic: true, color: { argb: "FFCC0000" }, size: 10 };
	infoCell.fill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FFFFF8F0" },
	};
	infoCell.alignment = { vertical: "middle", wrapText: true };
	ws.getRow(2).height = 24;

	// ── Row 3: Column headers ──
	const headerRow = ws.getRow(3);
	const headers = ["Name", "Gender"];
	headers.forEach((h, i) => {
		const cell = headerRow.getCell(i + 1);
		cell.value = h;
		cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
		cell.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FF1A1A2E" },
		};
		cell.alignment = { horizontal: "center", vertical: "middle" };
		cell.border = {
			bottom: { style: "medium", color: { argb: "FFFF8C00" } },
		};
	});
	headerRow.height = 26;

	// ── Sample rows ──
	const samples = [
		["John Smith", "male"],
		["Jane Doe", "female"],
		["", ""],
	];
	samples.forEach((row, ri) => {
		const r = ws.getRow(4 + ri);
		row.forEach((val, ci) => {
			const cell = r.getCell(ci + 1);
			cell.value = val;
			cell.font = {
				color: { argb: val ? "FF333333" : "FFAAAAAA" },
				italic: !val,
				size: 10,
			};
			cell.alignment = { horizontal: "center", vertical: "middle" };
			if (ri % 2 === 0) {
				cell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FFF9F9F9" },
				};
			}
		});
		r.height = 22;
	});

	// Column widths
	ws.getColumn(1).width = 30;
	ws.getColumn(2).width = 15;

	// Add data validation for Gender column
	for (let i = 4; i <= 103; i++) {
		ws.getCell(`B${i}`).dataValidation = {
			type: "list",
			allowBlank: true,
			formulae: ['"male,female"'],
			showErrorMessage: true,
			errorTitle: "Invalid Gender",
			error: 'Please enter "male" or "female"',
		};
	}

	const buffer = await wb.xlsx.writeBuffer();
	downloadFile(
		buffer as ArrayBuffer,
		"JJ_Competitors_Template.xlsx",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	);
}

/**
 * Generate and download a styled XLSX import template for judges
 */
export async function downloadJudgeTemplate(): Promise<void> {
	const wb = new ExcelJS.Workbook();
	wb.creator = "Jack & Jill Competition System";
	wb.created = new Date();

	const ws = wb.addWorksheet("Judges", {
		properties: { defaultColWidth: 22 },
	});

	// ── Row 1: Warning line ──
	ws.mergeCells("A1:C1");
	const warningCell = ws.getCell("A1");
	warningCell.value =
		"DO NOT REMOVE THIS LINE. Removing this will break J&J auto matching for this template.";
	warningCell.font = { bold: true, color: { argb: "FFFF0000" }, size: 11 };
	warningCell.fill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FFFFF0F0" },
	};
	warningCell.alignment = { vertical: "middle", wrapText: true };
	ws.getRow(1).height = 28;

	// ── Row 2: Info line ──
	ws.mergeCells("A2:C2");
	const infoCell = ws.getCell("A2");
	infoCell.value =
		"If removed, the column headers will not automatically match when imported into your event.";
	infoCell.font = { italic: true, color: { argb: "FFCC0000" }, size: 10 };
	infoCell.fill = {
		type: "pattern",
		pattern: "solid",
		fgColor: { argb: "FFFFF8F0" },
	};
	infoCell.alignment = { vertical: "middle", wrapText: true };
	ws.getRow(2).height = 24;

	// ── Row 3: Column headers ──
	const headerRow = ws.getRow(3);
	const headers = ["Name", "Gender", "PIN (optional)"];
	headers.forEach((h, i) => {
		const cell = headerRow.getCell(i + 1);
		cell.value = h;
		cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
		cell.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FF1A1A2E" },
		};
		cell.alignment = { horizontal: "center", vertical: "middle" };
		cell.border = {
			bottom: { style: "medium", color: { argb: "FFFF8C00" } },
		};
	});
	headerRow.height = 26;

	// ── Sample rows ──
	const samples = [
		["Alex Johnson", "male", "1234"],
		["Maria Garcia", "female", ""],
		["", "", ""],
	];
	samples.forEach((row, ri) => {
		const r = ws.getRow(4 + ri);
		row.forEach((val, ci) => {
			const cell = r.getCell(ci + 1);
			cell.value = val;
			cell.font = {
				color: { argb: val ? "FF333333" : "FFAAAAAA" },
				italic: !val,
				size: 10,
			};
			cell.alignment = { horizontal: "center", vertical: "middle" };
			if (ri % 2 === 0) {
				cell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FFF9F9F9" },
				};
			}
		});
		r.height = 22;
	});

	// Column widths
	ws.getColumn(1).width = 30;
	ws.getColumn(2).width = 15;
	ws.getColumn(3).width = 18;

	// Add data validation for Gender column
	for (let i = 4; i <= 103; i++) {
		ws.getCell(`B${i}`).dataValidation = {
			type: "list",
			allowBlank: true,
			formulae: ['"male,female"'],
			showErrorMessage: true,
			errorTitle: "Invalid Gender",
			error: 'Please enter "male" or "female"',
		};
	}

	const buffer = await wb.xlsx.writeBuffer();
	downloadFile(
		buffer as ArrayBuffer,
		"JJ_Judges_Template.xlsx",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	);
}

/**
 * Parse an XLSX file for competitor import.
 * Expects the template format: Row 1 = warning, Row 2 = info, Row 3 = headers, Row 4+ = data.
 * Also supports plain XLSX with headers in Row 1.
 */
export async function parseCompetitorXlsx(
	file: File,
): Promise<{ number?: number; name: string; gender: "male" | "female" }[]> {
	const wb = new ExcelJS.Workbook();
	const buffer = await file.arrayBuffer();
	await wb.xlsx.load(buffer);

	const ws = wb.worksheets[0];
	if (!ws) throw new Error("No worksheet found");

	const data: { number?: number; name: string; gender: "male" | "female" }[] =
		[];

	// Detect if row 1 is the template warning line
	const firstCellValue = String(ws.getCell("A1").value || "").trim();
	const isTemplate = firstCellValue.toUpperCase().startsWith("DO NOT REMOVE");
	const dataStartRow = isTemplate ? 4 : 2; // skip warning+info+header or just header

	ws.eachRow((row, rowNumber) => {
		if (rowNumber < dataStartRow) return;

		const values = row.values as (string | number | null)[];
		// ExcelJS row.values is 1-indexed (index 0 is empty)
		const col1 = String(values[1] || "").trim();
		const col2 = String(values[2] || "")
			.trim()
			.toLowerCase();
		const col3 = values[3] != null ? String(values[3]).trim() : undefined;

		if (!col1) return;

		// Check if col1 is a number (number,name,gender format)
		const isNumber = /^\d+$/.test(col1);
		if (isNumber && col3) {
			const gender = col3.toLowerCase();
			if (gender === "male" || gender === "female") {
				data.push({
					number: parseInt(col1, 10),
					name: String(values[2] || "").trim(),
					gender,
				});
			}
		} else if (col2 === "male" || col2 === "female") {
			data.push({ name: col1, gender: col2 });
		}
	});

	return data;
}

/**
 * Parse an XLSX file for judge import.
 * Expects the template format: Row 1 = warning, Row 2 = info, Row 3 = headers, Row 4+ = data.
 * Also supports plain XLSX with headers in Row 1.
 */
export async function parseJudgeXlsx(
	file: File,
): Promise<{ name: string; gender: "male" | "female"; pin?: string }[]> {
	const wb = new ExcelJS.Workbook();
	const buffer = await file.arrayBuffer();
	await wb.xlsx.load(buffer);

	const ws = wb.worksheets[0];
	if (!ws) throw new Error("No worksheet found");

	const data: { name: string; gender: "male" | "female"; pin?: string }[] =
		[];

	const firstCellValue = String(ws.getCell("A1").value || "").trim();
	const isTemplate = firstCellValue.toUpperCase().startsWith("DO NOT REMOVE");
	const dataStartRow = isTemplate ? 4 : 2;

	ws.eachRow((row, rowNumber) => {
		if (rowNumber < dataStartRow) return;

		const values = row.values as (string | number | null)[];
		const name = String(values[1] || "").trim();
		const gender = String(values[2] || "")
			.trim()
			.toLowerCase();
		const pin = values[3] != null ? String(values[3]).trim() : undefined;

		if (!name) return;
		if (gender === "male" || gender === "female") {
			data.push({ name, gender, pin: pin || undefined });
		}
	});

	return data;
}

function downloadFile(
	buffer: ArrayBuffer,
	filename: string,
	mimeType: string,
): void {
	const blob = new Blob([buffer], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
