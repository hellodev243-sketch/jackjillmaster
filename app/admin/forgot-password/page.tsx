"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { Mail, Loader2, ArrowLeft, Crown, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setIsLoading(true);

		try {
			const baseUrl = window.location.origin;
			const response = await fetch("/api/admin/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, baseUrl }),
			});

			const data = await response.json();

			if (data.success) {
				// Navigate to check email page
				router.push(
					`/admin/forgot-password/check-email?email=${encodeURIComponent(email)}`,
				);
			} else {
				setError(data.error || "Failed to send reset link");
			}
		} catch (err) {
			setError("Failed to send reset link. Please try again.");
		}

		setIsLoading(false);
	};

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
								<h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
									Forgot Password?
								</h1>
								<p className="text-muted-foreground text-sm">
									Enter your email and we&apos;ll send you a
									link to reset your password.
								</p>
							</motion.div>

							<form onSubmit={handleSubmit} className="space-y-5">
								{/* Email */}
								<motion.div
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: 0.4 }}
									className="space-y-2"
								>
									<Label
										htmlFor="email"
										className="text-foreground font-semibold"
									>
										Email Address
									</Label>
									<div className="relative group">
										<Input
											id="email"
											type="email"
											placeholder="Enter your email"
											value={email}
											onChange={(e) =>
												setEmail(e.target.value)
											}
											className="h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
											autoFocus
											required
										/>
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
									transition={{ delay: 0.6 }}
								>
									<Button
										type="submit"
										className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg transition-all duration-300 hover:scale-[1.02]"
										disabled={isLoading || !email}
									>
										{isLoading ? (
											<>
												<Loader2 className="w-5 h-5 mr-2 animate-spin" />
												Sending...
											</>
										) : (
											<>
												<Mail className="w-5 h-5 mr-2" />
												Send Link
											</>
										)}
									</Button>
								</motion.div>
							</form>

							{/* Back to Sign In */}
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.8 }}
								className="mt-6 text-center"
							>
								<Link
									href="/admin/login"
									className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									<ArrowLeft className="w-4 h-4" />
									Back to Sign In
								</Link>
							</motion.div>
						</CardContent>
					</Card>
				</motion.div>
			</div>
		</div>
	);
}
