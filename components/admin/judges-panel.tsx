"use client";

import { useState, useRef } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { exportJudgesExcel } from "@/lib/export-excel";
import { downloadJudgeTemplate, parseJudgeXlsx } from "@/lib/import-templates";
import type { Judge, Heat, Gender, Vote, Competitor, Event } from "@/lib/types";
import {
	Copy,
	Check,
	ExternalLink,
	Search,
	UserPlus,
	Pencil,
	Trash2,
	QrCode,
	Download,
	Camera,
	Upload,
	Eye,
	CheckCircle2,
	FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { PlaceholderAvatar } from "@/components/ui/placeholder-avatar";

interface JudgesPanelProps {
	judges: Judge[];
	currentHeat: Heat | null;
	baseUrl: string;
	votes?: Vote[];
	competitors?: Competitor[];
	onAdd?: (
		name: string,
		gender: Gender,
		pin?: string,
		photoData?: string,
		photoType?: string,
	) => Promise<Judge | null>;
	onUpdate?: (judgeId: string, updates: Partial<Judge>) => Promise<boolean>;
	onDelete?: (judgeId: string) => Promise<boolean>;
	onImportCSV?: (
		data: { name: string; gender: Gender; pin?: string }[],
	) => Promise<boolean>;
	event?: Event;
}

export function JudgesPanel({
	judges,
	currentHeat,
	baseUrl,
	votes,
	competitors,
	onAdd,
	onUpdate,
	onDelete,
	onImportCSV,
	event,
}: JudgesPanelProps) {
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
	const [isVoteViewOpen, setIsVoteViewOpen] = useState(false);
	const [voteViewJudgeId, setVoteViewJudgeId] = useState<string | null>(null);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [selectedJudge, setSelectedJudge] = useState<Judge | null>(null);
	const [newJudge, setNewJudge] = useState({
		name: "",
		gender: "male" as Gender,
		pin: "",
	});
	const [photoPreview, setPhotoPreview] = useState<string | null>(null);
	const [photoData, setPhotoData] = useState<string | null>(null);
	const [photoType, setPhotoType] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const photoInputRef = useRef<HTMLInputElement>(null);

	// Get judge's vote for current heat
	const getJudgeVote = (judgeId: string): Vote | undefined => {
		if (!votes || !currentHeat) return undefined;
		return votes.find(
			(v) => v.judgeId === judgeId && v.heatId === currentHeat.id,
		);
	};

	// Get the live vote for the vote view modal (updates in real-time)
	const voteViewJudge = voteViewJudgeId
		? judges.find((j) => j.id === voteViewJudgeId)
		: null;
	const voteViewVote = voteViewJudgeId ? getJudgeVote(voteViewJudgeId) : null;

	// Open vote view modal
	const openVoteView = (judge: Judge) => {
		const vote = getJudgeVote(judge.id);
		if (vote) {
			setVoteViewJudgeId(judge.id);
			setIsVoteViewOpen(true);
		}
	};

	const males = judges.filter((j) => j.gender === "male");
	const females = judges.filter((j) => j.gender === "female");

	const filterJudges = (judgeList: Judge[]) => {
		if (!searchQuery) return judgeList;
		const query = searchQuery.toLowerCase();
		return judgeList.filter((j) => j.name.toLowerCase().includes(query));
	};

	const copyLink = (judge: Judge) => {
		const link = `${baseUrl}/judge/${judge.token}`;
		navigator.clipboard.writeText(link);
		setCopiedId(judge.id);
		toast.success("Link copied to clipboard");
		setTimeout(() => setCopiedId(null), 2000);
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
		if (!onAdd || !newJudge.name.trim()) return;
		setIsSubmitting(true);
		const result = await onAdd(
			newJudge.name.trim(),
			newJudge.gender,
			newJudge.pin || undefined,
			photoData || undefined,
			photoType || undefined,
		);
		if (result) {
			toast.success(`Judge ${result.name} added successfully`);
			setNewJudge({ name: "", gender: "male", pin: "" });
			clearPhoto();
			setIsAddDialogOpen(false);
		} else {
			toast.error("Failed to add judge");
		}
		setIsSubmitting(false);
	};

	const handleEdit = async () => {
		if (!onUpdate || !selectedJudge) return;
		setIsSubmitting(true);
		const success = await onUpdate(selectedJudge.id, {
			name: selectedJudge.name,
			pin: selectedJudge.pin,
		});
		if (success) {
			toast.success("Judge updated successfully");
			setIsEditDialogOpen(false);
			setSelectedJudge(null);
		} else {
			toast.error("Failed to update judge");
		}
		setIsSubmitting(false);
	};

	const handleDelete = async () => {
		if (!onDelete || !deleteConfirmId) return;
		setIsSubmitting(true);
		const success = await onDelete(deleteConfirmId);
		if (success) {
			toast.success("Judge deleted successfully");
		} else {
			toast.error("Failed to delete judge");
		}
		setDeleteConfirmId(null);
		setIsSubmitting(false);
	};

	const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !onImportCSV) return;

		try {
			toast.info("Reading spreadsheet...");
			const data = await parseJudgeXlsx(file);

			if (data.length > 0) {
				const success = await onImportCSV(data);
				if (success) {
					toast.success(`Imported ${data.length} judges`);
				} else {
					toast.error("Failed to import judges");
				}
			} else {
				toast.error(
					"No valid data found. Expected columns: Name, Gender, PIN (optional)",
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

	const openEditDialog = (judge: Judge) => {
		setSelectedJudge({ ...judge });
		setIsEditDialogOpen(true);
	};

	const openQRDialog = (judge: Judge) => {
		setSelectedJudge(judge);
		setIsQRDialogOpen(true);
	};

	const getQRCodeUrl = (judge: Judge) => {
		const link = `${baseUrl}/judge/${judge.token}`;
		return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
			link,
		)}`;
	};

	const handleExportExcel = async () => {
		if (judges.length === 0) {
			toast.error("No judges to export");
			return;
		}

		if (!event) {
			toast.error("Event data not available for export");
			return;
		}

		toast.loading("Preparing Excel export with images...");
		try {
			await exportJudgesExcel(event);
			toast.dismiss();
			toast.success("Judges exported successfully");
		} catch (error) {
			console.error("Excel export failed:", error);
			toast.dismiss();
			toast.error("Failed to generate Excel export");
		}
	};

	const renderJudgeCard = (judge: Judge) => {
		const hasSubmitted = currentHeat?.judgesSubmitted.includes(judge.id);
		const filtered = filterJudges([judge]);
		if (filtered.length === 0) return null;

		// In finals, determine if this judge should be voting in the current heat
		// Heat 1 (finalistGender="male") = male judges vote (male finalists judged by male judges)
		// Heat 2 (finalistGender="female") = female judges vote (female finalists judged by female judges)
		const isFinalsHeat =
			currentHeat?.round === "finals" && currentHeat?.finalistGender;
		const isJudgesTurnInFinals = isFinalsHeat
			? currentHeat.finalistGender === judge.gender
			: true;

		// Determine status display for finals
		let statusBadge = null;
		if (currentHeat) {
			if (isFinalsHeat) {
				if (isJudgesTurnInFinals) {
					// This judge should be voting in this heat
					statusBadge = (
						<Badge
							variant={hasSubmitted ? "default" : "outline"}
							className={`mt-2 ${
								hasSubmitted
									? "bg-emerald-500 text-white"
									: "bg-transparent"
							}`}
						>
							{hasSubmitted ? "Submitted" : "Pending"}
						</Badge>
					);
				} else {
					// This judge votes in a different heat - check if they already voted in their heat
					// Heat 1 (finalistGender="male") = male judges vote
					// Heat 2 (finalistGender="female") = female judges vote
					// If current heat is Heat 2 (female finalists), male judges already voted in Heat 1
					// If current heat is Heat 1 (male finalists), female judges will vote in Heat 2
					const alreadyVoted =
						currentHeat.finalistGender === "female" &&
						judge.gender === "male";
					statusBadge = (
						<Badge
							variant="outline"
							className={`mt-2 ${
								alreadyVoted
									? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
									: "bg-muted text-muted-foreground"
							}`}
						>
							{alreadyVoted
								? "Voted (Heat 1)"
								: "Votes in Heat 2"}
						</Badge>
					);
				}
			} else {
				// Non-finals heat - show normal status
				statusBadge = (
					<Badge
						variant={hasSubmitted ? "default" : "outline"}
						className={`mt-2 ${
							hasSubmitted
								? "bg-emerald-500 text-white"
								: "bg-transparent"
						}`}
					>
						{hasSubmitted ? "Submitted" : "Pending"}
					</Badge>
				);
			}
		}

		return (
			<div
				key={judge.id}
				className="relative group p-4 rounded-lg border bg-muted border-border"
			>
				{/* Action buttons */}
				<div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 bg-background/80"
						onClick={() => openEditDialog(judge)}
					>
						<Pencil className="h-3 w-3" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 bg-background/80 text-destructive"
						onClick={() => setDeleteConfirmId(judge.id)}
					>
						<Trash2 className="h-3 w-3" />
					</Button>
				</div>

				<div className="flex items-start gap-3">
					<PlaceholderAvatar
						src={judge.photoUrl}
						alt={judge.name}
						name={judge.name}
						className="w-16 h-16 rounded-full"
					/>
					<div className="flex-1 min-w-0">
						<p className="font-semibold text-foreground">
							{judge.name}
						</p>
						<p className="text-sm text-muted-foreground capitalize">
							{judge.gender} Judge
						</p>
						{judge.pin && (
							<p className="text-xs text-muted-foreground mt-1">
								PIN: {judge.pin}
							</p>
						)}
						{statusBadge}
					</div>
				</div>

				<div className="flex gap-2 mt-3">
					<Button
						variant="outline"
						size="sm"
						className="flex-1 bg-transparent"
						onClick={() => copyLink(judge)}
					>
						{copiedId === judge.id ? (
							<>
								<Check className="w-4 h-4 mr-1" />
								Copied
							</>
						) : (
							<>
								<Copy className="w-4 h-4 mr-1" />
								Copy Link
							</>
						)}
					</Button>
					{hasSubmitted && (
						<Button
							variant="outline"
							size="sm"
							className="bg-transparent"
							onClick={() => openVoteView(judge)}
							title="View submitted vote"
						>
							<Eye className="w-4 h-4" />
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						className="bg-transparent"
						onClick={() => openQRDialog(judge)}
					>
						<QrCode className="w-4 h-4" />
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="bg-transparent"
						onClick={() =>
							window.open(`/judge/${judge.token}`, "_blank")
						}
					>
						<ExternalLink className="w-4 h-4" />
					</Button>
				</div>
			</div>
		);
	};

	const renderJudgeList = (judgeList: Judge[]) => {
		const filtered = filterJudges(judgeList);
		if (filtered.length === 0) {
			return (
				<p className="text-center text-muted-foreground py-8">
					{searchQuery
						? "No judges match your search"
						: "No judges added"}
				</p>
			);
		}
		return (
			<div className="grid gap-3 sm:grid-cols-2">
				{filtered.map(renderJudgeCard)}
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
								Judges
							</CardTitle>
							<CardDescription>
								{males.length} male judges • {females.length}{" "}
								female judges
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
								title="Export all judges to Excel"
								disabled={judges.length === 0}
							>
								<Download className="h-4 w-4 mr-1" />
								Export
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="bg-transparent"
								onClick={() => fileInputRef.current?.click()}
								title="Import judges from XLSX file"
							>
								<Upload className="h-4 w-4 mr-1" />
								Import
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="bg-transparent hover:bg-violet-500 hover:text-white transition-colors"
								onClick={() => {
									downloadJudgeTemplate();
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
									<Button size="sm">
										<UserPlus className="h-4 w-4 mr-1" />
										Add Judge
									</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Add Judge</DialogTitle>
										<DialogDescription>
											Add a new judge to the event
										</DialogDescription>
									</DialogHeader>
									<div className="space-y-4 py-4">
										{/* Photo Upload */}
										<div className="space-y-2">
											<Label>Photo (Optional)</Label>
											<div className="flex items-center gap-4">
												<div className="relative w-20 h-20 rounded-full overflow-hidden bg-muted border-2 border-dashed border-border">
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
												placeholder="Enter judge name"
												value={newJudge.name}
												onChange={(e) =>
													setNewJudge((prev) => ({
														...prev,
														name: e.target.value,
													}))
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Gender</Label>
											<RadioGroup
												value={newJudge.gender}
												onValueChange={(v) =>
													setNewJudge((prev) => ({
														...prev,
														gender: v as Gender,
													}))
												}
												className="flex gap-4"
											>
												<div className="flex items-center space-x-2">
													<RadioGroupItem
														value="male"
														id="judge-male"
													/>
													<Label htmlFor="judge-male">
														Male (judges males)
													</Label>
												</div>
												<div className="flex items-center space-x-2">
													<RadioGroupItem
														value="female"
														id="judge-female"
													/>
													<Label htmlFor="judge-female">
														Female (judges females)
													</Label>
												</div>
											</RadioGroup>
										</div>
										<div className="space-y-2">
											<Label>PIN (Optional)</Label>
											<Input
												placeholder="4-6 digit PIN"
												value={newJudge.pin}
												onChange={(e) =>
													setNewJudge((prev) => ({
														...prev,
														pin: e.target.value,
													}))
												}
												maxLength={6}
											/>
											<p className="text-xs text-muted-foreground">
												If set, judge must enter PIN to
												access their voting page
											</p>
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
												!newJudge.name.trim()
											}
										>
											{isSubmitting
												? "Adding..."
												: "Add Judge"}
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
							placeholder="Search judges..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>

					<Tabs defaultValue="males">
						<TabsList className="mb-4">
							<TabsTrigger value="males">
								Male Judges ({males.length})
							</TabsTrigger>
							<TabsTrigger value="females">
								Female Judges ({females.length})
							</TabsTrigger>
						</TabsList>
						<TabsContent value="males">
							{renderJudgeList(males)}
						</TabsContent>
						<TabsContent value="females">
							{renderJudgeList(females)}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{/* Edit Dialog */}
			<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Judge</DialogTitle>
						<DialogDescription>
							Update judge information
						</DialogDescription>
					</DialogHeader>
					{selectedJudge && (
						<div className="space-y-4 py-4">
							<div className="flex items-center gap-4">
								<PlaceholderAvatar
									src={selectedJudge.photoUrl}
									alt=""
									name={selectedJudge.name}
									className="w-16 h-16 rounded-full"
								/>
								<div>
									<p className="text-sm text-muted-foreground capitalize">
										{selectedJudge.gender} Judge
									</p>
								</div>
							</div>
							<div className="space-y-2">
								<Label>Name</Label>
								<Input
									value={selectedJudge.name}
									onChange={(e) =>
										setSelectedJudge((prev) =>
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
							<div className="space-y-2">
								<Label>PIN</Label>
								<Input
									value={selectedJudge.pin || ""}
									onChange={(e) =>
										setSelectedJudge((prev) =>
											prev
												? {
														...prev,
														pin: e.target.value,
													}
												: null,
										)
									}
									maxLength={6}
									placeholder="Leave empty to remove PIN"
								/>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsEditDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button onClick={handleEdit} disabled={isSubmitting}>
							{isSubmitting ? "Saving..." : "Save Changes"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* QR Code Dialog */}
			<Dialog open={isQRDialogOpen} onOpenChange={setIsQRDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Judge QR Code</DialogTitle>
						<DialogDescription>
							{selectedJudge?.name} can scan this QR code to
							access their voting page
						</DialogDescription>
					</DialogHeader>
					{selectedJudge && (
						<div className="flex flex-col items-center py-4">
							<img
								src={getQRCodeUrl(selectedJudge)}
								alt="QR Code"
								className="w-48 h-48 rounded-lg border"
							/>
							<p className="text-sm text-muted-foreground mt-4 text-center break-all">
								{baseUrl}/judge/{selectedJudge.token}
							</p>
							{selectedJudge.pin && (
								<p className="text-sm font-medium mt-2">
									PIN: {selectedJudge.pin}
								</p>
							)}
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsQRDialogOpen(false)}
						>
							Close
						</Button>
						<Button
							onClick={() =>
								selectedJudge && copyLink(selectedJudge)
							}
						>
							<Copy className="w-4 h-4 mr-2" />
							Copy Link
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
						<AlertDialogTitle>Delete Judge?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. The judge will be
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

			{/* Vote View Modal */}
			<Dialog
				open={isVoteViewOpen}
				onOpenChange={(open) => {
					setIsVoteViewOpen(open);
					if (!open) setVoteViewJudgeId(null);
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<CheckCircle2 className="w-5 h-5 text-emerald-500" />
							Vote Submitted
						</DialogTitle>
						<DialogDescription>
							{voteViewJudge?.name}&apos;s vote for Heat{" "}
							{currentHeat?.number}
						</DialogDescription>
					</DialogHeader>
					{voteViewVote && (
						<div className="py-4">
							<div className="space-y-3">
								{voteViewVote.rankings
									.sort((a, b) => a.rank - b.rank)
									.map((ranking) => {
										const competitor = competitors?.find(
											(c) =>
												c.id === ranking.competitorId,
										);
										if (!competitor) return null;
										return (
											<div
												key={ranking.competitorId}
												className="flex items-center gap-3 p-3 bg-muted rounded-lg"
											>
												<span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
													{ranking.rank}
												</span>
												<span className="font-medium">
													#{competitor.number}
												</span>
												<span className="text-muted-foreground">
													{competitor.name}
												</span>
											</div>
										);
									})}
							</div>
							<p className="text-xs text-muted-foreground mt-4 text-center">
								Submitted at{" "}
								{new Date(
									voteViewVote.submittedAt,
								).toLocaleString()}
							</p>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsVoteViewOpen(false)}
						>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
