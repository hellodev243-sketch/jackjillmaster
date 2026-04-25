"use client";

import type React from "react";
import { useState, useEffect } from "react";
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
import { useRouter } from "next/navigation";
import {
	Lock,
	ShieldCheck,
	Mail,
	Loader2,
	Sparkles,
	Crown,
	Eye,
	EyeOff,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function AdminLoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showRegisteredSuccess, setShowRegisteredSuccess] = useState(false);
	const router = useRouter();

	useEffect(() => {
		setMounted(true);
		// Check if already authenticated
		const authStatus = sessionStorage.getItem("adminAuthenticated");
		const adminProfileStr = sessionStorage.getItem("adminProfile");
		if (authStatus === "true" && adminProfileStr) {
			try {
				const profile = JSON.parse(adminProfileStr);
				router.push(`/admin/dashboard?adminId=${profile.id}`);
			} catch {
				router.push("/admin/dashboard");
			}
		}
		// Check if redirected from registration
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			if (params.get("registered") === "true") {
				setShowRegisteredSuccess(true);
			}
		}
	}, [router]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setIsLoading(true);
		setShowRegisteredSuccess(false);

		try {
			const response = await fetch("/api/admin/auth", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});

			const data = await response.json();

			if (data.success && data.authenticated) {
				sessionStorage.setItem("adminAuthenticated", "true");
				sessionStorage.setItem("adminEmail", email);
				if (data.admin) {
					sessionStorage.setItem(
						"adminProfile",
						JSON.stringify(data.admin),
					);
					router.push(`/admin/dashboard?adminId=${data.admin.id}`);
				} else {
					router.push("/admin/dashboard");
				}
			} else {
				setError("Invalid email or password. Please try again.");
			}
		} catch (err) {
			setError("Authentication failed. Please try again.");
		}

		setIsLoading(false);
	};

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
			{/* Animated Background Elements */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
				<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
			</div>

			<div className="w-full max-w-md relative z-10">
				{/* Hero Text */}
				<motion.div
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
						className="text-4xl md:text-4xl font-bold bg-gradient-to-r from-white via-amber-200 to-orange-200 bg-clip-text text-transparent mb-3"
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

				{/* Login Card */}
				<motion.div
					initial={{ opacity: 0, y: 30, scale: 0.95 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ delay: 0.4, duration: 0.6 }}
				>
					<Card className="border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10">
						<CardHeader className="text-center pb-2">
							<CardTitle className="text-3xl text-foreground">
								Welcome Back!
							</CardTitle>
							<CardDescription className="text-muted-foreground">
								Sign in to access the competition control panel
							</CardDescription>
						</CardHeader>
						<CardContent className="pt-4">
							<form onSubmit={handleSubmit} className="space-y-5">
								<motion.div
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: 1 }}
									className="space-y-2"
								>
									<Label
										htmlFor="email"
										className="text-foreground"
									>
										Email
									</Label>
									<div className="relative group">
										<Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
										<Input
											id="email"
											type="email"
											placeholder="Enter your email"
											value={email}
											onChange={(e) =>
												setEmail(e.target.value)
											}
											className="pl-11 h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
											autoFocus
											required
										/>
									</div>
								</motion.div>

								<motion.div
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: 1.1 }}
									className="space-y-2"
								>
									<div className="flex items-center justify-between">
										<Label
											htmlFor="password"
											className="text-foreground"
										>
											Password
										</Label>
										<Link
											href="/admin/forgot-password"
											className="text-xs text-primary hover:text-primary/80 transition-colors"
										>
											Forgot Password?
										</Link>
									</div>
									<div className="relative group">
										<Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
										<Input
											id="password"
											type={
												showPassword
													? "text"
													: "password"
											}
											placeholder="Enter your password"
											value={password}
											onChange={(e) =>
												setPassword(e.target.value)
											}
											className="pl-11 pr-11 h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 transition-all"
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
								</motion.div>

								{showRegisteredSuccess && (
									<motion.div
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
									>
										<p className="text-sm text-emerald-400 text-center">
											🎉 Account created successfully!
											Please sign in with your
											credentials.
										</p>
									</motion.div>
								)}

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

								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 1.2 }}
								>
									<Button
										type="submit"
										className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-primary/40 hover:scale-[1.02]"
										disabled={
											isLoading || !email || !password
										}
									>
										{isLoading ? (
											<>
												<Loader2 className="w-5 h-5 mr-2 animate-spin" />
												Verifying...
											</>
										) : (
											<>
												<ShieldCheck className="w-5 h-5 mr-2" />
												Access Control Panel
											</>
										)}
									</Button>
								</motion.div>
							</form>

							{/* Footer */}
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 1.4 }}
								className="mt-6 pt-4 border-t border-border text-center space-y-3"
							>
								<p className="text-sm text-muted-foreground">
									Don&apos;t have an account?{" "}
									<Link
										href="/admin/register"
										className="text-primary hover:text-primary/80 font-medium transition-colors"
									>
										Sign Up
									</Link>
								</p>
							</motion.div>
						</CardContent>
					</Card>
				</motion.div>

				{/* Bottom Tagline */}
				<motion.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 1.5 }}
					className="text-center text-muted-foreground text-sm mt-6"
				>
					Powering dance competitions worldwide 💃🕺
				</motion.p>
			</div>
		</div>
	);
}
