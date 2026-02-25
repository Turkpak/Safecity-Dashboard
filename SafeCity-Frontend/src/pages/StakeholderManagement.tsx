import { Layout } from "@/components/layout/Layout";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import {
    Plus,
    Edit2,
    Trash2,
    Search,
    X,
    Users,
    Save,
    RotateCcw,
    ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Stakeholder {
    id: number;
    type: string;
    title: string;
    status: "Active" | "Inactive";
}

export default function StakeholderManagement() {
    const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);
    const [formData, setFormData] = useState({
        type: "",
        title: "",
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [pageSize, setPageSize] = useState("5");
    const { toast } = useToast();

    const handleCreateOrUpdate = () => {
        if (!formData.type || !formData.title) {
            toast({
                title: "Error",
                description: "Type and Title are required",
                variant: "destructive",
            });
            return;
        }

        if (editingStakeholder) {
            setStakeholders(stakeholders.map(s =>
                s.id === editingStakeholder.id
                    ? { ...s, type: formData.type, title: formData.title }
                    : s
            ));
            toast({
                title: "Success",
                description: "Stakeholder updated successfully",
            });
        } else {
            const newStakeholder: Stakeholder = {
                id: Math.max(0, ...stakeholders.map(s => s.id)) + 1,
                type: formData.type,
                title: formData.title,
                status: "Active",
            };
            setStakeholders([...stakeholders, newStakeholder]);
            toast({
                title: "Success",
                description: "Stakeholder added successfully",
            });
        }

        setFormData({ type: "", title: "" });
        setEditingStakeholder(null);
        setIsAddDialogOpen(false);
    };

    const handleDelete = (id: number) => {
        setStakeholders(stakeholders.filter(s => s.id !== id));
        toast({
            title: "Deleted",
            description: "Stakeholder removed successfully",
        });
    };

    const toggleStatus = (id: number) => {
        setStakeholders(stakeholders.map(s =>
            s.id === id
                ? { ...s, status: s.status === "Active" ? "Inactive" : "Active" }
                : s
        ));
    };

    const openEditDialog = (stakeholder: Stakeholder) => {
        setEditingStakeholder(stakeholder);
        setFormData({ type: stakeholder.type, title: stakeholder.title });
        setIsAddDialogOpen(true);
    };

    const filteredStakeholders = stakeholders.filter(s =>
        s.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Layout title="Stakeholder Management">
            <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-20">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-primary p-4 rounded-t-lg shadow-lg border-b-4 border-secondary gap-3">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Users className="h-5 w-5 text-secondary" /> Stakeholders
                    </h1>
                    <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                        setIsAddDialogOpen(open);
                        if (!open) {
                            setEditingStakeholder(null);
                            setFormData({ type: "", title: "" });
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button className="bg-secondary hover:bg-secondary/90 text-white border-none shadow-md font-bold">
                                <Plus className="h-4 w-4 mr-2" /> Add Stakeholder
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] p-0 border-none rounded-xl max-h-[90vh] overflow-y-auto">
                            <div className="bg-primary px-6 py-4 flex items-center justify-between border-b-4 border-secondary">
                                <DialogTitle className="text-white text-lg font-bold">
                                    {editingStakeholder ? "Edit Stakeholder" : "Add Stakeholder"}
                                </DialogTitle>
                                <button onClick={() => setIsAddDialogOpen(false)} className="text-white/70 hover:text-white transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</Label>
                                        <Input
                                            placeholder="Stakeholder Type"
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                            className="h-10 border-muted-foreground/20 focus:ring-secondary/20"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</Label>
                                        <Input
                                            placeholder="stakeholder Title"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="h-10 border-muted-foreground/20 focus:ring-secondary/20"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-center gap-3 pt-4">
                                    <Button onClick={handleCreateOrUpdate} className="bg-secondary hover:bg-secondary/90 text-white px-8 h-10 shadow-lg font-bold">
                                        <Save className="h-4 w-4 mr-2" /> {editingStakeholder ? "Update" : "Add"}
                                    </Button>
                                    <Button variant="secondary" onClick={() => setIsAddDialogOpen(false)} className="bg-slate-500 hover:bg-slate-600 text-white px-8 h-10 shadow-lg border-none font-bold">
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Filters Section */}
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

                {/* Table Section */}
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
                                {filteredStakeholders.length > 0 ? (
                                    filteredStakeholders.slice(0, parseInt(pageSize)).map((stakeholder, index) => (
                                        <TableRow key={stakeholder.id} className="group border-b border-slate-100 last:border-0 hover:bg-secondary/5 transition-colors">
                                            <TableCell className="font-bold text-primary border-r border-slate-100 bg-slate-50/50">{index + 1}</TableCell>
                                            <TableCell className="text-primary font-bold border-r border-slate-100">{stakeholder.type}</TableCell>
                                            <TableCell className="text-slate-800 border-r border-slate-100 font-medium">{stakeholder.title}</TableCell>
                                            <TableCell className="text-center border-r border-slate-100">
                                                <button
                                                    onClick={() => toggleStatus(stakeholder.id)}
                                                    className={cn(
                                                        "px-4 py-1.5 rounded text-[10px] font-black transition-all shadow-sm active:scale-95 text-white uppercase tracking-tighter",
                                                        stakeholder.status === "Active"
                                                            ? "bg-primary hover:bg-primary/90"
                                                            : "bg-slate-400 hover:bg-slate-500"
                                                    )}
                                                >
                                                    {stakeholder.status}
                                                </button>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => openEditDialog(stakeholder)}
                                                        className="bg-primary hover:bg-primary/90 h-8 w-8 p-0 border-none shadow-sm"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5 text-white" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleDelete(stakeholder.id)}
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
