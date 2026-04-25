// Google Cloud Storage configuration for jack_jill_data bucket
// Bucket name: jack_jill_data

export const GCS_BUCKET_NAME = "jack_jill_data";
export const GCS_BASE_URL = `https://storage.googleapis.com/${GCS_BUCKET_NAME}`;

/**
 * GCS Folder Tree Structure:
 *
 * jack_jill_data/
 * ├── admin/
 * │   └── admin.json                 # Admin credentials (email + bcrypt hashed password)
 * │
 * ├── events/
 * │   └── {event_id}/
 * │       ├── metadata.json          # Event info (name, date, venue, status)
 * │       ├── competitors/
 * │       │   ├── index.json         # All competitors list
 * │       │   └── photos/
 * │       │       ├── {competitor_id}.jpg
 * │       │       └── ...
 * │       ├── judges/
 * │       │   ├── index.json         # All judges list (with hashed PINs)
 * │       │   └── photos/
 * │       │       ├── {judge_id}.jpg
 * │       │       └── ...
 * │       ├── rounds/
 * │       │   ├── round1/
 * │       │   │   ├── heats.json     # Heat pairings
 * │       │   │   ├── votes.json     # All votes for this round
 * │       │   │   └── results.json   # Rankings after round
 * │       │   ├── round2/
 * │       │   │   ├── heats.json
 * │       │   │   ├── votes.json
 * │       │   │   └── results.json
 * │       │   └── finals/
 * │       │       ├── heats.json
 * │       │       ├── votes.json
 * │       │       └── results.json
 * │       └── exports/
 * │           ├── final_results.pdf
 * │           ├── full_report.json
 * │           └── certificates/
 * │               ├── winner_male.pdf
 * │               └── winner_female.pdf
 * │
 * ├── archives/
 * │   └── {year}/
 * │       └── {event_id}/            # Completed events moved here
 * │           └── ... (same structure as events)
 * │
 * └── templates/
 *     ├── certificate_template.pdf
 *     ├── results_template.pdf
 *     └── default_photos/
 *         ├── male_placeholder.jpg
 *         └── female_placeholder.jpg
 */

// Path builders for GCS
export const GCS_PATHS = {
	// Admin paths (legacy single admin)
	adminCredentials: () => `admin/admin.json`,

	// Multi-admin paths
	adminsIndex: () => `admins/index.json`,
	adminProfile: (adminId: string) => `admins/${adminId}/profile.json`,
	passwordResetTokens: () => `admins/password-reset-tokens.json`,

	// Event paths
	eventMetadata: (eventId: string) => `events/${eventId}/metadata.json`,

	// Competitor paths
	competitorsIndex: (eventId: string) =>
		`events/${eventId}/competitors/index.json`,
	competitorPhoto: (eventId: string, competitorId: string) =>
		`events/${eventId}/competitors/photos/${competitorId}.jpg`,

	// Judge paths
	judgesIndex: (eventId: string) => `events/${eventId}/judges/index.json`,
	judgePhoto: (eventId: string, judgeId: string) =>
		`events/${eventId}/judges/photos/${judgeId}.jpg`,

	// Comp Assistant paths
	compAssistantPhoto: (eventId: string, compAssistantId: string) =>
		`events/${eventId}/comp-assistants/photos/${compAssistantId}.jpg`,

	// Round paths
	roundHeats: (eventId: string, round: string) =>
		`events/${eventId}/rounds/${round}/heats.json`,
	roundVotes: (eventId: string, round: string) =>
		`events/${eventId}/rounds/${round}/votes.json`,
	roundResults: (eventId: string, round: string) =>
		`events/${eventId}/rounds/${round}/results.json`,

	// Export paths
	finalResults: (eventId: string) =>
		`events/${eventId}/exports/final_results.pdf`,
	fullReport: (eventId: string) =>
		`events/${eventId}/exports/full_report.json`,
	certificate: (eventId: string, type: string) =>
		`events/${eventId}/exports/certificates/${type}.pdf`,

	// Archive paths
	archive: (year: string, eventId: string) => `archives/${year}/${eventId}`,

	// Template paths
	certificateTemplate: () => `templates/certificate_template.pdf`,
	defaultPhoto: (gender: string) =>
		`templates/default_photos/${gender}_placeholder.jpg`,
};

// Helper to get full GCS URL
export const getGcsUrl = (path: string): string => {
	return `${GCS_BASE_URL}/${path}`;
};

// Signed URL expiration times (in seconds)
export const SIGNED_URL_EXPIRY = {
	photo: 604800, // 7 days for photos (was 1 hour)
	download: 300, // 5 minutes for downloads
	upload: 600, // 10 minutes for uploads
};
