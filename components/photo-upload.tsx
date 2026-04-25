"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, ImageIcon, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoUploadProps {
	onPhotoChange: (photoData: string | null, photoType: string | null) => void;
	initialPhotoUrl?: string;
	className?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PhotoUpload({
	onPhotoChange,
	initialPhotoUrl,
	className,
}: PhotoUploadProps) {
	const [preview, setPreview] = useState<string | null>(
		initialPhotoUrl || null
	);
	const [isDragging, setIsDragging] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isMobile, setIsMobile] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const cameraInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		// Detect mobile device
		const checkMobile = () => {
			setIsMobile(
				/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
					navigator.userAgent
				)
			);
		};
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	const validateFile = (file: File): string | null => {
		if (!ACCEPTED_TYPES.includes(file.type)) {
			return "Please upload a valid image (JPG, PNG, or WebP)";
		}
		if (file.size > MAX_FILE_SIZE) {
			return "Image must be less than 5MB";
		}
		return null;
	};

	const processFile = useCallback(
		(file: File) => {
			setError(null);
			const validationError = validateFile(file);
			if (validationError) {
				setError(validationError);
				return;
			}

			const reader = new FileReader();
			reader.onload = (e) => {
				const result = e.target?.result as string;
				setPreview(result);
				// Extract base64 data without the data URL prefix
				const base64Data = result.split(",")[1];
				onPhotoChange(base64Data, file.type);
			};
			reader.onerror = () => {
				setError("Failed to read file. Please try again.");
			};
			reader.readAsDataURL(file);
		},
		[onPhotoChange]
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);

			const files = e.dataTransfer.files;
			if (files.length > 0) {
				processFile(files[0]);
			}
		},
		[processFile]
	);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files;
			if (files && files.length > 0) {
				processFile(files[0]);
			}
		},
		[processFile]
	);

	const handleRemove = useCallback(() => {
		setPreview(null);
		setError(null);
		onPhotoChange(null, null);
		if (fileInputRef.current) fileInputRef.current.value = "";
		if (cameraInputRef.current) cameraInputRef.current.value = "";
	}, [onPhotoChange]);

	const openFilePicker = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const openCamera = useCallback(() => {
		cameraInputRef.current?.click();
	}, []);

	// On mobile, clicking the drop zone opens camera directly
	const handleDropZoneClick = useCallback(() => {
		if (isMobile) {
			openCamera();
		} else {
			openFilePicker();
		}
	}, [isMobile, openCamera, openFilePicker]);

	return (
		<div className={cn("space-y-3", className)}>
			{/* Hidden file inputs */}
			<input
				ref={fileInputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				onChange={handleFileSelect}
				className="hidden"
			/>
			<input
				ref={cameraInputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				capture="user"
				onChange={handleFileSelect}
				className="hidden"
			/>

			{preview ? (
				// Preview state
				<div className="flex flex-col items-center gap-4">
					<div className="relative">
						<div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary/50 shadow-lg">
							<img
								src={preview}
								alt="Photo preview"
								className="w-full h-full object-cover"
							/>
						</div>
						<div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
							<Check className="w-3 h-3" />
							Looking good!
						</div>
					</div>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={openFilePicker}
							className="bg-transparent"
						>
							Change
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleRemove}
							className="bg-transparent text-red-500 hover:text-red-600 hover:bg-red-500/10"
						>
							<X className="w-4 h-4 mr-1" />
							Remove
						</Button>
					</div>
				</div>
			) : (
				// Upload state
				<>
					<div
						onClick={handleDropZoneClick}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						className={cn(
							"border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all",
							isDragging
								? "border-primary bg-primary/10"
								: "border-border hover:border-primary/50 hover:bg-muted/50",
							error && "border-red-500/50"
						)}
					>
						<div className="flex flex-col items-center gap-2">
							<div
								className={cn(
									"w-12 h-12 rounded-full flex items-center justify-center",
									isDragging ? "bg-primary/20" : "bg-muted"
								)}
							>
								<ImageIcon
									className={cn(
										"w-6 h-6",
										isDragging
											? "text-primary"
											: "text-muted-foreground"
									)}
								/>
							</div>
							<div>
								<p className="font-medium text-foreground">
									{isMobile
										? "Tap to take a selfie"
										: "Drop your photo here"}
								</p>
								<p className="text-sm text-muted-foreground">
									{isMobile
										? "or choose from gallery"
										: "or click to browse"}
								</p>
							</div>
							<p className="text-xs text-muted-foreground">
								PNG, JPG up to 5MB
							</p>
						</div>
					</div>

					{/* Action buttons */}
					<div className="grid grid-cols-2 gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={openFilePicker}
							className="bg-transparent"
						>
							<Upload className="w-4 h-4 mr-2" />
							Upload
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={openCamera}
							className="bg-transparent"
						>
							<Camera className="w-4 h-4 mr-2" />
							Take Photo
						</Button>
					</div>
				</>
			)}

			{/* Error message */}
			{error && (
				<div className="flex items-center gap-2 text-red-500 text-sm">
					<AlertCircle className="w-4 h-4" />
					{error}
				</div>
			)}

			{/* Helper text */}
			{!preview && !error && (
				<p className="text-xs text-muted-foreground text-center">
					Your photo will be displayed during the competition
				</p>
			)}
		</div>
	);
}
