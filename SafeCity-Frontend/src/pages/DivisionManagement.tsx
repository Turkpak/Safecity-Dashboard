import { Layout } from "@/components/layout/Layout";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Plus, Edit2, Trash2, Search, X, Globe, Upload, Check, ChevronRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { CityMap } from "@/components/dashboard/CityMap";
import { LayerType } from "@/pages/GISLayers";

export default function DivisionManagement() {
    const [divisions, setDivisions] = useState([
        { id: 1, province: "Gilgit Baltistan", name: "Skardu Division" },
        { id: 2, province: "Punjab", name: "Lahore Division" },
        { id: 3, province: "Punjab", name: "Rawalpindi Division" }
    ]);
    const [formData, setFormData] = useState({
        province: "",
        name: ""
    });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const { toast } = useToast();

    const handleEdit = (id: number) => {
        const division = divisions.find(d => d.id === id);
        if (division) {
            setFormData({
                province: division.province,
                name: division.name
            });
            setEditingId(id);
        }
    };

    const handleCreate = () => {
        if (!formData.province || !formData.name) {
            toast({
                title: "Error",
                description: "All fields are required",
                variant: "destructive"
            });
            return;
        }

        if (editingId !== null) {
            // Update existing division
            setDivisions(divisions.map(d => 
                d.id === editingId ? { ...d, province: formData.province, name: formData.name } : d
            ));
            setFormData({ province: "", name: "" });
            setEditingId(null);
            toast({
                title: "Success",
                description: "Division updated successfully"
            });
        } else {
            // Create new division
            const newDivision = {
                id: divisions.length + 1,
                province: formData.province,
                name: formData.name
            };
            setDivisions([...divisions, newDivision]);
            setFormData({ province: "", name: "" });
            toast({
                title: "Success",
                description: "Division created successfully"
            });
        }
    };

    const handleCancel = () => {
        setFormData({ province: "", name: "" });
        setEditingId(null);
    };

    const handleDelete = (id: number) => {
        setDivisions(divisions.filter(d => d.id !== id));
        toast({
            title: "Deleted",
            description: "Division removed successfully"
        });
    };

    const filteredDivisions = divisions.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.province.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Division Name</Label>
                                <Input
                                    placeholder="Enter division name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="h-10"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 lg:col-span-1">
                                <Button onClick={handleCreate} className="bg-secondary hover:bg-secondary/90 text-white w-full h-10">
                                    {editingId !== null ? (
                                        <>Update Division</>
                                    ) : (
                                        <><Plus className="h-4 w-4 mr-2" /> Create Division</>
                                    )}
                                </Button>
                                {editingId !== null && (
                                    <Button variant="outline" onClick={handleCancel} className="w-full h-10">
                                        Cancel
                                    </Button>
                                )}
                                {editingId === null && (
                                    <Button variant="outline" onClick={() => setFormData({ province: "", name: "" })} className="w-full h-10">
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
                                    {filteredDivisions.map((division, index) => (
                                        <TableRow key={division.id}>
                                            <TableCell className="font-medium">{index + 1}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                                        {division.province.substring(0, 2)}
                                                    </div>
                                                    <span className="truncate">{division.province}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-semibold text-primary">{division.name}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => handleEdit(division.id)}
                                                        className="h-8 border border-muted hover:bg-muted whitespace-nowrap"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(division.id)}
                                                        className="h-8 border border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 whitespace-nowrap"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredDivisions.length === 0 && (
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
