// Email service using Resend
import { Resend } from "resend";

// Initialize Resend only if API key is available (not during build)
const resend = process.env.RESEND_API_KEY
	? new Resend(process.env.RESEND_API_KEY)
	: null;

const ADMIN_EMAIL = "info@ericlalta.com";
const FROM_EMAIL =
	process.env.RESEND_FROM_EMAIL || "noreply@jacknjillsoftware.com";
const FROM_NAME = process.env.RESEND_FROM_NAME || "Jack&Jill Events";

// Store verification codes in memory (using globalThis to persist across hot reloads)
const globalForVerification = globalThis as unknown as {
	verificationCodes: Map<
		string,
		{ code: string; expiresAt: number; verified: boolean }
	>;
};

if (!globalForVerification.verificationCodes) {
	globalForVerification.verificationCodes = new Map();
}

const verificationCodes = globalForVerification.verificationCodes;

export function generateVerificationCode(): string {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

export function storeVerificationCode(email: string, code: string): void {
	const expiresAt = Date.now() + 1 * 60 * 1000; // 1 minute
	verificationCodes.set(email.toLowerCase(), {
		code,
		expiresAt,
		verified: false,
	});
}

export function verifyCode(
	email: string,
	code: string,
): { valid: boolean; error?: string } {
	const stored = verificationCodes.get(email.toLowerCase());

	if (!stored) {
		return {
			valid: false,
			error: "No verification code found. Please request a new code.",
		};
	}

	if (Date.now() > stored.expiresAt) {
		verificationCodes.delete(email.toLowerCase());
		return {
			valid: false,
			error: "Verification code has expired. Please request a new code.",
		};
	}

	if (stored.code !== code) {
		return {
			valid: false,
			error: "Invalid verification code. Please try again.",
		};
	}

	// Mark as verified
	stored.verified = true;
	verificationCodes.set(email.toLowerCase(), stored);
	return { valid: true };
}

export function isEmailVerified(email: string): boolean {
	const stored = verificationCodes.get(email.toLowerCase());
	return stored?.verified === true && Date.now() <= stored.expiresAt;
}

export function clearVerification(email: string): void {
	verificationCodes.delete(email.toLowerCase());
}

// Send verification code email
export async function sendVerificationEmail(
	email: string,
	code: string,
): Promise<{ success: boolean; error?: string }> {
	if (!resend) {
		console.error("[Email] Resend not initialized - API key missing");
		return { success: false, error: "Email service not configured" };
	}

	// Retry up to 3 times with exponential backoff
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const { error } = await resend.emails.send({
				from: `${FROM_NAME} <${FROM_EMAIL}>`,
				to: email,
				subject: "Your Verification Code - Jack & Jill Competition",
				html: getVerificationEmailTemplate(code),
			});

			if (error) {
				console.error(
					`[Email] Verification email error (attempt ${attempt}/3):`,
					error,
				);
				if (attempt < 3) {
					await new Promise((r) => setTimeout(r, 1000 * attempt));
					continue;
				}
				return { success: false, error: error.message };
			}

			return { success: true };
		} catch (err) {
			console.error(
				`[Email] Failed to send verification email (attempt ${attempt}/3):`,
				err,
			);
			if (attempt < 3) {
				await new Promise((r) => setTimeout(r, 1000 * attempt));
				continue;
			}
			return {
				success: false,
				error: "Failed to send verification email",
			};
		}
	}
	return { success: false, error: "Failed after 3 attempts" };
}

// Send registration confirmation to competitor
export async function sendCompetitorConfirmationEmail(
	email: string,
	competitorName: string,
	competitorNumber: number,
	role: string,
	eventName: string,
	eventDate: string,
	eventVenue: string,
	eventId?: string,
	gender?: string,
	photoUrl?: string,
): Promise<{ success: boolean; error?: string }> {
	if (!resend) {
		console.error("[Email] Resend not initialized - API key missing");
		return { success: false, error: "Email service not configured" };
	}

	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const { error } = await resend.emails.send({
				from: `${FROM_NAME} <${FROM_EMAIL}>`,
				to: email,
				subject: `Registration Successful - ${eventName}`,
				html: getCompetitorConfirmationTemplate(
					competitorName,
					competitorNumber,
					role,
					eventName,
					eventDate,
					eventVenue,
					eventId,
					gender,
					photoUrl,
				),
			});

			if (error) {
				console.error(
					`[Email] Competitor confirmation error (attempt ${attempt}/3):`,
					error,
				);
				if (attempt < 3) {
					await new Promise((r) => setTimeout(r, 1000 * attempt));
					continue;
				}
				return { success: false, error: error.message };
			}

			return { success: true };
		} catch (err) {
			console.error(
				`[Email] Failed to send competitor confirmation (attempt ${attempt}/3):`,
				err,
			);
			if (attempt < 3) {
				await new Promise((r) => setTimeout(r, 1000 * attempt));
				continue;
			}
			return {
				success: false,
				error: "Failed to send confirmation email",
			};
		}
	}
	return { success: false, error: "Failed after 3 attempts" };
}

