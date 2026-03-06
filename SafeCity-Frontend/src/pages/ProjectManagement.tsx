import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FolderKanban, Plus, Upload, FileText, MapPin, X, File, ChevronRight, ChevronLeft, CheckCircle2, Calendar, Eye, Pencil, ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  listProjects,
  listStakeholders,
  listProvinces,
  listDivisions,
  listDistricts,
  listTehsils,
  createProject,
  updateProject,
  deleteProject,
} from "@/api";
import type { Project as ApiProject } from "@/api/types";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Component to fit map bounds to GeoJSON
function GeoJSONFitBounds({ data }: { data: any }) {
  const map = useMap();
  useEffect(() => {
    if (data) {
      try {
        const layer = L.geoJSON(data);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 15,
            animate: true,
            duration: 1.5
          });
        }
      } catch (err) {
        console.error("Error fitting map to GeoJSON:", err);
      }
    }
  }, [data, map]);
  return null;
}

// Map component for displaying project area
function ProjectAreaMap({ geoData }: { geoData: any }) {
  const [isMounted, setIsMounted] = useState(false);
  const center: [number, number] = [31.5204, 74.3587]; // Default to Lahore

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="h-[400px] w-full bg-muted animate-pulse rounded-lg" />;
  }

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border">
      <MapContainer
        center={center}
        zoom={10}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geoData && (
          <>
            <GeoJSON data={geoData} style={{ color: "#3b82f6", weight: 3, fillColor: "#3b82f6", fillOpacity: 0.2 }} />
            <GeoJSONFitBounds data={geoData} />
          </>
        )}
      </MapContainer>
    </div>
  );
}

