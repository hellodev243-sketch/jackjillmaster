// GCS Client for server-side operations with real @google-cloud/storage
import { Storage } from "@google-cloud/storage";
import { GCS_BUCKET_NAME, GCS_PATHS, SIGNED_URL_EXPIRY } from "./gcs-config";
import path from "path";
import fs from "fs";

// Types for GCS operations
interface UploadOptions {
	contentType?: string;
	metadata?: Record<string, string>;
}

interface SignedUrlOptions {
	action: "read" | "write";
	expiresIn?: number;
	contentType?: string;
}

// Initialize storage with service account or default credentials
function initStorage(): Storage {
	const projectId = process.env.GOOGLE_CLOUD_PROJECT || "jackjill-481622";
	const keyFilePath = path.resolve(process.cwd(), "gcs_key.json");

	// Check if key file exists (local development)
	if (fs.existsSync(keyFilePath)) {
		console.log("[GCS] Using service account key file");
		return new Storage({
			projectId,
			keyFilename: keyFilePath,
		});
	}

	// Check for GCS_KEY_JSON environment variable (Railway, Cloud Run, etc.)
	if (process.env.GCS_KEY_JSON) {
		try {
			console.log("[GCS] Using GCS_KEY_JSON environment variable");
			const credentials = JSON.parse(process.env.GCS_KEY_JSON);
			return new Storage({
				projectId,
				credentials,
			});
		} catch (error) {
			console.error("[GCS] Failed to parse GCS_KEY_JSON:", error);
		}
	}

	// Use default credentials (Cloud Run, GCE, etc.)
	console.log("[GCS] Using default credentials");
	return new Storage({ projectId });
}

const storage = initStorage();
const bucket = storage.bucket(GCS_BUCKET_NAME);

class GCSClient {
	private bucketName: string;

	constructor(bucketName: string) {
		this.bucketName = bucketName;
	}

	// Upload JSON data
	async uploadJson(filePath: string, data: unknown): Promise<string> {
		try {
			const file = bucket.file(filePath);
			await file.save(JSON.stringify(data, null, 2), {
				contentType: "application/json",
				metadata: {
					cacheControl: "no-cache",
				},
			});
			console.log(
				`[GCS] Uploaded JSON to: ${this.bucketName}/${filePath}`
			);
			return `https://storage.googleapis.com/${this.bucketName}/${filePath}`;
		} catch (error) {
			console.error(`[GCS] Error uploading JSON to ${filePath}:`, error);
			throw error;
		}
	}

	// Upload file (binary)
	async uploadFile(
		filePath: string,
		buffer: Buffer,
		options?: UploadOptions
	): Promise<string> {
		try {
			const file = bucket.file(filePath);
			await file.save(buffer, {
				contentType: options?.contentType || "application/octet-stream",
				metadata: options?.metadata,
			});
			console.log(
				`[GCS] Uploaded file to: ${this.bucketName}/${filePath}`
			);
			return `https://storage.googleapis.com/${this.bucketName}/${filePath}`;
		} catch (error) {
			console.error(`[GCS] Error uploading file to ${filePath}:`, error);
			throw error;
		}
	}

	// Download JSON data
	async downloadJson<T>(filePath: string): Promise<T | null> {
		try {
			const file = bucket.file(filePath);
			const [exists] = await file.exists();
			if (!exists) {
				console.log(`[GCS] File not found: ${filePath}`);
				return null;
			}
			const [content] = await file.download();
			return JSON.parse(content.toString()) as T;
		} catch (error) {
			console.error(
				`[GCS] Error downloading JSON from ${filePath}:`,
				error
			);
			return null;
		}
	}

	// Download file as buffer
	async downloadFile(filePath: string): Promise<Buffer | null> {
		try {
			const file = bucket.file(filePath);
			const [exists] = await file.exists();
			if (!exists) return null;
			const [content] = await file.download();
			return content;
		} catch (error) {
			console.error(
				`[GCS] Error downloading file from ${filePath}:`,
				error
			);
			return null;
		}
	}

	// Generate signed URL for secure access
	async getSignedUrl(
		filePath: string,
		options: SignedUrlOptions
	): Promise<string> {
		try {
			const expiry = options.expiresIn || SIGNED_URL_EXPIRY.photo;
			const file = bucket.file(filePath);

			const [url] = await file.getSignedUrl({
				version: "v4",
				action: options.action,
				expires: Date.now() + expiry * 1000,
				contentType: options.contentType,
			});

			console.log(`[GCS] Generated signed URL for: ${filePath}`);
			return url;
		} catch (error) {
			console.error(
				`[GCS] Error generating signed URL for ${filePath}:`,
				error
			);
			throw error;
		}
	}

