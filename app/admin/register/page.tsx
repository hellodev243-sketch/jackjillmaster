"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import {
	Loader2,
	Sparkles,
	Eye,
	EyeOff,
	CheckCircle2,
	Mail,
	Crown,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function AdminRegisterPage() {
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [organizationName, setOrganizationName] = useState("");
	const [agreedToTerms, setAgreedToTerms] = useState(false);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const router = useRouter();

	// Email verification state
	const [verificationSent, setVerificationSent] = useState(false);
	const [verificationCode, setVerificationCode] = useState([
		"",
		"",
		"",
		"",
		"",
		"",
	]);
	const [emailVerified, setEmailVerified] = useState(false);
	const [isSendingCode, setIsSendingCode] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [verifyError, setVerifyError] = useState("");
	const [cooldown, setCooldown] = useState(0);
	const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

	// Cooldown timer
	useEffect(() => {
		if (cooldown <= 0) return;
		const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
		return () => clearTimeout(timer);
	}, [cooldown]);

	// Reset verification when email changes
	useEffect(() => {
		if (emailVerified || verificationSent) {
			setEmailVerified(false);
			setVerificationSent(false);
			setVerificationCode(["", "", "", "", "", ""]);
			setVerifyError("");
		}
	}, [email]);

	const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

	const handleSendVerification = async () => {
		if (!email || !isValidEmail(email)) {
			setVerifyError("Please enter a valid email address");
			return;
		}
		setVerifyError("");
		setIsSendingCode(true);

		try {
			const res = await fetch("/api/email/send-verification", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.toLowerCase().trim() }),
			});
			const data = await res.json();
			if (data.success) {
				setVerificationSent(true);
				setCooldown(60);
				setVerificationCode(["", "", "", "", "", ""]);
				setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
			} else {
				setVerifyError(
					data.error || "Failed to send verification code",
				);
			}
		} catch {
			setVerifyError("Failed to send verification code");
		}
		setIsSendingCode(false);
	};

	const handleCodeChange = (index: number, value: string) => {
		if (!/^\d*$/.test(value)) return;
		const newCode = [...verificationCode];
		newCode[index] = value.slice(-1);
		setVerificationCode(newCode);
		setVerifyError("");

		// Auto-focus next input
		if (value && index < 5) {
			codeInputRefs.current[index + 1]?.focus();
		}

		// Auto-verify when all 6 digits entered
		const fullCode = newCode.join("");
		if (fullCode.length === 6) {
			verifyCode(fullCode);
		}
	};

	const handleCodeKeyDown = (
		index: number,
		e: React.KeyboardEvent<HTMLInputElement>,
	) => {
		if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
			codeInputRefs.current[index - 1]?.focus();
		}
	};

	const handleCodePaste = (e: React.ClipboardEvent) => {
		e.preventDefault();
		const pasted = e.clipboardData
			.getData("text")
			.replace(/\D/g, "")
			.slice(0, 6);
		if (pasted.length === 0) return;
		const newCode = [...verificationCode];
		for (let i = 0; i < pasted.length; i++) {
			newCode[i] = pasted[i];
		}
		setVerificationCode(newCode);
		if (pasted.length === 6) {
			verifyCode(pasted);
		} else {
			codeInputRefs.current[pasted.length]?.focus();
		}
	};

	const verifyCode = async (code: string) => {
		setIsVerifying(true);
		setVerifyError("");
		try {
			const res = await fetch("/api/email/verify-code", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: email.toLowerCase().trim(),
					code,
				}),
			});
			const data = await res.json();
			if (data.success) {
				setEmailVerified(true);
				setVerifyError("");
			} else {
				setVerifyError(data.error || "Invalid code");
				setVerificationCode(["", "", "", "", "", ""]);
				codeInputRefs.current[0]?.focus();
			}
		} catch {
			setVerifyError("Verification failed");
		}
		setIsVerifying(false);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!agreedToTerms) {
			setError("Please agree to the Terms of Service and Privacy Policy");
			return;
		}
		if (password.length < 6) {
			setError("Password must be at least 6 characters");
			return;
		}
		if (!emailVerified) {
			setError("Please verify your email address first");
			return;
		}

		setIsLoading(true);
		try {
			const response = await fetch("/api/admin/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fullName,
					email,
					password,
					organizationName,
				}),
			});
			const data = await response.json();
			if (data.success) {
				router.push("/admin/login?registered=true");
			} else {
				setError(
					data.error || "Registration failed. Please try again.",
				);
			}
		} catch {
			setError("Registration failed. Please try again.");
		}
		setIsLoading(false);
	};

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-amber-500/8 rounded-full blur-3xl animate-pulse" />
				<div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-orange-500/8 rounded-full blur-3xl animate-pulse delay-1000" />
			</div>

			<div className="w-full max-w-md relative z-10">
				{/* Hero Text */}
				<motion.div
					initial={{ opacity: 0, y: -30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, ease: "easeOut" }}
					className="text-center mb-6"
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
						className="text-4xl font-bold bg-gradient-to-r from-white via-amber-200 to-orange-200 bg-clip-text text-transparent mb-3"
					>
						Jack & Jill
					</motion.h1>

					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.7 }}
						className="text-xl text-amber-200/80 font-light"
					>
						Competition Management System
					</motion.p>

					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.9 }}
						className="text-sm text-muted-foreground mt-2"
					>
						Where Champions Are Made ✨
					</motion.p>
				</motion.div>

				{/* Subtitle */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 1.0 }}
					className="text-center mb-6"
				>
					<h2 className="text-2xl font-bold text-foreground mb-1">
						Start your free trial
					</h2>
					<p className="text-muted-foreground text-sm">
						7 days free · Up to 20 competitors · No credit card
					</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 30, scale: 0.95 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ delay: 0.4, duration: 0.6 }}
				>
					<Card className="border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10">
						<CardContent className="pt-6">
							<form onSubmit={handleSubmit} className="space-y-4">
								{/* Full Name */}
								<div className="space-y-2">
									<Label
										htmlFor="fullName"
										className="text-foreground font-semibold"
									>
										Full name
									</Label>
									<Input
										id="fullName"
										type="text"
										placeholder="Enter your full name"
										value={fullName}
										onChange={(e) =>
											setFullName(e.target.value)
										}
										className="h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
										autoFocus
										required
									/>
								</div>

								{/* Email + Verification */}
								<div className="space-y-2">
									<Label
										htmlFor="email"
										className="text-foreground font-semibold"
									>
										Email
									</Label>
									<div className="flex gap-2">
										<Input
											id="email"
											type="email"
											placeholder="Enter your email"
											value={email}
											onChange={(e) =>
												setEmail(e.target.value)
											}
											className="h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all flex-1"
											required
											disabled={emailVerified}
										/>
										{!emailVerified ? (
											<Button
												type="button"
												variant="outline"
												className="h-12 px-4 shrink-0"
												onClick={handleSendVerification}
												disabled={
													isSendingCode ||
													cooldown > 0 ||
													!email ||
													!isValidEmail(email)
												}
											>
												{isSendingCode ? (
													<Loader2 className="w-4 h-4 animate-spin" />
												) : cooldown > 0 ? (
													`${cooldown}s`
												) : verificationSent ? (
													"Resend"
												) : (
													<>
														<Mail className="w-4 h-4 mr-1" />
														Verify
													</>
												)}
											</Button>
										) : (
											<div className="h-12 px-3 flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10">
												<CheckCircle2 className="w-4 h-4 text-emerald-500" />
												<span className="text-xs text-emerald-500 font-medium">
													Verified
												</span>
											</div>
										)}
									</div>

									{/* 6-digit code input */}
									{verificationSent && !emailVerified && (
										<div className="space-y-2 pt-1">
											<p className="text-xs text-muted-foreground">
												Enter the 6-digit code sent to{" "}
												<span className="text-foreground font-medium">
													{email}
												</span>
											</p>
											<div
												className="flex gap-2 justify-center"
												onPaste={handleCodePaste}
											>
												{verificationCode.map(
													(digit, i) => (
														<Input
															key={i}
															ref={(el) => {
																codeInputRefs.current[
																	i
																] = el;
															}}
															type="text"
															inputMode="numeric"
															maxLength={1}
															value={digit}
															onChange={(e) =>
																handleCodeChange(
																	i,
																	e.target
																		.value,
																)
															}
															onKeyDown={(e) =>
																handleCodeKeyDown(
																	i,
																	e,
																)
															}
															className="w-11 h-12 text-center text-lg font-bold bg-input border-border text-foreground focus:border-primary focus:ring-primary/20"
															disabled={
																isVerifying
															}
														/>
													),
												)}
											</div>
											{isVerifying && (
												<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
													<Loader2 className="w-3 h-3 animate-spin" />
													Verifying...
												</div>
											)}
										</div>
									)}

									{verifyError && (
										<p className="text-xs text-red-400">
											{verifyError}
										</p>
									)}
								</div>

								{/* Password */}
								<div className="space-y-2">
									<Label
										htmlFor="password"
										className="text-foreground font-semibold"
									>
										Password
									</Label>
									<div className="relative group">
										<Input
											id="password"
											type={
												showPassword
													? "text"
													: "password"
											}
											placeholder="Create a password (min 6 characters)"
											value={password}
											onChange={(e) =>
												setPassword(e.target.value)
											}
											className="pr-11 h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
											required
										/>
										<button
											type="button"
											onClick={() =>
												setShowPassword(!showPassword)
											}
											className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
										>
											{showPassword ? (
												<EyeOff className="w-5 h-5" />
											) : (
												<Eye className="w-5 h-5" />
											)}
										</button>
									</div>
								</div>

								{/* Organization Name */}
								<div className="space-y-2">
									<Label
										htmlFor="organizationName"
										className="text-foreground font-semibold"
									>
										Event or organization name
									</Label>
									<Input
										id="organizationName"
										type="text"
										placeholder="e.g., WCS Nationals 2025"
										value={organizationName}
										onChange={(e) =>
											setOrganizationName(e.target.value)
										}
										className="h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
										required
									/>
								</div>

								{/* Dance Style + Expected Competitors */}
								{/* Terms Checkbox */}
								<div className="flex items-center space-x-2 pt-1">
									<Checkbox
										id="terms"
										checked={agreedToTerms}
										onCheckedChange={(checked) =>
											setAgreedToTerms(checked === true)
										}
										className="border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
									/>
									<label
										htmlFor="terms"
										className="text-sm text-muted-foreground cursor-pointer"
									>
										I agree to the Terms of Service and
										Privacy Policy
									</label>
								</div>

								{/* Error */}
								{error && (
									<motion.div
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
									>
										<p className="text-sm text-red-400 text-center">
											{error}
										</p>
									</motion.div>
								)}

								{/* Submit Button */}
								<Button
									type="submit"
									className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-primary/40 hover:scale-[1.02]"
									disabled={isLoading || !emailVerified}
								>
									{isLoading ? (
										<>
											<Loader2 className="w-5 h-5 mr-2 animate-spin" />
											Creating Account...
										</>
									) : (
										<>
											<Sparkles className="w-5 h-5 mr-2" />
											Create Free Trial
										</>
									)}
								</Button>
							</form>

							{/* Footer */}
							<div className="mt-6 pt-4 border-t border-border text-center">
								<p className="text-sm text-muted-foreground">
									Already have an account?{" "}
									<Link
										href="/admin/login"
										className="text-primary hover:text-primary/80 font-medium transition-colors"
									>
										Log In
									</Link>
								</p>
							</div>
						</CardContent>
					</Card>
				</motion.div>
			</div>
		</div>
	);
}
