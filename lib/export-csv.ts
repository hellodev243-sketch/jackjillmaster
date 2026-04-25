import type { Competitor, Judge, Event } from "./types";

/**
 * Converts competitors and judges data to HTML format with embedded images
 * Includes actual profile pictures, not just URLs
 */
export async function exportToHTML(event: Event): Promise<void> {
	const html = await generateHTML(event);
	downloadHTML(html, `${sanitizeFilename(event.name)}_export.html`);
}

/**
 * Generate HTML content with embedded images
 */
async function generateHTML(event: Event): Promise<string> {
	const { competitors, judges, name, date, venue } = event;

	// Convert images to base64
	const competitorsWithImages = await Promise.all(
		competitors.map(async (comp) => ({
			...comp,
			imageData: await loadImageAsBase64(comp.photoUrl),
		})),
	);

	const judgesWithImages = await Promise.all(
		judges.map(async (judge) => ({
			...judge,
			imageData: await loadImageAsBase64(judge.photoUrl),
		})),
	);

	const formattedDate = new Date(date).toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(name)} - Export</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            padding: 40px;
            background: #f8f9fa;
            color: #212529;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 3px solid #f59e0b;
        }
        .header h1 {
            font-size: 36px;
            color: #1f2937;
            margin-bottom: 12px;
        }
        .header .event-info {
            font-size: 18px;
            color: #6b7280;
            margin-top: 8px;
        }
        .header .event-info .date {
            font-weight: 600;
            color: #f59e0b;
        }
        .header .event-info .venue {
            color: #4b5563;
        }
        .section {
            margin-bottom: 50px;
        }
        .section-title {
            font-size: 28px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 24px;
            padding-bottom: 12px;
            border-bottom: 2px solid #e5e7eb;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 24px;
        }
        .card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 20px;
            background: #ffffff;
            transition: all 0.3s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateY(-2px);
        }
        .card-image {
            width: 100%;
            height: 280px;
            object-fit: cover;
            border-radius: 8px;
            margin-bottom: 16px;
            background: #f3f4f6;
        }
        .card-number {
            display: inline-block;
            background: #f59e0b;
            color: white;
            padding: 6px 14px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 16px;
            margin-bottom: 12px;
        }
        .card-name {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 8px;
        }
        .card-gender {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        .card-gender.male {
            background: #dbeafe;
            color: #1e40af;
        }
        .card-gender.female {
            background: #fce7f3;
            color: #be185d;
        }
        .card-stats {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #e5e7eb;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 14px;
        }
        .stat-label {
            color: #6b7280;
            font-weight: 500;
        }
        .stat-value {
            color: #1f2937;
            font-weight: 600;
        }
        .eliminated {
            background: #fee2e2;
            color: #991b1b;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
            margin-top: 8px;
        }
        .judge-token {
            background: #f3f4f6;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            margin-top: 8px;
            word-break: break-all;
        }
        .no-data {
            text-align: center;
            padding: 60px 20px;
            color: #9ca3af;
            font-size: 18px;
        }
        @media print {
            body {
                padding: 20px;
                background: white;
            }
            .container {
                box-shadow: none;
                padding: 20px;
            }
            .card {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${escapeHtml(name)}</h1>
            <div class="event-info">
                <div class="date">📅 ${formattedDate}</div>
                <div class="venue">📍 ${escapeHtml(venue)}</div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">🏆 Competitors (${
				competitors.length
			})</h2>
            ${
				competitors.length === 0
					? '<div class="no-data">No competitors registered</div>'
					: `<div class="grid">${competitorsWithImages
							.map(
								(comp) => `
                <div class="card">
                    <img src="${comp.imageData}" alt="${escapeHtml(
						comp.name,
					)}" class="card-image" />
                    <div class="card-number">#${comp.number}</div>
                    <div class="card-name">${escapeHtml(comp.name)}</div>
                    <span class="card-gender ${comp.gender}">${
						comp.gender === "male" ? "Male" : "Female"
					}</span>
                    ${
						comp.eliminated
							? '<div class="eliminated">Eliminated</div>'
							: ""
					}
                    <div class="card-stats">
                        <div class="stat-row">
                            <span class="stat-label">Total Votes:</span>
                            <span class="stat-value">${
								(comp.round1Votes || 0) +
								(comp.round2Votes || 0) +
								(comp.finalsPoints || 0)
							}</span>
                        </div>
                    </div>
                </div>
            `,
							)
							.join("")}</div>`
			}
        </div>

        <div class="section">
            <h2 class="section-title">⚖️ Judges (${judges.length})</h2>
            ${
				judges.length === 0
					? '<div class="no-data">No judges registered</div>'
					: `<div class="grid">${judgesWithImages
							.map(
								(judge) => `
                <div class="card">
                    <img src="${judge.imageData}" alt="${escapeHtml(
						judge.name,
					)}" class="card-image" />
                    <div class="card-name">${escapeHtml(judge.name)}</div>
                    <span class="card-gender ${judge.gender}">${
						judge.gender === "male" ? "Male" : "Female"
					}</span>
                    <div class="card-stats">
                        <div class="stat-row">
                            <span class="stat-label">PIN:</span>
                            <span class="stat-value">${
								judge.pin || "N/A"
							}</span>
                        </div>
                    </div>
                    <div class="judge-token">
                        <strong>Token:</strong><br>${escapeHtml(judge.token)}
                    </div>
                </div>
            `,
							)
							.join("")}</div>`
			}
        </div>
    </div>
