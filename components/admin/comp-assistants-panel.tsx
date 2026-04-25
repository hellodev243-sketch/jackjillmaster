"use client";

import { useState, useRef } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CompAssistant, Gender } from "@/lib/types";
import {
	Search,
	Pencil,
	Trash2,
	UserPlus,
	Camera,
	X,
	HelpCircle,
	AlertCircle,
	Upload,
} from "lucide-react";
import { toast } from "sonner";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";

interface CompAssistantsPanelProps {
	compAssistants: CompAssistant[];
	competitionStarted?: boolean;
	maleStartNumber?: number;
	maleEndNumber?: number;
	femaleStartNumber?: number;
	femaleEndNumber?: number;
	eventId?: string;
	onAdd?: (
		name: string,
		number: number,
		gender: Gender,
		photoData?: string,
		photoType?: string
	) => Promise<CompAssistant | null>;
	onUpdate?: (
		compAssistantId: string,
		updates: Partial<CompAssistant> & {
			photoData?: string;
			photoType?: string;
		}
	) => Promise<boolean>;
	onDelete?: (compAssistantId: string) => Promise<boolean>;
}

export function CompAssistantsPanel({
	compAssistants,
	competitionStarted = false,
	maleStartNumber,
	maleEndNumber,
	femaleStartNumber,
	femaleEndNumber,
	eventId,
	onAdd,
	onUpdate,
	onDelete,
}: CompAssistantsPanelProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [selectedAssistant, setSelectedAssistant] =
		useState<CompAssistant | null>(null);
	const [editNumber, setEditNumber] = useState<number | "">("");
	const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(
		null
	);
	const [editPhotoData, setEditPhotoData] = useState<string | null>(null);
	const [editPhotoType, setEditPhotoType] = useState<string | null>(null);
	const [newAssistant, setNewAssistant] = useState({
		name: "",
		number: "",
		gender: "male" as Gender,
	});
	const [photoPreview, setPhotoPreview] = useState<string | null>(null);
	const [photoData, setPhotoData] = useState<string | null>(null);
	const [photoType, setPhotoType] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const photoInputRef = useRef<HTMLInputElement>(null);
	const editPhotoInputRef = useRef<HTMLInputElement>(null);

	const males = compAssistants
		.filter((ca) => ca.gender === "male")
		.sort((a, b) => a.number - b.number);
	const females = compAssistants
		.filter((ca) => ca.gender === "female")
		.sort((a, b) => a.number - b.number);

	const filterAssistants = (assistants: CompAssistant[]) => {
		if (!searchQuery) return assistants;
		const query = searchQuery.toLowerCase();
		return assistants.filter(
			(ca) =>
				ca.name.toLowerCase().includes(query) ||
				ca.number.toString().includes(query)
		);
	};

	const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (file.size > 5 * 1024 * 1024) {
			toast.error("Photo must be less than 5MB");
			return;
		}

		const reader = new FileReader();
		reader.onload = (event) => {
			const result = event.target?.result as string;
			setPhotoPreview(result);
			const base64Data = result.split(",")[1];
			setPhotoData(base64Data);
			setPhotoType(file.type);
		};
		reader.readAsDataURL(file);
	};

	const clearPhoto = () => {
		setPhotoPreview(null);
		setPhotoData(null);
		setPhotoType(null);
		if (photoInputRef.current) {
			photoInputRef.current.value = "";
		}
	};

	const handleEditPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (file.size > 5 * 1024 * 1024) {
			toast.error("Photo must be less than 5MB");
			return;
		}

		toast.info("Processing photo...");
		const reader = new FileReader();
		reader.onload = (event) => {
			const result = event.target?.result as string;
			setEditPhotoPreview(result);
			const base64Data = result.split(",")[1];
			setEditPhotoData(base64Data);
			setEditPhotoType(file.type);
			toast.success("Photo ready to upload");
		};
		reader.readAsDataURL(file);
	};

	const clearEditPhoto = () => {
		setEditPhotoPreview(null);
		setEditPhotoData(null);
		setEditPhotoType(null);
		if (editPhotoInputRef.current) {
			editPhotoInputRef.current.value = "";
		}
	};

	const validateNumber = (num: number): string | null => {
		if (num < 0) {
			return "Number cannot be negative";
		}
		if (
			typeof maleStartNumber === "number" &&
			typeof maleEndNumber === "number" &&
			num >= maleStartNumber &&
			num <= maleEndNumber
		) {
			return `Number ${num} is within the male contestant range (${maleStartNumber}-${maleEndNumber})`;
		}
		if (
			typeof femaleStartNumber === "number" &&
			typeof femaleEndNumber === "number" &&
			num >= femaleStartNumber &&
			num <= femaleEndNumber
		) {
			return `Number ${num} is within the female contestant range (${femaleStartNumber}-${femaleEndNumber})`;
		}
		return null;
	};

	const handleAdd = async () => {
		if (!onAdd || !newAssistant.name.trim() || !newAssistant.number) return;

		const num = parseInt(newAssistant.number, 10);
		if (isNaN(num)) {
			toast.error("Please enter a valid number");
			return;
		}

		const validationError = validateNumber(num);
		if (validationError) {
			toast.error(validationError);
			return;
		}

		setIsSubmitting(true);
		const result = await onAdd(
			newAssistant.name.trim(),
			num,
			newAssistant.gender,
			photoData || undefined,
			photoType || undefined
		);
		if (result) {
			toast.success(
				`Comp Assistant #${result.number} added successfully`
			);
			setNewAssistant({ name: "", number: "", gender: "male" });
			clearPhoto();
			setIsAddDialogOpen(false);
		} else {
			toast.error("Failed to add comp assistant");
		}
		setIsSubmitting(false);
	};

	const handleEdit = async () => {
		if (!onUpdate || !selectedAssistant) return;

		if (editPhotoPreview && (!editPhotoData || !editPhotoType)) {
			toast.error("Photo is still processing. Please wait a moment.");
			return;
		}

		setIsSubmitting(true);

		const updates: Partial<CompAssistant> & {
			photoData?: string;
			photoType?: string;
		} = {
			name: selectedAssistant.name,
		};

		if (editNumber !== "" && editNumber !== selectedAssistant.number) {
			const validationError = validateNumber(editNumber);
			if (validationError) {
				toast.error(validationError);
				setIsSubmitting(false);
				return;
			}
			updates.number = editNumber;
		}

		if (editPhotoData && editPhotoType) {
			updates.photoData = editPhotoData;
			updates.photoType = editPhotoType;
			toast.info("Uploading photo...");
		}

		const success = await onUpdate(selectedAssistant.id, updates);
		if (success) {
			toast.success("Comp Assistant updated successfully");
			setIsEditDialogOpen(false);
			setSelectedAssistant(null);
			setEditNumber("");
			clearEditPhoto();
		} else {
			toast.error("Failed to update comp assistant");
		}
		setIsSubmitting(false);
	};

	const handleDelete = async () => {
		if (!onDelete || !deleteConfirmId) return;
		setIsSubmitting(true);
		const success = await onDelete(deleteConfirmId);
		if (success) {
			toast.success("Comp Assistant deleted successfully");
		} else {
			toast.error("Failed to delete comp assistant");
		}
		setDeleteConfirmId(null);
		setIsSubmitting(false);
	};

	const openEditDialog = (assistant: CompAssistant) => {
		setSelectedAssistant({ ...assistant });
		setEditNumber(assistant.number);
		setEditPhotoPreview(null);
		setEditPhotoData(null);
		setEditPhotoType(null);
		setIsEditDialogOpen(true);
	};

	const getExcludedRangesText = () => {
		const ranges: string[] = [];
		if (
			typeof maleStartNumber === "number" &&
			typeof maleEndNumber === "number"
		) {
			ranges.push(
				`${maleStartNumber}-${maleEndNumber} (male contestants)`
			);
		}
		if (
			typeof femaleStartNumber === "number" &&
			typeof femaleEndNumber === "number"
		) {
			ranges.push(
				`${femaleStartNumber}-${femaleEndNumber} (female contestants)`
			);
		}
		return ranges.length > 0 ? ranges.join(", ") : "None configured";
	};

	const renderAssistantGrid = (assistants: CompAssistant[]) => {
		const filtered = filterAssistants(assistants);
		if (filtered.length === 0) {
			return (
				<p className="text-center text-muted-foreground py-8">
					{searchQuery
						? "No assistants match your search"
						: "No comp assistants added"}
				</p>
			);
		}

		return (
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
				{filtered.map((assistant) => (
					<div
						key={assistant.id}
						className="relative group p-3 rounded-lg border bg-muted border-border"
					>
						{/* Action buttons */}
						{!competitionStarted && (
							<div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 bg-background/80"
									onClick={() => openEditDialog(assistant)}
								>
									<Pencil className="h-3 w-3" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 bg-background/80 text-destructive"
									onClick={() =>
										setDeleteConfirmId(assistant.id)
									}
								>
									<Trash2 className="h-3 w-3" />
								</Button>
							</div>
						)}

						<PlaceholderAvatar
							src={assistant.photoUrl}
							alt={assistant.name}
							name={assistant.name}
							className="w-full aspect-square rounded-md mb-2"
							eventId={eventId}
						/>
						<p className="font-bold text-foreground text-center">
							#{assistant.number}
						</p>
						<p className="text-xs text-muted-foreground text-center truncate">
							{assistant.name}
						</p>
						<Badge
							variant="outline"
							className="w-full mt-2 justify-center bg-amber-500/10 text-amber-600 border-amber-500/30"
						>
							Assistant
						</Badge>
					</div>
				))}
			</div>
		);
	};

	return (
		<>
			<Card className="border-border bg-card">
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2 text-foreground">
								Comp Assistants
								<Badge variant="secondary">
									{compAssistants.length}
								</Badge>
							</CardTitle>
							<CardDescription className="flex items-center gap-1 mt-1">
								<HelpCircle className="h-3 w-3" />
								Assistants appear in Round 1 results but cannot
								be voted for
							</CardDescription>
						</div>
						{competitionStarted ? (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<AlertCircle className="h-4 w-4" />
								<span>Locked during competition</span>
							</div>
						) : (
							<Dialog
								open={isAddDialogOpen}
								onOpenChange={(open) => {
									setIsAddDialogOpen(open);
									if (!open) clearPhoto();
								}}
							>
								<DialogTrigger asChild>
									<Button size="sm">
										<UserPlus className="h-4 w-4 mr-2" />
										Add Assistant
									</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>
											Add Comp Assistant
										</DialogTitle>
										<DialogDescription>
											Add a competition assistant. They
											will appear in Round 1 results but
											judges cannot vote for them.
										</DialogDescription>
									</DialogHeader>
									<div className="space-y-4 py-4">
										{/* Photo Upload */}
										<div className="space-y-2">
											<Label>Photo (Optional)</Label>
											<div className="flex items-center gap-4">
												<div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted border-2 border-dashed border-border">
													{photoPreview ? (
														<img
															src={photoPreview}
															alt="Preview"
															className="w-full h-full object-cover"
														/>
													) : (
														<div className="w-full h-full flex items-center justify-center">
															<Camera className="w-8 h-8 text-muted-foreground" />
														</div>
													)}
												</div>
												<div className="flex flex-col gap-2">
													<input
														type="file"
														ref={photoInputRef}
														accept="image/jpeg,image/png"
														className="hidden"
														onChange={
															handlePhotoSelect
														}
													/>
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() =>
															photoInputRef.current?.click()
														}
													>
														<Upload className="w-4 h-4 mr-1" />
														Upload Photo
													</Button>
													{photoPreview && (
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={clearPhoto}
															className="text-destructive"
														>
															Remove
														</Button>
													)}
												</div>
											</div>
											<p className="text-xs text-muted-foreground">
												JPG or PNG, max 5MB
											</p>
										</div>
										<div className="space-y-2">
											<Label htmlFor="name">Name</Label>
											<Input
												id="name"
												value={newAssistant.name}
												onChange={(e) =>
													setNewAssistant({
														...newAssistant,
														name: e.target.value,
													})
												}
												placeholder="Enter name"
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="number">
												Number
											</Label>
											<Input
												id="number"
												type="number"
												min="0"
												value={newAssistant.number}
												onChange={(e) =>
													setNewAssistant({
														...newAssistant,
														number: e.target.value,
													})
												}
												placeholder="Enter number"
											/>
											<p className="text-xs text-muted-foreground">
												Excluded ranges:{" "}
												{getExcludedRangesText()}
											</p>
										</div>
										<div className="space-y-2">
											<Label>Gender</Label>
											<RadioGroup
												value={newAssistant.gender}
												onValueChange={(value) =>
													setNewAssistant({
														...newAssistant,
														gender: value as Gender,
													})
												}
												className="flex gap-4"
											>
												<div className="flex items-center space-x-2">
													<RadioGroupItem
														value="male"
														id="male"
													/>
													<Label htmlFor="male">
														Male
													</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem
														value="female"
														id="female"
													/>
													<Label htmlFor="female">
														Female
													</Label>
												</div>
											</RadioGroup>
										</div>
									</div>
									<DialogFooter>
										<Button
											variant="outline"
											onClick={() => {
												setIsAddDialogOpen(false);
												clearPhoto();
											}}
										>
											Cancel
										</Button>
										<Button
											onClick={handleAdd}
											disabled={
												isSubmitting ||
												!newAssistant.name.trim() ||
												!newAssistant.number
											}
										>
											{isSubmitting
												? "Adding..."
												: "Add Assistant"}
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{/* Search bar */}
					<div className="relative mb-4">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by name or number..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>

					<Tabs defaultValue="male" className="w-full">
						<TabsList className="mb-4">
							<TabsTrigger value="male">
								Male ({males.length})
							</TabsTrigger>
							<TabsTrigger value="female">
								Female ({females.length})
							</TabsTrigger>
						</TabsList>
						<TabsContent value="male">
							{renderAssistantGrid(males)}
						</TabsContent>
						<TabsContent value="female">
							{renderAssistantGrid(females)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{/* Edit Dialog */}
			<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Comp Assistant</DialogTitle>
						<DialogDescription>
							Update the comp assistant details.
						</DialogDescription>
					</DialogHeader>
					{selectedAssistant && (
						<div className="space-y-4 py-4">
							<div className="flex items-center gap-4">
								<PlaceholderAvatar
									src={selectedAssistant.photoUrl}
									alt=""
									name={selectedAssistant.name}
									className="w-16 h-16 rounded-full"
								/>
								<div>
									<p className="font-bold">
										#{selectedAssistant.number}
									</p>
									<p className="text-sm text-muted-foreground capitalize">
										{selectedAssistant.gender}
									</p>
								</div>
							</div>

							{/* Photo Re-upload Section */}
							<div className="space-y-2">
								<Label>Photo</Label>
								<div className="flex items-center gap-4">
									<div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted border-2 border-dashed border-border">
										{editPhotoPreview ? (
											<img
												src={editPhotoPreview}
												alt="New Preview"
												className="w-full h-full object-cover"
											/>
										) : selectedAssistant.photoUrl &&
										  !selectedAssistant.photoUrl.includes(
												"placeholder"
										  ) ? (
											<img
												src={selectedAssistant.photoUrl}
												alt="Current"
												className="w-full h-full object-cover"
											/>
										) : (
											<div className="w-full h-full flex items-center justify-center">
												<Camera className="w-8 h-8 text-muted-foreground" />
											</div>
										)}
									</div>
									<div className="flex flex-col gap-2">
										<input
											type="file"
											ref={editPhotoInputRef}
											accept="image/jpeg,image/png"
											className="hidden"
											onChange={handleEditPhotoSelect}
										/>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												editPhotoInputRef.current?.click()
											}
										>
											<Upload className="w-4 h-4 mr-1" />
											{editPhotoPreview
												? "Change Photo"
												: "Upload New Photo"}
										</Button>
										{editPhotoPreview && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={clearEditPhoto}
												className="text-destructive"
											>
												<X className="w-4 h-4 mr-1" />
												Remove New Photo
											</Button>
										)}
									</div>
								</div>
								<p className="text-xs text-muted-foreground">
									JPG or PNG, max 5MB. Leave empty to keep
									current photo.
								</p>
							</div>

							{/* Number Edit Section */}
							<div className="space-y-2">
								<Label htmlFor="edit-number">Number</Label>
								<Input
									id="edit-number"
									type="number"
									min="0"
									value={editNumber}
									onChange={(e) =>
										setEditNumber(
											e.target.value === ""
												? ""
												: parseInt(e.target.value, 10)
										)
									}
								/>
								<p className="text-xs text-muted-foreground">
									Excluded ranges: {getExcludedRangesText()}
								</p>
							</div>

							{/* Name Edit Section */}
							<div className="space-y-2">
								<Label htmlFor="edit-name">Name</Label>
								<Input
									id="edit-name"
									value={selectedAssistant.name}
									onChange={(e) =>
										setSelectedAssistant({
											...selectedAssistant,
											name: e.target.value,
										})
									}
								/>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setIsEditDialogOpen(false);
								clearEditPhoto();
							}}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button onClick={handleEdit} disabled={isSubmitting}>
							{isSubmitting
								? editPhotoData
									? "Uploading Photo..."
									: "Saving..."
								: "Save Changes"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation */}
			<AlertDialog
				open={!!deleteConfirmId}
				onOpenChange={() => setDeleteConfirmId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete Comp Assistant
						</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this comp assistant?
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
