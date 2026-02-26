import { Layout } from "@/components/layout/Layout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listProvinces,
  createProvince,
  updateProvince,
  deleteProvince,
} from "@/api/province";
import type { Province } from "@/api/types";

export default function ProvinceManagement() {
  const [provinceName, setProvinceName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: provinces = [], isLoading } = useQuery({
    queryKey: ["provinces"],
    queryFn: listProvinces,
  });

  const createMutation = useMutation({
    mutationFn: createProvince,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provinces"] });
      setProvinceName("");
      toast({ title: "Success", description: "Province created successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to create province", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { province_name: string } }) =>
      updateProvince(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provinces"] });
      setProvinceName("");
      setEditingId(null);
      toast({ title: "Success", description: "Province updated successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to update province", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProvince,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provinces"] });
      toast({ title: "Deleted", description: "Province removed successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to delete province", variant: "destructive" });
    },
  });

  const handleEdit = (p: Province) => {
    setProvinceName(p.province_name);
    setEditingId(p.id);
  };

  const handleSubmit = () => {
    if (!provinceName.trim()) {
      toast({ title: "Error", description: "Province name is required", variant: "destructive" });
      return;
    }
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, payload: { province_name: provinceName.trim() } });
    } else {
      createMutation.mutate({ province_name: provinceName.trim() });
    }
  };

  const handleCancel = () => {
    setProvinceName("");
    setEditingId(null);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this province?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredProvinces = provinces.filter((p) =>
    p.province_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout title="Area Hierarchy Management">
      <div className="flex flex-col gap-8 max-w-[1400px] mx-auto pb-20">
        <div>
          <h1 className="text-2xl font-bold text-primary">Province — Add / Edit</h1>
          <p className="text-muted-foreground text-sm">Create a new province or edit an existing one.</p>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="h-1 bg-secondary w-full" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <div className="space-y-2">
                <Label htmlFor="province-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Province Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="province-name"
                  placeholder="e.g. Punjab"
                  value={provinceName}
                  onChange={(e) => setProvinceName(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-secondary hover:bg-secondary/90 text-white w-full h-10"
                >
                  {editingId !== null ? "Update Province" : <><Plus className="h-4 w-4 mr-2" /> Create Province</>}
                </Button>
                {editingId !== null && (
                  <Button variant="outline" onClick={handleCancel} className="w-full h-10">
                    Cancel
                  </Button>
                )}
                {editingId === null && (
                  <Button variant="outline" onClick={() => setProvinceName("")} className="w-full h-10">
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-primary">Province List</h2>
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
                    <TableHead className="w-16">#</TableHead>
                    <TableHead className="w-24">ID</TableHead>
                    <TableHead>Province</TableHead>
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
                  ) : filteredProvinces.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No provinces found. Create one above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProvinces.map((province, index) => (
                      <TableRow key={province.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">{province.id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-xs shrink-0">
                              {province.province_name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="truncate">{province.province_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(province)}
                              className="h-8 border border-muted hover:bg-muted whitespace-nowrap"
                            >
                              <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(province.id)}
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
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