export default function ProjectManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [showXERDialog, setShowXERDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingProject, setEditingProject] = useState<ApiProject | null>(null);
  const [selectedProjectForView, setSelectedProjectForView] = useState<ApiProject | null>(null);

  const { data: projectsData = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });
  const { data: stakeholdersList = [] } = useQuery({
    queryKey: ["stakeholders"],
    queryFn: listStakeholders,
  });
  const { data: provincesList = [] } = useQuery({
    queryKey: ["provinces"],
    queryFn: listProvinces,
  });
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>("");
  const provinceIdNum = selectedProvinceId ? Number(selectedProvinceId) : undefined;
  const { data: divisionsList = [] } = useQuery({
    queryKey: ["divisions", provinceIdNum],
    queryFn: () => listDivisions(provinceIdNum),
    enabled: !!provinceIdNum,
  });
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("");
  const divisionIdNum = selectedDivisionId ? Number(selectedDivisionId) : undefined;
  const { data: districtsList = [] } = useQuery({
    queryKey: ["districts", divisionIdNum],
    queryFn: () => listDistricts(divisionIdNum),
    enabled: !!divisionIdNum,
  });
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("");
  const districtIdNum = selectedDistrictId ? Number(selectedDistrictId) : undefined;
  const { data: tehsilsList = [] } = useQuery({
    queryKey: ["tehsils", districtIdNum],
    queryFn: () => listTehsils(districtIdNum),
    enabled: !!districtIdNum,
  });

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Success", description: "Project created successfully." });
      resetForm();
      setEditingProject(null);
      setShowAddProjectDialog(false);
      setShowXERDialog(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to create project", variant: "destructive" });
    },
  });
  const updateProjectMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateProject>[1] }) =>
      updateProject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Success", description: "Project updated successfully." });
      resetForm();
      setEditingProject(null);
      setShowAddProjectDialog(false);
      setShowXERDialog(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to update project", variant: "destructive" });
    },
  });
  const deleteProjectMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Project Deleted", description: "Project has been deleted successfully." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message || "Failed to delete project", variant: "destructive" });
    },
  });

  // Form state
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [startingDate, setStartingDate] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [stakeholderIds, setStakeholderIds] = useState<string[]>([]);
  const [selectedTehsilId, setSelectedTehsilId] = useState<string>("");
  const [totalBudgetAllocated, setTotalBudgetAllocated] = useState<string>("");
  const [budgetUtilized, setBudgetUtilized] = useState<string>("");
  const [xerFile, setXerFile] = useState<File | null>(null);
  const [areaFile, setAreaFile] = useState<File | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [isLoadingGeoData, setIsLoadingGeoData] = useState(false);

  useEffect(() => {
    setSelectedDivisionId("");
    setSelectedDistrictId("");
    setSelectedTehsilId("");
  }, [selectedProvinceId]);
  useEffect(() => {
    setSelectedDistrictId("");
    setSelectedTehsilId("");
  }, [selectedDivisionId]);
  useEffect(() => {
    setSelectedTehsilId("");
  }, [selectedDistrictId]);

  // Handle XER file upload
  const handleXERFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.xer')) {
        toast({
          title: "Invalid File",
          description: "Please select a valid .xer file",
          variant: "destructive",
        });
        return;
      }
      setXerFile(file);
    }
  };

  // Handle area file upload (GeoJSON, KML, KMZ, Shapefile)
  const handleAreaFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop();

    setIsLoadingGeoData(true);

    try {
      if (extension === 'geojson' || extension === 'json') {
        // Handle GeoJSON
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const jsonData = JSON.parse(event.target?.result as string);
            setGeoData(jsonData);
            setAreaFile(file);
            setIsLoadingGeoData(false);
          } catch (err) {
            console.error("Error parsing GeoJSON:", err);
            toast({
              title: "Error",
              description: "Error parsing GeoJSON file. Please ensure it's a valid GeoJSON file.",
              variant: "destructive",
            });
            setIsLoadingGeoData(false);
          }
        };
        reader.readAsText(file);
      } else if (extension === 'kml' || extension === 'kmz') {
        // For KML/KMZ, we'll store the file but note that full parsing requires additional libraries
        // For now, we'll show a message that KML/KMZ support is coming
        setAreaFile(file);
        toast({
          title: "File Uploaded",
          description: "KML/KMZ file uploaded. Full parsing support coming soon. For now, please use GeoJSON format.",
        });
        setIsLoadingGeoData(false);
      } else if (extension === 'zip' || extension === 'shp') {
        // For Shapefile, we'll store the file but note that parsing requires shapefile.js
        setAreaFile(file);
        toast({
          title: "File Uploaded",
          description: "Shapefile uploaded. Full parsing support coming soon. For now, please use GeoJSON format.",
        });
        setIsLoadingGeoData(false);
      } else {
        toast({
          title: "Invalid File Format",
          description: "Unsupported file format. Please upload GeoJSON, KML, KMZ, or Shapefile (ZIP).",
          variant: "destructive",
        });
        setIsLoadingGeoData(false);
      }
    } catch (err) {
      console.error("Error handling area file:", err);
      toast({
        title: "Error",
        description: "Error processing file. Please try again.",
        variant: "destructive",
      });
      setIsLoadingGeoData(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setProjectName("");
    setProjectDescription("");
    setStartingDate("");
    setReferenceNumber("");
    setStakeholderIds([]);
    setSelectedProvinceId("");
    setSelectedDivisionId("");
    setSelectedDistrictId("");
    setSelectedTehsilId("");
    setTotalBudgetAllocated("");
    setBudgetUtilized("");
    setXerFile(null);
    setAreaFile(null);
    setGeoData(null);
    setCurrentStep(1);
  };

  // Open dialog for editing a project — prefetch division/district/tehsil so dropdowns show selected values
  const openEditDialog = async (project: ApiProject) => {
    await Promise.all([
      queryClient.prefetchQuery({ queryKey: ["divisions", project.province], queryFn: () => listDivisions(project.province) }),
      queryClient.prefetchQuery({ queryKey: ["districts", project.division], queryFn: () => listDistricts(project.division) }),
      queryClient.prefetchQuery({ queryKey: ["tehsils", project.district], queryFn: () => listTehsils(project.district) }),
    ]);
    setEditingProject(project);
    setProjectName(project.project_name ?? "");
    setProjectDescription(project.project_description ?? "");
    setStartingDate(project.project_starting_date ? project.project_starting_date.slice(0, 10) : "");
    setReferenceNumber(project.project_reference_no ?? "");
    setStakeholderIds(project.stakeholder?.map(String) || []);
    setSelectedProvinceId(String(project.province));
    setSelectedDivisionId(String(project.division));
    setSelectedDistrictId(String(project.district));
    setSelectedTehsilId(String(project.tehsil));
    setTotalBudgetAllocated(project.total_budget_allocated ?? "");
    setBudgetUtilized(project.budget_utilized ?? "");
    setXerFile(null);
    setAreaFile(null);
    setGeoData(project.geom && typeof project.geom === "object" ? (project.geom as object) : null);
    setCurrentStep(1);
    setShowAddProjectDialog(true);
  };

  // Validate step 1
  const validateStep1 = () => {
    if (!projectName.trim()) {
      toast({ title: "Validation Error", description: "Please enter a project name", variant: "destructive" });
      return false;
    }
    if (!selectedProvinceId || !selectedDivisionId || !selectedDistrictId || !selectedTehsilId) {
      toast({ title: "Validation Error", description: "Please select province, division, district and tehsil", variant: "destructive" });
      return false;
    }
    if (stakeholderIds.length === 0) {
      toast({ title: "Validation Error", description: "Please select at least one stakeholder", variant: "destructive" });
      return false;
    }
    if (!editingProject && !xerFile) {
      toast({ title: "Validation Error", description: "Please upload an XER file", variant: "destructive" });
      return false;
    }
    return true;
  };

  // Validate step 2
  const validateStep2 = () => {
    if (!editingProject && !areaFile) {
      toast({
        title: "Validation Error",
        description: "Please upload a project area file",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Handle next step
  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) {
        setCurrentStep(2);
      }
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep === 1) {
      handleNext();
      return;
    }
    if (currentStep === 2) {
      if (!validateStep2()) return;
      const totalBudget = totalBudgetAllocated.trim() ? Number(totalBudgetAllocated) : 0;
      const utilized = budgetUtilized.trim() ? Number(budgetUtilized) : 0;
      const variance = totalBudget - utilized;
      const remaining = Math.max(0, totalBudget - utilized);

      if (editingProject) {
        updateProjectMutation.mutate({
          id: editingProject.id,
          payload: {
            stakeholder: stakeholderIds.map(Number),
            project_name: projectName.trim() || null,
            project_description: projectDescription.trim() || null,
            project_starting_date: startingDate || null,
            project_reference_no: referenceNumber.trim() || null,
            province: Number(selectedProvinceId),
            division: Number(selectedDivisionId),
            district: Number(selectedDistrictId),
            tehsil: Number(selectedTehsilId),
            total_budget_allocated: totalBudgetAllocated.trim() || null,
            budget_utilized: budgetUtilized.trim() || null,
            budget_variance: String(variance),
            budget_remaining: String(remaining),
          },
        });
      } else {
        createProjectMutation.mutate({
          stakeholder: stakeholderIds.map(Number),
          project_name: projectName.trim() || null,
          project_description: projectDescription.trim() || null,
          project_starting_date: startingDate || null,
          project_reference_no: referenceNumber.trim() || null,
          province: Number(selectedProvinceId),
          division: Number(selectedDivisionId),
          district: Number(selectedDistrictId),
          tehsil: Number(selectedTehsilId),
          total_budget_allocated: totalBudget,
          budget_utilized: utilized,
          xer_file: xerFile ?? undefined,
          boundary_file: areaFile ?? undefined,
        });
      }
    }
  };

  const handleDeleteProject = (id: number) => {
    const project = projectsData.find((p) => p.id === id);
    if (window.confirm(`Are you sure you want to delete "${project?.project_name}"?`)) {
      deleteProjectMutation.mutate(id);
      setSelectedProjectForView((prev) => (prev?.id === id ? null : prev));
    }
  };

  return (
    <Layout title="Project Management">
      <div className="space-y-8">
        {/* Header with Add Project Button */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Added Projects</h1>
            <p className="text-muted-foreground mt-1">
              {!projectsLoading && projectsData.length > 0
                ? `${projectsData.length} project${projectsData.length !== 1 ? "s" : ""}`
                : "Manage and view project details below"}
            </p>
          </div>
          <Button onClick={() => setShowAddProjectDialog(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Add New Project
          </Button>
        </div>

        {/* Projects Grid */}
        {projectsLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground">Loading projects…</p>
            </CardContent>
          </Card>
        ) : projectsData.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FolderKanban className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Get started by creating a new project</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {projectsData.map((project: ApiProject) => {
              const isSelected = selectedProjectForView?.id === project.id;
              return (
                <Card
                  key={project.id}
                  className={`transition-all duration-200 hover:shadow-md ${
                    isSelected
                      ? "ring-2 ring-primary shadow-md"
                      : "hover:border-primary/30"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg leading-tight truncate" title={project.project_name || "Unnamed"}>
                          {project.project_name || "Unnamed"}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          Updated {project.updated_at ? new Date(project.updated_at).toLocaleDateString() : "—"}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 shrink-0">
                        Active
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {project.project_description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{project.project_description}</p>
                    )}
                    <div className="space-y-2.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>Start: {project.project_starting_date ? new Date(project.project_starting_date).toLocaleDateString() : "N/A"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span>Ref: {project.project_reference_no || "N/A"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span>
                          {project.stakeholder_title != null && project.stakeholder_title !== ""
                            ? project.stakeholder_type != null && project.stakeholder_type !== ""
                              ? `${project.stakeholder_title} (${project.stakeholder_type})`
                              : project.stakeholder_title
                            : `Stakeholder #${project.stakeholder}`}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="break-words">
                          {project.tehsil_name ?? String(project.tehsil)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-row items-center gap-3 pt-4 mt-1 border-t">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => openEditDialog(project)}
                        disabled={updateProjectMutation.isPending}
                        className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Update
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProjectForView(isSelected ? null : project)}
                        className={`gap-1.5 border-emerald-500/70 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 ${isSelected ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Detail panel: selected project info in the space beneath the cards */}
        {selectedProjectForView && (
          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <FolderKanban className="h-5 w-5" />
                  {selectedProjectForView.project_name || "Unnamed Project"}
                </CardTitle>
                
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedProjectForView(null)}
                className="shrink-0"
                aria-label="Close detail view"
              >
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedProjectForView.project_description && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedProjectForView.project_description}</p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Stakeholder</p>
                    <p className="text-sm font-medium">
                      {selectedProjectForView.stakeholder_title != null && selectedProjectForView.stakeholder_title !== ""
                        ? selectedProjectForView.stakeholder_type != null && selectedProjectForView.stakeholder_type !== ""
                          ? `${selectedProjectForView.stakeholder_title} (${selectedProjectForView.stakeholder_type})`
                          : selectedProjectForView.stakeholder_title
                        : `Stakeholder #${selectedProjectForView.stakeholder}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="text-sm font-medium">
                      {selectedProjectForView.project_starting_date
                        ? new Date(selectedProjectForView.project_starting_date).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Reference No</p>
                    <p className="text-sm font-medium">{selectedProjectForView.project_reference_no || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium">
                      {selectedProjectForView.tehsil_name ?? String(selectedProjectForView.tehsil)}
                    </p>
                  </div>
                </div>
              </div>
              {(selectedProjectForView.total_budget_allocated != null || selectedProjectForView.budget_utilized != null) && (
                <div className="rounded-lg border p-4">
                  <h4 className="text-sm font-medium mb-3">Budget</h4>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {selectedProjectForView.total_budget_allocated != null && selectedProjectForView.total_budget_allocated !== "" && (
                      <span className="text-muted-foreground">
                        Allocated: <strong className="text-foreground">{selectedProjectForView.total_budget_allocated}</strong>
                      </span>
                    )}
                    {selectedProjectForView.budget_utilized != null && selectedProjectForView.budget_utilized !== "" && (
                      <span className="text-muted-foreground">
                        Utilized: <strong className="text-foreground">{selectedProjectForView.budget_utilized}</strong>
                      </span>
                    )}
                    {selectedProjectForView.budget_remaining != null && selectedProjectForView.budget_remaining !== "" && (
                      <span className="text-muted-foreground">
                        Remaining: <strong className="text-foreground">{selectedProjectForView.budget_remaining}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}
              {selectedProjectForView.xer_file && (
                <div className="rounded-lg border p-3 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">XER File</p>
                    <a
                      href={selectedProjectForView.xer_file.startsWith("http") ? selectedProjectForView.xer_file : `${import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"}${selectedProjectForView.xer_file.startsWith("/") ? "" : "/"}${selectedProjectForView.xer_file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline truncate block"
                    >
                      {selectedProjectForView.xer_file.split("/").pop() ?? selectedProjectForView.xer_file}
                    </a>
                  </div>
                </div>
              )}
              {selectedProjectForView.geom && typeof selectedProjectForView.geom === "object" && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Project Area (Map)</h4>
                  <div className="rounded-md border overflow-hidden">
                    <ProjectAreaMap geoData={selectedProjectForView.geom} />
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedProjectForView)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Update this project
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/project/${selectedProjectForView.tehsil}/${selectedProjectForView.id}`} className="gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Open full project page
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Project Dialog */}
      <Dialog open={showAddProjectDialog} onOpenChange={(open) => {
        setShowAddProjectDialog(open);
        if (!open) {
          resetForm();
          setEditingProject(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Update Project" : "Add New Project"}</DialogTitle>
            <DialogDescription>
              {editingProject
                ? "Edit the project details below. Leave file fields unchanged unless you want to replace them."
                : "Fill in the project details and upload required files"}
            </DialogDescription>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="flex items-center gap-3 w-fit">
              {/* Step 1 */}
              <div className="flex flex-col items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                  currentStep >= 1 ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground bg-background"
                }`}>
                  {currentStep > 1 ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-semibold">1</span>
                  )}
                </div>
                <p className={`text-xs font-medium mt-2 ${currentStep === 1 ? "text-primary" : "text-muted-foreground"}`}>
                  Project Details
                </p>
              </div>

              {/* Animated Progress Line */}
              <div className="relative w-24 h-1 bg-muted rounded-full overflow-hidden mt-4">
                {currentStep >= 2 && (
                  <>
                    <div className="absolute inset-0 bg-primary" />
                    <div 
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(90deg, transparent 30%, #ef4444 50%, transparent 70%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s linear infinite',
                      }}
                    />
                  </>
                )}
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                  currentStep >= 2 ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground bg-background"
                }`}>
                  <span className="text-sm font-semibold">2</span>
                </div>
                <p className={`text-xs font-medium mt-2 ${currentStep === 2 ? "text-primary" : "text-muted-foreground"}`}>
                  Project Area
                </p>
              </div>
            </div>
          </div>

          <style dangerouslySetInnerHTML={{__html: `
            @keyframes shimmer {
              0% {
                background-position: -200% 0;
              }
              100% {
                background-position: 200% 0;
              }
            }
          `}} />

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Project Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Project Name */}
                <div className="space-y-2">
                  <Label htmlFor="projectName">Project Name *</Label>
                  <Input
                    id="projectName"
                    placeholder="Enter project name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                  />
                </div>

                {/* Project Description */}
                <div className="space-y-2">
                  <Label htmlFor="projectDescription">Project Description *</Label>
                  <Textarea
                    id="projectDescription"
                    placeholder="Enter project description..."
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={4}
                    required
                  />
                </div>

                {/* Starting Date and Reference Number */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startingDate">Project Starting Date *</Label>
                    <Input
                      id="startingDate"
                      type="date"
                      value={startingDate}
                      onChange={(e) => setStartingDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referenceNumber">Project Reference No *</Label>
                    <Input
                      id="referenceNumber"
                      placeholder="Enter reference number"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Total Budget Allocated & Budget Utilized */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalBudgetAllocated">Total Budget Allocated</Label>
                    <Input
                      id="totalBudgetAllocated"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="e.g. 100000"
                      value={totalBudgetAllocated}
                      onChange={(e) => setTotalBudgetAllocated(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budgetUtilized">Budget Utilized</Label>
                    <Input
                      id="budgetUtilized"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="e.g. 60000"
                      value={budgetUtilized}
                      onChange={(e) => setBudgetUtilized(e.target.value)}
                    />
                  </div>
                </div>

                {/* Stakeholder (multi-select) */}
                <div className="space-y-2">
                  <Label htmlFor="stakeholderIds">Stakeholder(s) *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="stakeholderIds"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal min-h-10 h-auto py-2"
                      >
                        <span className="truncate">
                          {stakeholderIds.length === 0
                            ? "Select stakeholder(s)"
                            : stakeholderIds
                                .map((id) => stakeholdersList.find((s) => String(s.id) === id))
                                .filter(Boolean)
                                .map((s) => `${s!.stakeholder_title} (${s!.stakeholder_type})`)
                                .join(", ")}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <div className="max-h-60 overflow-auto p-2">
                        {stakeholdersList.map((s) => (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              checked={stakeholderIds.includes(String(s.id))}
                              onCheckedChange={(checked) => {
                                setStakeholderIds((prev) =>
                                  checked
                                    ? [...prev, String(s.id)]
                                    : prev.filter((id) => id !== String(s.id))
                                );
                              }}
                            />
                            <span className="text-sm">
                              {s.stakeholder_title} ({s.stakeholder_type})
                            </span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Province */}
                <div className="space-y-2">
                  <Label htmlFor="province">Province *</Label>
                  <Select value={selectedProvinceId} onValueChange={setSelectedProvinceId} required>
                    <SelectTrigger id="province">
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                    <SelectContent>
                      {provincesList.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.province_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Division */}
                <div className="space-y-2">
                  <Label htmlFor="division">Division *</Label>
                  <Select value={selectedDivisionId} onValueChange={setSelectedDivisionId} disabled={!selectedProvinceId} required>
                    <SelectTrigger id="division">
                      <SelectValue placeholder={selectedProvinceId ? "Select division" : "Select province first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {divisionsList.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.division_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* District */}
                <div className="space-y-2">
                  <Label htmlFor="district">District *</Label>
                  <Select value={selectedDistrictId} onValueChange={setSelectedDistrictId} disabled={!selectedDivisionId} required>
                    <SelectTrigger id="district">
                      <SelectValue placeholder={selectedDivisionId ? "Select district" : "Select division first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {districtsList.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.district_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tehsil */}
                <div className="space-y-2">
                  <Label htmlFor="tehsil">Tehsil *</Label>
                  <Select value={selectedTehsilId} onValueChange={setSelectedTehsilId} disabled={!selectedDistrictId} required>
                    <SelectTrigger id="tehsil">
                      <SelectValue placeholder={selectedDistrictId ? "Select tehsil" : "Select district first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {tehsilsList.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>{t.tehsil_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* XER File Upload */}
                <div className="space-y-2">
                  <Label>XER File *</Label>
                  {editingProject && editingProject.xer_file && !xerFile && (
                    <div className="rounded-lg border bg-muted/50 p-3 flex items-center gap-3 mb-2">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          Current file: {editingProject.xer_file.split("/").pop() ?? editingProject.xer_file}
                        </p>
                        <a
                          href={editingProject.xer_file.startsWith("http") ? editingProject.xer_file : `${import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"}${editingProject.xer_file.startsWith("/") ? "" : "/"}${editingProject.xer_file}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Open / download
                        </a>
                      </div>
                    </div>
                  )}
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-all ${
                      xerFile
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/20 hover:border-primary/50 cursor-pointer"
                    }`}
                    onClick={() => !xerFile && setShowXERDialog(true)}
                  >
                    {xerFile ? (
                      <div className="flex items-center gap-3 w-full">
                        <FileText className="h-8 w-8 text-primary" />
                        <div className="flex-1">
                          <p className="font-medium">{xerFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(xerFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setXerFile(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">
                          {editingProject ? "Click to upload a new XER file (optional)" : "Click to upload XER file"}
                        </p>
                        <p className="text-xs text-muted-foreground">.xer format</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Project Area */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* When editing: show current boundary file name & format first, then map once */}
                {editingProject && (editingProject.boundary_file || geoData) && (
                  <div className="space-y-2">
                    <Label>Current project boundary</Label>
                    {editingProject.boundary_file && (
                      <div className="rounded-lg border bg-muted/50 p-3 flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            File: {editingProject.boundary_file.split("/").pop() ?? editingProject.boundary_file}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Format: {(() => {
                              const name = (editingProject.boundary_file.split("/").pop() ?? "").toLowerCase();
                              if (name.endsWith(".geojson") || name.endsWith(".json")) return "GeoJSON";
                              if (name.endsWith(".kml")) return "KML";
                              if (name.endsWith(".kmz")) return "KMZ";
                              if (name.endsWith(".shp") || name.endsWith(".zip")) return "Shapefile";
                              return "GeoJSON";
                            })()}
                          </p>
                        </div>
                      </div>
                    )}
                    {geoData && (
                      <div className="rounded-md border overflow-hidden">
                        <ProjectAreaMap geoData={geoData} />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Project Area (GeoJSON, Shapefile, KMZ, KML) {editingProject ? "(optional – upload to replace)" : "*"}</Label>
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-all ${
                      areaFile
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/20 hover:border-primary/50 cursor-pointer"
                    }`}
                    onClick={() => document.getElementById("area-file-input")?.click()}
                  >
                    {areaFile ? (
                      <div className="flex items-center gap-3 w-full">
                        <MapPin className="h-8 w-8 text-primary" />
                        <div className="flex-1">
                          <p className="font-medium">{areaFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(areaFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAreaFile(null);
                            setGeoData(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Click to upload area file</p>
                        <p className="text-xs text-muted-foreground">GeoJSON, Shapefile, KMZ, or KML</p>
                      </>
                    )}
                    <Input
                      id="area-file-input"
                      type="file"
                      accept=".geojson,.json,.kml,.kmz,.zip,.shp"
                      onChange={handleAreaFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {isLoadingGeoData && (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Loading geographic data...</p>
                  </div>
                )}

                {/* Map preview only when NOT editing (new upload) – avoid showing boundary twice */}
                {!editingProject && geoData && (
                  <div className="space-y-2">
                    <Label>Map Preview</Label>
                    <div className="rounded-md border overflow-hidden">
                      <ProjectAreaMap geoData={geoData} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowAddProjectDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              {currentStep === 1 && (
                <Button type="button" onClick={handleNext} className="gap-2">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {currentStep === 2 && (
                <>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handlePrevious}
                    className="gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button type="submit" disabled={updateProjectMutation.isPending}>
                    {editingProject ? "Update Project" : "Create Project"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* XER File Upload Dialog */}
      <Dialog open={showXERDialog} onOpenChange={setShowXERDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload XER File</DialogTitle>
            <DialogDescription>
              Upload your Primavera P6 XER file for project scheduling
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className="relative border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-all hover:border-primary/50 cursor-pointer"
              onClick={() => document.getElementById("xer-file-input")?.click()}
            >
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">Click to upload XER file</p>
              <p className="text-xs text-muted-foreground">.xer format only</p>
              <Input
                id="xer-file-input"
                type="file"
                accept=".xer"
                onChange={handleXERFileChange}
                className="hidden"
              />
            </div>
            {xerFile && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <File className="h-5 w-5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{xerFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(xerFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowXERDialog(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (xerFile) {
                  setShowXERDialog(false);
                } else {
                  toast({
                    title: "No File Selected",
                    description: "Please select an XER file first",
                    variant: "destructive",
                  });
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Layout>
  );
}
