"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, UserPlus, Vote, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface Notification {
	id: string;
	type:
		| "competitor_registered"
		| "vote_submitted"
		| "round_complete"
		| "judge_connected";
	title: string;
	message: string;
	timestamp: Date;
	read: boolean;
}

interface NotificationBellProps {
	notifications: Notification[];
	onMarkAsRead: (id: string) => void;
	onMarkAllAsRead: () => void;
	onClear: () => void;
}

export function NotificationBell({
	notifications,
	onMarkAsRead,
	onMarkAllAsRead,
	onClear,
}: NotificationBellProps) {
	const [isOpen, setIsOpen] = useState(false);
	const unreadCount = notifications.filter((n) => !n.read).length;

	const getIcon = (type: Notification["type"]) => {
		switch (type) {
			case "competitor_registered":
				return <UserPlus className="h-4 w-4 text-emerald-500" />;
			case "vote_submitted":
				return <Vote className="h-4 w-4 text-blue-500" />;
			case "round_complete":
				return <Trophy className="h-4 w-4 text-amber-500" />;
			case "judge_connected":
				return <Users className="h-4 w-4 text-purple-500" />;
			default:
				return <Bell className="h-4 w-4" />;
		}
	};

	const formatTime = (date: Date) => {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);

		if (minutes < 1) return "Just now";
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return date.toLocaleDateString();
	};

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon" className="relative">
					<Bell className="h-5 w-5" />
					{unreadCount > 0 && (
						<Badge
							variant="destructive"
							className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
						>
							{unreadCount > 9 ? "9+" : unreadCount}
						</Badge>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align="end">
				<div className="flex items-center justify-between p-3 border-b">
					<h4 className="font-semibold">Notifications</h4>
					{notifications.length > 0 && (
						<div className="flex gap-2">
							<Button
								variant="ghost"
								size="sm"
								className="h-7 text-xs"
								onClick={onMarkAllAsRead}
							>
								Mark all read
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 text-xs text-muted-foreground"
								onClick={onClear}
							>
								Clear
							</Button>
						</div>
					)}
				</div>
				<ScrollArea className="h-[300px]">
					{notifications.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
							<Bell className="h-8 w-8 mb-2 opacity-50" />
							<p className="text-sm">No notifications</p>
						</div>
					) : (
						<div className="divide-y">
							{notifications.map((notification) => (
								<div
									key={notification.id}
									className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
										!notification.read ? "bg-primary/5" : ""
									}`}
									onClick={() =>
										onMarkAsRead(notification.id)
									}
								>
									<div className="flex gap-3">
										<div className="mt-0.5">
											{getIcon(notification.type)}
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between gap-2">
												<p className="font-medium text-sm truncate">
													{notification.title}
												</p>
												{!notification.read && (
													<div className="h-2 w-2 rounded-full bg-primary shrink-0" />
												)}
											</div>
											<p className="text-xs text-muted-foreground mt-0.5">
												{notification.message}
											</p>
											<p className="text-xs text-muted-foreground mt-1">
												{formatTime(
													notification.timestamp
												)}
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>
			</PopoverContent>
		</Popover>
	);
}
