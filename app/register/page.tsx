"use client";

import type React from "react";
import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PhotoUpload } from "@/components/photo-upload";
import { useSocket } from "@/hooks/use-socket";
import { EventDeletedModal } from "@/components/event-deleted-modal";
import type { Gender } from "@/lib/types";
import Link from "next/link";
import {
	ArrowLeft,
	UserPlus,
	Loader2,
	Sparkles,
	Trophy,
	Users,
	Mail,
	CheckCircle2,
	Send,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

function RegisterPageContent() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const eventId = searchParams?.get("event") || undefined;
	const [mounted, setMounted] = useState(false);

	const {
		event,
		isLoading,
		registerCompetitor,
		deletedEventInfo,
		clearDeletedEventInfo,
	} = useSocket(eventId);

	const [formData, setFormData] = useState({
		name: "",
		email: "",
		gender: "male" as Gender,
		photoData: null as string | null,
		photoType: null as string | null,
	});

	// Email verification state
	const [verificationCode, setVerificationCode] = useState("");
	const [isEmailVerified, setIsEmailVerified] = useState(false);
	const [isSendingCode, setIsSendingCode] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [showVerificationInput, setShowVerificationInput] = useState(false);
	const [countdown, setCountdown] = useState(0);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		setMounted(true);

		// Check if competitor is already registered for this event
		const registeredEventId = sessionStorage.getItem("competitorEventId");
		const competitorNumber = sessionStorage.getItem("competitorNumber");
		const competitorName = sessionStorage.getItem("competitorName");

		// If already registered for this event, redirect to success page
		if (
			competitorNumber &&
			(registeredEventId === eventId ||
				(!eventId && registeredEventId === "demo-event-1"))
		) {
			const successUrl = `/register/success?number=${competitorNumber}&name=${encodeURIComponent(
				competitorName || "",
			)}${eventId ? `&event=${eventId}` : ""}`;
			router.push(successUrl);
		}
	}, [eventId, router]);

	// Countdown timer for verification code
	useEffect(() => {
		if (countdown > 0) {
			const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
			return () => clearTimeout(timer);
		}
	}, [countdown]);

	const handlePhotoChange = (
		photoData: string | null,
		photoType: string | null,
	) => {
		setFormData((prev) => ({ ...prev, photoData, photoType }));
	};

	// Send verification code
	const handleSendVerificationCode = useCallback(async () => {
		if (!formData.email.trim()) {
			toast.error("Please enter your email address");
			return;
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(formData.email)) {
			toast.error("Please enter a valid email address");
			return;
		}

		setIsSendingCode(true);
		try {
			const response = await fetch("/api/email/send-verification", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: formData.email }),
			});

			const data = await response.json();

			if (data.success) {
				toast.success("Verification code sent to your email!");
				setShowVerificationInput(true);
				setCountdown(300); // 5 minutes countdown
			} else {
				toast.error(data.error || "Failed to send verification code");
			}
		} catch (error) {
			toast.error("Failed to send verification code. Please try again.");
		} finally {
			setIsSendingCode(false);
		}
	}, [formData.email]);

	// Verify the code
	const handleVerifyCode = useCallback(async () => {
		if (!verificationCode.trim() || verificationCode.length !== 6) {
			toast.error("Please enter the 6-digit verification code");
			return;
		}

		setIsVerifying(true);
		try {
			const response = await fetch("/api/email/verify-code", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: formData.email,
					code: verificationCode,
				}),
			});

			const data = await response.json();

			if (data.success) {
				toast.success("Email verified successfully!");
				setIsEmailVerified(true);
				setShowVerificationInput(false);
				setCountdown(0);
			} else {
				toast.error(data.error || "Invalid verification code");
			}
		} catch (error) {
			toast.error("Failed to verify code. Please try again.");
		} finally {
			setIsVerifying(false);
		}
	}, [formData.email, verificationCode]);

	// Format countdown time
	const formatCountdown = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.name.trim()) return;

		// Check email verification
		if (!isEmailVerified) {
			toast.error("Please verify your email before registering");
			return;
		}

		setIsSubmitting(true);

		const result = await registerCompetitor(
			formData.name.trim(),
			formData.gender,
			formData.photoData || undefined,
			formData.photoType || undefined,
		);

		if (result) {
			// Save registration to session storage
			sessionStorage.setItem(
				"competitorEventId",
				eventId || "demo-event-1",
			);
			sessionStorage.setItem(
				"competitorNumber",
				result.number.toString(),
			);
			sessionStorage.setItem("competitorName", formData.name.trim());
			sessionStorage.setItem("competitorId", result.id);
			sessionStorage.setItem("competitorGender", formData.gender);
			sessionStorage.setItem("competitorEmail", formData.email);
			// Save photo URL if available
			if (result.photoUrl && !result.photoUrl.includes("placeholder")) {
				sessionStorage.setItem("competitorPhotoUrl", result.photoUrl);
			}

			// Send confirmation emails (await to ensure delivery)
			try {
				const role =
					formData.gender === "male"
						? "Lead (Male)"
						: "Follow (Female)";
				const emailRes = await fetch("/api/email/send-confirmation", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						email: formData.email,
						competitorName: formData.name.trim(),
						competitorNumber: result.number,
						role,
						eventName: event?.name || "Jack & Jill Competition",
						eventDate: event?.date || "",
						eventVenue: event?.venue || "TBA",
						eventId: eventId || "demo-event-1",
						gender: formData.gender,
						photoUrl:
							result.photoUrl &&
							!result.photoUrl.includes("placeholder")
								? result.photoUrl
								: undefined,
					}),
				});
				const emailData = await emailRes.json();
				if (!emailData.success || !emailData.competitorEmailSent) {
					console.warn(
						"[Register] Confirmation email may not have been sent:",
						emailData,
					);
				}
			} catch (emailError) {
				console.error(
					"Failed to send confirmation emails:",
					emailError,
				);
				// Don't block registration if email fails — competitor is already saved
			}

			toast.success(`Welcome! Your number is #${result.number}`);
			// Redirect to success page with competitor info
			const photoParam =
				result.photoUrl && !result.photoUrl.includes("placeholder")
					? `&photo=${encodeURIComponent(result.photoUrl)}`
					: "";
			const successUrl = `/register/success?number=${
				result.number
			}&name=${encodeURIComponent(formData.name.trim())}&gender=${
				formData.gender
			}${eventId ? `&event=${eventId}` : ""}${photoParam}`;
			router.push(successUrl);
		} else {
			toast.error("Registration failed. Please try again.");
			setIsSubmitting(false);
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-primary" />
			</div>
		);
	}

	const maleCount =
		event?.competitors.filter((c) => c.gender === "male").length || 0;
	const femaleCount =
		event?.competitors.filter((c) => c.gender === "female").length || 0;

	// Calculate max allowed competitors based on number ranges
	const maleMaxCount =
		typeof event?.maleStartNumber === "number" &&
		typeof event?.maleEndNumber === "number"
			? event.maleEndNumber - event.maleStartNumber + 1
			: undefined;
	const femaleMaxCount =
		typeof event?.femaleStartNumber === "number" &&
		typeof event?.femaleEndNumber === "number"
			? event.femaleEndNumber - event.femaleStartNumber + 1
			: undefined;

	// Check if registration is full for selected gender
	const isMaleFull = maleMaxCount !== undefined && maleCount >= maleMaxCount;
	const isFemaleFull =
		femaleMaxCount !== undefined && femaleCount >= femaleMaxCount;
	const isSelectedGenderFull =
		formData.gender === "male" ? isMaleFull : isFemaleFull;

	// Get remaining slots
	const maleRemaining =
		maleMaxCount !== undefined ? maleMaxCount - maleCount : undefined;
	const femaleRemaining =
		femaleMaxCount !== undefined ? femaleMaxCount - femaleCount : undefined;

	return (
		<div className="min-h-screen bg-background p-6 relative overflow-hidden">
			{/* Animated Background Elements */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
				<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
			</div>

			<div className="max-w-lg mx-auto relative z-10">
				<motion.div
					initial={{ opacity: 0, x: -20 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.5 }}
				>
					<Link
						href={eventId ? `/?event=${eventId}` : "/"}
						className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
					>
						<ArrowLeft className="w-4 h-4" />
						Back to Home
					</Link>
				</motion.div>

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

					<motion.h1
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.5 }}
						className="text-3xl md:text-4xl font-bold bg-linear-to-r from-white via-amber-200 to-orange-200 bg-clip-text text-transparent mb-3"
					>
						Register
					</motion.h1>

					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.7 }}
						className="text-lg text-amber-200/80 font-light"
					>
						{event?.name || "West Coast Swing Championship 2025"}
					</motion.p>

					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.9 }}
						className="text-sm text-muted-foreground mt-2"
					>
						Show your moves, win the crown! 💃🕺
					</motion.p>
				</motion.header>

				<motion.div
					initial={{ opacity: 0, y: 30, scale: 0.95 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ delay: 0.4, duration: 0.6 }}
				>
					<Card className="border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10 text-center">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-xl justify-center py-3">
								<img
									src="/jack-and-jill-logo-transparent.png"
									alt="Jack & Jill"
									className="w-7 h-7 object-contain"
								/>
								<p className="text-2xl">Register to Compete</p>
							</CardTitle>
							<CardDescription>
								Fill in your details to join the Jack & Jill
								competition
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleSubmit} className="space-y-6">
								<motion.div
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: 0.5 }}
									className="space-y-2"
								>
									<Label
										htmlFor="name"
										className="text-foreground"
									>
										Full Name *
									</Label>
									<Input
										id="name"
										placeholder="Enter your full name"
										value={formData.name}
										onChange={(e) =>
											setFormData((prev) => ({
												...prev,
												name: e.target.value,
											}))
										}
										className="h-12 bg-input border-border focus:border-primary"
										required
									/>
								</motion.div>

								{/* Email Verification Section */}
								<motion.div
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: 0.55 }}
									className="space-y-3"
								>
									<Label
										htmlFor="email"
										className="text-foreground flex items-center gap-2"
									>
										<Mail className="w-4 h-4" />
										Email Address *
										{isEmailVerified && (
											<span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
												<CheckCircle2 className="w-3 h-3" />
												Verified
											</span>
										)}
									</Label>
									<div className="flex gap-2">
										<Input
											id="email"
											type="email"
											placeholder="Enter your email"
											value={formData.email}
											onChange={(e) => {
												setFormData((prev) => ({
													...prev,
													email: e.target.value,
												}));
												// Reset verification if email changes
												if (isEmailVerified) {
													setIsEmailVerified(false);
												}
											}}
											className="h-12 bg-input border-border focus:border-primary flex-1"
											disabled={isEmailVerified}
											required
										/>
										{!isEmailVerified && (
											<Button
												type="button"
												onClick={
													handleSendVerificationCode
												}
												disabled={
													isSendingCode ||
													!formData.email.trim() ||
													countdown > 0
												}
												className="h-12 px-4 bg-primary hover:bg-primary/90"
											>
												{isSendingCode ? (
													<Loader2 className="w-4 h-4 animate-spin" />
												) : countdown > 0 ? (
													formatCountdown(countdown)
												) : (
													<>
														<Send className="w-4 h-4 mr-2" />
														Verify
													</>
												)}
											</Button>
										)}
									</div>

									{/* Verification Code Input */}
									{showVerificationInput &&
										!isEmailVerified && (
											<motion.div
												initial={{
													opacity: 0,
													height: 0,
												}}
												animate={{
													opacity: 1,
													height: "auto",
												}}
												className="space-y-2 pt-2"
											>
												<div className="flex gap-2">
													<Input
														type="text"
														placeholder="Enter 6-digit code"
														value={verificationCode}
														onChange={(e) => {
															const value =
																e.target.value
																	.replace(
																		/\D/g,
																		"",
																	)
																	.slice(
																		0,
																		6,
																	);
															setVerificationCode(
																value,
															);
														}}
														className="h-12 bg-input border-border focus:border-primary flex-1 text-center text-lg tracking-widest"
														maxLength={6}
													/>
													<Button
														type="button"
														onClick={
															handleVerifyCode
														}
														disabled={
															isVerifying ||
															verificationCode.length !==
																6
														}
														className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700"
													>
														{isVerifying ? (
															<Loader2 className="w-4 h-4 animate-spin" />
														) : (
															"Verify"
														)}
													</Button>
												</div>
												{countdown > 0 && (
													<p className="text-xs text-muted-foreground text-center">
														Code expires in{" "}
														{formatCountdown(
															countdown,
														)}
													</p>
												)}
												{countdown === 0 &&
													showVerificationInput && (
														<div className="text-center space-y-2">
															<p className="text-xs text-amber-400">
																Code expired.
																Please request a
																new code.
															</p>
															<Button
																type="button"
																variant="outline"
																size="sm"
																onClick={
																	handleSendVerificationCode
																}
																disabled={
																	isSendingCode
																}
																className="text-xs"
															>
																{isSendingCode ? (
																	<Loader2 className="w-3 h-3 mr-1 animate-spin" />
																) : (
																	<Send className="w-3 h-3 mr-1" />
																)}
																Resend Code
															</Button>
														</div>
													)}
											</motion.div>
										)}
								</motion.div>

								<motion.div
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: 0.6 }}
									className="space-y-3"
								>
									<Label className="text-foreground">
										Role *
									</Label>
									<RadioGroup
										value={formData.gender}
										onValueChange={(value) => {
											const gender = value as Gender;
											const isFull =
												gender === "male"
													? isMaleFull
													: isFemaleFull;
											if (isFull) {
												toast.warning(
													`${
														gender === "male"
															? "Lead"
															: "Follow"
													} registration is full! Maximum ${
														gender === "male"
															? maleMaxCount
															: femaleMaxCount
													} competitors allowed.`,
													{ duration: 4000 },
												);
												return;
											}
											setFormData((prev) => ({
												...prev,
												gender,
											}));
										}}
										className="grid grid-cols-2 gap-4"
									>
										<Label
											htmlFor="male"
											className={`flex flex-col items-center justify-center rounded-xl border-2 p-5 cursor-pointer transition-all ${
												isMaleFull
													? "border-destructive/50 bg-destructive/10 cursor-not-allowed opacity-60"
													: formData.gender === "male"
														? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
														: "border-border hover:border-primary/50 hover:bg-muted/50"
											}`}
											onClick={(e) => {
												if (isMaleFull) {
													e.preventDefault();
													toast.warning(
														`Lead registration is full! Maximum ${maleMaxCount} Lead competitors allowed.`,
														{ duration: 4000 },
													);
												}
											}}
										>
											<RadioGroupItem
												value="male"
												id="male"
												className="sr-only"
												disabled={isMaleFull}
											/>
											<span className="text-3xl mb-2">
												🕺
											</span>
											<span className="font-semibold text-lg">
												Lead
											</span>
											<span className="text-xs text-muted-foreground mt-1">
												{maleCount} registered
												{maleMaxCount !== undefined && (
													<span
														className={
															maleRemaining !==
																undefined &&
															maleRemaining <= 5
																? "text-amber-500 font-medium"
																: ""
														}
													>
														{" "}
														/ {maleMaxCount}
														{maleRemaining !==
															undefined &&
															maleRemaining > 0 &&
															maleRemaining <=
																5 && (
																<span className="block text-amber-500">
																	Only{" "}
																	{
																		maleRemaining
																	}{" "}
																	spots left!
																</span>
															)}
													</span>
												)}
											</span>
											{isMaleFull && (
												<span className="text-xs text-destructive font-medium mt-1">
													FULL
												</span>
											)}
										</Label>
										<Label
											htmlFor="female"
											className={`flex flex-col items-center justify-center rounded-xl border-2 p-5 cursor-pointer transition-all ${
												isFemaleFull
													? "border-destructive/50 bg-destructive/10 cursor-not-allowed opacity-60"
													: formData.gender ===
														  "female"
														? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
														: "border-border hover:border-primary/50 hover:bg-muted/50"
											}`}
											onClick={(e) => {
												if (isFemaleFull) {
													e.preventDefault();
													toast.warning(
														`Follow registration is full! Maximum ${femaleMaxCount} Follow competitors allowed.`,
														{ duration: 4000 },
													);
												}
											}}
										>
											<RadioGroupItem
												value="female"
												id="female"
												className="sr-only"
												disabled={isFemaleFull}
											/>
											<span className="text-3xl mb-2">
												💃
											</span>
											<span className="font-semibold text-lg">
												Follow
											</span>
											<span className="text-xs text-muted-foreground mt-1">
												{femaleCount} registered
												{femaleMaxCount !==
													undefined && (
													<span
														className={
															femaleRemaining !==
																undefined &&
															femaleRemaining <= 5
																? "text-amber-500 font-medium"
																: ""
														}
													>
														{" "}
														/ {femaleMaxCount}
														{femaleRemaining !==
															undefined &&
															femaleRemaining >
																0 &&
															femaleRemaining <=
																5 && (
																<span className="block text-amber-500">
																	Only{" "}
																	{
																		femaleRemaining
																	}{" "}
																	spots left!
																</span>
															)}
													</span>
												)}
											</span>
											{isFemaleFull && (
												<span className="text-xs text-destructive font-medium mt-1">
													FULL
												</span>
											)}
										</Label>
									</RadioGroup>
								</motion.div>

								{/* Registration Limit Warning */}
								{isSelectedGenderFull && (
									<motion.div
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive"
									>
										<p className="text-sm font-medium">
											⚠️ Registration for{" "}
											{formData.gender === "male"
												? "Lead"
												: "Follow"}{" "}
											is currently full.
										</p>
										<p className="text-xs mt-1 opacity-80">
											Please select the other role or
											contact the event organizer.
										</p>
									</motion.div>
								)}

								<motion.div
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: 0.7 }}
									className="space-y-2"
								>
									<Label className="text-foreground">
										Photo (Optional)
									</Label>
									<PhotoUpload
										onPhotoChange={handlePhotoChange}
									/>
								</motion.div>

								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.8 }}
								>
									<Button
										type="submit"
										className={`w-full h-12 font-semibold shadow-lg transition-all duration-300 hover:scale-[1.02] ${
											isSelectedGenderFull ||
											!isEmailVerified
												? "bg-muted text-muted-foreground cursor-not-allowed"
												: "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25 hover:shadow-primary/40"
										}`}
										disabled={
											isSubmitting ||
											!formData.name.trim() ||
											!isEmailVerified ||
											isSelectedGenderFull
										}
									>
										{isSubmitting ? (
											<>
												<Loader2 className="w-5 h-5 mr-2 animate-spin" />
												Registering...
											</>
										) : isSelectedGenderFull ? (
											<>Registration Full</>
										) : !isEmailVerified ? (
											<>Please Verify Email First</>
										) : (
											<>
												<UserPlus className="w-5 h-5 mr-2" />
												Register Now
											</>
										)}
									</Button>
								</motion.div>
							</form>
						</CardContent>
					</Card>
				</motion.div>

				{/* Stats Footer */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 1 }}
					className="mt-6 p-4 bg-card/60 backdrop-blur-sm rounded-xl border border-border"
				>
					<div className="flex items-center justify-center gap-2 mb-3">
						<Users className="w-4 h-4 text-primary" />
						<span className="text-sm font-medium text-foreground">
							Competition Stats
						</span>
					</div>
					<div className="grid grid-cols-3 gap-4 text-center">
						<div>
							<p className="text-2xl font-bold text-primary">
								{maleCount + femaleCount}
							</p>
							<p className="text-xs text-muted-foreground">
								Total
							</p>
						</div>
						<div>
							<p className="text-2xl font-bold text-blue-400">
								{maleCount}
							</p>
							<p className="text-xs text-muted-foreground">
								Leads
							</p>
						</div>
						<div>
							<p className="text-2xl font-bold text-pink-400">
								{femaleCount}
							</p>
							<p className="text-xs text-muted-foreground">
								Follows
							</p>
						</div>
					</div>
				</motion.div>

				{/* Bottom Tagline */}
				<motion.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 1.2 }}
					className="text-center text-muted-foreground text-sm mt-6"
				>
					Ready to shine on the dance floor? ✨
				</motion.p>
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

export default function RegisterPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-background flex items-center justify-center">
					<Loader2 className="w-8 h-8 animate-spin text-primary" />
				</div>
			}
		>
			<RegisterPageContent />
		</Suspense>
	);
}
