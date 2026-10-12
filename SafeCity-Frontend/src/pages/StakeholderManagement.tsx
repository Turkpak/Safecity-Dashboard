import { Layout } from "@/components/layout/Layout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit2, Trash2, Users, Save, Search, LayoutList, ShieldCheck, ShieldOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  listStakeholders,
  createStakeholder,
  updateStakeholder,
  deleteStakeholder,
} from "@/api";
import type { Stakeholder as ApiStakeholder, StakeholderStatus } from "@/api/types";

function statusDisplay(s: StakeholderStatus): string {
  return s === "active" ? "Active" : "Disabled";
}

export default function StakeholderManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<ApiStakeholder | null>(null);
  const [formData, setFormData] = useState({ type: "", title: "", status: "active" as StakeholderStatus });
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState("10");
  const [statusConfirmTarget, setStatusConfirmTarget] = useState<ApiStakeholder | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stakeholders = [], isLoading } = useQuery({
    queryKey: ["stakeholders"],
    queryFn: listStakeholders,
  });

  const createMutation = useMutation({
    mutationFn: createStakeholder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      closeDialog();
      toast({ title: "Success", description: "Stakeholder added successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to add stakeholder", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { stakeholder_type?: string; stakeholder_title?: string; status?: StakeholderStatus } }) =>
      updateStakeholder(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      closeDialog();
      toast({ title: "Success", description: "Stakeholder updated successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to update stakeholder", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStakeholder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      toast({ title: "Deleted", description: "Stakeholder removed successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to delete stakeholder", variant: "destructive" });
    },
  });

  const handleCreateOrUpdate = (e?: React.FormEvent) => {
    e?.preventDefault();
    const typeTrimmed = formData.type.trim();
    const titleTrimmed = formData.title.trim();

    if (!typeTrimmed) {
      toast({
        title: "Validation Error",
        description: "Stakeholder Type is required. Please enter the type before adding.",
        variant: "destructive",
      });
      return;
    }
    if (!titleTrimmed) {
      toast({
        title: "Validation Error",
        description: "Stakeholder Title is required. Please enter the title before adding.",
        variant: "destructive",
      });
      return;
    }

    if (editingStakeholder) {
      updateMutation.mutate({
        id: editingStakeholder.id,
        payload: {
          stakeholder_type: typeTrimmed,
          stakeholder_title: titleTrimmed,
          status: formData.status,
        },
      });
    } else {
      createMutation.mutate({
        stakeholder_type: typeTrimmed,
        stakeholder_title: titleTrimmed,
      });
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this stakeholder?")) {
      deleteMutation.mutate(id);
    }
  };

  const requestToggleStatus = (s: ApiStakeholder) => {
    setStatusConfirmTarget(s);
  };

  const confirmToggleStatus = () => {
    if (!statusConfirmTarget) return;
    const next: StakeholderStatus = statusConfirmTarget.status === "active" ? "disable" : "active";
    updateMutation.mutate(
      { id: statusConfirmTarget.id, payload: { status: next } },
      { onSettled: () => setStatusConfirmTarget(null) }
    );
  };

  const openEditDialog = (stakeholder: ApiStakeholder) => {
    setEditingStakeholder(stakeholder);
    setFormData({
      type: stakeholder.stakeholder_type,
      title: stakeholder.stakeholder_title,
      status: stakeholder.status,
    });
    setIsAddDialogOpen(true);
  };

  const closeDialog = () => {
    setIsAddDialogOpen(false);
    setEditingStakeholder(null);
    setFormData({ type: "", title: "", status: "active" });
  };

  const filteredStakeholders = stakeholders.filter(
    (s) =>
      s.stakeholder_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.stakeholder_title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const paginated = filteredStakeholders.slice(0, parseInt(pageSize, 10) || 10);

  const activeCount = stakeholders.filter((s) => s.status === "active").length;
  const disabledCount = stakeholders.filter((s) => s.status === "disable").length;

  const emptyListMessage = (
    <div className="flex flex-col items-center justify-center gap-3 py-6 px-4 text-center">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Users className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-foreground">No stakeholders found</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {searchQuery ? "Try a different search." : "Add your first stakeholder to get started."}
        </p>
      </div>
      {!searchQuery && (
        <Button className="mt-1 w-full max-w-xs" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add stakeholder
        </Button>
      )}
    </div>
  );

  return (
    <Layout title="Stakeholder Management">
      <div className="flex flex-col gap-3 sm:gap-6 w-full max-w-[1400px] mx-auto min-w-0 pb-12 sm:pb-20">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Stakeholders</h1>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          <Card className="border-l-4 border-l-primary/80 shadow-sm">
            <CardContent className="pt-2 pb-2 sm:pt-5 sm:pb-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground mt-0.5 tabular-nums">{stakeholders.length}</p>
                </div>
                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500/80 shadow-sm">
            <CardContent className="pt-2 pb-2 sm:pt-5 sm:pb-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground mt-0.5 tabular-nums">{activeCount}</p>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shrink-0" aria-hidden />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-slate-400/80 shadow-sm">
            <CardContent className="pt-2 pb-2 sm:pt-5 sm:pb-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Disabled</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground mt-0.5 tabular-nums">{disabledCount}</p>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400 shadow-sm shrink-0" aria-hidden />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main list card */}
        <Card className="shadow-md overflow-hidden rounded-xl border-border/80">
          <CardHeader className="border-b bg-muted/30 pb-3 px-4 sm:px-6 pt-3 sm:pt-6">
            <div className="flex flex-col gap-2 sm:gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2 flex-wrap">
                  <LayoutList className="h-5 w-5 text-primary shrink-0" />
                  <span>Stakeholder list</span>
                </CardTitle>
                <CardDescription className="mt-1 text-xs sm:text-sm">
                  Showing {paginated.length} of {filteredStakeholders.length} stakeholders
                </CardDescription>
              </div>
              <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                  setIsAddDialogOpen(open);
                  if (!open) closeDialog();
                }}
              >
                <DialogTrigger asChild>
                  <Button className="bg-secondary hover:bg-secondary/90 text-white font-semibold shadow-sm w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" /> Add stakeholder
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[420px] !p-0 !gap-0 overflow-hidden flex flex-col [&>button]:top-2.5 [&>button]:right-3 [&>button]:text-white/80 [&>button]:hover:text-white [&>button]:opacity-100">
                  {/* Accent header */}
                  <div className="bg-primary px-4 py-3 shrink-0 flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="text-white text-sm font-bold leading-tight">
                        {editingStakeholder ? "Edit Stakeholder" : "Add New Stakeholder"}
                      </DialogTitle>
                      <p className="text-white/65 text-[11px] leading-tight mt-0.5">
                        {editingStakeholder ? `ID #${editingStakeholder.id}` : "Fields marked * are required"}
                      </p>
                    </div>
                  </div>

                  {/* Form body */}
                  <form onSubmit={handleCreateOrUpdate} className="px-4 py-3 space-y-3 bg-background" noValidate>

                    {/* Type */}
                    <div className="space-y-1">
                      <Label htmlFor="stakeholder-type" className="text-xs font-semibold text-foreground">
                        Type <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="stakeholder-type"
                        placeholder="e.g. Client, Consultant, Contractor"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="h-9 text-sm bg-muted/40 border-border/70 focus:bg-background transition-colors"
                        required
                      />
                    </div>

                    {/* Title */}
                    <div className="space-y-1">
                      <Label htmlFor="stakeholder-title" className="text-xs font-semibold text-foreground">
                        Title <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="stakeholder-title"
                        placeholder="e.g. Punjab Safe City Authority"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="h-9 text-sm bg-muted/40 border-border/70 focus:bg-background transition-colors"
                        required
                      />
                    </div>

                    {/* Status — edit mode only */}
                    {editingStakeholder && (
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-foreground">Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(v) => setFormData({ ...formData, status: v as StakeholderStatus })}
                        >
                          <SelectTrigger className="h-9 text-sm bg-muted/40 border-border/70">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                Active
                              </span>
                            </SelectItem>
                            <SelectItem value="disable">
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                                Disabled
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex gap-2 pt-2 border-t border-border/50 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeDialog}
                        className="h-9 px-4 text-sm font-medium"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        className="h-9 px-4 text-sm bg-primary hover:bg-primary/90 text-white font-semibold shadow-sm"
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        {createMutation.isPending || updateMutation.isPending
                          ? "Saving…"
                          : editingStakeholder
                            ? "Save Changes"
                            : "Add Stakeholder"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Toolbar: search + page size */}
            <div className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-4 border-b bg-muted/20 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by type or title…"
                  className="pl-9 h-10 min-h-10 bg-background border-muted-foreground/20 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                  <span className="hidden sm:inline">Rows per page</span>
                  <span className="sm:hidden">Rows</span>
                </span>
                <Select value={pageSize} onValueChange={setPageSize}>
                  <SelectTrigger className="w-[76px] sm:w-[88px] h-10 min-h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mobile: card list */}
            <div className="md:hidden border-t border-border/60">
              {isLoading ? (
                <div className="p-2 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg border bg-card p-2 space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-3/4" />
                      <div className="flex justify-end gap-2 pt-1">
                        <Skeleton className="h-10 w-10 rounded-md" />
                        <Skeleton className="h-10 w-10 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : paginated.length === 0 ? (
                emptyListMessage
              ) : (
                <div className="p-3 space-y-3">
                  {paginated.map((stakeholder, index) => {
                    const isActive = stakeholder.status === "active";
                    const accentBorder = isActive ? "border-l-emerald-500" : "border-l-slate-400";
                    const statusClasses = isActive
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200";

                    return (
                      <Card
                        key={stakeholder.id}
                        className={cn(
                          "rounded-xl border border-border/80 bg-gradient-to-b from-card to-muted/15 shadow-sm overflow-hidden border-l-4",
                          accentBorder,
                        )}
                      >
                        <CardHeader className="pb-2 pt-3 px-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <CardTitle className="text-sm font-semibold leading-tight break-words">
                                {stakeholder.stakeholder_title}
                              </CardTitle>
                              <CardDescription className="text-xs mt-1 text-muted-foreground">
                                Type: <span className="font-medium text-foreground">{stakeholder.stakeholder_type}</span>
                              </CardDescription>
                            </div>
                            <button
                              type="button"
                              onClick={() => requestToggleStatus(stakeholder)}
                              disabled={updateMutation.isPending}
                              className={cn(
                                "shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border-0",
                                statusClasses,
                              )}
                              aria-label="Toggle stakeholder status"
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  isActive ? "bg-emerald-600" : "bg-slate-500",
                                )}
                                aria-hidden
                              />
                              {statusDisplay(stakeholder.status)}
                            </button>
                          </div>
                        </CardHeader>

                        <CardContent className="px-4 pb-4 pt-0 space-y-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="tabular-nums">#{index + 1}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="default"
                              className="w-full"
                              onClick={() => openEditDialog(stakeholder)}
                              disabled={updateMutation.isPending}
                            >
                              <Edit2 className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full text-destructive border-destructive/20 hover:bg-destructive/10"
                              onClick={() => handleDelete(stakeholder.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto overflow-x-touch scrollbar-hide">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
                    <TableHead className="w-14 font-semibold text-foreground">#</TableHead>
                    <TableHead className="font-semibold text-foreground">Type</TableHead>
                    <TableHead className="font-semibold text-foreground">Title</TableHead>
                    <TableHead className="font-semibold text-foreground text-center w-[120px]">Status</TableHead>
                    <TableHead className="font-semibold text-foreground text-right w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-6" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : paginated.length > 0 ? (
                    paginated.map((stakeholder, index) => (
                      <TableRow
                        key={stakeholder.id}
                        className="group hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="font-medium text-muted-foreground tabular-nums">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {stakeholder.stakeholder_type}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {stakeholder.stakeholder_title}
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => requestToggleStatus(stakeholder)}
                            disabled={updateMutation.isPending}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                              stakeholder.status === "active"
                                ? "border-transparent bg-primary text-primary-foreground"
                                : "border-slate-200 bg-slate-100 text-slate-700"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full shrink-0",
                                stakeholder.status === "active" ? "bg-primary-foreground/80" : "bg-slate-500"
                              )}
                              aria-hidden
                            />
                            {statusDisplay(stakeholder.status)}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-primary hover:bg-primary/10"
                                  onClick={() => openEditDialog(stakeholder)}
                                  disabled={updateMutation.isPending}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDelete(stakeholder.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        {emptyListMessage}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status toggle confirmation dialog */}
      <Dialog
        open={statusConfirmTarget !== null}
        onOpenChange={(open) => { if (!open) setStatusConfirmTarget(null); }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[400px] !p-0 !gap-0 overflow-hidden flex flex-col [&>button]:top-2.5 [&>button]:right-3 [&>button]:text-white/80 [&>button]:hover:text-white [&>button]:opacity-100">
          {/* Header */}
          <div
            className={cn(
              "px-4 py-3 shrink-0 flex items-center gap-3 pr-10",
              statusConfirmTarget?.status === "active" ? "bg-slate-600" : "bg-emerald-600"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
              {statusConfirmTarget?.status === "active"
                ? <ShieldOff className="h-4 w-4 text-white" />
                : <ShieldCheck className="h-4 w-4 text-white" />
              }
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-white text-sm font-bold leading-tight">
                {statusConfirmTarget?.status === "active" ? "Disable Stakeholder?" : "Activate Stakeholder?"}
              </DialogTitle>
              <p className="text-white/65 text-[11px] leading-tight mt-0.5">
                This will change the stakeholder's status
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 pt-4 pb-4 bg-background space-y-4">
            {/* Stakeholder info card */}
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Stakeholder</p>
              <p className="text-sm font-semibold text-foreground leading-tight truncate">
                {statusConfirmTarget?.stakeholder_title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                Type: <span className="font-medium text-foreground">{statusConfirmTarget?.stakeholder_type}</span>
              </p>
            </div>

            {/* Consequence message */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {statusConfirmTarget?.status === "active"
                ? "Disabling this stakeholder will mark them as inactive. They will remain in the system but won't be selectable for new projects."
                : "Activating this stakeholder will mark them as active and allow them to be assigned to projects again."
              }
            </p>

            {/* Current → New status indicator */}
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                statusConfirmTarget?.status === "active"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-600"
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", statusConfirmTarget?.status === "active" ? "bg-emerald-500" : "bg-slate-400")} />
                {statusConfirmTarget?.status === "active" ? "Active" : "Disabled"}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                statusConfirmTarget?.status === "active"
                  ? "bg-slate-100 text-slate-600"
                  : "bg-emerald-100 text-emerald-800"
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", statusConfirmTarget?.status === "active" ? "bg-slate-400" : "bg-emerald-500")} />
                {statusConfirmTarget?.status === "active" ? "Disabled" : "Active"}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1 border-t border-border/50 justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-9 px-4 text-sm font-medium"
                onClick={() => setStatusConfirmTarget(null)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={cn(
                  "h-9 px-4 text-sm font-semibold text-white shadow-sm",
                  statusConfirmTarget?.status === "active"
                    ? "bg-slate-600 hover:bg-slate-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
                onClick={confirmToggleStatus}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving…" : (
                  <>
                    {statusConfirmTarget?.status === "active"
                      ? <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
                      : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                    }
                    {statusConfirmTarget?.status === "active" ? "Yes, Disable" : "Yes, Activate"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </Layout>
  );
}