	// Delete file
	async deleteFile(filePath: string): Promise<boolean> {
		try {
			const file = bucket.file(filePath);
			const [exists] = await file.exists();
			if (!exists) return false;
			await file.delete();
			console.log(`[GCS] Deleted file: ${this.bucketName}/${filePath}`);
			return true;
		} catch (error) {
			console.error(`[GCS] Error deleting file ${filePath}:`, error);
			return false;
		}
	}

	// List files in a path
	async listFiles(prefix: string): Promise<string[]> {
		try {
			const [files] = await bucket.getFiles({ prefix });
			return files.map((f) => f.name);
		} catch (error) {
			console.error(
				`[GCS] Error listing files with prefix ${prefix}:`,
				error
			);
			return [];
		}
	}

	// Check if file exists
	async exists(filePath: string): Promise<boolean> {
		try {
			const file = bucket.file(filePath);
			const [exists] = await file.exists();
			return exists;
		} catch (error) {
			console.error(
				`[GCS] Error checking existence of ${filePath}:`,
				error
			);
			return false;
		}
	}

	// Delete all files with prefix (for cleanup)
	async deletePrefix(prefix: string): Promise<number> {
		try {
			const files = await this.listFiles(prefix);
			let deleted = 0;
			for (const filePath of files) {
				await this.deleteFile(filePath);
				deleted++;
			}
			console.log(
				`[GCS] Deleted ${deleted} files with prefix: ${prefix}`
			);
			return deleted;
		} catch (error) {
			console.error(`[GCS] Error deleting prefix ${prefix}:`, error);
			return 0;
		}
	}
}

// Export singleton instance
export const gcsClient = new GCSClient(GCS_BUCKET_NAME);