// Send new registration notification to admin
export async function sendAdminNotificationEmail(
	competitorName: string,
	competitorNumber: number,
	competitorEmail: string,
	role: string,
	eventName: string,
	eventDate: string,
	eventVenue: string,
): Promise<{ success: boolean; error?: string }> {
	if (!resend) {
		console.error("[Email] Resend not initialized - API key missing");
		return { success: false, error: "Email service not configured" };
	}

	for (let attempt = 1; attempt <= 2; attempt++) {
		try {
			const { error } = await resend.emails.send({
				from: `${FROM_NAME} <${FROM_EMAIL}>`,
				to: ADMIN_EMAIL,
				subject: `New Registration: ${competitorName} - ${eventName}`,
				html: getAdminNotificationTemplate(
					competitorName,
					competitorNumber,
					competitorEmail,
					role,
					eventName,
					eventDate,
					eventVenue,
				),
			});

			if (error) {
				console.error(
					`[Email] Admin notification error (attempt ${attempt}/2):`,
					error,
				);
				if (attempt < 2) {
					await new Promise((r) => setTimeout(r, 1000));
					continue;
				}
				return { success: false, error: error.message };
			}

			return { success: true };
		} catch (err) {
			console.error(
				`[Email] Failed to send admin notification (attempt ${attempt}/2):`,
				err,
			);
			if (attempt < 2) {
				await new Promise((r) => setTimeout(r, 1000));
				continue;
			}
			return {
				success: false,
				error: "Failed to send admin notification",
			};
		}
	}
	return { success: false, error: "Failed after 2 attempts" };
}

// Email Templates

