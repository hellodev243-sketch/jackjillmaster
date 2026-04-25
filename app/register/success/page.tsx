"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSocket } from "@/hooks/use-socket";
import { EventDeletedModal } from "@/components/event-deleted-modal";

import { Loader2, Sparkles, Trophy, Download } from "lucide-react";
import { motion } from "framer-motion";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

function SuccessPageContent() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const eventId = searchParams?.get("event") || undefined;
	const urlCompetitorNumber = searchParams?.get("number");
	const urlCompetitorName = searchParams?.get("name");
	const urlCompetitorGender = searchParams?.get("gender");
	const urlCompetitorPhoto = searchParams?.get("photo");
	const [mounted, setMounted] = useState(false);
	const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

	// Get from URL params or session storage
	const [competitorNumber, setCompetitorNumber] = useState<string | null>(
		null,
	);
	const [competitorPhotoUrl, setCompetitorPhotoUrl] = useState<string | null>(
		null,
	);
	const [competitorGender, setCompetitorGender] = useState<string | null>(
		null,
	);

	const { event, isLoading, deletedEventInfo, clearDeletedEventInfo } =
		useSocket(eventId);

	useEffect(() => {
		setMounted(true);

		// Try URL params first, then session storage
		if (urlCompetitorNumber) {
			setCompetitorNumber(urlCompetitorNumber);
			if (urlCompetitorGender) {
				setCompetitorGender(urlCompetitorGender);
			}
			if (urlCompetitorPhoto) {
				setCompetitorPhotoUrl(decodeURIComponent(urlCompetitorPhoto));
			}
		} else {
			// Check session storage
			const storedEventId = sessionStorage.getItem("competitorEventId");
			const storedNumber = sessionStorage.getItem("competitorNumber");

			// Only use session data if it's for the same event
			if (
				storedNumber &&
				(storedEventId === eventId ||
					(!eventId && storedEventId === "demo-event-1"))
			) {
				setCompetitorNumber(storedNumber);
			}
		}

		// Get photo URL and gender from session storage (fallback)
		const storedPhotoUrl = sessionStorage.getItem("competitorPhotoUrl");
		if (storedPhotoUrl && !urlCompetitorPhoto) {
			setCompetitorPhotoUrl(storedPhotoUrl);
		}
		// Only get gender from session if not in URL
		if (!urlCompetitorGender) {
			const storedGender = sessionStorage.getItem("competitorGender");
			if (storedGender) {
				setCompetitorGender(storedGender);
			}
		}
	}, [
		urlCompetitorNumber,
		urlCompetitorName,
		urlCompetitorGender,
		urlCompetitorPhoto,
		eventId,
	]);

	// Fetch photo URL from API when coming from email (no photo in URL or session)
	useEffect(() => {
		const fetchPhotoUrl = async () => {
			// Only fetch if we have event and number but no photo URL yet
			const number = urlCompetitorNumber || competitorNumber;
			if (!eventId || !number || competitorPhotoUrl) return;

			// Check session storage first
			const storedPhotoUrl = sessionStorage.getItem("competitorPhotoUrl");
			if (storedPhotoUrl) return;

			console.log("Fetching photo URL from API for:", {
				eventId,
				number,
			});
			try {
				const response = await fetch(
					`/api/competitors/photo?event=${eventId}&number=${number}`,
				);
				if (response.ok) {
					const data = await response.json();
					console.log("Photo API response:", data);
					if (data.photoUrl) {
						setCompetitorPhotoUrl(data.photoUrl);
						console.log(
							"Set photo URL:",
							data.photoUrl.substring(0, 100) + "...",
						);
					}
				} else {
					console.error(
						"Photo API error:",
						response.status,
						await response.text(),
					);
				}
			} catch (error) {
				console.error("Failed to fetch photo URL:", error);
			}
		};

		if (mounted) {
			fetchPhotoUrl();
		}
	}, [
		mounted,
		eventId,
		urlCompetitorNumber,
		competitorNumber,
		competitorPhotoUrl,
	]);

	// Redirect if no competitor number found
	useEffect(() => {
		if (mounted && !competitorNumber && !urlCompetitorNumber) {
			const storedNumber = sessionStorage.getItem("competitorNumber");
			if (!storedNumber) {
				router.push(
					eventId ? `/register?event=${eventId}` : "/register",
				);
			}
		}
	}, [mounted, competitorNumber, urlCompetitorNumber, eventId, router]);

	// Convert image to circular using canvas - uses proxy to avoid CORS issues
	const getCircularImage = useCallback(
		async (imageUrl: string, size: number): Promise<string | null> => {
			return new Promise((resolve) => {
				const img = new Image();

				const processImage = () => {
					try {
						const canvas = document.createElement("canvas");
						canvas.width = size;
						canvas.height = size;
						const ctx = canvas.getContext("2d");

						if (!ctx) {
							resolve(null);
							return;
						}

						// Create circular clipping path
						ctx.beginPath();
						ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
						ctx.closePath();
						ctx.clip();

						// Draw image centered and covering the circle
						const minDim = Math.min(img.width, img.height);
						const sx = (img.width - minDim) / 2;
						const sy = (img.height - minDim) / 2;
						ctx.drawImage(
							img,
							sx,
							sy,
							minDim,
							minDim,
							0,
							0,
							size,
							size,
						);

						resolve(canvas.toDataURL("image/png"));
					} catch (e) {
						console.error("Canvas error:", e);
						resolve(null);
					}
				};

				img.onload = processImage;

				img.onerror = () => {
					console.error("Failed to load image for PDF");
					resolve(null);
				};

				// Use proxy endpoint to avoid CORS issues with GCS signed URLs
				const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(
					imageUrl,
				)}`;
				img.src = proxyUrl;
			});
		},
		[],
	);

	// Generate and download PDF
	const handleDownloadPdf = useCallback(async () => {
		if (!competitorNumber) return;

		// Get competitor name from URL params first, then session storage
		const competitorName =
			urlCompetitorName || sessionStorage.getItem("competitorName");
		if (!competitorName) {
			toast.error("Competitor name not found");
			return;
		}

		// Check if event data is loaded
		if (isLoading || !event) {
			toast.error("Please wait for event data to load");
			return;
		}

		const gender =
			competitorGender || sessionStorage.getItem("competitorGender");

		setIsGeneratingPdf(true);
		try {
			const doc = new jsPDF({
				orientation: "portrait",
				unit: "mm",
				format: "a4",
			});

			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();
			const margin = 15;
			const contentWidth = pageWidth - margin * 2;

			// Background color (dark theme)
			doc.setFillColor(26, 26, 46);
			doc.rect(0, 0, pageWidth, pageHeight, "F");

			// Outer Border
			doc.setDrawColor(245, 158, 11);
			doc.setLineWidth(2);
			doc.rect(8, 8, pageWidth - 16, pageHeight - 16, "S");

			// Inner decorative border
			doc.setDrawColor(217, 119, 6);
			doc.setLineWidth(0.5);
			doc.rect(12, 12, pageWidth - 24, pageHeight - 24, "S");

			// J&J Logo
			const logoX = pageWidth / 2;
			const logoY = 35;
			const logoRadius = 18;

			doc.setFillColor(26, 26, 46);
			doc.circle(logoX, logoY, logoRadius, "F");
			doc.setDrawColor(245, 158, 11);
			doc.setLineWidth(1.5);
			doc.circle(logoX, logoY, logoRadius - 2, "S");

			doc.setTextColor(245, 158, 11);
			doc.setFont("times", "bold");
			doc.setFontSize(22);
			doc.text("J", logoX, logoY - 2, { align: "center" });
			doc.setFontSize(12);
			doc.text("&", logoX - 7, logoY + 8, { align: "center" });
			doc.setFontSize(22);
			doc.text("J", logoX + 7, logoY + 8, { align: "center" });

			// Sparkle dots
			doc.setFillColor(245, 158, 11);
			doc.circle(logoX - 14, logoY - 12, 1.2, "F");
			doc.circle(logoX + 16, logoY - 10, 0.8, "F");
			doc.circle(logoX + 17, logoY + 12, 1.2, "F");
			doc.circle(logoX - 15, logoY + 14, 0.8, "F");

			// Title
			doc.setTextColor(255, 255, 255);
			doc.setFont("helvetica", "bold");
			doc.setFontSize(26);
			doc.text("JACK & JILL", pageWidth / 2, 65, { align: "center" });

			doc.setTextColor(245, 158, 11);
			doc.setFontSize(16);
			doc.text("COMPETITION", pageWidth / 2, 74, { align: "center" });

			// Event name - use actual event data
			doc.setTextColor(251, 191, 36);
			doc.setFont("helvetica", "italic");
			doc.setFontSize(12);
			doc.text(event.name, pageWidth / 2, 85, { align: "center" });

			// Registration confirmation badge
			const badgeText = "REGISTRATION CONFIRMED";
			doc.setFontSize(9);
			const badgeWidth = doc.getTextWidth(badgeText) + 16;
			const badgeX = pageWidth / 2 - badgeWidth / 2;
			doc.setFillColor(16, 185, 129);
			doc.roundedRect(badgeX, 92, badgeWidth, 10, 5, 5, "F");
			doc.setTextColor(255, 255, 255);
			doc.setFont("helvetica", "bold");
			doc.text(badgeText, pageWidth / 2, 99, { align: "center" });

			// Competitor photo (if available) - circular
			let tableStartY = 110;
			console.log(
				"PDF Generation - competitorPhotoUrl:",
				competitorPhotoUrl,
			);
			if (competitorPhotoUrl) {
				try {
					console.log(
						"Attempting to add photo to PDF:",
						competitorPhotoUrl.substring(0, 100) + "...",
					);
					const photoSizePx = 200;
					const circularPhoto = await getCircularImage(
						competitorPhotoUrl,
						photoSizePx,
					);
					if (circularPhoto) {
						console.log("Successfully processed circular photo");
						const photoSizeMm = 30;
						const photoX = pageWidth / 2 - photoSizeMm / 2;
						const photoY = 108;

						// Draw golden border circle behind the photo
						doc.setFillColor(245, 158, 11);
						doc.circle(
							pageWidth / 2,
							photoY + photoSizeMm / 2,
							photoSizeMm / 2 + 2,
							"F",
						);

						// Add circular photo
						doc.addImage(
							circularPhoto,
							"PNG",
							photoX,
							photoY,
							photoSizeMm,
							photoSizeMm,
						);

						tableStartY = photoY + photoSizeMm + 8;
					} else {
						console.log("Failed to process circular photo");
					}
				} catch (e) {
					console.error("Failed to add photo to PDF:", e);
				}
			} else {
				console.log("No photo URL available for PDF");
			}

			// Competitor Information Table
			const tableX = margin + 5;
			const tableWidth = contentWidth - 10;
			const rowHeight = 10;

			// Table header
			doc.setFillColor(245, 158, 11);
			doc.rect(tableX, tableStartY, tableWidth, rowHeight, "F");
			doc.setTextColor(26, 26, 46);
			doc.setFont("helvetica", "bold");
			doc.setFontSize(10);
			doc.text("COMPETITOR INFORMATION", pageWidth / 2, tableStartY + 8, {
				align: "center",
			});

			// Determine role text
			let roleText = "N/A";
			if (gender === "male") {
				roleText = "Lead (Male)";
			} else if (gender === "female") {
				roleText = "Follow (Female)";
			}

			// Format date properly
			let dateText = new Date().toLocaleDateString();
			if (event.date) {
				try {
					dateText = new Date(
						event.date + "T00:00:00",
					).toLocaleDateString("en-US", {
						weekday: "long",
						year: "numeric",
						month: "long",
						day: "numeric",
					});
				} catch {
					dateText = event.date;
				}
			}

			// Table rows - use actual event data
			const rows = [
				["Name", competitorName],
				["Competitor Number", `#${competitorNumber}`],
				["Role", roleText],
				["Event", event.name],
				["Date", dateText],
				["Venue", event.venue || "TBA"],
			];

			let currentY = tableStartY + rowHeight;
			rows.forEach((row, index) => {
				if (index % 2 === 0) {
					doc.setFillColor(40, 40, 60);
				} else {
					doc.setFillColor(50, 50, 70);
				}
				doc.rect(tableX, currentY, tableWidth, rowHeight, "F");

				doc.setTextColor(180, 180, 180);
				doc.setFont("helvetica", "normal");
				doc.setFontSize(9);
				doc.text(row[0], tableX + 5, currentY + 8);

				doc.setTextColor(255, 255, 255);
				doc.setFont("helvetica", "bold");
				doc.setFontSize(9);
				doc.text(row[1], tableX + tableWidth - 5, currentY + 8, {
					align: "right",
				});

				currentY += rowHeight;
			});

			// Table border
			doc.setDrawColor(245, 158, 11);
			doc.setLineWidth(0.5);
			doc.rect(
				tableX,
				tableStartY,
				tableWidth,
				rowHeight * (rows.length + 1),
				"S",
			);

			// Large competitor number display box
			const numberBoxY = currentY + 8;
			const numberBoxHeight = 40;
			doc.setFillColor(40, 40, 60);
			doc.roundedRect(
				tableX,
				numberBoxY,
				tableWidth,
				numberBoxHeight,
				4,
				4,
				"F",
			);
			doc.setDrawColor(245, 158, 11);
			doc.setLineWidth(1);
			doc.roundedRect(
				tableX,
				numberBoxY,
				tableWidth,
				numberBoxHeight,
				4,
				4,
				"S",
			);

			doc.setTextColor(180, 180, 180);
			doc.setFont("helvetica", "normal");
			doc.setFontSize(8);
			doc.text("YOUR COMPETITOR NUMBER", pageWidth / 2, numberBoxY + 9, {
				align: "center",
			});

			doc.setTextColor(245, 158, 11);
			doc.setFont("helvetica", "bold");
			doc.setFontSize(38);
			doc.text(`#${competitorNumber}`, pageWidth / 2, numberBoxY + 30, {
				align: "center",
			});

			// Important note - positioned with proper spacing
			const noteY = numberBoxY + numberBoxHeight + 6;
			doc.setFillColor(60, 50, 30);
			doc.roundedRect(tableX, noteY, tableWidth, 14, 3, 3, "F");
			doc.setDrawColor(251, 191, 36);
			doc.setLineWidth(0.3);
			doc.roundedRect(tableX, noteY, tableWidth, 14, 3, 3, "S");
			doc.setTextColor(251, 191, 36);
			doc.setFont("helvetica", "normal");
			doc.setFontSize(7);
			doc.text(
				"Please keep this document. You will need your competitor number",
				pageWidth / 2,
				noteY + 5,
				{ align: "center" },
			);
			doc.text(
				"during the competition for identification.",
				pageWidth / 2,
				noteY + 10,
				{ align: "center" },
			);

			// Footer - positioned after the note box with proper spacing
			const footerY = noteY + 23;
			doc.setTextColor(100, 100, 100);
			doc.setFontSize(6);
			doc.text(
				"Generated by Jack & Jill Competition System",
				pageWidth / 2,
				footerY,
				{ align: "center" },
			);
			doc.text(
				`Registration Date: ${new Date().toLocaleString()}`,
				pageWidth / 2,
				footerY + 3,
				{ align: "center" },
			);

			// Download the PDF
			const fileName = `JackAndJill_${competitorName.replace(
				/\s+/g,
				"_",
			)}_${competitorNumber}.pdf`;
			doc.save(fileName);
			toast.success("Registration PDF downloaded!");
		} catch (error) {
			console.error("Error generating PDF:", error);
			toast.error("Failed to generate PDF. Please try again.");
		} finally {
			setIsGeneratingPdf(false);
		}
	}, [
		competitorNumber,
		competitorGender,
		competitorPhotoUrl,
		event,
		isLoading,
		getCircularImage,
		urlCompetitorName,
	]);

	if (!competitorNumber) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background p-6 relative overflow-hidden">
			{/* Animated Background Elements */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
				<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
			</div>

			<div className="max-w-lg mx-auto relative z-10 pt-10">
				{/* Hero Header */}
				<motion.header
					initial={{ opacity: 0, y: -30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, ease: "easeOut" }}
					className="text-center mb-8"
				>
					<motion.div
						initial={{ scale: 0 }}
						animate={{ scale: 1 }}
						transition={{
							delay: 0.3,
							type: "spring",
							stiffness: 200,
						}}
						className="mb-4"
					>
						<img
							src="/jack-and-jill-logo-transparent.png"
							alt="Jack & Jill"
							className="w-16 h-16 mx-auto object-contain"
						/>
					</motion.div>

					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.5 }}
						className="text-lg text-amber-200/80 font-light"
					>
						{event?.name || "Jack & Jill Competition"}
					</motion.p>
				</motion.header>

				<motion.div
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.5 }}
				>
					<Card className="border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10">
						<CardContent className="pt-8 pb-8 text-center">
							<motion.div
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.5, type: "spring" }}
								className="bg-linear-to-br from-primary/20 to-amber-500/20 rounded-2xl p-8 mb-6 border border-primary/30"
							>
								<p className="text-sm text-muted-foreground mb-3">
									Your Competitor Number
								</p>
								<p className="text-8xl font-bold text-primary">
									#{competitorNumber}
								</p>
							</motion.div>

							{/* Download PDF Button */}
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.55 }}
								className="mb-6"
							>
								<Button
									onClick={handleDownloadPdf}
									disabled={
										isGeneratingPdf || isLoading || !event
									}
									className="w-full h-16 sm:h-20 text-lg sm:text-xl bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-lg shadow-amber-500/25 transition-all duration-300 hover:shadow-amber-500/40 hover:scale-[1.02]"
								>
									{isGeneratingPdf ? (
										<>
											<Loader2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 animate-spin" />
											<span className="text-sm sm:text-base">
												Generating PDF...
											</span>
										</>
									) : isLoading ? (
										<>
											<Loader2 className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 animate-spin" />
											<span className="text-sm sm:text-base">
												Loading event data...
											</span>
										</>
									) : (
										<>
											<Download className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
											<span className="text-center">
												<span className="block sm:inline">
													Download now to complete
												</span>
												<span className="block sm:inline sm:ml-1">
													registration
												</span>
											</span>
										</>
									)}
								</Button>
							</motion.div>

							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.6 }}
								className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4"
							>
								<p className="text-amber-300 text-sm font-medium">
									📝 DOWNLOAD UR NUMBER AND BRING THIS TO THE
									EVENT
								</p>
							</motion.div>
						</CardContent>
					</Card>
				</motion.div>
			</div>

			{/* Event Deleted Modal */}
			<EventDeletedModal
				isOpen={!!deletedEventInfo}
				eventName={deletedEventInfo?.eventName}
				onClose={clearDeletedEventInfo}
			/>
		</div>
	);
}

export default function RegistrationSuccessPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-background flex items-center justify-center">
					<Loader2 className="w-8 h-8 animate-spin text-primary" />
				</div>
			}
		>
			<SuccessPageContent />
		</Suspense>
	);
}
