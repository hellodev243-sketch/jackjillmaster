"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useSocket } from "@/hooks/use-socket";
import { EventDeletedModal } from "@/components/event-deleted-modal";
import Link from "next/link";
import {
	Users,
	UserPlus,
	Sparkles,
	ChevronRight,
	Loader2,
	Trophy,
	Calendar,
	MapPin,
	Star,
	Music,
	Heart,
} from "lucide-react";
import { motion } from "framer-motion";

function HomePage() {
	const searchParams = useSearchParams();
	const eventId = searchParams?.get("event") || undefined;

	const {
		event,
		isLoading,
		isConnected,
		deletedEventInfo,
		clearDeletedEventInfo,
	} = useSocket(eventId);
	const [showSplash, setShowSplash] = useState(true);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Splash Screen with event data from GCS
	if (showSplash) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
				{/* Animated Background Elements */}
				<div className="absolute inset-0 overflow-hidden pointer-events-none">
					<div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
					<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
				</div>
				<div className="text-center z-10 px-6 max-w-2xl mx-auto">
					{/* Logo Icon */}
					<motion.div
						initial={{ scale: 0, rotate: -180 }}
						animate={{ scale: 1, rotate: 0 }}
						transition={{
							type: "spring",
							stiffness: 200,
							delay: 0.2,
						}}
						className="mb-8"
					>
						<div className="w-28 h-28 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-primary/40">
							<img
								src="/jack-and-jill-logo-transparent.png"
								alt="Jack & Jill"
								className="w-28 h-28 object-contain"
							/>
						</div>
					</motion.div>

					{/* Dance Style Badge */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.3 }}
						className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full border border-amber-500/30 mb-6"
					>
						<Music className="w-4 h-4 text-amber-400" />
						<span className="text-amber-300 text-sm font-semibold tracking-wide">
							Welcome to Jack & Jill
						</span>
						<Heart className="w-4 h-4 text-amber-400" />
					</motion.div>

					{/* Main Title */}
					<motion.h1
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.4 }}
						className="text-5xl md:text-5xl font-extrabold bg-gradient-to-r from-white via-amber-200 to-orange-200 bg-clip-text text-transparent mb-6 tracking-tight"
					>
						Jack & Jill Competition
					</motion.h1>

					{/* Event Name */}
					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.6 }}
						className="text-2xl md:text-2xl text-primary font-bold mb-6 tracking-wide"
					>
						{event?.name || "Competition 2025"}
					</motion.p>

					{/* Event Details Card */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.7 }}
						className="inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-6 px-6 py-4 bg-card/40 backdrop-blur-sm rounded-2xl border border-border/50 mb-6"
					>
						<div className="flex items-center gap-2 text-foreground">
							<MapPin className="w-5 h-5 text-primary" />
							<span className="font-medium">
								{event?.venue || "Grand Ballroom, Los Angeles"}
							</span>
						</div>
						<div className="hidden sm:block w-px h-6 bg-border" />
						<div className="flex items-center gap-2 text-foreground">
							<Calendar className="w-5 h-5 text-primary" />
							<span className="font-medium">
								{event?.date
									? new Date(event.date).toLocaleDateString(
											"en-US",
											{
												weekday: "long",
												year: "numeric",
												month: "long",
												day: "numeric",
											},
										)
									: "January 15, 2025"}
							</span>
						</div>
					</motion.div>

					{/* Tagline */}
					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.8 }}
						className="text-lg text-amber-200/70 mb-10 italic"
					>
						"Where Every Dance Tells a Story"
					</motion.p>

					{/* CTA Button */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 1 }}
					>
						<Button
							size="lg"
							onClick={() => setShowSplash(false)}
							className="h-14 px-10 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-2xl shadow-primary/30 transition-all duration-300 hover:shadow-primary/50 hover:scale-105 rounded-xl"
						>
							Get Started
						</Button>
					</motion.div>

					{/* Bottom Text */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 1.2 }}
						className="mt-10 space-y-2"
					>
						<p className="text-base text-muted-foreground font-medium">
							💃 Dance • Connect • Compete 🕺
						</p>
						<p className="text-sm text-muted-foreground/60">
							Random partner pairing • All skill levels welcome
						</p>
					</motion.div>

					{isLoading && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.5 }}
							className="flex items-center justify-center gap-2 mt-6"
						>
							<Loader2 className="w-4 h-4 animate-spin text-primary" />
							<span className="text-muted-foreground text-sm">
								Loading event data...
							</span>
						</motion.div>
					)}
				</div>
			</div>
		);
	}

	// Loading state after splash
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

	// Main page after splash - simplified without duplicate header
	return (
		<div className="min-h-screen bg-background p-6 relative overflow-hidden">
			{/* Animated Background Elements */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
				<div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
			</div>

			<div className="max-w-4xl mx-auto relative z-10">
				{/* Simple Header */}
				<motion.header
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
					className="text-center mb-8"
				>
					<div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full border border-amber-500/30 mb-4">
						<Trophy className="w-4 h-4 text-amber-400" />
						<span className="text-amber-300 text-sm font-medium">
							{event?.name ||
								"West Coast Swing Championship 2025"}
						</span>
						<Star className="w-4 h-4 text-amber-400" />
					</div>

					{/* Event Details */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.2 }}
						className="flex items-center justify-center gap-4 text-sm text-muted-foreground flex-wrap"
					>
						<span className="flex items-center gap-1">
							<MapPin className="w-4 h-4 text-primary" />
							{event?.venue || "Grand Ballroom, Los Angeles"}
						</span>
						<span className="hidden sm:inline">•</span>
						<span className="flex items-center gap-1">
							<Calendar className="w-4 h-4 text-primary" />
							{event?.date
								? new Date(event.date).toLocaleDateString(
										"en-US",
										{
											weekday: "long",
											year: "numeric",
											month: "long",
											day: "numeric",
										},
									)
								: "January 15, 2025"}
						</span>
					</motion.div>

					{!isConnected && (
						<div className="flex items-center justify-center gap-2 mt-4">
							<Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
							<span className="text-yellow-500 text-sm">
								Connecting to server...
							</span>
						</div>
					)}
				</motion.header>

				<div className="grid gap-6 md:grid-cols-1 max-w-xl mx-auto">
					{/* Main Registration Card */}
					<motion.div
						initial={{ opacity: 0, y: 30, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={{ delay: 0.2, duration: 0.6 }}
					>
						<Card className="border-primary/30 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden">
							<div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
							<CardHeader className="text-center pb-4 relative">
								<motion.div
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									transition={{ delay: 0.4, type: "spring" }}
									className="mb-4"
								>
									<img
										src="/jack-and-jill-logo-transparent.png"
										alt="Jack & Jill"
										className="w-16 h-16 mx-auto object-contain"
									/>
								</motion.div>
								<CardTitle className="text-2xl text-foreground">
									Competition Registration
								</CardTitle>
								<CardDescription className="text-base">
									Join the excitement! Register now and
									showcase your talent on the dance floor
								</CardDescription>
							</CardHeader>
							<CardContent className="pt-0 relative">
								<Link
									href={
										event?.id
											? `/register?event=${event.id}`
											: "/register"
									}
								>
									<Button
										className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-primary/40 hover:scale-[1.02]"
										size="lg"
									>
										Register Now
										<ChevronRight className="w-5 h-5 ml-2" />
									</Button>
								</Link>
								<p className="text-xs text-center text-muted-foreground mt-3">
									🎯 Random partner pairing • Fair competition
									• Amazing prizes
								</p>
							</CardContent>
						</Card>
					</motion.div>

					{/* Competition Stats */}
					<motion.div
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.4, duration: 0.6 }}
					>
						<Card className="border-white/10 bg-card/60 backdrop-blur-sm">
							<CardHeader className="pb-4">
								<CardTitle className="flex items-center justify-center gap-2 text-foreground text-lg">
									<Users className="w-5 h-5 text-primary" />
									Competition Stats
								</CardTitle>
								<CardDescription className="text-center">
									Join {maleCount + femaleCount} amazing
									dancers already registered!
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-3 gap-4 text-center">
									<motion.div
										initial={{ opacity: 0, scale: 0.8 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ delay: 0.5 }}
										className="p-4 bg-muted/50 rounded-xl border border-border"
									>
										<p className="text-3xl font-bold text-primary">
											{maleCount + femaleCount}
										</p>
										<p className="text-xs text-muted-foreground">
											Total Dancers
										</p>
									</motion.div>
									<motion.div
										initial={{ opacity: 0, scale: 0.8 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ delay: 0.6 }}
										className="p-4 bg-muted/50 rounded-xl border border-border"
									>
										<p className="text-3xl font-bold text-blue-400">
											{maleCount}
										</p>
										<p className="text-xs text-muted-foreground">
											Leads 🕺
										</p>
									</motion.div>
									<motion.div
										initial={{ opacity: 0, scale: 0.8 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ delay: 0.7 }}
										className="p-4 bg-muted/50 rounded-xl border border-border"
									>
										<p className="text-3xl font-bold text-pink-400">
											{femaleCount}
										</p>
										<p className="text-xs text-muted-foreground">
											Follows 💃
										</p>
									</motion.div>
								</div>
							</CardContent>
						</Card>
					</motion.div>
				</div>

				{/* Footer */}
				<motion.footer
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.8 }}
					className="mt-6 text-center text-sm text-muted-foreground"
				>
					<p className="text-amber-300/60">
						✨ Where Every Dance Tells a Story ✨
					</p>
					<p className="text-xs mt-2 text-muted-foreground/60">
						© 2025 Jack & Jill Competition System
					</p>
				</motion.footer>
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

function HomePageWrapper() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-background flex items-center justify-center">
					<Loader2 className="w-8 h-8 animate-spin text-primary" />
				</div>
			}
		>
			<HomePage />
		</Suspense>
	);
}

export default HomePageWrapper;
