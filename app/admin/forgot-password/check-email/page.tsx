"use client";

import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import {
	CheckCircle2,
	Mail,
	Loader2,
	ArrowLeft,
	Crown,
	Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

function CheckEmailContent() {
	const searchParams = useSearchParams();
	const email = searchParams?.get("email") || "";
	const [isResending, setIsResending] = useState(false);
	const [resendSuccess, setResendSuccess] = useState(false);

	const handleResend = async () => {
		setIsResending(true);
		setResendSuccess(false);

		try {
			const baseUrl = window.location.origin;
			const response = await fetch("/api/admin/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, baseUrl }),
			});

			const data = await response.json();

			if (data.success) {
				setResendSuccess(true);
				setTimeout(() => setResendSuccess(false), 5000);
			}
		} catch (err) {
			// Silently fail
		}

		setIsResending(false);
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
							{/* Success Icon */}
							<motion.div
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								transition={{
									delay: 0.2,
									type: "spring",
									stiffness: 200,
								}}
								className="flex justify-center mb-6"
							>
								<div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
									<CheckCircle2 className="w-10 h-10 text-primary" />
								</div>
							</motion.div>

							{/* Text */}
							<motion.div
								initial={{ opacity: 0, y: -10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.4 }}
								className="text-center mb-8"
							>
								<h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
									Check Your Email
								</h1>
								<p className="text-muted-foreground text-sm leading-relaxed">
									We sent a password reset link to{" "}
									<strong className="text-foreground">
										{email}
									</strong>
									. Click the link in the email to set a new
									password.
								</p>
								<p className="text-muted-foreground/60 text-xs mt-4">
									The link expires in 1 hour.
								</p>
							</motion.div>

							{/* Resend Button */}
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.6 }}
							>
								<Button
									variant="outline"
									className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all"
									onClick={handleResend}
									disabled={isResending || resendSuccess}
								>
									{isResending ? (
										<>
											<Loader2 className="w-5 h-5 mr-2 animate-spin" />
											Sending...
										</>
									) : resendSuccess ? (
										<>
											<CheckCircle2 className="w-5 h-5 mr-2" />
											Email Sent!
										</>
									) : (
										<>
											<Mail className="w-5 h-5 mr-2" />
											Resend Email
										</>
									)}
								</Button>
							</motion.div>

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

export default function CheckEmailPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-background flex items-center justify-center">
					<Loader2 className="w-8 h-8 animate-spin text-primary" />
				</div>
			}
		>
			<CheckEmailContent />
		</Suspense>
	);
}
