"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface PinEntryProps {
	onSubmit: (pin: string) => void;
	error: string | null;
}

export function PinEntry({ onSubmit, error }: PinEntryProps) {
	const [pin, setPin] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);

	const handleKeyPress = (digit: string) => {
		if (pin.length < 4) {
			setPin((prev) => prev + digit);
		}
	};

	const handleDelete = () => {
		setPin((prev) => prev.slice(0, -1));
	};

	const handleSubmit = () => {
		if (pin.length === 4) {
			onSubmit(pin);
		}
	};

	// Handle keyboard input for both web and mobile
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Handle number keys (both main keyboard and numpad)
			if (/^[0-9]$/.test(e.key)) {
				e.preventDefault();
				handleKeyPress(e.key);
			}
			// Handle backspace and delete
			else if (e.key === "Backspace" || e.key === "Delete") {
				e.preventDefault();
				handleDelete();
			}
			// Handle Enter key
			else if (e.key === "Enter" && pin.length === 4) {
				e.preventDefault();
				handleSubmit();
			}
		};

		// Add event listener
		window.addEventListener("keydown", handleKeyDown);

		// Focus the container to ensure keyboard events are captured
		containerRef.current?.focus();

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [pin]);

	return (
		<div
			ref={containerRef}
			tabIndex={0}
			className="min-h-screen flex flex-col items-center justify-center p-6 bg-background outline-none"
		>
			{/* Hidden input for mobile keyboard support */}
			<input
				type="tel"
				inputMode="numeric"
				pattern="[0-9]*"
				autoComplete="one-time-code"
				className="sr-only"
				value={pin}
				onChange={(e) => {
					const value = e.target.value.replace(/\D/g, "").slice(0, 4);
					setPin(value);
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter" && pin.length === 4) {
						e.preventDefault();
						handleSubmit();
					}
				}}
				autoFocus
			/>

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="w-full max-w-sm"
			>
				<h1 className="text-2xl font-bold text-center text-foreground mb-2">
					Enter Your PIN
				</h1>
				<p className="text-center text-muted-foreground mb-8">
					Enter your 4-digit judge PIN to continue
				</p>

				{/* PIN display */}
				<div className="flex justify-center gap-3 mb-8">
					{[0, 1, 2, 3].map((i) => (
						<div
							key={i}
							className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
								pin.length > i
									? "border-primary bg-primary/10 text-primary"
									: "border-border bg-muted text-muted-foreground"
							}`}
						>
							{pin.length > i ? "•" : ""}
						</div>
					))}
				</div>

				{error && (
					<p className="text-center text-destructive mb-4 text-sm">
						{error}
					</p>
				)}

				{/* Number pad */}
				<div className="grid grid-cols-3 gap-3 mb-4">
					{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
						<Button
							key={digit}
							variant="outline"
							className="h-16 text-2xl font-semibold bg-transparent"
							onClick={() => handleKeyPress(String(digit))}
							type="button"
						>
							{digit}
						</Button>
					))}
					<Button
						variant="ghost"
						className="h-16 text-lg"
						onClick={handleDelete}
						type="button"
					>
						Delete
					</Button>
					<Button
						variant="outline"
						className="h-16 text-2xl font-semibold bg-transparent"
						onClick={() => handleKeyPress("0")}
						type="button"
					>
						0
					</Button>
					<Button
						variant="default"
						className="h-16 text-lg font-semibold"
						onClick={handleSubmit}
						disabled={pin.length !== 4}
						type="button"
					>
						Enter
					</Button>
				</div>

				{/* Keyboard hint */}
				<p className="text-center text-xs text-muted-foreground mt-4">
					You can also use your keyboard to enter the PIN
				</p>
			</motion.div>
		</div>
	);
}
