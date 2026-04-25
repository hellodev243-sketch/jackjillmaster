"use client";

import type React from "react";
import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Lock,
	Loader2,
	Eye,
	EyeOff,
	KeyRound,
	Crown,
	Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

function ResetPasswordContent() {
	const searchParams = useSearchParams();
	const token = searchParams?.get("token") || "";
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (password.length < 6) {
			setError("Password must be at least 6 characters");
			return;
		}

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		setIsLoading(true);

		try {
			const response = await fetch("/api/admin/reset-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, password }),
			});

			const data = await response.json();

			if (data.success) {
				router.push("/admin/reset-password/success");
			} else {
				setError(
					data.error ||
						"Failed to reset password. The link may have expired.",
				);
			}
		} catch (err) {
			setError("Failed to reset password. Please try again.");
		}

		setIsLoading(false);
	};

	if (!token) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center p-6">
				<Card className="border-white/10 bg-card/80 backdrop-blur-xl w-full max-w-md">
					<CardContent className="pt-8 pb-8 text-center">
						<div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
							<KeyRound className="w-8 h-8 text-red-400" />
						</div>
						<h1 className="text-2xl font-bold text-foreground mb-2">
							Invalid Reset Link
						</h1>
						<p className="text-muted-foreground text-sm mb-6">
							This password reset link is invalid or has expired.
							Please request a new one.
						</p>
						<Button
							onClick={() =>
								router.push("/admin/forgot-password")
							}
							className="bg-primary hover:bg-primary/90"
						>
							Request New Link
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
			{/* Animated Background */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-primary/8 rounded-full blur-3xl animate-pulse" />
				<div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-amber-500/8 rounded-full blur-3xl animate-pulse delay-1000" />
			</div>

			<div className="w-full max-w-md relative z-10">
				{/* Hero Text */}
				<motion.div
					initial={{ opacity: 0, y: -30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, ease: "easeOut" }}
					className="text-center mb-6"
				>
					<div className="mb-4">
						<img
							src="/jack-and-jill-logo-transparent.png"
							alt="Jack & Jill"
							className="w-16 h-16 mx-auto object-contain"
						/>
					</div>
					<h1 className="text-4xl font-bold bg-gradient-to-r from-white via-amber-200 to-orange-200 bg-clip-text text-transparent mb-3">
						Jack & Jill
					</h1>
					<p className="text-xl text-amber-200/80 font-light">
						Competition Management System
					</p>
					<p className="text-sm text-muted-foreground mt-2">
						Where Champions Are Made ✨
					</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 30, scale: 0.95 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ duration: 0.6 }}
				>
					<Card className="border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10">
						<CardContent className="pt-8 pb-8">
							{/* Header */}
							<motion.div
								initial={{ opacity: 0, y: -20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.2 }}
								className="text-center mb-8"
							>
								<div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
									<Lock className="w-8 h-8 text-primary" />
								</div>
								<h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
									Set New Password
								</h1>
								<p className="text-muted-foreground text-sm">
									Create a strong password for your account
								</p>
							</motion.div>

							<form onSubmit={handleSubmit} className="space-y-5">
								{/* New Password */}
								<motion.div
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: 0.4 }}
									className="space-y-2"
								>
									<Label
										htmlFor="password"
										className="text-foreground font-semibold"
									>
										New Password
									</Label>
									<div className="relative group">
										<Input
											id="password"
											type={
												showPassword
													? "text"
													: "password"
											}
											placeholder="Enter new password"
											value={password}
											onChange={(e) =>
												setPassword(e.target.value)
											}
											className="pr-11 h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
											autoFocus
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
									<p className="text-xs text-muted-foreground">
										Must be at least 6 characters
									</p>
								</motion.div>

								{/* Confirm Password */}
								<motion.div
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: 0.5 }}
									className="space-y-2"
								>
									<Label
										htmlFor="confirmPassword"
										className="text-foreground font-semibold"
									>
										Confirm Password
									</Label>
									<div className="relative group">
										<Input
											id="confirmPassword"
											type={
												showConfirm
													? "text"
													: "password"
											}
											placeholder="Confirm new password"
											value={confirmPassword}
											onChange={(e) =>
												setConfirmPassword(
													e.target.value,
												)
											}
											className="pr-11 h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
											required
										/>
										<button
											type="button"
											onClick={() =>
												setShowConfirm(!showConfirm)
											}
											className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
										>
											{showConfirm ? (
												<EyeOff className="w-5 h-5" />
											) : (
												<Eye className="w-5 h-5" />
											)}
										</button>
									</div>
								</motion.div>

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

								{/* Submit */}
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.7 }}
								>
									<Button
										type="submit"
										className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg transition-all duration-300 hover:scale-[1.02]"
										disabled={
											isLoading ||
											!password ||
											!confirmPassword
										}
									>
										{isLoading ? (
											<>
												<Loader2 className="w-5 h-5 mr-2 animate-spin" />
												Resetting...
											</>
										) : (
											"Reset Password"
										)}
									</Button>
								</motion.div>
							</form>
						</CardContent>
					</Card>
				</motion.div>
			</div>
		</div>
	);
}

export default function ResetPasswordPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-background flex items-center justify-center">
					<Loader2 className="w-8 h-8 animate-spin text-primary" />
				</div>
			}
		>
			<ResetPasswordContent />
		</Suspense>
	);
}