function getVerificationEmailTemplate(code: string): string {
	return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a2e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #16213e; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.3);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #1a1a2e; font-size: 28px; font-weight: bold;">Jack & Jill</h1>
              <p style="margin: 8px 0 0 0; color: #1a1a2e; font-size: 14px; opacity: 0.8;">Competition System</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px; text-align: center;">Email Verification</h2>
              <p style="margin: 0 0 30px 0; color: #94a3b8; font-size: 16px; line-height: 1.6; text-align: center;">
                Use the verification code below to complete your registration. This code will expire in 5 minutes.
              </p>
              
              <!-- Code Box -->
              <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
                <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 14px;">Your Verification Code</p>
                <p style="margin: 0; color: #f59e0b; font-size: 42px; font-weight: bold; letter-spacing: 8px;">${code}</p>
              </div>
              
              <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">
                If you didn't request this code, please ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px 30px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                © ${new Date().getFullYear()} Jack & Jill Competition System
              </p>
              <p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px;">
                <a href="https://www.jacknjillsoftware.com" style="color: #f59e0b; text-decoration: none;">www.jacknjillsoftware.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function getCompetitorConfirmationTemplate(
	competitorName: string,
	competitorNumber: number,
	role: string,
	eventName: string,
	eventDate: string,
	eventVenue: string,
	eventId?: string,
	gender?: string,
	photoUrl?: string,
): string {
	const formattedDate = formatEventDate(eventDate);
	const baseUrl = "https://www.jacknjillsoftware.com";
	// Don't include photoUrl in the link - it's a signed URL that expires
	// The success page will fetch a fresh signed URL from the API
	const downloadUrl = `${baseUrl}/register/success?number=${competitorNumber}&name=${encodeURIComponent(
		competitorName,
	)}&gender=${gender || ""}${eventId ? `&event=${eventId}` : ""}`;

	return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Successful</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a2e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #16213e; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.3);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #1a1a2e; font-size: 28px; font-weight: bold;">Jack & Jill</h1>
              <p style="margin: 8px 0 0 0; color: #1a1a2e; font-size: 14px; opacity: 0.8;">Competition System</p>
            </td>
          </tr>
          
          <!-- Success Badge -->
          <tr>
            <td style="padding: 30px 30px 0 30px; text-align: center;">
              <div style="display: inline-block; background-color: #10b981; border-radius: 50%; width: 60px; height: 60px; line-height: 60px;">
                <span style="color: white; font-size: 30px;">✓</span>
              </div>
              <h2 style="margin: 20px 0 10px 0; color: #10b981; font-size: 26px;">Registration Successful!</h2>
              <p style="margin: 0; color: #94a3b8; font-size: 16px;">Welcome to ${eventName}</p>
            </td>
          </tr>
          
          <!-- Info Box -->
          <tr>
            <td style="padding: 30px;">
              <div style="background-color: #e0f2fe; border-left: 4px solid #0ea5e9; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <p style="margin: 0; color: #0c4a6e; font-size: 14px;">
                  ✅ Your registration has been created successfully.
                </p>
              </div>
              
              <!-- Details Card -->
              <div style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 18px; border-bottom: 1px solid #334155; padding-bottom: 12px;">Your Account Details:</h3>
                
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Name:</td>
                    <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right; font-weight: 600;">${competitorName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Competitor Number:</td>
                    <td style="padding: 8px 0; color: #f59e0b; font-size: 14px; text-align: right; font-weight: 600;">#${competitorNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Role:</td>
                    <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right; font-weight: 600;">${role}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Event:</td>
                    <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right; font-weight: 600;">${eventName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Date:</td>
                    <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right; font-weight: 600;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Venue:</td>
                    <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right; font-weight: 600;">${
						eventVenue || "TBA"
					}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Large Number Display -->
              <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 20px;">
                <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 14px;">YOUR COMPETITOR NUMBER</p>
                <p style="margin: 0; color: #f59e0b; font-size: 56px; font-weight: bold;">#${competitorNumber}</p>
                <p style="margin: 15px 0 0 0; color: #64748b; font-size: 12px;">Please remember this number for the competition</p>
              </div>
              
              <!-- Download PDF Button -->
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${downloadUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 18px 40px; border-radius: 12px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);">
                  📥 Download Registration PDF
                </a>
                <p style="margin: 12px 0 0 0; color: #94a3b8; font-size: 13px;">Click the button above to download your registration confirmation</p>
              </div>
              
              <!-- Important Note -->
              <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">📝 IMPORTANT:</p>
                <p style="margin: 8px 0 0 0; color: #78350f; font-size: 13px;">Download your registration PDF and bring it to the event for check-in.</p>
              </div>
            </td>
          </tr>
          
          <!-- Contact Info -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #dbeafe; border-radius: 8px; padding: 20px;">
                <h4 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px;">Administrator Contact:</h4>
                <p style="margin: 0 0 8px 0; color: #1e3a8a; font-size: 14px;">📧 Email: info@ericlalta.com</p>
				  <p style="margin: 0 0 8px 0; color: #1e3a8a; font-size: 14px;">📞 Phone:+971 52 841 1575</p>
                <p style="margin: 0; color: #3b82f6; font-size: 13px;">If you have any questions or need immediate assistance, please contact the administrator.</p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px 30px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                © ${new Date().getFullYear()} Jack & Jill Competition System
              </p>
              <p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px;">
                <a href="https://www.jacknjillsoftware.com" style="color: #f59e0b; text-decoration: none;">www.jacknjillsoftware.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function getAdminNotificationTemplate(
	competitorName: string,
	competitorNumber: number,
	competitorEmail: string,
	role: string,
	eventName: string,
	eventDate: string,
	eventVenue: string,
): string {
	const formattedDate = formatEventDate(eventDate);
	const registrationTime = new Date().toLocaleString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZoneName: "short",
	});

	return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Competitor Registration</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a2e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #16213e; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.3);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Jack & Jill</h1>
              <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">Admin Notification</p>
            </td>
          </tr>
          
          <!-- Alert Badge -->
          <tr>
            <td style="padding: 30px 30px 0 30px; text-align: center;">
              <div style="display: inline-block; background-color: #f59e0b; border-radius: 50%; width: 60px; height: 60px; line-height: 60px;">
                <span style="color: white; font-size: 30px;">🆕</span>
              </div>
              <h2 style="margin: 20px 0 10px 0; color: #f59e0b; font-size: 24px;">New Competitor Registration</h2>
              <p style="margin: 0; color: #94a3b8; font-size: 16px;">A new competitor has registered for ${eventName}</p>
            </td>
          </tr>
          
          <!-- Registration Details -->
          <tr>
            <td style="padding: 30px;">
              <div style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 18px; border-bottom: 1px solid #334155; padding-bottom: 12px;">📋 Registration Details</h3>
                
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 14px; width: 40%;">Competitor Name:</td>
                    <td style="padding: 10px 0; color: #ffffff; font-size: 14px; font-weight: 600;">${competitorName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 14px;">Competitor Number:</td>
                    <td style="padding: 10px 0; color: #f59e0b; font-size: 18px; font-weight: bold;">#${competitorNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 14px;">Email:</td>
                    <td style="padding: 10px 0; color: #3b82f6; font-size: 14px;">
                      <a href="mailto:${competitorEmail}" style="color: #3b82f6; text-decoration: none;">${competitorEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 14px;">Role:</td>
                    <td style="padding: 10px 0; color: #ffffff; font-size: 14px; font-weight: 600;">${role}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 15px 0 5px 0; border-top: 1px solid #334155;"></td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 14px;">Event:</td>
                    <td style="padding: 10px 0; color: #ffffff; font-size: 14px; font-weight: 600;">${eventName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 14px;">Event Date:</td>
                    <td style="padding: 10px 0; color: #ffffff; font-size: 14px;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 14px;">Venue:</td>
                    <td style="padding: 10px 0; color: #ffffff; font-size: 14px;">${
						eventVenue || "TBA"
					}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #94a3b8; font-size: 14px;">Registration Time:</td>
                    <td style="padding: 10px 0; color: #10b981; font-size: 14px;">${registrationTime}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Quick Stats -->
              <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 1px solid #334155; border-radius: 12px; padding: 20px; text-align: center;">
                <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Assigned Number</p>
                <p style="margin: 0; color: #f59e0b; font-size: 48px; font-weight: bold;">#${competitorNumber}</p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px 30px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px;">
                This is an automated notification from Jack & Jill Competition System
              </p>
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                <a href="https://www.jacknjillsoftware.com" style="color: #f59e0b; text-decoration: none;">www.jacknjillsoftware.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Send admin registration confirmation email
export async function sendAdminRegistrationEmail(
	email: string,
	fullName: string,
	organizationName: string,
): Promise<{ success: boolean; error?: string }> {
	if (!resend) {
		console.error("[Email] Resend not initialized - API key missing");
		return { success: false, error: "Email service not configured" };
	}

	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const { error } = await resend.emails.send({
				from: `${FROM_NAME} <${FROM_EMAIL}>`,
				to: email,
				subject: "Welcome to Jack & Jill - Registration Successful!",
				html: getAdminRegistrationTemplate(fullName, organizationName),
			});

			if (error) {
				console.error(
					`[Email] Admin registration email error (attempt ${attempt}/3):`,
					error,
				);
				if (attempt < 3) {
					await new Promise((r) => setTimeout(r, 1000 * attempt));
					continue;
				}
				return { success: false, error: error.message };
			}

			return { success: true };
		} catch (err) {
			console.error(
				`[Email] Failed to send admin registration email (attempt ${attempt}/3):`,
				err,
			);
			if (attempt < 3) {
				await new Promise((r) => setTimeout(r, 1000 * attempt));
				continue;
			}
			return {
				success: false,
				error: "Failed to send registration email",
			};
		}
	}
	return { success: false, error: "Failed after 3 attempts" };
}

// Send password reset email
export async function sendPasswordResetEmail(
	email: string,
	resetToken: string,
	baseUrl: string,
): Promise<{ success: boolean; error?: string }> {
	if (!resend) {
		console.error("[Email] Resend not initialized - API key missing");
		return { success: false, error: "Email service not configured" };
	}

	const resetLink = `${baseUrl}/admin/reset-password?token=${resetToken}`;

	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const { error } = await resend.emails.send({
				from: `${FROM_NAME} <${FROM_EMAIL}>`,
				to: email,
				subject: "Reset Your Password - Jack & Jill",
				html: getPasswordResetTemplate(resetLink),
			});

			if (error) {
				console.error(
					`[Email] Password reset email error (attempt ${attempt}/3):`,
					error,
				);
				if (attempt < 3) {
					await new Promise((r) => setTimeout(r, 1000 * attempt));
					continue;
				}
				return { success: false, error: error.message };
			}

			return { success: true };
		} catch (err) {
			console.error(
				`[Email] Failed to send password reset email (attempt ${attempt}/3):`,
				err,
			);
			if (attempt < 3) {
				await new Promise((r) => setTimeout(r, 1000 * attempt));
				continue;
			}
			return {
				success: false,
				error: "Failed to send password reset email",
			};
		}
	}
	return { success: false, error: "Failed after 3 attempts" };
}

