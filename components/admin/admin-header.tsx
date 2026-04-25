"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotificationBell, type Notification } from "./notification-bell";
import type { Event } from "@/lib/types";
import { getRoundName } from "@/lib/competition-config";
import { Monitor, RotateCcw, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AdminHeaderProps {
	event: Event;
	onReset: () => void;
	notifications?: Notification[];
	onMarkNotificationAsRead?: (id: string) => void;
	onMarkAllNotificationsAsRead?: () => void;
	onClearNotifications?: () => void;
}



export function AdminHeader({
	event,
	onReset,
	notifications = [],
	onMarkNotificationAsRead = () => {},
	onMarkAllNotificationsAsRead = () => {},
	onClearNotifications = () => {},
}: AdminHeaderProps) {
	const router = useRouter();

	const handleLogout = () => {
		sessionStorage.removeItem("adminAuthenticated");
		router.push("/admin/login");
	};

	return (
		<header className="bg-card border-b border-border sticky top-0 z-50">
			<div className="px-4 py-3 max-w-7xl mx-auto">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-xl font-bold text-foreground">
							{event.name}
						</h1>
						<p className="text-sm text-muted-foreground">
							Admin Control Panel
						</p>
					</div>

					<div className="flex items-center gap-3">
						<Badge
							variant={event.votingOpen ? "default" : "secondary"}
							className={
								event.votingOpen
									? "bg-emerald-500 text-white"
									: ""
							}
						>
							{event.votingOpen ? "Voting Open" : "Voting Closed"}
						</Badge>

						<Badge variant="outline" className="bg-transparent">
							{getRoundName(event, event.currentRound)} • Heat{" "}
							{event.currentHeat}
						</Badge>

						<NotificationBell
							notifications={notifications}
							onMarkAsRead={onMarkNotificationAsRead}
							onMarkAllAsRead={onMarkAllNotificationsAsRead}
							onClear={onClearNotifications}
						/>

						<Link
							href={`/display?event=${event.id}`}
							target="_blank"
						>
							<Button
								variant="outline"
								size="sm"
								className="bg-transparent"
							>
								<Monitor className="w-4 h-4 mr-2" />
								Display
							</Button>
						</Link>

						<Button
							variant="ghost"
							size="sm"
							onClick={onReset}
							title="Reset Data"
						>
							<RotateCcw className="w-4 h-4" />
						</Button>

						<Button
							variant="ghost"
							size="sm"
							onClick={handleLogout}
							title="Logout"
						>
							<LogOut className="w-4 h-4" />
						</Button>
					</div>
				</div>
			</div>
		</header>
	);
}
