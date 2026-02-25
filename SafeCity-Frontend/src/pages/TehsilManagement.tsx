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

export default function TehsilManagement() {
    const [tehsils, setTehsils] = useState([
        { id: 1, province: "Punjab", division: "Lahore Division", district: "Lahore", name: "Model Town" },
        { id: 2, province: "Punjab", division: "Lahore Division", district: "Lahore", name: "Lahore Cantt" },
    ]);
    const [formData, setFormData] = useState({
        province: "",
        division: "",
        district: "",
        name: ""
    });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const { toast } = useToast();

    const handleEdit = (id: number) => {
        const tehsil = tehsils.find(t => t.id === id);
        if (tehsil) {
            setFormData({
                province: tehsil.province,
                division: tehsil.division,
                district: tehsil.district,
                name: tehsil.name
            });
            setEditingId(id);
        }
    };

    const handleCreate = () => {
        if (!formData.province || !formData.division || !formData.district || !formData.name) {
            toast({
                title: "Error",
                description: "All fields are required",
                variant: "destructive"
            });
            return;
        }

        if (editingId !== null) {
            // Update existing tehsil
            setTehsils(tehsils.map(t => 
                t.id === editingId ? { ...t, province: formData.province, division: formData.division, district: formData.district, name: formData.name } : t
            ));
            setFormData({ province: "", division: "", district: "", name: "" });
            setEditingId(null);
            toast({
                title: "Success",
                description: "Tehsil updated successfully"
            });
        } else {
            // Create new tehsil
            const newTehsil = {
                id: tehsils.length + 1,
                province: formData.province,
                division: formData.division,
                district: formData.district,
                name: formData.name
            };
            setTehsils([...tehsils, newTehsil]);
            setFormData({ province: "", division: "", district: "", name: "" });
            toast({
                title: "Success",
                description: "Tehsil created successfully"
            });
        }
    };

    const handleCancel = () => {
        setFormData({ province: "", division: "", district: "", name: "" });
        setEditingId(null);
    };

    const handleDelete = (id: number) => {
        setTehsils(tehsils.filter(t => t.id !== id));
        toast({
            title: "Deleted",
            description: "Tehsil removed successfully"
        });
    };

    const filteredTehsils = tehsils.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.division.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.province.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Layout title="Area Hierarchy Management">
            <div className="flex flex-col gap-8 max-w-[1400px] mx-auto pb-20">
                <div>
                    <h1 className="text-2xl font-bold text-primary">Tehsil — Add / Edit</h1>
                    <p className="text-muted-foreground text-sm">Create a new tehsil or edit an existing one.</p>
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
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Province</Label>
                                <Select onValueChange={(v) => setFormData({ ...formData, province: v })} value={formData.province}>
                                    <SelectTrigger className="h-10 text-xs text-foreground">
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
                                    <SelectTrigger className="h-10 text-xs text-foreground">
                                        <SelectValue placeholder="Select division" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Lahore Division">Lahore Division</SelectItem>
                                        <SelectItem value="Rawalpindi Division">Rawalpindi Division</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">District</Label>
                                <Select onValueChange={(v) => setFormData({ ...formData, district: v })} value={formData.district} disabled={!formData.division}>
                                    <SelectTrigger className="h-10 text-xs text-foreground">
                                        <SelectValue placeholder="Select district" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Lahore">Lahore</SelectItem>
                                        <SelectItem value="Kasur">Kasur</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tehsil Name</Label>
                                <Input
                                    placeholder="Enter tehsil name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="h-10 text-xs"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button onClick={handleCreate} className="bg-secondary hover:bg-secondary/90 text-white w-full h-10 text-xs">
                                    {editingId !== null ? (
                                        <>Update Tehsil</>
                                    ) : (
                                        <><Plus className="h-3 w-3 mr-2" /> Create Tehsil</>
                                    )}
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
                                    {filteredTehsils.map((tehsil, index) => (
                                        <TableRow key={tehsil.id}>
                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                            <TableCell className="whitespace-nowrap">{tehsil.province}</TableCell>
                                            <TableCell className="whitespace-nowrap">{tehsil.division}</TableCell>
                                            <TableCell className="whitespace-nowrap">{tehsil.district}</TableCell>
                                            <TableCell className="font-semibold text-primary whitespace-nowrap">{tehsil.name}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => handleEdit(tehsil.id)}
                                                        className="h-8 border border-muted hover:bg-muted whitespace-nowrap"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(tehsil.id)}
                                                        className="h-8 border border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 whitespace-nowrap"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredTehsils.length === 0 && (
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
