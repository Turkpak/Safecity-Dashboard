import { Layout } from "@/components/layout/Layout";
import { useState, useEffect } from "react";
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
  listDistricts,
  createDistrict,
  updateDistrict,
  deleteDistrict,
} from "@/api";
import type { District, Division, Province } from "@/api/types";

export default function DistrictManagement() {
  const [formData, setFormData] = useState({ provinceId: "", divisionId: "", district_name: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: provinces = [], isLoading: provincesLoading } = useQuery({
    queryKey: ["provinces"],
    queryFn: listProvinces,
  });

  const provinceIdNum = formData.provinceId ? Number(formData.provinceId) : undefined;
  const { data: divisionsByProvince = [] } = useQuery({
    queryKey: ["divisions", provinceIdNum],
    queryFn: () => listDivisions(provinceIdNum),
    enabled: !!provinceIdNum,
  });

  const { data: allDistrictsRaw = [], isLoading: districtsLoading } = useQuery({
    queryKey: ["districts"],
    queryFn: () => listDistricts(),
  });
  const allDistricts = Array.isArray(allDistrictsRaw) ? allDistrictsRaw : [];

  useEffect(() => {
    if (!formData.provinceId) setFormData((f) => ({ ...f, divisionId: "" }));
  }, [formData.provinceId]);

  const createMutation = useMutation({
    mutationFn: createDistrict,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["districts"] });
      setFormData({ provinceId: "", divisionId: "", district_name: "" });
      toast({ title: "Success", description: "District created successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to create district", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: { district_name?: string; province?: number; division?: number };
    }) => updateDistrict(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["districts"] });
      setFormData({ provinceId: "", divisionId: "", district_name: "" });
      setEditingId(null);
      toast({ title: "Success", description: "District updated successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to update district", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDistrict,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["districts"] });
      toast({ title: "Deleted", description: "District removed successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to delete district", variant: "destructive" });
    },
  });

  const handleEdit = (d: District) => {
    setFormData({
      provinceId: String(d.province),
      divisionId: String(d.division),
      district_name: d.district_name,
    });
    setEditingId(d.id);
  };

  const handleSubmit = () => {
    if (!formData.district_name.trim()) {
      toast({ title: "Error", description: "District name is required", variant: "destructive" });
      return;
    }
    if (!formData.provinceId || !formData.divisionId) {
      toast({ title: "Error", description: "Please select province and division", variant: "destructive" });
      return;
    }
    const provinceId = Number(formData.provinceId);
    const divisionId = Number(formData.divisionId);
    if (editingId !== null) {
      updateMutation.mutate({
        id: editingId,
        payload: { district_name: formData.district_name.trim(), province: provinceId, division: divisionId },
      });
    } else {
      createMutation.mutate({
        district_name: formData.district_name.trim(),
        province: provinceId,
        division: divisionId,
      });
    }
  };

  const handleCancel = () => {
    setFormData({ provinceId: "", divisionId: "", district_name: "" });
    setEditingId(null);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this district?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredDistricts = allDistricts.filter(
    (d) =>
      d.district_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.division_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.province_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout title="Area Hierarchy Management">
      <div className="flex flex-col gap-8 max-w-[1400px] mx-auto pb-20">
        <div>
          <h1 className="text-2xl font-bold text-primary">District — Add / Edit</h1>
          <p className="text-muted-foreground text-sm">Select Province → Division, then add the district against that hierarchy.</p>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="h-1 bg-secondary w-full" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Province <span className="text-destructive">*</span>
                </Label>
                <Select
                  onValueChange={(v) => setFormData({ ...formData, provinceId: v, divisionId: "" })}
                  value={formData.provinceId}
                  disabled={provincesLoading}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={provinces.length === 0 ? "Add provinces first" : "Select province"} />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((p: Province) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.province_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Division <span className="text-destructive">*</span>
                </Label>
                <Select
                  onValueChange={(v) => setFormData({ ...formData, divisionId: v })}
                  value={formData.divisionId}
                  disabled={!formData.provinceId}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={!formData.provinceId ? "Select province first" : "Select division"} />
                  </SelectTrigger>
                  <SelectContent>
                    {divisionsByProvince.map((d: Division) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.division_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  District Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Enter district name"
                  value={formData.district_name}
                  onChange={(e) => setFormData({ ...formData, district_name: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-secondary hover:bg-secondary/90 text-white flex-1 h-10 w-full"
                >
                  {editingId !== null ? "Update District" : <><Plus className="h-4 w-4 mr-2" /> Create District</>}
                </Button>
                {editingId !== null && (
                  <Button variant="outline" onClick={handleCancel} className="w-full h-10">
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-primary">District List</h2>
              <p className="text-muted-foreground text-sm mt-0.5">All added districts (Province → Division → District) from list-district API.</p>
            </div>
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
                    <TableHead>Province</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {districtsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDistricts.map((district, index) => (
                      <TableRow key={district.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="whitespace-nowrap">{district.province_name ?? ""}</TableCell>
                        <TableCell className="whitespace-nowrap">{district.division_name ?? ""}</TableCell>
                        <TableCell className="font-semibold text-primary whitespace-nowrap">{district.district_name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(district)}
                              className="h-8 border border-muted hover:bg-muted whitespace-nowrap"
                            >
                              <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(district.id)}
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
                  {!districtsLoading && filteredDistricts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No districts found.
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
