import { Layout } from "@/components/layout/Layout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listProvinces,
  listDivisions,
  createDivision,
  updateDivision,
  deleteDivision,
} from "@/api";
import type { Division, Province } from "@/api/types";

export default function DivisionManagement() {
  const [formData, setFormData] = useState({ provinceId: "" as string, division_name: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: provinces = [], isLoading: provincesLoading } = useQuery({
    queryKey: ["provinces"],
    queryFn: listProvinces,
  });

  const { data: allDivisionsRaw, isLoading: divisionsLoading } = useQuery({
    queryKey: ["divisions"],
    queryFn: () => listDivisions(),
  });
  const allDivisions = Array.isArray(allDivisionsRaw) ? allDivisionsRaw : [];

  const createMutation = useMutation({
    mutationFn: createDivision,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divisions"] });
      setFormData({ provinceId: "", division_name: "" });
      toast({ title: "Success", description: "Division created successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to create division", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { division_name?: string; province?: number } }) =>
      updateDivision(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divisions"] });
      setFormData({ provinceId: "", division_name: "" });
      setEditingId(null);
      toast({ title: "Success", description: "Division updated successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to update division", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDivision,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divisions"] });
      toast({ title: "Deleted", description: "Division removed successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to delete division", variant: "destructive" });
    },
  });

  const handleEdit = (d: Division) => {
    setFormData({ provinceId: String(d.province), division_name: d.division_name });
    setEditingId(d.id);
  };

  const handleSubmit = () => {
    if (!formData.division_name.trim()) {
      toast({ title: "Error", description: "Division name is required", variant: "destructive" });
      return;
    }
    if (!formData.provinceId) {
      toast({ title: "Error", description: "Please select a province", variant: "destructive" });
      return;
    }
    const provinceId = Number(formData.provinceId);
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, payload: { division_name: formData.division_name.trim(), province: provinceId } });
    } else {
      createMutation.mutate({ division_name: formData.division_name.trim(), province: provinceId });
    }
  };

  const handleCancel = () => {
    setFormData({ provinceId: "", division_name: "" });
    setEditingId(null);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this division?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredDivisions = allDivisions.filter(
    (d) =>
      d.division_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.province_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const isLoading = divisionsLoading;

  return (
    <Layout title="Area Hierarchy Management">
      <div className="flex flex-col gap-8 max-w-[1400px] mx-auto pb-20">
        <div>
          <h1 className="text-2xl font-bold text-primary">Division — Add / Edit</h1>
          <p className="text-muted-foreground text-sm">Create a new division or edit an existing one.</p>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="h-1 bg-secondary w-full" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Province <span className="text-destructive">*</span>
                </Label>
                <Select
                  onValueChange={(v) => setFormData({ ...formData, provinceId: v })}
                  value={formData.provinceId}
                  disabled={provincesLoading}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={provinces.length === 0 ? "No provinces—add in Province Management" : "Select province"} />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((p: Province) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.province_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!provincesLoading && provinces.length === 0 && (
                  <p className="text-xs text-muted-foreground">Add provinces in Province Management first, then select one here.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Division Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Enter division name"
                  value={formData.division_name}
                  onChange={(e) => setFormData({ ...formData, division_name: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 lg:col-span-1">
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-secondary hover:bg-secondary/90 text-white w-full h-10"
                >
                  {editingId !== null ? "Update Division" : <><Plus className="h-4 w-4 mr-2" /> Create Division</>}
                </Button>
                {editingId !== null && (
                  <Button variant="outline" onClick={handleCancel} className="w-full h-10">
                    Cancel
                  </Button>
                )}
                {editingId === null && (
                  <Button variant="destructive" size="sm" onClick={() => setFormData({ ...formData, division_name: "" })} className="w-full h-8 text-white bg-red-600 hover:bg-red-700 border-0 text-xs font-medium">
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-primary">Division List</h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name .."
                className="pl-10 h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Card className="border-none shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-20">#</TableHead>
                    <TableHead>Province</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDivisions.map((division, index) => (
                      <TableRow key={division.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {(division.province_name || "").substring(0, 2)}
                            </div>
                            <span className="truncate">{division.province_name ?? ""}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-primary">{division.division_name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(division)}
                              className="h-8 border border-muted hover:bg-muted whitespace-nowrap"
                            >
                              <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(division.id)}
                              disabled={deleteMutation.isPending}
                              className="h-8 border border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 whitespace-nowrap"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {!isLoading && filteredDivisions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No divisions found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
