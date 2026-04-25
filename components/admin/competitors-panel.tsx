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
import { exportCompetitorsExcel } from "@/lib/export-excel";
import {
	downloadCompetitorTemplate,
	parseCompetitorXlsx,
} from "@/lib/import-templates";
import type { Competitor, Gender, Event, Vote } from "@/lib/types";
import {
	Search,
	Pencil,
	Trash2,
	UserPlus,
	Download,
	Camera,
	Upload,
	ArrowUpDown,
	X,
	FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";

interface CompetitorsPanelProps {
	competitors: Competitor[];
	competitionStarted?: boolean; // True if heats have been generated
	eventId?: string;
	onAdd?: (
		name: string,
		gender: Gender,
		photoData?: string,
		photoType?: string,
	) => Promise<Competitor | null>;
	onUpdate?: (
		competitorId: string,
		updates: Partial<Competitor> & {
			photoData?: string;
			photoType?: string;
		},
	) => Promise<boolean>;
	onDelete?: (competitorId: string) => Promise<boolean>;
	onImportCSV?: (
		data: { number?: number; name: string; gender: Gender }[],
	) => Promise<boolean>;
	onSortByNumber?: (gender: Gender) => Promise<boolean>;
	event?: Event;
	votes?: Vote[];
}

export function CompetitorsPanel({
	competitors,
	competitionStarted = false,
	eventId,
	onAdd,
	onUpdate,
	onDelete,
	onImportCSV,
	onSortByNumber,
	event,
	votes,
}: CompetitorsPanelProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [selectedCompetitor, setSelectedCompetitor] =
		useState<Competitor | null>(null);
	const [editNumber, setEditNumber] = useState<number | "">("");
	const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(
		null,
	);
	const [editPhotoData, setEditPhotoData] = useState<string | null>(null);
	const [editPhotoType, setEditPhotoType] = useState<string | null>(null);
	const [newCompetitor, setNewCompetitor] = useState({
		name: "",
		gender: "male" as Gender,
	});
	const [photoPreview, setPhotoPreview] = useState<string | null>(null);
	const [photoData, setPhotoData] = useState<string | null>(null);
	const [photoType, setPhotoType] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const photoInputRef = useRef<HTMLInputElement>(null);
	const editPhotoInputRef = useRef<HTMLInputElement>(null);

	const handleSortByNumber = async (gender: Gender) => {
		if (!onSortByNumber) return;
		await onSortByNumber(gender);
	};

	const males = competitors
		.filter((c) => c.gender === "male")
		.sort((a, b) => a.number - b.number);
	const females = competitors
		.filter((c) => c.gender === "female")
		.sort((a, b) => a.number - b.number);

	const filterCompetitors = (comps: Competitor[]) => {
		if (!searchQuery) return comps;
		const query = searchQuery.toLowerCase();
		return comps.filter(
			(c) =>
				c.name.toLowerCase().includes(query) ||
				c.number.toString().includes(query),
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
			// Extract base64 data without the prefix
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

	const handleAdd = async () => {
		if (!onAdd || !newCompetitor.name.trim()) return;
		setIsSubmitting(true);
		const result = await onAdd(
			newCompetitor.name.trim(),
			newCompetitor.gender,
			photoData || undefined,
			photoType || undefined,
		);
		if (result) {
			toast.success(`Competitor #${result.number} added successfully`);
			setNewCompetitor({ name: "", gender: "male" });
			clearPhoto();
			setIsAddDialogOpen(false);
		} else {
			toast.error("Failed to add competitor");
		}
		setIsSubmitting(false);
	};

	const handleEdit = async () => {
		if (!onUpdate || !selectedCompetitor) return;

		// Check if photo preview exists but data is not ready yet
		if (editPhotoPreview && (!editPhotoData || !editPhotoType)) {
			toast.error(
				"Photo is still processing. Please wait a moment and try again.",
			);
			return;
		}

		setIsSubmitting(true);

		const updates: Partial<Competitor> & {
			photoData?: string;
			photoType?: string;
		} = {
			name: selectedCompetitor.name,
		};

		// Include number if changed
		if (editNumber !== "" && editNumber !== selectedCompetitor.number) {
			updates.number = editNumber;
		}

		// Include photo if new one was selected
		if (editPhotoData && editPhotoType) {
			console.log("[Admin] Including photo in update:", {
				photoType: editPhotoType,
				photoDataLength: editPhotoData.length,
			});
			updates.photoData = editPhotoData;
			updates.photoType = editPhotoType;
			toast.info("Uploading photo...");
		} else {
			console.log("[Admin] No photo data to include:", {
				editPhotoData: !!editPhotoData,
				editPhotoType: editPhotoType,
				editPhotoPreview: !!editPhotoPreview,
			});
		}

		console.log("[Admin] Sending update with keys:", Object.keys(updates));

		const success = await onUpdate(selectedCompetitor.id, updates);
		if (success) {
			toast.success("Competitor updated successfully");
			setIsEditDialogOpen(false);
			setSelectedCompetitor(null);
			setEditNumber("");
			clearEditPhoto();
		} else {
			toast.error("Failed to update competitor");
		}
		setIsSubmitting(false);
	};

	const handleDelete = async () => {
		if (!onDelete || !deleteConfirmId) return;
		setIsSubmitting(true);
		const success = await onDelete(deleteConfirmId);
		if (success) {
			toast.success("Competitor deleted successfully");
		} else {
			toast.error("Failed to delete competitor");
		}
		setDeleteConfirmId(null);
		setIsSubmitting(false);
	};

	const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !onImportCSV) return;

		try {
			toast.info("Reading spreadsheet...");
			const data = await parseCompetitorXlsx(file);

			if (data.length > 0) {
				await onImportCSV(data);
			} else {
				toast.error(
					"No valid data found. Expected columns: Name, Gender (male/female)",
				);
			}
		} catch (error) {
			console.error("XLSX import error:", error);
			toast.error(
				"Failed to read file. Make sure it's a valid .xlsx file.",
			);
		}
		e.target.value = "";
	};

	const clearEditPhoto = () => {
		setEditPhotoPreview(null);
		setEditPhotoData(null);
		setEditPhotoType(null);
		if (editPhotoInputRef.current) {
			editPhotoInputRef.current.value = "";
		}
	};

	const handleEditPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		console.log("[Admin] Photo file selected:", {
			name: file.name,
			type: file.type,
			size: file.size,
		});

		if (file.size > 5 * 1024 * 1024) {
			toast.error("Photo must be less than 5MB");
			return;
		}

		// Show loading toast
		toast.info("Processing photo...");

		const reader = new FileReader();
		reader.onload = (event) => {
			const result = event.target?.result as string;
			if (!result) {
				toast.error("Failed to read photo file");
				return;
			}
			setEditPhotoPreview(result);
			// Extract base64 data without the prefix
			const base64Data = result.split(",")[1];
			if (!base64Data) {
				toast.error("Failed to process photo data");
				return;
			}
			console.log("[Admin] Photo data extracted:", {
				base64Length: base64Data.length,
				type: file.type,
			});
			setEditPhotoData(base64Data);
			setEditPhotoType(file.type);
			toast.success("Photo ready to upload");
		};
		reader.onerror = () => {
			toast.error("Failed to read photo file");
		};
		reader.readAsDataURL(file);
	};

	const openEditDialog = (competitor: Competitor) => {
		setSelectedCompetitor({ ...competitor });
		setEditNumber(competitor.number);
		setEditPhotoPreview(null);
		setEditPhotoData(null);
		setEditPhotoType(null);
		setIsEditDialogOpen(true);
	};

	const handleExportExcel = async () => {
		if (competitors.length === 0) {
			toast.error("No competitors to export");
			return;
		}

		if (!event) {
			toast.error("Event data not available for export");
			return;
		}

		toast.loading("Preparing Excel export with images...");
		try {
			await exportCompetitorsExcel(event, votes || []);
			toast.dismiss();
			toast.success("Competitors exported successfully");
		} catch (error) {
			console.error("Excel export failed:", error);
			toast.dismiss();
			toast.error("Failed to generate Excel export");
		}
	};

	const renderCompetitorGrid = (comps: Competitor[]) => {
		const filtered = filterCompetitors(comps);
		if (filtered.length === 0) {
			return (
				<p className="text-center text-muted-foreground py-8">
					{searchQuery
						? "No competitors match your search"
						: "No competitors registered"}
				</p>
			);
		}

		return (
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
				{filtered.map((competitor) => (
					<div
						key={competitor.id}
						className={`relative group p-3 rounded-lg border ${
							competitor.eliminated
								? "bg-destructive/10 border-destructive/30 opacity-60"
								: "bg-muted border-border"
						}`}
					>
						{/* Action buttons */}
						<div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 bg-background/80"
								onClick={() => openEditDialog(competitor)}
							>
								<Pencil className="h-3 w-3" />
							</Button>
							{!competitionStarted && (
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 bg-background/80 text-destructive"
									onClick={() =>
										setDeleteConfirmId(competitor.id)
									}
								>
									<Trash2 className="h-3 w-3" />
								</Button>
							)}
						</div>

						<PlaceholderAvatar
							src={competitor.photoUrl}
							alt={competitor.name}
							name={competitor.name}
							className="w-full aspect-square rounded-md mb-2"
							eventId={eventId}
							competitorId={competitor.id}
						/>
						<p className="font-bold text-foreground text-center">
							#{competitor.number}
						</p>
						<p className="text-xs text-muted-foreground text-center truncate">
							{competitor.name}
						</p>
						{/* Votes display - commented out for now, can be enabled later
						{competitor.voteCount > 0 && (
							<Badge
								variant="secondary"
								className="w-full mt-1 justify-center"
							>
								{competitor.voteCount} votes
							</Badge>
						)}
						*/}
						{competitor.eliminated && (
							<Badge
								variant="destructive"
								className="w-full mt-1 justify-center"
							>
								Eliminated
							</Badge>
						)}
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
							<CardTitle className="text-foreground">
								Competitors
							</CardTitle>
							<CardDescription>
								{males.length} leads • {females.length} follows
								{competitionStarted && (
									<span className="text-amber-500 ml-2">
										• Competition in progress
									</span>
								)}
							</CardDescription>
						</div>
						<div className="flex gap-2 flex-wrap">
							<input
								type="file"
								ref={fileInputRef}
								accept=".xlsx,.xls"
								className="hidden"
								onChange={handleCSVImport}
							/>
							<Button
								variant="outline"
								size="sm"
								className="bg-transparent hover:bg-emerald-500 hover:text-white transition-colors"
								onClick={handleExportExcel}
								title="Export all competitors to Excel"
								disabled={competitors.length === 0}
							>
								<Download className="h-4 w-4 mr-1" />
								Export
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="bg-transparent"
								onClick={() => fileInputRef.current?.click()}
								title={
									competitionStarted
										? "Cannot import after competition starts"
										: "Import competitors from XLSX file"
								}
								disabled={competitionStarted}
							>
								<Upload className="h-4 w-4 mr-1" />
								Import
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="bg-transparent hover:bg-violet-500 hover:text-white transition-colors"
								onClick={() => {
									downloadCompetitorTemplate();
									toast.success("Template downloaded!");
								}}
								title="Download XLSX import template"
							>
								<FileSpreadsheet className="h-4 w-4 mr-1" />
								Template
							</Button>
							<Dialog
								open={isAddDialogOpen}
								onOpenChange={(open) => {
									setIsAddDialogOpen(open);
									if (!open) clearPhoto();
								}}
							>
								<DialogTrigger asChild>
									<Button
										size="sm"
										disabled={competitionStarted}
										title={
											competitionStarted
												? "Cannot add competitors after competition starts"
												: "Add new competitor"
										}
									>
										<UserPlus className="h-4 w-4 mr-1" />
										Add
									</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>
											Add Competitor
										</DialogTitle>
										<DialogDescription>
											Add a new competitor to the event
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
											<Label>Name</Label>
											<Input
												placeholder="Enter competitor name"
												value={newCompetitor.name}
												onChange={(e) =>
													setNewCompetitor(
														(prev) => ({
															...prev,
															name: e.target
																.value,
														}),
													)
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Role</Label>
											<RadioGroup
												value={newCompetitor.gender}
												onValueChange={(v) =>
													setNewCompetitor(
														(prev) => ({
															...prev,
															gender: v as Gender,
														}),
													)
												}
												className="flex gap-4"
											>
												<div className="flex items-center space-x-2">
													<RadioGroupItem
														value="male"
														id="male"
													/>
													<Label htmlFor="male">
														Lead (Male)
													</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem
														value="female"
														id="female"
													/>
													<Label htmlFor="female">
														Follow (Female)
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
												!newCompetitor.name.trim()
											}
										>
											{isSubmitting
												? "Adding..."
												: "Add Competitor"}
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</div>
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

					<Tabs defaultValue="males">
						<TabsList className="mb-4">
							<TabsTrigger value="males">
								Leads ({males.length})
							</TabsTrigger>
							<TabsTrigger value="females">
								Follows ({females.length})
							</TabsTrigger>
						</TabsList>
						<TabsContent value="males">
							<div className="mb-4">
								<Button
									variant="outline"
									size="sm"
									onClick={() => handleSortByNumber("male")}
									disabled={!onSortByNumber}
								>
									<ArrowUpDown className="h-4 w-4 mr-2" />
									Sort by Number
								</Button>
							</div>
							{renderCompetitorGrid(males)}
						</TabsContent>
						<TabsContent value="females">
							<div className="mb-4">
								<Button
									variant="outline"
									size="sm"
									onClick={() => handleSortByNumber("female")}
									disabled={!onSortByNumber}
								>
									<ArrowUpDown className="h-4 w-4 mr-2" />
									Sort by Number
								</Button>
							</div>
							{renderCompetitorGrid(females)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{/* Edit Dialog */}
			<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Competitor</DialogTitle>
						<DialogDescription>
							Update competitor information
						</DialogDescription>
					</DialogHeader>
					{selectedCompetitor && (
						<div className="space-y-4 py-4">
							<div className="flex items-center gap-4">
								<PlaceholderAvatar
									src={selectedCompetitor.photoUrl}
									alt=""
									name={selectedCompetitor.name}
									className="w-16 h-16 rounded-full"
								/>
								<div>
									<p className="font-bold">
										#{selectedCompetitor.number}
									</p>
									<p className="text-sm text-muted-foreground capitalize">
										{selectedCompetitor.gender === "male"
											? "Lead"
											: "Follow"}
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
										) : selectedCompetitor.photoUrl &&
										  !selectedCompetitor.photoUrl.includes(
												"placeholder",
										  ) ? (
											<PlaceholderAvatar
												src={
													selectedCompetitor.photoUrl
												}
												alt="Current"
												name={selectedCompetitor.name}
												className="w-full h-full"
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
								<Label>Competitor Number</Label>
								<Input
									type="number"
									value={editNumber}
									onChange={(e) =>
										setEditNumber(
											e.target.value === ""
												? ""
												: parseInt(e.target.value, 10),
										)
									}
									min={0}
								/>
								<p className="text-xs text-muted-foreground">
									Change the competitor's number. Must be
									unique and within the event's number range.
								</p>
							</div>

							{/* Name Edit Section */}
							<div className="space-y-2">
								<Label>Name</Label>
								<Input
									value={selectedCompetitor.name}
									onChange={(e) =>
										setSelectedCompetitor((prev) =>
											prev
												? {
														...prev,
														name: e.target.value,
													}
												: null,
										)
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
						<AlertDialogTitle>Delete Competitor?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. The competitor will be
							permanently removed from the event.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
