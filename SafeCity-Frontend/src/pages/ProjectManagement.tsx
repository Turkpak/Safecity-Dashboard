import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FolderKanban, Plus, Upload, FileText, MapPin, X, File, ChevronRight, ChevronLeft, CheckCircle2, Calendar, Users, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState, useMemo, useEffect } from "react";
import { getAllDivisions, getDistrictsByDivision, getTehsilsByDivisionAndDistrict } from "@/data/punjabHierarchy";
import { useToast } from "@/hooks/use-toast";
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

interface Project {
  id: string;
  name: string;
  description: string;
  startingDate: string;
  referenceNumber: string;
  saNumber: string;
  stakeholderType: string;
  division: string;
  district: string;
  tehsil: string;
  xerFileName: string;
  areaFileName: string;
  createdAt: Date;
  status: "Active" | "Completed" | "On Hold";
}

export default function ProjectManagement() {
  const { toast } = useToast();
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [showXERDialog, setShowXERDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Form state
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [startingDate, setStartingDate] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [saNumber, setSaNumber] = useState("");
  const [stakeholderType, setStakeholderType] = useState<string>("");
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedTehsil, setSelectedTehsil] = useState<string>("");
  const [xerFile, setXerFile] = useState<File | null>(null);
  const [areaFile, setAreaFile] = useState<File | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [isLoadingGeoData, setIsLoadingGeoData] = useState(false);

  // Get divisions
  const divisions = useMemo(() => getAllDivisions(), []);

  // Get districts based on selected division
  const districts = useMemo(() => {
    if (!selectedDivision) return [];
    return getDistrictsByDivision(selectedDivision);
  }, [selectedDivision]);

  // Get tehsils based on selected division and district
  const tehsils = useMemo(() => {
    if (!selectedDivision || !selectedDistrict) return [];
    return getTehsilsByDivisionAndDistrict(selectedDivision, selectedDistrict);
  }, [selectedDivision, selectedDistrict]);

  // Reset district and tehsil when division changes
  useEffect(() => {
    setSelectedDistrict("");
    setSelectedTehsil("");
  }, [selectedDivision]);

  // Reset tehsil when district changes
  useEffect(() => {
    setSelectedTehsil("");
  }, [selectedDistrict]);

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
    setSaNumber("");
    setStakeholderType("");
    setSelectedDivision("");
    setSelectedDistrict("");
    setSelectedTehsil("");
    setXerFile(null);
    setAreaFile(null);
    setGeoData(null);
    setCurrentStep(1);
  };

  // Validate step 1
  const validateStep1 = () => {
    if (!projectName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a project name",
        variant: "destructive",
      });
      return false;
    }
    if (!selectedDivision) {
      toast({
        title: "Validation Error",
        description: "Please select a division",
        variant: "destructive",
      });
      return false;
    }
    if (!selectedDistrict) {
      toast({
        title: "Validation Error",
        description: "Please select a district",
        variant: "destructive",
      });
      return false;
    }
    if (!selectedTehsil) {
      toast({
        title: "Validation Error",
        description: "Please select a tehsil",
        variant: "destructive",
      });
      return false;
    }
    if (!xerFile) {
      toast({
        title: "Validation Error",
        description: "Please upload an XER file",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Validate step 2
  const validateStep2 = () => {
    if (!areaFile) {
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
      if (!validateStep2()) {
        return;
      }

      // Create new project
      const newProject: Project = {
        id: Date.now().toString(),
        name: projectName,
        description: projectDescription,
        startingDate: startingDate,
        referenceNumber: referenceNumber,
        saNumber: saNumber,
        stakeholderType: stakeholderType,
        division: selectedDivision,
        district: selectedDistrict,
        tehsil: selectedTehsil,
        xerFileName: xerFile?.name || "",
        areaFileName: areaFile?.name || "",
        createdAt: new Date(),
        status: "Active"
      };

      // Add project to the list
      setProjects([...projects, newProject]);

      // Here you would typically send the data to your backend
      console.log("Project Data:", {
        projectName,
        projectDescription,
        startingDate,
        referenceNumber,
        saNumber,
        stakeholderType,
        division: selectedDivision,
        district: selectedDistrict,
        tehsil: selectedTehsil,
        xerFile,
        areaFile,
        geoData
      });

      toast({
        title: "Success!",
        description: "Project created successfully!",
      });
      resetForm();
      setShowAddProjectDialog(false);
      setShowXERDialog(false);
    }
  };

  // Handle delete project
  const handleDeleteProject = (id: string) => {
    const project = projects.find(p => p.id === id);
    if (window.confirm(`Are you sure you want to delete "${project?.name}"?`)) {
      setProjects(projects.filter(p => p.id !== id));
      toast({
        title: "Project Deleted",
        description: `"${project?.name}" has been deleted successfully.`,
      });
    }
  };

  return (
    <Layout title="Project Management">
      <div className="space-y-6">
        {/* Header with Add Project Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">No of Added Projects</h1>
            
          </div>
          <Button onClick={() => setShowAddProjectDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add New Project
          </Button>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FolderKanban className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Get started by creating a new project</p>
              
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{project.name}</CardTitle>
                      <CardDescription className="text-xs">
                        Created {project.createdAt.toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={`${
                        project.status === "Active"
                          ? "bg-blue-500 text-white border-blue-500"
                          : project.status === "Completed"
                          ? "bg-green-500 text-white border-green-500"
                          : "bg-gray-500 text-white border-gray-500"
                      }`}
                    >
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {project.description && (
                      <div className="text-sm">
                        <p className="text-muted-foreground line-clamp-2">{project.description}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Start: {project.startingDate ? new Date(project.startingDate).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Ref: {project.referenceNumber || "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        SA: {project.saNumber || "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Stakeholder: {project.stakeholderType || "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {project.division} → {project.district} → {project.tehsil}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground truncate" title={project.xerFileName}>
                        XER: {project.xerFileName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground truncate" title={project.areaFileName}>
                        Area: {project.areaFileName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProject(project.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Project Dialog */}
      <Dialog open={showAddProjectDialog} onOpenChange={(open) => {
        setShowAddProjectDialog(open);
        if (!open) {
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
            <DialogDescription>
              Fill in the project details and upload required files
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
                    <Label htmlFor="referenceNumber">Reference Number *</Label>
                    <Input
                      id="referenceNumber"
                      placeholder="Enter reference number"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* SA Number */}
                <div className="space-y-2">
                  <Label htmlFor="saNumber">SA Number *</Label>
                  <Input
                    id="saNumber"
                    placeholder="Enter SA number"
                    value={saNumber}
                    onChange={(e) => setSaNumber(e.target.value)}
                    required
                  />
                </div>

                {/* Stakeholder Type */}
                <div className="space-y-2">
                  <Label htmlFor="stakeholderType">Stakeholder Type *</Label>
                  <Select value={stakeholderType} onValueChange={setStakeholderType} required>
                    <SelectTrigger id="stakeholderType">
                      <SelectValue placeholder="Select stakeholder type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Consultant">Consultant</SelectItem>
                      <SelectItem value="Client">Client</SelectItem>
                      <SelectItem value="Contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Division Select */}
                <div className="space-y-2">
                  <Label htmlFor="division">Division *</Label>
                  <Select value={selectedDivision} onValueChange={setSelectedDivision} required>
                    <SelectTrigger id="division">
                      <SelectValue placeholder="Select division" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions.map((division) => (
                        <SelectItem key={division} value={division}>
                          {division}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* District Select */}
                <div className="space-y-2">
                  <Label htmlFor="district">District *</Label>
                  <Select
                    value={selectedDistrict}
                    onValueChange={setSelectedDistrict}
                    disabled={!selectedDivision}
                    required
                  >
                    <SelectTrigger id="district">
                      <SelectValue placeholder={selectedDivision ? "Select district" : "Select division first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((district) => (
                        <SelectItem key={district} value={district}>
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tehsil Select */}
                <div className="space-y-2">
                  <Label htmlFor="tehsil">Tehsil *</Label>
                  <Select
                    value={selectedTehsil}
                    onValueChange={setSelectedTehsil}
                    disabled={!selectedDistrict}
                    required
                  >
                    <SelectTrigger id="tehsil">
                      <SelectValue placeholder={selectedDistrict ? "Select tehsil" : "Select district first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {tehsils.map((tehsil) => (
                        <SelectItem key={tehsil} value={tehsil}>
                          {tehsil}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* XER File Upload */}
                <div className="space-y-2">
                  <Label>XER File *</Label>
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
                        <p className="text-sm font-medium">Click to upload XER file</p>
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
                <div className="space-y-2">
                  <Label>Project Area (GeoJSON, Shapefile, KMZ, KML) *</Label>
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

                {geoData && (
                  <div className="space-y-2">
                    <Label>Map Preview</Label>
                    <ProjectAreaMap geoData={geoData} />
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
                  <Button type="submit">Create Project</Button>
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
