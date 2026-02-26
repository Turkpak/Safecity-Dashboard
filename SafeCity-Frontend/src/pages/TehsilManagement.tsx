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
  listTehsils,
  createTehsil,
  updateTehsil,
  deleteTehsil,
} from "@/api";
import type { Tehsil, District, Division, Province } from "@/api/types";

export default function TehsilManagement() {
  const [formData, setFormData] = useState({
    provinceId: "",
    divisionId: "",
    districtId: "",
    tehsil_name: "",
  });
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

  const divisionIdNum = formData.divisionId ? Number(formData.divisionId) : undefined;
  const { data: districtsByDivision = [] } = useQuery({
    queryKey: ["districts", divisionIdNum],
    queryFn: () => listDistricts(divisionIdNum),
    enabled: !!divisionIdNum,
  });

  const { data: allTehsilsRaw = [], isLoading: tehsilsLoading } = useQuery({
    queryKey: ["tehsils"],
    queryFn: () => listTehsils(),
  });
  const allTehsils = Array.isArray(allTehsilsRaw) ? allTehsilsRaw : [];

  useEffect(() => {
    if (!formData.provinceId) setFormData((f) => ({ ...f, divisionId: "", districtId: "" }));
  }, [formData.provinceId]);
  useEffect(() => {
    if (!formData.divisionId) setFormData((f) => ({ ...f, districtId: "" }));
  }, [formData.divisionId]);

  const createMutation = useMutation({
    mutationFn: createTehsil,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tehsils"] });
      setFormData({ provinceId: "", divisionId: "", districtId: "", tehsil_name: "" });
      toast({ title: "Success", description: "Tehsil created successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to create tehsil", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: { tehsil_name?: string; province?: number; division?: number; district?: number };
    }) => updateTehsil(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tehsils"] });
      setFormData({ provinceId: "", divisionId: "", districtId: "", tehsil_name: "" });
      setEditingId(null);
      toast({ title: "Success", description: "Tehsil updated successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to update tehsil", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTehsil,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tehsils"] });
      toast({ title: "Deleted", description: "Tehsil removed successfully" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to delete tehsil", variant: "destructive" });
    },
  });

  const handleEdit = (t: Tehsil) => {
    setFormData({
      provinceId: String(t.province),
      divisionId: String(t.division),
      districtId: String(t.district),
      tehsil_name: t.tehsil_name,
    });
    setEditingId(t.id);
  };

  const handleSubmit = () => {
    if (!formData.tehsil_name.trim()) {
      toast({ title: "Error", description: "Tehsil name is required", variant: "destructive" });
      return;
    }
    if (!formData.provinceId || !formData.divisionId || !formData.districtId) {
      toast({ title: "Error", description: "Please select province, division and district", variant: "destructive" });
      return;
    }
    const provinceId = Number(formData.provinceId);
    const divisionId = Number(formData.divisionId);
    const districtId = Number(formData.districtId);
    if (editingId !== null) {
      updateMutation.mutate({
        id: editingId,
        payload: {
          tehsil_name: formData.tehsil_name.trim(),
          province: provinceId,
          division: divisionId,
          district: districtId,
        },
      });
    } else {
      createMutation.mutate({
        tehsil_name: formData.tehsil_name.trim(),
        province: provinceId,
        division: divisionId,
        district: districtId,
      });
    }
  };

  const handleCancel = () => {
    setFormData({ provinceId: "", divisionId: "", districtId: "", tehsil_name: "" });
    setEditingId(null);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this tehsil?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredTehsils = allTehsils.filter(
    (t) =>
      t.tehsil_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.district_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.division_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.province_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout title="Area Hierarchy Management">
      <div className="flex flex-col gap-8 max-w-[1400px] mx-auto pb-20">
        <div>
          <h1 className="text-2xl font-bold text-primary">Tehsil — Add / Edit</h1>
          <p className="text-muted-foreground text-sm">Select Province → Division → District, then enter tehsil name and click Create Tehsil.</p>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="h-1 bg-secondary w-full" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Province <span className="text-destructive">*</span></Label>
                <Select
                  onValueChange={(v) => setFormData({ ...formData, provinceId: v, divisionId: "", districtId: "" })}
                  value={formData.provinceId}
                  disabled={provincesLoading}
                >
                  <SelectTrigger className="h-10 text-xs text-foreground">
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Division <span className="text-destructive">*</span></Label>
                <Select
                  onValueChange={(v) => setFormData({ ...formData, divisionId: v, districtId: "" })}
                  value={formData.divisionId}
                  disabled={!formData.provinceId}
                >
                  <SelectTrigger className="h-10 text-xs text-foreground">
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">District <span className="text-destructive">*</span></Label>
                <Select
                  onValueChange={(v) => setFormData({ ...formData, districtId: v })}
                  value={formData.districtId}
                  disabled={!formData.divisionId}
                >
                  <SelectTrigger className="h-10 text-xs text-foreground">
                    <SelectValue placeholder={!formData.divisionId ? "Select division first" : "Select district"} />
                  </SelectTrigger>
                  <SelectContent>
                    {districtsByDivision.map((d: District) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.district_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tehsil Name <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Enter tehsil name"
                  value={formData.tehsil_name}
                  onChange={(e) => setFormData({ ...formData, tehsil_name: e.target.value })}
                  className="h-10 text-xs"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-secondary hover:bg-secondary/90 text-white w-full h-10 text-xs"
                >
                  {editingId !== null ? "Update Tehsil" : <><Plus className="h-3 w-3 mr-2" /> Create Tehsil</>}
                </Button>
                {editingId !== null && (
                  <Button variant="outline" onClick={handleCancel} className="w-full h-10 text-xs">
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-primary">Tehsil List</h2>
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
                    <TableHead>Tehsil</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tehsilsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTehsils.map((tehsil, index) => (
                      <TableRow key={tehsil.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="whitespace-nowrap">{tehsil.province_name ?? ""}</TableCell>
                        <TableCell className="whitespace-nowrap">{tehsil.division_name ?? ""}</TableCell>
                        <TableCell className="whitespace-nowrap">{tehsil.district_name ?? ""}</TableCell>
                        <TableCell className="font-semibold text-primary whitespace-nowrap">{tehsil.tehsil_name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(tehsil)}
                              className="h-8 border border-muted hover:bg-muted whitespace-nowrap"
                            >
                              <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(tehsil.id)}
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
                  {!tehsilsLoading && filteredTehsils.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No tehsils found.
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
