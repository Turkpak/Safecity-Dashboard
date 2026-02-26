import { Layout } from "@/components/layout/Layout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit2, Trash2, X, Users, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  listStakeholders,
  createStakeholder,
  updateStakeholder,
  deleteStakeholder,
} from "@/api";
import type { Stakeholder as ApiStakeholder, StakeholderStatus } from "@/api/types";

function statusDisplay(s: StakeholderStatus): string {
  return s === "active" ? "Active" : "Disable";
}

export default function StakeholderManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<ApiStakeholder | null>(null);
  const [formData, setFormData] = useState({ type: "", title: "", status: "active" as StakeholderStatus });
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState("5");
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

    // Validate before calling API — do not POST if required fields are missing
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
      // POST http://127.0.0.1:8000/api/create-stakeholder/ with body: { stakeholder_type, stakeholder_title }
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

  const toggleStatus = (s: ApiStakeholder) => {
    const next: StakeholderStatus = s.status === "active" ? "disable" : "active";
    updateMutation.mutate({ id: s.id, payload: { status: next } });
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
  const paginated = filteredStakeholders.slice(0, parseInt(pageSize, 10) || 5);

  return (
    <Layout title="Stakeholder Management">
      <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-primary p-4 rounded-t-lg shadow-lg border-b-4 border-secondary gap-3">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-secondary" /> Stakeholders
          </h1>
          <Dialog
            open={isAddDialogOpen}
            onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) closeDialog();
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-secondary hover:bg-secondary/90 text-white border-none shadow-md font-bold">
                <Plus className="h-4 w-4 mr-2" /> Add Stakeholder
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] p-0 border-none rounded-xl max-h-[90vh] overflow-y-auto">
              <div className="bg-primary px-6 py-4 flex items-center justify-between border-b-4 border-secondary">
                <DialogTitle className="text-white text-lg font-bold">
                  {editingStakeholder
                    ? `Edit Stakeholder${editingStakeholder.id ? ` (ID: ${editingStakeholder.id})` : ""}`
                    : "Add Stakeholder"}
                </DialogTitle>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="text-white/70 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form
                onSubmit={handleCreateOrUpdate}
                className="p-8 space-y-6"
                noValidate
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="stakeholder-type" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Stakeholder Type <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="stakeholder-type"
                      name="stakeholder_type"
                      placeholder="e.g. Client"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="h-10 border-muted-foreground/20 focus:ring-secondary/20"
                      required
                      aria-required="true"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stakeholder-title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Stakeholder Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="stakeholder-title"
                      name="stakeholder_title"
                      placeholder="e.g. Punjab Safe City Authority"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="h-10 border-muted-foreground/20 focus:ring-secondary/20"
                      required
                      aria-required="true"
                    />
                  </div>
                </div>
                {editingStakeholder && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v as StakeholderStatus })}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="disable">Disable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-center gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-secondary hover:bg-secondary/90 text-white px-8 h-10 shadow-lg font-bold"
                  >
                    <Save className="h-4 w-4 mr-2" /> {editingStakeholder ? "Update" : "Add"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={closeDialog}
                    className="bg-slate-500 hover:bg-slate-600 text-white px-8 h-10 shadow-lg border-none font-bold"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-primary/95 p-4 flex flex-col md:flex-row shadow-inner border-x border-primary gap-4">
          <div className="relative flex-1">
            <Input
              placeholder="Search Stakeholder Type here..."
              className="bg-white text-slate-800 h-10 border-none shadow-sm focus:ring-2 focus:ring-secondary/30 pl-4"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded shadow-sm text-sm border-l-4 border-secondary">
            <span className="text-slate-600 font-medium">Show Stakeholder List:</span>
            <Select value={pageSize} onValueChange={setPageSize}>
              <SelectTrigger className="w-20 border-none h-6 p-0 focus:ring-0 shadow-none font-bold text-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-slate-600">/ page</span>
          </div>
        </div>

        <div className="bg-white rounded-b-lg border border-slate-200 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-100 border-b-2 border-primary/10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 font-bold text-primary border-r border-slate-200">#</TableHead>
                  <TableHead className="font-bold text-primary border-r border-slate-200">Type</TableHead>
                  <TableHead className="font-bold text-primary border-r border-slate-200">Title</TableHead>
                  <TableHead className="font-bold text-primary border-r border-slate-200 text-center">Status</TableHead>
                  <TableHead className="font-bold text-primary text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : paginated.length > 0 ? (
                  paginated.map((stakeholder, index) => (
                    <TableRow
                      key={stakeholder.id}
                      className="group border-b border-slate-100 last:border-0 hover:bg-secondary/5 transition-colors"
                    >
                      <TableCell className="font-bold text-primary border-r border-slate-100 bg-slate-50/50">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-primary font-bold border-r border-slate-100">
                        {stakeholder.stakeholder_type}
                      </TableCell>
                      <TableCell className="text-slate-800 border-r border-slate-100 font-medium">
                        {stakeholder.stakeholder_title}
                      </TableCell>
                      <TableCell className="text-center border-r border-slate-100">
                        <button
                          onClick={() => toggleStatus(stakeholder)}
                          disabled={updateMutation.isPending}
                          className={cn(
                            "px-4 py-1.5 rounded text-[10px] font-black transition-all shadow-sm active:scale-95 text-white uppercase tracking-tighter",
                            stakeholder.status === "active"
                              ? "bg-primary hover:bg-primary/90"
                              : "bg-slate-400 hover:bg-slate-500"
                          )}
                        >
                          {statusDisplay(stakeholder.status)}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => openEditDialog(stakeholder)}
                            disabled={updateMutation.isPending}
                            className="bg-primary hover:bg-primary/90 h-8 px-3 border-none shadow-sm gap-1.5"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-white" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleDelete(stakeholder.id)}
                            disabled={deleteMutation.isPending}
                            className="bg-secondary hover:bg-secondary/90 h-8 w-8 p-0 border-none shadow-sm"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-white" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 opacity-20 text-primary" />
                        <p className="font-heading italic">No stakeholders found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
