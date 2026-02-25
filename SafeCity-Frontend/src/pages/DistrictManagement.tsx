import { Layout } from "@/components/layout/Layout";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DistrictManagement() {
    const [districts, setDistricts] = useState([
        { id: 1, province: "Punjab", division: "Lahore Division", name: "Lahore" },
        { id: 2, province: "Punjab", division: "Lahore Division", name: "Kasur" },
        { id: 3, province: "Gilgit Baltistan", division: "Skardu Division", name: "Skardu" }
    ]);
    const [formData, setFormData] = useState({
        province: "",
        division: "",
        name: ""
    });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const { toast } = useToast();

    const handleEdit = (id: number) => {
        const district = districts.find(d => d.id === id);
        if (district) {
            setFormData({
                province: district.province,
                division: district.division,
                name: district.name
            });
            setEditingId(id);
        }
    };

    const handleCreate = () => {
        if (!formData.province || !formData.division || !formData.name) {
            toast({
                title: "Error",
                description: "All fields are required",
                variant: "destructive"
            });
            return;
        }

        if (editingId !== null) {
            // Update existing district
            setDistricts(districts.map(d => 
                d.id === editingId ? { ...d, province: formData.province, division: formData.division, name: formData.name } : d
            ));
            setFormData({ province: "", division: "", name: "" });
            setEditingId(null);
            toast({
                title: "Success",
                description: "District updated successfully"
            });
        } else {
            // Create new district
            const newDistrict = {
                id: districts.length + 1,
                province: formData.province,
                division: formData.division,
                name: formData.name
            };
            setDistricts([...districts, newDistrict]);
            setFormData({ province: "", division: "", name: "" });
            toast({
                title: "Success",
                description: "District created successfully"
            });
        }
    };

    const handleCancel = () => {
        setFormData({ province: "", division: "", name: "" });
        setEditingId(null);
    };

    const handleDelete = (id: number) => {
        setDistricts(districts.filter(d => d.id !== id));
        toast({
            title: "Deleted",
            description: "District removed successfully"
        });
    };

    const filteredDistricts = districts.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.division.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.province.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Layout title="Area Hierarchy Management">
            <div className="flex flex-col gap-8 max-w-[1400px] mx-auto pb-20">
                <div>
                    <h1 className="text-2xl font-bold text-primary">District — Add / Edit</h1>
                    <p className="text-muted-foreground text-sm">Create a new district or edit an existing one.</p>
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
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Province</Label>
                                <Select onValueChange={(v) => setFormData({ ...formData, province: v })} value={formData.province}>
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select province" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Punjab">Punjab</SelectItem>
                                        <SelectItem value="Sindh">Sindh</SelectItem>
                                        <SelectItem value="Gilgit Baltistan">Gilgit Baltistan</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Division</Label>
                                <Select onValueChange={(v) => setFormData({ ...formData, division: v })} value={formData.division} disabled={!formData.province}>
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select division" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Lahore Division">Lahore Division</SelectItem>
                                        <SelectItem value="Rawalpindi Division">Rawalpindi Division</SelectItem>
                                        <SelectItem value="Skardu Division">Skardu Division</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">District Name</Label>
                                <Input
                                    placeholder="Enter district name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="h-10"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button onClick={handleCreate} className="bg-secondary hover:bg-secondary/90 text-white flex-1 h-10 w-full">
                                    {editingId !== null ? (
                                        <>Update District</>
                                    ) : (
                                        <><Plus className="h-4 w-4 mr-2" /> Create District</>
                                    )}
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
                        <h2 className="text-xl font-bold text-primary">District List</h2>
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
                                    {filteredDistricts.map((district, index) => (
                                        <TableRow key={district.id}>
                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                            <TableCell className="whitespace-nowrap">{district.province}</TableCell>
                                            <TableCell className="whitespace-nowrap">{district.division}</TableCell>
                                            <TableCell className="font-semibold text-primary whitespace-nowrap">{district.name}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => handleEdit(district.id)}
                                                        className="h-8 border border-muted hover:bg-muted whitespace-nowrap"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(district.id)}
                                                        className="h-8 border border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 whitespace-nowrap"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredDistricts.length === 0 && (
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