</body>
</html>
    `.trim();
}

/**
 * Load image and convert to base64 data URL
 */
async function loadImageAsBase64(url: string): Promise<string> {
	if (!url || url.includes("placeholder")) {
		// Return a default placeholder image
		return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect fill='%23f3f4f6' width='400' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='48' fill='%239ca3af'%3ENo Photo%3C/text%3E%3C/svg%3E";
	}

	try {
		// Create a promise to load the image
		return await new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = "anonymous"; // Enable CORS

			img.onload = () => {
				try {
					const canvas = document.createElement("canvas");
					canvas.width = img.width;
					canvas.height = img.height;

					const ctx = canvas.getContext("2d");
					if (!ctx) {
						reject(new Error("Could not get canvas context"));
						return;
					}

					ctx.drawImage(img, 0, 0);
					const dataURL = canvas.toDataURL("image/jpeg", 0.8);
					resolve(dataURL);
				} catch (error) {
					console.error("Error converting image to base64:", error);
					resolve(getPlaceholderImage());
				}
			};

			img.onerror = () => {
				console.error("Failed to load image:", url);
				resolve(getPlaceholderImage());
			};

			// Add timestamp to bypass cache if needed
			img.src = url.includes("?")
				? `${url}&t=${Date.now()}`
				: `${url}?t=${Date.now()}`;
		});
	} catch (error) {
		console.error("Error loading image:", error);
		return getPlaceholderImage();
	}
}

/**
 * Get placeholder image as data URL
 */
function getPlaceholderImage(): string {
	return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect fill='%23f3f4f6' width='400' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='48' fill='%239ca3af'%3ENo Photo%3C/text%3E%3C/svg%3E";
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Sanitize filename to remove invalid characters
 */
function sanitizeFilename(filename: string): string {
	return filename
		.replace(/[^a-z0-9_\-]/gi, "_")
		.replace(/_+/g, "_")
		.toLowerCase();
}

/**
 * Download HTML content as a file
 */
function downloadHTML(content: string, filename: string): void {
	const blob = new Blob([content], { type: "text/html;charset=utf-8;" });
	const link = document.createElement("a");

	if (link.download !== undefined) {
		const url = URL.createObjectURL(blob);
		link.setAttribute("href", url);
		link.setAttribute("download", filename);
		link.style.visibility = "hidden";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
}

/**
 * Legacy CSV export function (kept for backward compatibility)
 */
export function exportToCSV(
	competitors: Competitor[],
	judges: Judge[],
	eventName: string,
): void {
	// Prepare competitors CSV
	const competitorsCSV = generateCompetitorsCSV(competitors);
	const judgesCSV = generateJudgesCSV(judges);

	// Combine both CSVs with a separator
	const combinedCSV = `Event: ${eventName}\n\n=== COMPETITORS ===\n${competitorsCSV}\n\n=== JUDGES ===\n${judgesCSV}`;

	// Create and download the file
	downloadCSV(combinedCSV, `${sanitizeFilename(eventName)}_export.csv`);
}

/**
 * Generate CSV content for competitors
 */
function generateCompetitorsCSV(competitors: Competitor[]): string {
	if (competitors.length === 0) {
		return "No competitors registered";
	}

	// CSV Headers
	const headers = [
		"Number",
		"Name",
		"Gender",
		"Photo URL",
		"Total Votes",
		"Eliminated",
	];

	// CSV Rows
	const rows = competitors.map((comp) => [
		comp.number.toString(),
		escapeCSVField(comp.name),
		comp.gender === "male" ? "Male" : "Female",
		escapeCSVField(comp.photoUrl || ""),
		(
			(comp.round1Votes || 0) +
			(comp.round2Votes || 0) +
			(comp.finalsPoints || 0)
		).toString(),
		comp.eliminated ? "Yes" : "No",
	]);

	// Combine headers and rows
	return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

/**
 * Generate CSV content for judges
 */
function generateJudgesCSV(judges: Judge[]): string {
	if (judges.length === 0) {
		return "No judges registered";
	}

	// CSV Headers
	const headers = ["Name", "Gender", "Photo URL", "Token", "PIN"];

	// CSV Rows
	const rows = judges.map((judge) => [
		escapeCSVField(judge.name),
		judge.gender === "male" ? "Male" : "Female",
		escapeCSVField(judge.photoUrl || ""),
		escapeCSVField(judge.token),
		escapeCSVField(judge.pin || "N/A"),
	]);

	// Combine headers and rows
	return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

/**
 * Escape CSV field to handle commas, quotes, and newlines
 */
function escapeCSVField(field: string): string {
	if (!field) return '""';

	// If field contains comma, quote, or newline, wrap in quotes and escape quotes
	if (field.includes(",") || field.includes('"') || field.includes("\n")) {
		return `"${field.replace(/"/g, '""')}"`;
	}

	return field;
}

/**
 * Download CSV content as a file
 */
function downloadCSV(content: string, filename: string): void {
	const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
	const link = document.createElement("a");

	if (link.download !== undefined) {
		const url = URL.createObjectURL(blob);
		link.setAttribute("href", url);
		link.setAttribute("download", filename);
		link.style.visibility = "hidden";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
}
