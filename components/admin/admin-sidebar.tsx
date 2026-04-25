"use client";

import { Button } from "@/components/ui/button";
import {
	LayoutDashboard,
	Radio,
	Grid3X3,
	Trophy,
	Users,
	UserCheck,
	Scale,
	Settings,
	LogOut,
	ChevronLeft,
	ChevronRight,
	Sparkles,
	Plus,
	Zap,
	Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminProfile } from "@/lib/admin-types";

interface AdminSidebarProps {
	activeTab: string;
	onTabChange: (tab: string) => void;
	adminProfile?: AdminProfile | null;
	onLogout: () => void;
	collapsed?: boolean;
	onToggleCollapse?: () => void;
}

const mainNavItems = [
	{
		id: "dashboard",
		label: "Dashboard",
		icon: LayoutDashboard,
	},
	{
		id: "create-event",
		label: "Create Event",
		icon: Plus,
	},
];

const eventNavItems = [
	{
		id: "control",
		label: "Round Control",
		icon: Radio,
	},
	{
		id: "heats",
		label: "Heat & Pairings",
		icon: Grid3X3,
	},
	{
		id: "results",
		label: "Results",
		icon: Trophy,
	},
	{
		id: "competitors",
		label: "Competitors",
		icon: Users,
	},
	{
		id: "assistants",
		label: "Assistants",
		icon: UserCheck,
	},
	{
		id: "judges",
		label: "Judges",
		icon: Scale,
	},
	{
		id: "settings",
		label: "Settings",
		icon: Settings,
	},
];

export function AdminSidebar({
	activeTab,
	onTabChange,
	adminProfile,
	onLogout,
	collapsed = false,
	onToggleCollapse,
}: AdminSidebarProps) {
	return (
		<div
			className={cn(
				"h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 sticky top-0",
				collapsed ? "w-[72px]" : "w-[260px]",
			)}
		>
			{/* Logo */}
			<div className="p-4 border-b border-sidebar-border">
				<div className="flex items-center gap-3">
					<img
						src="/jack-and-jill-logo-transparent.png"
						alt="Jack & Jill"
						className="w-9 h-9 rounded-lg object-contain flex-shrink-0"
					/>
					{!collapsed && (
						<div className="overflow-hidden">
							<h1 className="text-sm font-bold text-sidebar-foreground leading-tight">
								Jack & Jill
							</h1>
							<p className="text-[11px] text-sidebar-foreground/60 leading-tight">
								Competition System
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Free Trial Badge */}
			{!collapsed &&
				adminProfile?.trialExpiresAt &&
				(() => {
					const now = new Date();
					const expires = new Date(adminProfile.trialExpiresAt);
					const diffMs = expires.getTime() - now.getTime();
					const daysRemaining = Math.max(
						0,
						Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
					);
					return (
						<div className="mx-3 mt-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
							<div className="flex items-center gap-1.5 mb-1">
								<Zap className="w-3.5 h-3.5 text-primary" />
								<span className="text-xs font-semibold text-primary">
									Free Trial
								</span>
							</div>
							<p className="text-[11px] text-sidebar-foreground/60 mb-2.5">
								{daysRemaining} day
								{daysRemaining !== 1 ? "s" : ""} remaining
							</p>
							<a
								href="https://jackandjillsoftware.lovable.app/pricing"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center gap-1.5 w-full h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors"
							>
								<Crown className="w-3.5 h-3.5" />
								Upgrade
							</a>
						</div>
					);
				})()}
			{collapsed && adminProfile?.trialExpiresAt && (
				<div className="mx-2 mt-3 flex justify-center">
					<a
						href="https://jackandjillsoftware.lovable.app/pricing"
						target="_blank"
						rel="noopener noreferrer"
						className="w-9 h-9 rounded-lg bg-primary hover:bg-primary/90 flex items-center justify-center transition-colors"
						title="Upgrade"
					>
						<Crown className="w-4 h-4 text-primary-foreground" />
					</a>
				</div>
			)}

			{/* Navigation */}
			<nav className="flex-1 py-3 px-2 overflow-y-auto">
				{/* Main */}
				<div className="space-y-1">
					{!collapsed && (
						<p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
							Main
						</p>
					)}
					{mainNavItems.map((item) => {
						const Icon = item.icon;
						const isActive = activeTab === item.id;

						return (
							<button
								key={item.id}
								onClick={() => onTabChange(item.id)}
								className={cn(
									"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
									isActive
										? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-sidebar-primary/30"
										: "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
								)}
								title={collapsed ? item.label : undefined}
							>
								<Icon
									className={cn(
										"w-5 h-5 flex-shrink-0",
										isActive
											? "text-sidebar-primary-foreground"
											: "text-sidebar-foreground/60",
									)}
								/>
								{!collapsed && (
									<span className="truncate">
										{item.label}
									</span>
								)}
							</button>
						);
					})}
				</div>

				{/* Event tabs */}
				<div className="space-y-1 pt-3">
					{!collapsed && (
						<p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
							Event
						</p>
					)}
					{eventNavItems.map((item) => {
						const Icon = item.icon;
						const isActive = activeTab === item.id;

						return (
							<button
								key={item.id}
								onClick={() => onTabChange(item.id)}
								className={cn(
									"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
									isActive
										? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-sidebar-primary/30"
										: "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
								)}
								title={collapsed ? item.label : undefined}
							>
								<Icon
									className={cn(
										"w-5 h-5 flex-shrink-0",
										isActive
											? "text-sidebar-primary-foreground"
											: "text-sidebar-foreground/60",
									)}
								/>
								{!collapsed && (
									<span className="truncate">
										{item.label}
									</span>
								)}
							</button>
						);
					})}
				</div>
			</nav>

			{/* Admin Profile + Actions */}
			<div className="border-t border-sidebar-border p-3 space-y-2">
				{/* Collapse Toggle */}
				{onToggleCollapse && (
					<button
						onClick={onToggleCollapse}
						className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-xs"
					>
						{collapsed ? (
							<ChevronRight className="w-4 h-4" />
						) : (
							<>
								<ChevronLeft className="w-4 h-4" />
								<span>Collapse</span>
							</>
						)}
					</button>
				)}

				{/* Profile */}
				{adminProfile && !collapsed && (
					<div className="px-3 py-2">
						<p className="text-xs font-medium text-sidebar-foreground truncate">
							{adminProfile.fullName}
						</p>
						<p className="text-[11px] text-sidebar-foreground/50 truncate">
							{adminProfile.email}
						</p>
					</div>
				)}

				{/* Logout Button */}
				<button
					onClick={onLogout}
					className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
					title={collapsed ? "Logout" : undefined}
				>
					<LogOut className="w-5 h-5 flex-shrink-0" />
					{!collapsed && <span>Logout</span>}
				</button>
			</div>
		</div>
	);
}