// Admin Registration Email Template
function getAdminRegistrationTemplate(
	fullName: string,
	organizationName: string,
): string {
	return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Successful</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a2e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #16213e; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.3);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #1a1a2e; font-size: 28px; font-weight: bold;">Jack & Jill</h1>
              <p style="margin: 8px 0 0 0; color: #1a1a2e; font-size: 14px; opacity: 0.8;">Competition Management System</p>
            </td>
          </tr>
          
          <!-- Success Badge -->
          <tr>
            <td style="padding: 30px 30px 0 30px; text-align: center;">
              <div style="display: inline-block; background-color: #10b981; border-radius: 50%; width: 60px; height: 60px; line-height: 60px;">
                <span style="color: white; font-size: 30px;">✓</span>
              </div>
              <h2 style="margin: 20px 0 10px 0; color: #10b981; font-size: 26px;">Registration Successful!</h2>
              <p style="margin: 0; color: #94a3b8; font-size: 16px;">Welcome to Jack & Jill Competition System</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; color: #e2e8f0; font-size: 16px; line-height: 1.6;">
                Hi <strong>${fullName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; color: #94a3b8; font-size: 16px; line-height: 1.6;">
                Your free trial account has been created successfully! You can now sign in and start setting up your competition events.
              </p>
              
              <!-- Details Card -->
              <div style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; color: #ffffff; font-size: 18px; border-bottom: 1px solid #334155; padding-bottom: 12px;">Your Account Details</h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Organization:</td>
                    <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right; font-weight: 600;">${organizationName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Plan:</td>
                    <td style="padding: 8px 0; color: #f59e0b; font-size: 14px; text-align: right; font-weight: 600;">Free Trial (7 days)</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">Competitors:</td>
                    <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right; font-weight: 600;">Up to 20</td>
                  </tr>
                </table>
              </div>
              
              <!-- What's Next -->
              <div style="background-color: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 16px 0; color: #ffffff; font-size: 18px;">🚀 What's Next?</h3>
                <ol style="margin: 0; padding-left: 20px; color: #94a3b8; font-size: 14px; line-height: 2;">
                  <li>Sign in</li>
                  <li>Create your first competition event</li>
                  <li>Configure your competition structure</li>
                  <li>Add competitors and judges</li>
                  <li>Go live with your competition!</li>
                </ol>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="https://www.jacknjillsoftware.com/admin/login" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);">
                  Sign In
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px 30px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                © ${new Date().getFullYear()} Jack & Jill Competition System
              </p>
              <p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px;">
                <a href="https://www.jacknjillsoftware.com" style="color: #f59e0b; text-decoration: none;">www.jacknjillsoftware.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Password Reset Email Template
function getPasswordResetTemplate(resetLink: string): string {
	return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a2e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #16213e; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.3);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #1a1a2e; font-size: 28px; font-weight: bold;">Jack & Jill</h1>
              <p style="margin: 8px 0 0 0; color: #1a1a2e; font-size: 14px; opacity: 0.8;">Competition Management System</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px; text-align: center;">Password Reset Request</h2>
              <p style="margin: 0 0 30px 0; color: #94a3b8; font-size: 16px; line-height: 1.6; text-align: center;">
                We received a request to reset your password. Click the button below to set a new password.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 0 0 30px 0;">
                <a href="${resetLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #1a1a2e; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);">
                  Reset Password
                </a>
              </div>
              
              <!-- Expiry Note -->
              <div style="background-color: #1e293b; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px;">
                <p style="margin: 0; color: #94a3b8; font-size: 14px;">
                  ⏰ This link expires in <strong style="color: #f59e0b;">1 hour</strong>
                </p>
              </div>
              
              <p style="margin: 0; color: #64748b; font-size: 13px; text-align: center;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px 30px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                © ${new Date().getFullYear()} Jack & Jill Competition System
              </p>
              <p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px;">
                <a href="https://www.jacknjillsoftware.com" style="color: #f59e0b; text-decoration: none;">www.jacknjillsoftware.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function formatEventDate(dateStr: string): string {
	if (!dateStr) return "TBA";
	try {
		const date = new Date(dateStr + "T00:00:00");
		return date.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	} catch {
		return dateStr;
	}
}
