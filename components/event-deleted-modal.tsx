"use client";

import { useEffect, useState } from "react";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

interface EventDeletedModalProps {
	isOpen: boolean;
	eventName?: string;
	onClose: () => void;
}

export function EventDeletedModal({
	isOpen,
	eventName,
	onClose,
}: EventDeletedModalProps) {
	const router = useRouter();

	const handleGoHome = () => {
		onClose();
		router.push("/");
	};

	return (
		<AlertDialog open={isOpen}>
			<AlertDialogContent className="max-w-md">
				<AlertDialogHeader>
					<div className="flex items-center justify-center mb-4">
						<div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
							<AlertTriangle className="w-8 h-8 text-destructive" />
						</div>
					</div>
					<AlertDialogTitle className="text-center text-xl">
						Event No Longer Available
					</AlertDialogTitle>
					<AlertDialogDescription className="text-center">
						{eventName ? (
							<>
								The event <strong>"{eventName}"</strong> has
								been deleted by an administrator and is no
								longer available.
							</>
						) : (
							<>
								This event has been deleted by an administrator
								and is no longer available.
							</>
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter className="flex-col sm:flex-row gap-2">
					<Button onClick={handleGoHome} className="w-full sm:w-auto">
						Go to Home Page
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