// Helper functions for common operations
export const gcsHelpers = {
	// Admin operations (legacy single admin)
	getAdminCredentials: async () => {
		return gcsClient.downloadJson<{ email: string; passwordHash: string }>(
			GCS_PATHS.adminCredentials()
		);
	},

	saveAdminCredentials: async (credentials: {
		email: string;
		passwordHash: string;
	}) => {
		return gcsClient.uploadJson(GCS_PATHS.adminCredentials(), credentials);
	},

	// Multi-admin operations
	getAdminsIndex: async () => {
		const data = await gcsClient.downloadJson<any[]>(GCS_PATHS.adminsIndex());
		return data || [];
	},

	saveAdminsIndex: async (admins: any[]) => {
		return gcsClient.uploadJson(GCS_PATHS.adminsIndex(), admins);
	},

	getAdminProfile: async (adminId: string) => {
		return gcsClient.downloadJson<any>(GCS_PATHS.adminProfile(adminId));
	},

	saveAdminProfile: async (adminId: string, profile: any) => {
		return gcsClient.uploadJson(GCS_PATHS.adminProfile(adminId), profile);
	},

	getPasswordResetTokens: async () => {
		const data = await gcsClient.downloadJson<any[]>(
			GCS_PATHS.passwordResetTokens()
		);
		return data || [];
	},

	savePasswordResetTokens: async (tokens: any[]) => {
		return gcsClient.uploadJson(GCS_PATHS.passwordResetTokens(), tokens);
	},

	// Event metadata
	getEventMetadata: async (eventId: string) => {
		return gcsClient.downloadJson(GCS_PATHS.eventMetadata(eventId));
	},

	saveEventMetadata: async (eventId: string, metadata: unknown) => {
		return gcsClient.uploadJson(GCS_PATHS.eventMetadata(eventId), metadata);
	},

	// Competitors
	getCompetitors: async (eventId: string) => {
		return gcsClient.downloadJson<unknown[]>(
			GCS_PATHS.competitorsIndex(eventId)
		);
	},

	saveCompetitors: async (eventId: string, competitors: unknown[]) => {
		return gcsClient.uploadJson(
			GCS_PATHS.competitorsIndex(eventId),
			competitors
		);
	},

	// Judges
	getJudges: async (eventId: string) => {
		return gcsClient.downloadJson<unknown[]>(
			GCS_PATHS.judgesIndex(eventId)
		);
	},

	saveJudges: async (eventId: string, judges: unknown[]) => {
		return gcsClient.uploadJson(GCS_PATHS.judgesIndex(eventId), judges);
	},

	// Round data
	getRoundData: async (
		eventId: string,
		round: string,
		type: "heats" | "votes" | "results"
	) => {
		const pathFn = {
			heats: GCS_PATHS.roundHeats,
			votes: GCS_PATHS.roundVotes,
			results: GCS_PATHS.roundResults,
		}[type];
		return gcsClient.downloadJson(pathFn(eventId, round));
	},

	saveRoundData: async (
		eventId: string,
		round: string,
		type: "heats" | "votes" | "results",
		data: unknown
	) => {
		const pathFn = {
			heats: GCS_PATHS.roundHeats,
			votes: GCS_PATHS.roundVotes,
			results: GCS_PATHS.roundResults,
		}[type];
		return gcsClient.uploadJson(pathFn(eventId, round), data);
	},

	// Photo operations
	uploadCompetitorPhoto: async (
		eventId: string,
		competitorId: string,
		buffer: Buffer,
		contentType: string
	) => {
		const ext = contentType.includes("png") ? "png" : "jpg";
		const filePath = GCS_PATHS.competitorPhoto(
			eventId,
			competitorId
		).replace(".jpg", `.${ext}`);
		return gcsClient.uploadFile(filePath, buffer, { contentType });
	},

	deleteCompetitorPhoto: async (eventId: string, competitorId: string) => {
		// Try both jpg and png
		const jpgPath = GCS_PATHS.competitorPhoto(eventId, competitorId);
		const pngPath = jpgPath.replace(".jpg", ".png");
		await gcsClient.deleteFile(jpgPath);
		await gcsClient.deleteFile(pngPath);
	},

	getCompetitorPhotoUrl: async (eventId: string, competitorId: string) => {
		const jpgPath = GCS_PATHS.competitorPhoto(eventId, competitorId);
		const pngPath = jpgPath.replace(".jpg", ".png");

		if (await gcsClient.exists(jpgPath)) {
			return gcsClient.getSignedUrl(jpgPath, {
				action: "read",
				expiresIn: SIGNED_URL_EXPIRY.photo,
			});
		}
		if (await gcsClient.exists(pngPath)) {
			return gcsClient.getSignedUrl(pngPath, {
				action: "read",
				expiresIn: SIGNED_URL_EXPIRY.photo,
			});
		}
		return null;
	},

	// Comp Assistant photo operations
	uploadCompAssistantPhoto: async (
		eventId: string,
		compAssistantId: string,
		buffer: Buffer,
		contentType: string
	) => {
		const ext = contentType.includes("png") ? "png" : "jpg";
		const filePath = GCS_PATHS.compAssistantPhoto(
			eventId,
			compAssistantId
		).replace(".jpg", `.${ext}`);
		return gcsClient.uploadFile(filePath, buffer, { contentType });
	},

	deleteCompAssistantPhoto: async (
		eventId: string,
		compAssistantId: string
	) => {
		// Try both jpg and png
		const jpgPath = GCS_PATHS.compAssistantPhoto(eventId, compAssistantId);
		const pngPath = jpgPath.replace(".jpg", ".png");
		await gcsClient.deleteFile(jpgPath);
		await gcsClient.deleteFile(pngPath);
	},

	getCompAssistantPhotoUrl: async (
		eventId: string,
		compAssistantId: string
	) => {
		const jpgPath = GCS_PATHS.compAssistantPhoto(eventId, compAssistantId);
		const pngPath = jpgPath.replace(".jpg", ".png");

		if (await gcsClient.exists(jpgPath)) {
			return gcsClient.getSignedUrl(jpgPath, {
				action: "read",
				expiresIn: SIGNED_URL_EXPIRY.photo,
			});
		}
		if (await gcsClient.exists(pngPath)) {
			return gcsClient.getSignedUrl(pngPath, {
				action: "read",
				expiresIn: SIGNED_URL_EXPIRY.photo,
			});
		}
		return null;
	},

	// Get photo upload signed URL
	getPhotoUploadUrl: async (
		eventId: string,
		type: "competitor" | "judge",
		id: string,
		contentType: string
	) => {
		const ext = contentType.includes("png") ? "png" : "jpg";
		const basePath =
			type === "competitor"
				? GCS_PATHS.competitorPhoto(eventId, id)
				: GCS_PATHS.judgePhoto(eventId, id);
		const filePath = basePath.replace(".jpg", `.${ext}`);
		return gcsClient.getSignedUrl(filePath, {
			action: "write",
			expiresIn: SIGNED_URL_EXPIRY.upload,
			contentType,
		});
	},

	// Delete all event data
	deleteEventData: async (eventId: string) => {
		return gcsClient.deletePrefix(`events/${eventId}/`);
	},

	// Delete all sample data
	deleteAllSampleData: async () => {
		const deleted = await gcsClient.deletePrefix("events/");
		return deleted;
	},

	// List all events
	listEvents: async () => {
		try {
			const files = await gcsClient.listFiles("events/");
			// Find all metadata.json files
			const metadataFiles = files.filter((f) =>
				f.endsWith("/metadata.json")
			);
			const events = [];
			for (const file of metadataFiles) {
				const event = await gcsClient.downloadJson(file);
				if (event) events.push(event);
			}
			return events;
		} catch (error) {
			console.error("[GCS] Error listing events:", error);
			return [];
		}
	},
};
