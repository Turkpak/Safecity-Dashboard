import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FolderKanban, Plus, Upload, FileText, MapPin, X, ChevronRight, ChevronLeft, CheckCircle2, Calendar, Eye, Pencil, ChevronDown, Building2, Wallet, Landmark, HandCoins, Percent, CalendarDays, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  listProjects,
  getProjectById,
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
import {
  ProjectAreaMap,
  WizardXerUploadSection,
  formatProjectStakeholder,
  getProjectAccent,
} from "@/features/projects/projectManagementParts";
import { mediaUrl } from "@/api/config";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";


export default function ProjectManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingProject, setEditingProject] = useState<ApiProject | null>(null);
  const [selectedProjectForView, setSelectedProjectForView] = useState<ApiProject | null>(null);
  const [loadingProjectView, setLoadingProjectView] = useState(false);
  const [projectsPage, setProjectsPage] = useState(1);
  const [locationSearch, setLocationSearch] = useState("");
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<ApiProject | null>(null);

  const PROJECTS_PER_PAGE = 6;
  const { data: projectsData = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  // Sidebar deep-link support.
  // NOTE: wouter commonly tracks pathname only; query params may not trigger location updates.
  // We support BOTH:
  // - /project-management/create  (preferred)
  // - /project-management/view
  // - /project-management?mode=create (fallback)
  const deepLinkMode = useMemo<"create" | "view" | "">(() => {
    try {
      const rawPath = String(location || "");
      // Prefer explicit path suffixes (works reliably with wouter)
      if (rawPath.startsWith("/project-management/create")) return "create";
      if (rawPath.startsWith("/project-management/view")) return "view";

      // Fallback: read from the actual browser URL search params
      const mode = (new URL(window.location.href).searchParams.get("mode") || "").toLowerCase();
      return mode === "create" || mode === "view" ? (mode as any) : "";
    } catch {
      return "";
    }
  }, [location]);

  const prevDeepLinkModeRef = useRef<typeof deepLinkMode>("");
  useEffect(() => {
    const prev = prevDeepLinkModeRef.current;
    prevDeepLinkModeRef.current = deepLinkMode;

    if (deepLinkMode === "create") {
      // Ensure Create New Project is never "same as view":
      // keep opening the full 3-step dialog whenever mode=create is present.
      if (!showAddProjectDialog || editingProject) {
        setEditingProject(null);
        resetForm();
        setShowAddProjectDialog(true);
      }
      return;
    }
    if (deepLinkMode === "view") {
      // Only auto-close when we *navigate* from create -> view.
      if (prev === "create" && showAddProjectDialog) setShowAddProjectDialog(false);
    }
  }, [deepLinkMode, showAddProjectDialog, editingProject]);
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
    // Add this line ↓↓↓
    queryClient.invalidateQueries({ queryKey: ["dashboard-page"] });
    
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    toast({ title: "Success", description: "Project created successfully." });
    resetForm();
    setEditingProject(null);
    setShowAddProjectDialog(false);
  },
  onError: (e: Error) => {
    toast({ title: "Error", description: e.message || "Failed to create project", variant: "destructive" });
  },
});
const updateProjectMutation = useMutation({
  mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateProject>[1] }) =>
    updateProject(id, payload),
  onSuccess: () => {
    // Add this line ↓↓↓
    queryClient.invalidateQueries({ queryKey: ["dashboard-page"] });
    
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    toast({ title: "Success", description: "Project updated successfully." });
    resetForm();
    setEditingProject(null);
    setShowAddProjectDialog(false);
  },
  onError: (e: Error) => {
    toast({ title: "Error", description: e.message || "Failed to update project", variant: "destructive" });
  },
});
const deleteProjectMutation = useMutation({
  mutationFn: deleteProject,
  onSuccess: () => {
    // Add this line ↓↓↓
    queryClient.invalidateQueries({ queryKey: ["dashboard-page"] });
    
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
  const [provinceComboboxOpen, setProvinceComboboxOpen] = useState(false);
  const [divisionComboboxOpen, setDivisionComboboxOpen] = useState(false);
  const [districtComboboxOpen, setDistrictComboboxOpen] = useState(false);
  const [tehsilComboboxOpen, setTehsilComboboxOpen] = useState(false);
  const [totalBudgetAllocated, setTotalBudgetAllocated] = useState<string>("");
  const [budgetUtilized, setBudgetUtilized] = useState<string>("");
  const [xerFile, setXerFile] = useState<File | null>(null);
  const [areaFile, setAreaFile] = useState<File | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [isLoadingGeoData, setIsLoadingGeoData] = useState(false);
  const [enableAllocation, setEnableAllocation] = useState(false);
  const [allocationCapital, setAllocationCapital] = useState<string>("");
  const [allocationRevenue, setAllocationRevenue] = useState<string>("");
  const [allocationTotal, setAllocationTotal] = useState<string>("");

  const [enablePdRelease, setEnablePdRelease] = useState(false);
  const [pdReleaseCapital, setPdReleaseCapital] = useState<string>("");
  const [pdReleaseRevenue, setPdReleaseRevenue] = useState<string>("");
  const [pdReleaseTotal, setPdReleaseTotal] = useState<string>("");

  const [enableSpendingRelease, setEnableSpendingRelease] = useState(false);
  const [spendingReleaseCapital, setSpendingReleaseCapital] = useState<string>("");
  const [spendingReleaseRevenue, setSpendingReleaseRevenue] = useState<string>("");
  const [spendingReleaseTotal, setSpendingReleaseTotal] = useState<string>("");

  const [enablePifraUtilization, setEnablePifraUtilization] = useState(false);
  const [pifraCapital, setPifraCapital] = useState<string>("");
  const [pifraRevenue, setPifraRevenue] = useState<string>("");
  const [pifraTotal, setPifraTotal] = useState<string>("");
  const [pifraDate, setPifraDate] = useState<string>("");

  const [enableUtilPct, setEnableUtilPct] = useState(false);
  const [utilPctCapital, setUtilPctCapital] = useState<string>("");
  const [utilPctRevenue, setUtilPctRevenue] = useState<string>("");
  const [utilPctTotal, setUtilPctTotal] = useState<string>("");
  /** When true, geography useEffects should not clear children (we're loading from project) */
  const skipGeographyClearRef = useRef(false);

  useEffect(() => {
    if (skipGeographyClearRef.current) return;
    setSelectedDivisionId("");
    setSelectedDistrictId("");
    setSelectedTehsilId("");
  }, [selectedProvinceId]);
  useEffect(() => {
    if (skipGeographyClearRef.current) return;
    setSelectedDistrictId("");
    setSelectedTehsilId("");
  }, [selectedDivisionId]);
  useEffect(() => {
    if (skipGeographyClearRef.current) return;
    setSelectedTehsilId("");
  }, [selectedDistrictId]);

  // When editing a project, keep cascading clear disabled until all prefilled IDs are applied.
  useEffect(() => {
    if (!skipGeographyClearRef.current) return;
    if (!editingProject) return;
    const allSet =
      selectedProvinceId === String(editingProject.province) &&
      selectedDivisionId === String(editingProject.division) &&
      selectedDistrictId === String(editingProject.district) &&
      selectedTehsilId === String(editingProject.tehsil);
    if (allSet) skipGeographyClearRef.current = false;
  }, [
    editingProject,
    selectedProvinceId,
    selectedDivisionId,
    selectedDistrictId,
    selectedTehsilId,
  ]);
useEffect(() => {
  const capital = parseFloat(allocationCapital) || 0;
  const revenue = parseFloat(allocationRevenue) || 0;

  setAllocationTotal(String(capital + revenue));
}, [allocationCapital, allocationRevenue]);

useEffect(() => {
  const capital = parseFloat(pdReleaseCapital) || 0;
  const revenue = parseFloat(pdReleaseRevenue) || 0;

  setPdReleaseTotal(String(capital + revenue));
}, [pdReleaseCapital, pdReleaseRevenue]);

useEffect(() => {
  const capital = parseFloat(spendingReleaseCapital) || 0;
  const revenue = parseFloat(spendingReleaseRevenue) || 0;

  setSpendingReleaseTotal(String(capital + revenue));
}, [spendingReleaseCapital, spendingReleaseRevenue]);

useEffect(() => {
  const capital = parseFloat(pifraCapital) || 0;
  const revenue = parseFloat(pifraRevenue) || 0;

  setPifraTotal(String(capital + revenue));
}, [pifraCapital, pifraRevenue]);

useEffect(() => {
  const capital = Number(utilPctCapital) || 0;
  const revenue = Number(utilPctRevenue) || 0;

  setUtilPctTotal(String(capital + revenue));
}, [utilPctCapital, utilPctRevenue]);

  // Handle XER file upload
  const handleXERFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".xer")) {
        toast({
          title: "Invalid File",
          description: "Please select a valid .xer file",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      setXerFile(file);
    }
    e.target.value = "";
  };

  // Handle area file upload (GeoJSON)
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
          description: "Unsupported file format. Please upload GeoJSON.",
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

    setEnableAllocation(false);
    setAllocationCapital("");
    setAllocationRevenue("");
    setAllocationTotal("");

    setEnablePdRelease(false);
    setPdReleaseCapital("");
    setPdReleaseRevenue("");
    setPdReleaseTotal("");

    setEnableSpendingRelease(false);
    setSpendingReleaseCapital("");
    setSpendingReleaseRevenue("");
    setSpendingReleaseTotal("");

    setEnablePifraUtilization(false);
    setPifraCapital("");
    setPifraRevenue("");
    setPifraTotal("");
    setPifraDate("");

    setEnableUtilPct(false);
    setUtilPctCapital("");
    setUtilPctRevenue("");
    setUtilPctTotal("");
  };

  // Open dialog for editing a project — prefetch division/district/tehsil so dropdowns show selected values
  const openEditDialog = async (project: ApiProject) => {
    // Always refetch the full project payload for prefill (includes financials + geom).
    // If fetch fails (auth/network), still open the wizard using the card payload.
    let p: ApiProject = project;
    try {
      const full = await getProjectById(project.id);
      if (full) p = full as ApiProject;
    } catch {
      // best-effort; continue with provided card project
    }
    skipGeographyClearRef.current = true;
    await Promise.all([
      queryClient.prefetchQuery({ queryKey: ["divisions", p.province], queryFn: () => listDivisions(p.province) }),
      queryClient.prefetchQuery({ queryKey: ["districts", p.division], queryFn: () => listDistricts(p.division) }),
      queryClient.prefetchQuery({ queryKey: ["tehsils", p.district], queryFn: () => listTehsils(p.district) }),
    ]);
    setEditingProject(p);
    setProjectName(p.project_name ?? "");
    setProjectDescription(p.project_description ?? "");
    setStartingDate(p.project_starting_date ? p.project_starting_date.slice(0, 10) : "");
    setReferenceNumber(p.project_reference_no ?? "");
    setStakeholderIds(
      Array.isArray(p.stakeholder)
        ? p.stakeholder.map(String)
        : p.stakeholder != null
          ? [String(p.stakeholder)]
          : []
    );
    setSelectedProvinceId(String(p.province));
    setSelectedDivisionId(String(p.division));
    setSelectedDistrictId(String(p.district));
    setSelectedTehsilId(String(p.tehsil));
    setTotalBudgetAllocated(p.total_budget_allocated ?? "");
    setBudgetUtilized(p.budget_utilized ?? "");

    const hasAny = (...vals: Array<unknown>) =>
      vals.some((v) => v !== null && v !== undefined && String(v).trim() !== "");

    const allocationEnabled = hasAny(p.allocation_capital_cost, p.allocation_revenue_cost, p.allocation_total_cost);
    setEnableAllocation(allocationEnabled);
    setAllocationCapital(p.allocation_capital_cost ?? "");
    setAllocationRevenue(p.allocation_revenue_cost ?? "");
    setAllocationTotal(p.allocation_total_cost ?? "");

    const pdEnabled = hasAny(p.pd_release_capital_cost, p.pd_release_cost, p.pd_release_total_cost);
    setEnablePdRelease(pdEnabled);
    setPdReleaseCapital(p.pd_release_capital_cost ?? "");
    setPdReleaseRevenue(p.pd_release_cost ?? "");
    setPdReleaseTotal(p.pd_release_total_cost ?? "");

    const spendingEnabled = hasAny(p.spending_release_capital_cost, p.spending_release_revenue_cost, p.spending_release_total_cost);
    setEnableSpendingRelease(spendingEnabled);
    setSpendingReleaseCapital(p.spending_release_capital_cost ?? "");
    setSpendingReleaseRevenue(p.spending_release_revenue_cost ?? "");
    setSpendingReleaseTotal(p.spending_release_total_cost ?? "");

    const pifraEnabled = hasAny(
      p.pifra_utilization_capital_cost,
      p.pifra_utilization_revenue_cost,
      p.pifra_utilization_total_cost,
      p.pifra_utilization_date,
    );
    setEnablePifraUtilization(pifraEnabled);
    setPifraCapital(p.pifra_utilization_capital_cost ?? "");
    setPifraRevenue(p.pifra_utilization_revenue_cost ?? "");
    setPifraTotal(p.pifra_utilization_total_cost ?? "");
    setPifraDate(p.pifra_utilization_date ? p.pifra_utilization_date.slice(0, 10) : "");

    const pctEnabled = hasAny(p.percentage_utilization_capital, p.percentage_utilization_revenue, p.percentage_utilization_total);
    setEnableUtilPct(pctEnabled);
    setUtilPctCapital(p.percentage_utilization_capital ?? "");
    setUtilPctRevenue(p.percentage_utilization_revenue ?? "");
    setUtilPctTotal(p.percentage_utilization_total ?? "");

    setXerFile(null);
    setAreaFile(null);
    setGeoData(p.geom && typeof p.geom === "object" ? (p.geom as object) : null);
    setCurrentStep(1);
    setShowAddProjectDialog(true);
  };

  // Validate step 1
  const validateStep1 = () => {
    // Frontend validation intentionally disabled (temporary).
    return true;
  };

  // Validate step 2 (schedule + boundary — backend consumes both on create)
  const validateStep2 = () => {
    if (editingProject) return true;
    if (!xerFile) {
      toast({
        title: "XER file required",
        description: "Upload a Primavera P6 .xer file so the schedule can be stored and activities imported.",
        variant: "destructive",
      });
      return false;
    }
    if (!areaFile) {
      toast({
        title: "Project area file required",
        description: "Upload a boundary file (GeoJSON) / Shapefile (.zip) for the project map.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    // Updating project details should not be blocked by optional financial sections.
    // `openEditDialog` may auto-enable toggles from partial API data; users may skip step 3 fields.
    if (editingProject) return true;

    const requireAll = (enabled: boolean, fields: Array<{ label: string; value: any }>) => {
  if (!enabled) return true;
  for (const f of fields) {
    const val = f.value ?? ""; // handle null/undefined
    if (String(val).trim() === "") {
      toast({
        title: "Validation Error",
        description: `Please enter ${f.label}.`,
        variant: "destructive",
      });
      return false;
    }
  }
  return true;
};

    if (
      !requireAll(enableAllocation, [
        { label: "Allocation capital cost (M)", value: allocationCapital },
        { label: "Allocation revenue cost (M)", value: allocationRevenue },
        { label: "Allocation total cost (M)", value: allocationTotal },
      ])
    )
      return false;

    if (
      !requireAll(enablePdRelease, [
        { label: "P&D release capital cost (M)", value: pdReleaseCapital },
        { label: "P&D release revenue cost (M)", value: pdReleaseRevenue },
        { label: "P&D release total cost (M)", value: pdReleaseTotal },
      ])
    )
      return false;

    if (
      !requireAll(enableSpendingRelease, [
        { label: "Spending release capital cost (M)", value: spendingReleaseCapital },
        { label: "Spending release revenue cost (M)", value: spendingReleaseRevenue },
        { label: "Spending release total cost (M)", value: spendingReleaseTotal },
      ])
    )
      return false;

    if (
      !requireAll(enablePifraUtilization, [
        { label: "PIFRA utilization capital cost (M)", value: pifraCapital },
        { label: "PIFRA utilization revenue cost (M)", value: pifraRevenue },
        { label: "PIFRA utilization total cost (M)", value: pifraTotal },
        { label: "PIFRA utilization date", value: pifraDate },
      ])
    )
      return false;

    if (
      !requireAll(enableUtilPct, [
        { label: "Capital %", value: utilPctCapital },
        { label: "Revenue %", value: utilPctRevenue },
        { label: "Total %", value: utilPctTotal },
      ])
    )
      return false;

    return true;
  };

  // Handle next step
  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      if (validateStep2()) {
        setCurrentStep(3);
      }
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    if (currentStep === 2) setCurrentStep(1);
    if (currentStep === 3) setCurrentStep(2);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep === 1) {
      handleNext();
      return;
    }
    if (currentStep === 2) {
      handleNext();
      return;
    }
    if (currentStep === 3) {
      if (!validateStep3()) return;
      const totalBudget = totalBudgetAllocated.trim() ? Number(totalBudgetAllocated) : null;
      const utilized = budgetUtilized.trim() ? Number(budgetUtilized) : null;
      const variance = (totalBudget ?? 0) - (utilized ?? 0);
      const remaining = Math.max(0, (totalBudget ?? 0) - (utilized ?? 0));

      const n = (v: string): number => Number(v);
      const allocationPayload = enableAllocation
        ? {
            allocation_capital_cost: n(allocationCapital),
            allocation_revenue_cost: n(allocationRevenue),
            allocation_total_cost: n(allocationTotal),
          }
        : {
            allocation_capital_cost: null,
            allocation_revenue_cost: null,
            allocation_total_cost: null,
          };
      const pdPayload = enablePdRelease
        ? {
            pd_release_capital_cost: n(pdReleaseCapital),
            pd_release_cost: n(pdReleaseRevenue),
            pd_release_total_cost: n(pdReleaseTotal),
          }
        : {
            pd_release_capital_cost: null,
            pd_release_cost: null,
            pd_release_total_cost: null,
          };
      const spendingPayload = enableSpendingRelease
        ? {
            spending_release_capital_cost: n(spendingReleaseCapital),
            spending_release_revenue_cost: n(spendingReleaseRevenue),
            spending_release_total_cost: n(spendingReleaseTotal),
          }
        : {
            spending_release_capital_cost: null,
            spending_release_revenue_cost: null,
            spending_release_total_cost: null,
          };
      const pifraPayload = enablePifraUtilization
        ? {
            pifra_utilization_capital_cost: n(pifraCapital),
            pifra_utilization_revenue_cost: n(pifraRevenue),
            pifra_utilization_total_cost: n(pifraTotal),
            pifra_utilization_date: pifraDate,
          }
        : {
            pifra_utilization_capital_cost: null,
            pifra_utilization_revenue_cost: null,
            pifra_utilization_total_cost: null,
            pifra_utilization_date: null,
          };
      const pctPayload = enableUtilPct
        ? {
            percentage_utilization_capital: n(utilPctCapital),
            percentage_utilization_revenue: n(utilPctRevenue),
            percentage_utilization_total: n(utilPctTotal),
          }
        : {
            percentage_utilization_capital: null,
            percentage_utilization_revenue: null,
            percentage_utilization_total: null,
          };

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
            ...allocationPayload,
            ...pdPayload,
            ...spendingPayload,
            ...pifraPayload,
            ...pctPayload,
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
          ...(enableAllocation
            ? {
                allocation_capital_cost: n(allocationCapital),
                allocation_revenue_cost: n(allocationRevenue),
                allocation_total_cost: n(allocationTotal),
              }
            : {}),
          ...(enablePdRelease
            ? {
                pd_release_capital_cost: n(pdReleaseCapital),
                pd_release_cost: n(pdReleaseRevenue),
                pd_release_total_cost: n(pdReleaseTotal),
              }
            : {}),
          ...(enableSpendingRelease
            ? {
                spending_release_capital_cost: n(spendingReleaseCapital),
                spending_release_revenue_cost: n(spendingReleaseRevenue),
                spending_release_total_cost: n(spendingReleaseTotal),
              }
            : {}),
          ...(enablePifraUtilization
            ? {
                pifra_utilization_capital_cost: n(pifraCapital),
                pifra_utilization_revenue_cost: n(pifraRevenue),
                pifra_utilization_total_cost: n(pifraTotal),
                pifra_utilization_date: pifraDate,
              }
            : {}),
          ...(enableUtilPct
            ? {
                percentage_utilization_capital: n(utilPctCapital),
                percentage_utilization_revenue: n(utilPctRevenue),
                percentage_utilization_total: n(utilPctTotal),
              }
            : {}),
          xer_file: xerFile ?? undefined,
          boundary_file: areaFile ?? undefined,
        });
      }
    }
  };

  const handleDeleteProject = (id: number) => {
    const project = projectsData.find((p) => p.id === id);
    if (project) {
      setDeleteConfirmProject(project);
    }
  };

  const confirmDeleteProject = () => {
    if (!deleteConfirmProject) return;
    deleteProjectMutation.mutate(deleteConfirmProject.id, {
      onSettled: () => {
        setSelectedProjectForView((prev) => (prev?.id === deleteConfirmProject.id ? null : prev));
        setDeleteConfirmProject(null);
      },
    });
  };

  const handleViewProject = async (project: ApiProject) => {
    // If the same project is already selected, toggle it off
    if (selectedProjectForView?.id === project.id) {
      setSelectedProjectForView(null);
      return;
    }
    setLoadingProjectView(true);
    try {
      const fullProject = await getProjectById(project.id);
      setSelectedProjectForView(fullProject ?? project);
    } catch {
      // Fallback to list data if the detail fetch fails
      setSelectedProjectForView(project);
      toast({ title: "Warning", description: "Could not load full project details. Showing partial data.", variant: "destructive" });
    } finally {
      setLoadingProjectView(false);
    }
  };

  const filteredProjects = useMemo(() => {
    const query = locationSearch.trim().toLowerCase();

    const filtered = projectsData.filter((project) => {
      const divisionText = (project.division_name ?? String(project.division ?? "")).toLowerCase();
      const districtText = (project.district_name ?? String(project.district ?? "")).toLowerCase();
      const tehsilText = (project.tehsil_name ?? String(project.tehsil ?? "")).toLowerCase();

      if (!query) return true;
      return (
        divisionText.includes(query) ||
        districtText.includes(query) ||
        tehsilText.includes(query)
      );
    });
    
    const asTime = (value: unknown): number => {
      if (typeof value !== "string") return Number.NaN;
      const t = new Date(value).getTime();
      return Number.isFinite(t) ? t : Number.NaN;
    };

    // Show most recently created projects first.
    // If created_at is missing/invalid, fall back to id (higher id = newer).
    return filtered.slice().sort((a, b) => {
      const ta = asTime((a as any).created_at);
      const tb = asTime((b as any).created_at);
      if (Number.isFinite(ta) && Number.isFinite(tb)) return tb - ta;
      if (Number.isFinite(tb)) return 1;
      if (Number.isFinite(ta)) return -1;
      return (b.id ?? 0) - (a.id ?? 0);
    });
  }, [projectsData, locationSearch]);

  const totalProjectsPages = Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE) || 1;
  const paginatedProjects = useMemo(() => {
    const start = (projectsPage - 1) * PROJECTS_PER_PAGE;
    return filteredProjects.slice(start, start + PROJECTS_PER_PAGE);
  }, [filteredProjects, projectsPage, PROJECTS_PER_PAGE]);

  useEffect(() => {
    if (projectsPage > totalProjectsPages && totalProjectsPages > 0) {
      setProjectsPage(totalProjectsPages);
    }
  }, [projectsPage, totalProjectsPages]);

  useEffect(() => {
    setProjectsPage(1);
  }, [locationSearch]);

  const isCreatePath =
    typeof window !== "undefined" &&
    window.location?.pathname === "/project-management/create";
  const isViewPath =
    typeof window !== "undefined" &&
    window.location?.pathname === "/project-management/view";
  const dialogOpen = showAddProjectDialog;

  // Full-page create flow: keep all existing API/mutation/state logic intact,
  // but render the exact same wizard as a normal page (not a dialog/overlay).
  if (isCreatePath) {
    return (
      <Layout title="Create New Project">
        <div className="flex flex-col min-h-[calc(100vh-8rem)] w-full min-w-0">
          <div className="max-w-5xl mx-auto w-full">
            <Card>
              <CardHeader>
                <CardTitle>{editingProject ? "Update Project" : "Add New Project"}</CardTitle>
                <CardDescription>
                  {editingProject
                    ? "Edit the project details below. Leave file fields unchanged unless you want to replace them."
                    : "Fill in the project details and upload required files"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Reuse the same wizard (step indicator + all 3 steps + footer) */}
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

                    <div className="relative w-24 h-1 bg-muted rounded-full overflow-hidden mt-4">
                      {currentStep >= 2 && (
                        <>
                          <div className="absolute inset-0 bg-primary" />
                          <div
                            className="absolute inset-0"
                            style={{
                              background: "linear-gradient(90deg, transparent 30%, #ef4444 50%, transparent 70%)",
                              backgroundSize: "200% 100%",
                              animation: "shimmer 1.5s linear infinite",
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
                        {currentStep > 2 ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-sm font-semibold">2</span>}
                      </div>
                      <p className={`text-xs font-medium mt-2 text-center max-w-[5.5rem] leading-tight ${currentStep === 2 ? "text-primary" : "text-muted-foreground"}`}>
                        XER + map
                      </p>
                    </div>

                    <div className="relative w-24 h-1 bg-muted rounded-full overflow-hidden mt-4">
                      {currentStep >= 3 && (
                        <>
                          <div className="absolute inset-0 bg-primary" />
                          <div
                            className="absolute inset-0"
                            style={{
                              background: "linear-gradient(90deg, transparent 30%, #ef4444 50%, transparent 70%)",
                              backgroundSize: "200% 100%",
                              animation: "shimmer 1.5s linear infinite",
                            }}
                          />
                        </>
                      )}
                    </div>

                    {/* Step 3 */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                          currentStep >= 3
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-muted-foreground bg-background"
                        }`}
                      >
                        <span className="text-sm font-semibold">3</span>
                      </div>
                      <p className={`text-xs font-medium mt-2 ${currentStep === 3 ? "text-primary" : "text-muted-foreground"}`}>
                        Add Financial Details
                      </p>
                    </div>
                  </div>
                </div>

                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                      @keyframes shimmer {
                        0% { background-position: -200% 0; }
                        100% { background-position: 200% 0; }
                      }
                    `,
                  }}
                />

                {/* Full wizard form (same handlers/mutations as modal) */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Step 1: Project Details */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="projectName">Project Name *</Label>
                        <Input
                          id="projectName"
                          placeholder="Enter project name"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="projectDescription">Project Description *</Label>
                        <Textarea
                          id="projectDescription"
                          placeholder="Enter project description..."
                          value={projectDescription}
                          onChange={(e) => setProjectDescription(e.target.value)}
                          rows={4}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="startingDate">Project Starting Date *</Label>
                          <Input
                            id="startingDate"
                            type="date"
                            value={startingDate}
                            onChange={(e) => setStartingDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="referenceNumber">Project Reference No *</Label>
                          <Input
                            id="referenceNumber"
                            placeholder="Enter reference number"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stakeholderIds">Stakeholder(s) *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              id="stakeholderIds"
                              variant="outline"
                              className="w-full justify-between"
                              type="button"
                            >
                              {stakeholderIds.length > 0
                                ? `${stakeholderIds.length} stakeholder(s) selected`
                                : "Select stakeholders"}
                              <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                            <Command>
                              <CommandInput placeholder="Search stakeholders..." />
                              <CommandList>
                                <CommandEmpty>No stakeholders found.</CommandEmpty>
                                <CommandGroup>
                                  {stakeholdersList.map((s: any) => {
                                    const id = String(s.id);
                                    const selected = stakeholderIds.includes(id);
                                    return (
                                      <CommandItem
                                        key={id}
                                        onSelect={() => {
                                          setStakeholderIds((prev) =>
                                            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                                          );
                                        }}
                                      >
                                        <Checkbox checked={selected} className="mr-2" />
                                        {s.stakeholder_title} ({s.stakeholder_type})
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Province / Division / District / Tehsil (Area Management) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Province — searchable */}
                        <div className="space-y-2">
                          <Label htmlFor="province">Province *</Label>
                          <Popover open={provinceComboboxOpen} onOpenChange={setProvinceComboboxOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                id="province"
                                variant="outline"
                                role="combobox"
                                aria-expanded={provinceComboboxOpen}
                                className="w-full justify-between font-normal h-9 px-3 text-sm"
                                type="button"
                              >
                                <span className="truncate">
                                  {selectedProvinceId
                                    ? (provincesList.find((p) => String(p.id) === selectedProvinceId)?.province_name ??
                                      "Select province")
                                    : "Select province"}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <Command
                                filter={(value, search) => {
                                  const q = (search || "").toLowerCase();
                                  if (!q) return 1;
                                  return (value || "").toLowerCase().includes(q) ? 1 : 0;
                                }}
                              >
                                <CommandInput placeholder="Type to search province…" />
                                <CommandList>
                                  <CommandEmpty>No province found.</CommandEmpty>
                                  <CommandGroup>
                                    {provincesList.map((p) => (
                                      <CommandItem
                                        key={p.id}
                                        value={p.province_name}
                                        onSelect={() => {
                                          skipGeographyClearRef.current = false;
                                          setSelectedProvinceId(String(p.id));
                                          setProvinceComboboxOpen(false);
                                        }}
                                      >
                                        {p.province_name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Division — searchable */}
                        <div className="space-y-2">
                          <Label htmlFor="division">Division *</Label>
                          <Popover open={divisionComboboxOpen} onOpenChange={setDivisionComboboxOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                id="division"
                                variant="outline"
                                role="combobox"
                                aria-expanded={divisionComboboxOpen}
                                disabled={!selectedProvinceId}
                                className="w-full justify-between font-normal h-9 px-3 text-sm"
                                type="button"
                              >
                                <span className="truncate">
                                  {selectedDivisionId
                                    ? (divisionsList.find((d) => String(d.id) === selectedDivisionId)?.division_name ??
                                      "Select division")
                                    : selectedProvinceId
                                      ? "Select division"
                                      : "Select province first"}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <Command
                                filter={(value, search) => {
                                  const q = (search || "").toLowerCase();
                                  if (!q) return 1;
                                  return (value || "").toLowerCase().includes(q) ? 1 : 0;
                                }}
                              >
                                <CommandInput placeholder="Type to search division…" />
                                <CommandList>
                                  <CommandEmpty>No division found.</CommandEmpty>
                                  <CommandGroup>
                                    {divisionsList.map((d) => (
                                      <CommandItem
                                        key={d.id}
                                        value={d.division_name}
                                        onSelect={() => {
                                          skipGeographyClearRef.current = false;
                                          setSelectedDivisionId(String(d.id));
                                          setDivisionComboboxOpen(false);
                                        }}
                                      >
                                        {d.division_name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* District — searchable */}
                        <div className="space-y-2">
                          <Label htmlFor="district">District *</Label>
                          <Popover open={districtComboboxOpen} onOpenChange={setDistrictComboboxOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                id="district"
                                variant="outline"
                                role="combobox"
                                aria-expanded={districtComboboxOpen}
                                disabled={!selectedDivisionId}
                                className="w-full justify-between font-normal h-9 px-3 text-sm"
                                type="button"
                              >
                                <span className="truncate">
                                  {selectedDistrictId
                                    ? (districtsList.find((d) => String(d.id) === selectedDistrictId)?.district_name ??
                                      "Select district")
                                    : selectedDivisionId
                                      ? "Select district"
                                      : "Select division first"}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <Command
                                filter={(value, search) => {
                                  const q = (search || "").toLowerCase();
                                  if (!q) return 1;
                                  return (value || "").toLowerCase().includes(q) ? 1 : 0;
                                }}
                              >
                                <CommandInput placeholder="Type to search district…" />
                                <CommandList>
                                  <CommandEmpty>No district found.</CommandEmpty>
                                  <CommandGroup>
                                    {districtsList.map((d) => (
                                      <CommandItem
                                        key={d.id}
                                        value={d.district_name}
                                        onSelect={() => {
                                          skipGeographyClearRef.current = false;
                                          setSelectedDistrictId(String(d.id));
                                          setDistrictComboboxOpen(false);
                                        }}
                                      >
                                        {d.district_name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Tehsil — searchable */}
                        <div className="space-y-2">
                          <Label htmlFor="tehsil">Tehsil *</Label>
                          <Popover open={tehsilComboboxOpen} onOpenChange={setTehsilComboboxOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                id="tehsil"
                                variant="outline"
                                role="combobox"
                                aria-expanded={tehsilComboboxOpen}
                                disabled={!selectedDistrictId}
                                className="w-full justify-between font-normal h-9 px-3 text-sm"
                                type="button"
                              >
                                <span className="truncate">
                                  {selectedTehsilId
                                    ? (tehsilsList.find((t) => String(t.id) === selectedTehsilId)?.tehsil_name ??
                                      "Select tehsil")
                                    : selectedDistrictId
                                      ? "Select tehsil"
                                      : "Select district first"}
                                </span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <Command
                                filter={(value, search) => {
                                  const q = (search || "").toLowerCase();
                                  if (!q) return 1;
                                  return (value || "").toLowerCase().includes(q) ? 1 : 0;
                                }}
                              >
                                <CommandInput placeholder="Type to search tehsil…" />
                                <CommandList>
                                  <CommandEmpty>No tehsil found.</CommandEmpty>
                                  <CommandGroup>
                                    {tehsilsList.map((t) => (
                                      <CommandItem
                                        key={t.id}
                                        value={t.tehsil_name}
                                        onSelect={() => {
                                          skipGeographyClearRef.current = false;
                                          setSelectedTehsilId(String(t.id));
                                          setTehsilComboboxOpen(false);
                                        }}
                                      >
                                        {t.tehsil_name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Schedule (XER) + project area */}
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

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8 items-stretch">
                        <WizardXerUploadSection
                          editingProject={editingProject}
                          xerFile={xerFile}
                          onXerInputChange={handleXERFileChange}
                          onClearXer={() => setXerFile(null)}
                        />
                        <div className="flex flex-col gap-3 min-w-0 h-full">
                          <div>
                            <Label className="text-sm font-medium">
                              Project area (GeoJSON / Shapefile(.zip)){" "}
                              {editingProject ? "(optional – upload to replace)" : "*"}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              Boundary is converted in the browser when needed, then sent with the XER in the same create request.
                            </p>
                          </div>
                          <div
                            className={`relative border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-center px-4 py-6 min-h-[13rem] flex-1 transition-colors touch-manipulation ${
                              areaFile
                                ? "border-primary bg-primary/5"
                                : "border-muted-foreground/25 hover:border-primary/50 active:bg-muted/40 cursor-pointer"
                            }`}
                            onClick={() => document.getElementById("area-file-input")?.click()}
                          >
                            {areaFile ? (
                              <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-full">
                                <MapPin className="h-10 w-10 text-primary shrink-0" />
                                <div className="flex-1 min-w-0 text-left w-full">
                                  <p className="font-medium text-sm sm:text-base break-all">{areaFile.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {(areaFile.size / 1024).toFixed(2)} KB · ready to upload
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11 shrink-0"
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
                                <Upload className="h-10 w-10 text-muted-foreground shrink-0" />
                                <p className="text-sm font-medium">Tap to upload area file</p>
                                <p className="text-xs text-muted-foreground max-w-md">
                                  GeoJSON, Shapefile (ZIP)
                                </p>
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
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-full min-h-11 px-6"
                            onClick={() => document.getElementById("area-file-input")?.click()}
                          >
                            Choose area file…
                          </Button>
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

                  {/* Step 3: Add Financial Details (Frontend only) */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      {/* Allocation */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Checkbox checked={enableAllocation} onCheckedChange={(v) => setEnableAllocation(Boolean(v))} />
                          Allocation (M)
                        </label>
                        {enableAllocation && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Capital Cost (M)</Label>
                              <Input value={allocationCapital} onChange={(e) => setAllocationCapital(e.target.value)} type="number" min={0} step="any" placeholder="e.g. 0" />
                            </div>
                            <div className="space-y-2">
                              <Label>Revenue Cost (M)</Label>
                              <Input value={allocationRevenue} onChange={(e) => setAllocationRevenue(e.target.value)} type="number" min={0} step="any" placeholder="e.g. 643.615" />
                            </div>
                            <div className="space-y-2">
                              <Label>Total Cost (M)</Label>
                              <Input value={allocationTotal} 
                              // onChange={(e) => setAllocationTotal(e.target.value)} 
                              type="number" min={0} step="any" placeholder="e.g. 643.615" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* P&D Release */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Checkbox checked={enablePdRelease} onCheckedChange={(v) => setEnablePdRelease(Boolean(v))} />
                          P&amp;D Release (M)
                        </label>
                        {enablePdRelease && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Capital Cost (M)</Label>
                              <Input value={pdReleaseCapital} onChange={(e) => setPdReleaseCapital(e.target.value)} type="number" min={0} step="any" />
                            </div>
                            <div className="space-y-2">
                              <Label>Revenue Cost (M)</Label>
                              <Input value={pdReleaseRevenue} onChange={(e) => setPdReleaseRevenue(e.target.value)} type="number" min={0} step="any" />
                            </div>
                            <div className="space-y-2">
                              <Label>Total Cost (M)</Label>
                              <Input value={pdReleaseTotal} o
                              // nChange={(e) => setPdReleaseTotal(e.target.value)} 
                              type="number" min={0} step="any" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Spending Release */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Checkbox checked={enableSpendingRelease} onCheckedChange={(v) => setEnableSpendingRelease(Boolean(v))} />
                          Spending Release (M)
                        </label>
                        {enableSpendingRelease && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Capital Cost (M)</Label>
                              <Input value={spendingReleaseCapital} onChange={(e) => setSpendingReleaseCapital(e.target.value)} type="number" min={0} step="any" />
                            </div>
                            <div className="space-y-2">
                              <Label>Revenue Cost (M)</Label>
                              <Input value={spendingReleaseRevenue} onChange={(e) => setSpendingReleaseRevenue(e.target.value)} type="number" min={0} step="any" />
                            </div>
                            <div className="space-y-2">
                              <Label>Total Cost (M)</Label>
                              <Input value={spendingReleaseTotal} 
                              // onChange={(e) => setSpendingReleaseTotal(e.target.value)} 
                              type="number" min={0} step="any" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* PIFRA Utilization */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Checkbox checked={enablePifraUtilization} onCheckedChange={(v) => setEnablePifraUtilization(Boolean(v))} />
                          Pifra Utilization (M)
                        </label>
                        {enablePifraUtilization && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                              <Label>Capital Cost (M)</Label>
                              <Input value={pifraCapital} onChange={(e) => setPifraCapital(e.target.value)} type="number" min={0} step="any" />
                            </div>
                            <div className="space-y-2">
                              <Label>Revenue Cost (M)</Label>
                              <Input value={pifraRevenue} onChange={(e) => setPifraRevenue(e.target.value)} type="number" min={0} step="any" />
                            </div>
                            <div className="space-y-2">
                              <Label>Total Cost (M)</Label>
                              <Input value={pifraTotal} 
                              // onChange={(e) => setPifraTotal(e.target.value)} 
                              type="number" min={0} step="any" />
                            </div>
                            <div className="space-y-2">
                              <Label>Date</Label>
                              <Input value={pifraDate} onChange={(e) => setPifraDate(e.target.value)} type="date" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* % Utilization against Spending Release */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Checkbox checked={enableUtilPct} onCheckedChange={(v) => setEnableUtilPct(Boolean(v))} />
                          %age Utilization against Spending Release
                        </label>
                        {enableUtilPct && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Capital %</Label>
                              <Input value={utilPctCapital} onChange={(e) => setUtilPctCapital(e.target.value)} type="number" min={0} step="any" placeholder="e.g. 0.0" />
                            </div>
                            <div className="space-y-2">
                              <Label>Revenue %</Label>
                              <Input value={utilPctRevenue} onChange={(e) => setUtilPctRevenue(e.target.value)} type="number" min={0} step="any" placeholder="e.g. 38.53" />
                            </div>
                            <div className="space-y-2">
                              <Label>Total Cost %</Label>
                              <Input value={utilPctTotal} 
                              // onChange={(e) => setUtilPctTotal(e.target.value)} 
                              type="number" min={0} step="any" placeholder="e.g. 38.53" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingProject(null);
                        resetForm();
                        setLocation("/project-management/view");
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
                        <Button type="button" variant="outline" onClick={handlePrevious} className="gap-2">
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <Button type="button" onClick={handleNext} className="gap-2">
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {currentStep === 3 && (
                      <>
                        <Button type="button" variant="outline" onClick={handlePrevious} className="gap-2">
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
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Project Management">
      <div className="flex flex-col min-h-[calc(100vh-8rem)] w-full min-w-0">
        {!isCreatePath && (
        <>
        {/* Header with search and Add Project button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0 mb-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight leading-tight">
              Added Projects
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              {!projectsLoading && projectsData.length > 0
                ? filteredProjects.length !== projectsData.length
                  ? `${filteredProjects.length} of ${projectsData.length} projects`
                  : `${projectsData.length} project${projectsData.length !== 1 ? "s" : ""}`
                : "Manage and view project details below"}
            </p>
          </div>
          <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
            {!projectsLoading && projectsData.length > 0 && (
              <div className="flex-1 min-w-0 sm:w-[280px] sm:flex-none md:w-[320px]">
                <Input
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  placeholder="Search division, district, or tehsil"
                  className="h-9"
                />
              </div>
            )}
            {!isViewPath && (
              <Button
                onClick={() => {
                  setEditingProject(null);
                  resetForm();
                  setShowAddProjectDialog(true);
                }}
                className="gap-2 shrink-0 px-3 sm:px-4"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add New Project</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>
        </div>

        {/* Projects Grid */}
        {projectsLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground">Loading projects…</p>
            </CardContent>
          </Card>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FolderKanban className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No matching projects</h3>
              <p className="text-sm text-muted-foreground mb-4">Try changing division, district, or tehsil search text</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {paginatedProjects.map((project: ApiProject) => {
              const isSelected = selectedProjectForView?.id === project.id;
              const accent = getProjectAccent(project.id);
              return (
                <Card
                  key={project.id}
                  className={`rounded-xl border border-border/80 bg-gradient-to-b from-card to-muted/15 shadow-sm transition-all duration-200 hover:shadow-md overflow-hidden border-l-4 ${accent.borderClass} ${
                    isSelected
                      ? "ring-2 ring-primary shadow-md"
                      : "hover:border-primary/30"
                  }`}
                >
                  <CardHeader className="pb-3 pt-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center ${accent.iconBgClass}`}>
                          <FolderKanban className={`h-5 w-5 ${accent.iconClass}`} />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base font-semibold leading-tight truncate" title={project.project_name || "Unnamed"}>
                            {project.project_name || "Unnamed"}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1 text-muted-foreground">
                            Updated {project.updated_at ? new Date(project.updated_at).toLocaleDateString() : "—"}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className="shrink-0 text-[11px] font-medium px-2 py-0 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200 border-0">
                        Active
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 pt-0 space-y-4">
                    {/* Compact summary: keep the cards clean; full details live in the View panel */}
                    <div className="flex flex-wrap gap-2">
                      {project.project_reference_no && (
                        <Badge
                          variant="outline"
                          className="text-[11px] font-medium bg-background/60 border-border/70 text-foreground"
                        >
                          <FileText className="h-3 w-3 mr-1 text-muted-foreground" />
                          <span className="truncate max-w-[160px]" title={project.project_reference_no}>
                            {project.project_reference_no}
                          </span>
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[11px] font-medium bg-background/60 border-border/70 text-foreground"
                      >
                        <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
                        <span className="max-w-[220px] truncate" title={project.tehsil_name ?? String(project.tehsil)}>
                          {project.tehsil_name ?? String(project.tehsil)}
                        </span>
                      </Badge>
                      {project.project_starting_date && (
                        <Badge
                          variant="outline"
                          className="text-[11px] font-medium bg-background/60 border-border/70 text-foreground"
                        >
                          <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                          {new Date(project.project_starting_date).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => openEditDialog(project)}
                        disabled={updateProjectMutation.isPending}
                        className="flex-1 gap-1.5 h-8 bg-primary text-primary-foreground hover:bg-primary/90 border-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Update
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewProject(project)}
                        disabled={loadingProjectView}
                        className={`flex-1 gap-1.5 h-8 border-border bg-background hover:bg-muted/50 ${isSelected ? "ring-1 ring-primary/50 bg-muted/30" : ""}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteProject(project.id)}
                        disabled={deleteProjectMutation.isPending && deleteConfirmProject?.id === project.id}
                        className="h-8 w-8 p-0 border-border bg-background hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive text-muted-foreground"
                        aria-label="Delete project"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          </div>
        )}

        {/* Pagination at bottom of page */}
        {!projectsLoading && projectsData.length > 0 && totalProjectsPages > 1 && (
          <div className="flex items-center justify-center gap-4 py-6 mt-auto border-t border-border/80 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProjectsPage((p) => Math.max(1, p - 1))}
              disabled={projectsPage <= 1}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground min-w-[100px] text-center">
              Page {projectsPage} of {totalProjectsPages}
            </span>
            <Button
              variant="default"
              size="sm"
              onClick={() => setProjectsPage((p) => Math.min(totalProjectsPages, p + 1))}
              disabled={projectsPage >= totalProjectsPages}
              className="gap-1.5 bg-primary text-primary-foreground"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Detail panel: selected project info in the space beneath the cards */}
        {selectedProjectForView && (
          <Card className="mt-6 border-primary/20 shadow-lg">
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
            <CardContent className="space-y-4">
              <Tabs defaultValue="overview">
                <TabsList className="w-full justify-start gap-1 overflow-x-auto whitespace-nowrap flex-nowrap">
                  <TabsTrigger value="overview" className="shrink-0">Project Info</TabsTrigger>
                  <TabsTrigger value="financial" className="shrink-0">Financial Details</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-6">
                  {selectedProjectForView.project_description && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedProjectForView.project_description}</p>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Stakeholder</p>
                        <p className="text-sm font-medium">
                          {formatProjectStakeholder(selectedProjectForView)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="h-10 w-10 rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300 flex items-center justify-center">
                        <Calendar className="h-5 w-5" />
                      </div>
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
                      <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 flex items-center justify-center">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Reference No</p>
                        <p className="text-sm font-medium">{selectedProjectForView.project_reference_no || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Location</p>
                        <p className="text-sm font-medium">
                          {selectedProjectForView.tehsil_name ?? String(selectedProjectForView.tehsil)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedProjectForView.xer_file && (
                    <div className="rounded-lg border p-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 flex items-center justify-center">
                        <FileText className="h-5 w-5" />
                      </div>
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

                  {!!selectedProjectForView.geom && typeof selectedProjectForView.geom === "object" && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Project Area (Map)</h4>
                      <div className="rounded-md border overflow-hidden">
                        <ProjectAreaMap geoData={selectedProjectForView.geom} />
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="financial" className="mt-4">
                  {(() => {
                    const p = selectedProjectForView as any;
                    const hasAny = (...vals: Array<unknown>) =>
                      vals.some((v) => v !== null && v !== undefined && String(v).trim() !== "");
                    const showAllocation = hasAny(p.allocation_capital_cost, p.allocation_revenue_cost, p.allocation_total_cost);
                    const showPd = hasAny(p.pd_release_capital_cost, p.pd_release_cost, p.pd_release_total_cost);
                    const showSpending = hasAny(p.spending_release_capital_cost, p.spending_release_revenue_cost, p.spending_release_total_cost);
                    const showPifra = hasAny(
                      p.pifra_utilization_capital_cost,
                      p.pifra_utilization_revenue_cost,
                      p.pifra_utilization_total_cost,
                      p.pifra_utilization_date,
                    );
                    const showPct = hasAny(p.percentage_utilization_capital, p.percentage_utilization_revenue, p.percentage_utilization_total);

                    if (!showAllocation && !showPd && !showSpending && !showPifra && !showPct) {
                      return (
                        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                          No financial details were provided for this project.
                        </div>
                      );
                    }

                    const formatNum = (v: unknown) => {
                      if (v === "" || v == null) return "—";
                      const n = typeof v === "number" ? v : Number(String(v));
                      if (!Number.isFinite(n)) return String(v);
                      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
                    };

                    const Stat = ({ label, value }: { label: string; value: unknown }) => (
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
                        <p className="mt-1 text-base font-semibold tabular-nums">{formatNum(value)}</p>
                      </div>
                    );

                    const Section = ({
                      title,
                      icon,
                      badgeClassName,
                      children,
                    }: {
                      title: string;
                      icon: React.ReactNode;
                      badgeClassName: string;
                      children: React.ReactNode;
                    }) => (
                      <div className="rounded-xl border p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${badgeClassName}`}>
                            {icon}
                          </div>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{title}</p>
                            <p className="text-xs text-muted-foreground">Values in millions (M)</p>
                          </div>
                        </div>
                        {children}
                      </div>
                    );

                    return (
                      <div className="space-y-4">
                        {showAllocation && (
                          <Section
                            title="Allocation"
                            icon={<Landmark className="h-4 w-4" />}
                            badgeClassName="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          >
                            <div className="grid gap-3 sm:grid-cols-3">
                              <Stat label="Capital (M)" value={p.allocation_capital_cost} />
                              <Stat label="Revenue (M)" value={p.allocation_revenue_cost} />
                              <Stat label="Total (M)" value={p.allocation_total_cost} />
                            </div>
                          </Section>
                        )}

                        {showPd && (
                          <Section
                            title="P&D Release"
                            icon={<HandCoins className="h-4 w-4" />}
                            badgeClassName="bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          >
                            <div className="grid gap-3 sm:grid-cols-3">
                              <Stat label="Capital (M)" value={p.pd_release_capital_cost} />
                              <Stat label="Revenue (M)" value={p.pd_release_cost} />
                              <Stat label="Total (M)" value={p.pd_release_total_cost} />
                            </div>
                          </Section>
                        )}

                        {showSpending && (
                          <Section
                            title="Spending Release"
                            icon={<Wallet className="h-4 w-4" />}
                            badgeClassName="bg-sky-500/10 text-sky-700 dark:text-sky-300"
                          >
                            <div className="grid gap-3 sm:grid-cols-3">
                              <Stat label="Capital (M)" value={p.spending_release_capital_cost} />
                              <Stat label="Revenue (M)" value={p.spending_release_revenue_cost} />
                              <Stat label="Total (M)" value={p.spending_release_total_cost} />
                            </div>
                          </Section>
                        )}

                        {showPifra && (
                          <div className="rounded-xl border p-4">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="h-8 w-8 rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300 flex items-center justify-center">
                                <Wallet className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold leading-tight">PIFRA Utilization</p>
                                <p className="text-xs text-muted-foreground">Values in millions (M)</p>
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-4">
                              <Stat label="Capital (M)" value={p.pifra_utilization_capital_cost} />
                              <Stat label="Revenue (M)" value={p.pifra_utilization_revenue_cost} />
                              <Stat label="Total (M)" value={p.pifra_utilization_total_cost} />
                              <div className="rounded-lg border bg-muted/20 p-3">
                                <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  Date
                                </p>
                                <p className="mt-1 text-base font-semibold tabular-nums">
                                  {p.pifra_utilization_date ? String(p.pifra_utilization_date).slice(0, 10) : "—"}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {showPct && (
                          <div className="rounded-xl border p-4">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-center justify-center">
                                <Percent className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold leading-tight">% Utilization vs Spending Release</p>
                                <p className="text-xs text-muted-foreground">Percent values (%)</p>
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <Stat label="Capital %" value={p.percentage_utilization_capital} />
                              <Stat label="Revenue %" value={p.percentage_utilization_revenue} />
                              <Stat label="Total %" value={p.percentage_utilization_total} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
        </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmProject}
        onOpenChange={(open) => { if (!open) setDeleteConfirmProject(null); }}
      >
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription className="pt-1">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                "{deleteConfirmProject?.project_name || "this project"}"
              </span>
              ? This action cannot be undone and will permanently remove the project along with all its activities, schedules, and related data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmProject(null)}
              disabled={deleteProjectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProject}
              disabled={deleteProjectMutation.isPending}
              className="gap-2"
            >
              {deleteProjectMutation.isPending ? (
                <>Deleting…</>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Project
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Project Dialog (also used as full-page on /project-management/create) */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setShowAddProjectDialog(open);
          if (!open) {
            resetForm();
            setEditingProject(null);
          }
        }}
      >
        <DialogContent
          className={
            "w-[95vw] max-w-[min(96vw,48rem)] sm:max-w-3xl max-h-[min(92vh,900px)] overflow-y-auto p-4 sm:p-6"
          }
        >
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
                  {currentStep > 2 ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-sm font-semibold">2</span>}
                </div>
                <p className={`text-xs font-medium mt-2 text-center max-w-[5.5rem] leading-tight ${currentStep === 2 ? "text-primary" : "text-muted-foreground"}`}>
                  XER + map
                </p>
              </div>

              {/* Animated Progress Line */}
              <div className="relative w-24 h-1 bg-muted rounded-full overflow-hidden mt-4">
                {currentStep >= 3 && (
                  <>
                    <div className="absolute inset-0 bg-primary" />
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent 30%, #ef4444 50%, transparent 70%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.5s linear infinite",
                      }}
                    />
                  </>
                )}
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                    currentStep >= 3
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-muted-foreground bg-background"
                  }`}
                >
                  <span className="text-sm font-semibold">3</span>
                </div>
                <p
                  className={`text-xs font-medium mt-2 ${
                    currentStep === 3 ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Add Financial Details
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referenceNumber">Project Reference No *</Label>
                    <Input
                      id="referenceNumber"
                      placeholder="Enter reference number"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
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

                {/* Province — searchable */}
                <div className="space-y-2">
                  <Label htmlFor="province">Province *</Label>
                  <Popover open={provinceComboboxOpen} onOpenChange={setProvinceComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="province"
                        variant="outline"
                        role="combobox"
                        aria-expanded={provinceComboboxOpen}
                        className="w-full justify-between font-normal h-9 px-3 text-sm"
                      >
                        <span className="truncate">
                          {selectedProvinceId
                            ? (provincesList.find((p) => String(p.id) === selectedProvinceId)?.province_name ?? "Select province")
                            : "Select province"}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command
                        filter={(value, search) => {
                          const q = (search || "").toLowerCase();
                          if (!q) return 1;
                          return (value || "").toLowerCase().includes(q) ? 1 : 0;
                        }}
                      >
                        <CommandInput placeholder="Type to search province…" />
                        <CommandList>
                          <CommandEmpty>No province found.</CommandEmpty>
                          <CommandGroup>
                            {provincesList.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={p.province_name}
                                onSelect={() => {
                                  skipGeographyClearRef.current = false;
                                  setSelectedProvinceId(String(p.id));
                                  setProvinceComboboxOpen(false);
                                }}
                              >
                                {p.province_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Division — searchable; show current name from list or editingProject */}
                <div className="space-y-2">
                  <Label htmlFor="division">Division *</Label>
                  <Popover open={divisionComboboxOpen} onOpenChange={setDivisionComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="division"
                        variant="outline"
                        role="combobox"
                        aria-expanded={divisionComboboxOpen}
                        disabled={!selectedProvinceId}
                        className="w-full justify-between font-normal h-9 px-3 text-sm"
                      >
                        <span className="truncate">
                          {selectedDivisionId
                            ? (divisionsList.find((d) => String(d.id) === selectedDivisionId)?.division_name ??
                              (editingProject && Number(selectedDivisionId) === editingProject.division ? editingProject.division_name : null) ??
                              "Select division")
                            : selectedProvinceId ? "Select division" : "Select province first"}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command
                        filter={(value, search) => {
                          const q = (search || "").toLowerCase();
                          if (!q) return 1;
                          return (value || "").toLowerCase().includes(q) ? 1 : 0;
                        }}
                      >
                        <CommandInput placeholder="Type to search division…" />
                        <CommandList>
                          <CommandEmpty>No division found.</CommandEmpty>
                          <CommandGroup>
                            {divisionsList.map((d) => (
                              <CommandItem
                                key={d.id}
                                value={d.division_name}
                                onSelect={() => {
                                  skipGeographyClearRef.current = false;
                                  setSelectedDivisionId(String(d.id));
                                  setDivisionComboboxOpen(false);
                                }}
                              >
                                {d.division_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* District — searchable */}
                <div className="space-y-2">
                  <Label htmlFor="district">District *</Label>
                  <Popover open={districtComboboxOpen} onOpenChange={setDistrictComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="district"
                        variant="outline"
                        role="combobox"
                        aria-expanded={districtComboboxOpen}
                        disabled={!selectedDivisionId}
                        className="w-full justify-between font-normal h-9 px-3 text-sm"
                      >
                        <span className="truncate">
                          {selectedDistrictId
                            ? (districtsList.find((d) => String(d.id) === selectedDistrictId)?.district_name ??
                              (editingProject && Number(selectedDistrictId) === editingProject.district ? editingProject.district_name : null) ??
                              "Select district")
                            : selectedDivisionId ? "Select district" : "Select division first"}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command
                        filter={(value, search) => {
                          const q = (search || "").toLowerCase();
                          if (!q) return 1;
                          return (value || "").toLowerCase().includes(q) ? 1 : 0;
                        }}
                      >
                        <CommandInput placeholder="Type to search district…" />
                        <CommandList>
                          <CommandEmpty>No district found.</CommandEmpty>
                          <CommandGroup>
                            {districtsList.map((d) => (
                              <CommandItem
                                key={d.id}
                                value={d.district_name}
                                onSelect={() => {
                                  skipGeographyClearRef.current = false;
                                  setSelectedDistrictId(String(d.id));
                                  setDistrictComboboxOpen(false);
                                }}
                              >
                                {d.district_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Tehsil — searchable */}
                <div className="space-y-2">
                  <Label htmlFor="tehsil">Tehsil *</Label>
                  <Popover open={tehsilComboboxOpen} onOpenChange={setTehsilComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="tehsil"
                        variant="outline"
                        role="combobox"
                        aria-expanded={tehsilComboboxOpen}
                        disabled={!selectedDistrictId}
                        className="w-full justify-between font-normal h-9 px-3 text-sm"
                      >
                        <span className="truncate">
                          {selectedTehsilId
                            ? (tehsilsList.find((t) => String(t.id) === selectedTehsilId)?.tehsil_name ??
                              (editingProject && Number(selectedTehsilId) === editingProject.tehsil ? editingProject.tehsil_name : null) ??
                              "Select tehsil")
                            : selectedDistrictId ? "Select tehsil" : "Select district first"}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command
                        filter={(value, search) => {
                          const q = (search || "").toLowerCase();
                          if (!q) return 1;
                          return (value || "").toLowerCase().includes(q) ? 1 : 0;
                        }}
                      >
                        <CommandInput placeholder="Type to search tehsil…" />
                        <CommandList>
                          <CommandEmpty>No tehsil found.</CommandEmpty>
                          <CommandGroup>
                            {tehsilsList.map((t) => (
                              <CommandItem
                                key={t.id}
                                value={t.tehsil_name}
                                onSelect={() => {
                                  skipGeographyClearRef.current = false;
                                  setSelectedTehsilId(String(t.id));
                                  setTehsilComboboxOpen(false);
                                }}
                              >
                                {t.tehsil_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Step 2: Schedule (XER) + project area */}
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

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8 items-stretch">
                  <WizardXerUploadSection
                    editingProject={editingProject}
                    xerFile={xerFile}
                    onXerInputChange={handleXERFileChange}
                    onClearXer={() => setXerFile(null)}
                  />
                  <div className="flex flex-col gap-3 min-w-0 h-full">
                    <div>
                      <Label className="text-sm font-medium">
                        Project area (GeoJSON / Shapefile(.zip)){" "}
                        {editingProject ? "(optional – upload to replace)" : "*"}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Sent together with the XER when you create the project (multipart request).
                      </p>
                    </div>
                    <div
                      className={`relative border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-center px-4 py-6 min-h-[13rem] flex-1 transition-colors touch-manipulation ${
                        areaFile
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-primary/50 active:bg-muted/40 cursor-pointer"
                      }`}
                      onClick={() => document.getElementById("area-file-input")?.click()}
                    >
                      {areaFile ? (
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-full">
                          <MapPin className="h-10 w-10 text-primary shrink-0" />
                          <div className="flex-1 min-w-0 text-left w-full">
                            <p className="font-medium text-sm sm:text-base break-all">{areaFile.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {(areaFile.size / 1024).toFixed(2)} KB · ready to upload
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 shrink-0"
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
                          <Upload className="h-10 w-10 text-muted-foreground shrink-0" />
                          <p className="text-sm font-medium">Tap to upload area file</p>
                          <p className="text-xs text-muted-foreground max-w-md">
                            GeoJSON
                          </p>
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
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full min-h-11 px-6"
                      onClick={() => document.getElementById("area-file-input")?.click()}
                    >
                      Choose area file…
                    </Button>
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

            {/* Step 3: Add Financial Details (Frontend only) */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {/* Allocation */}
                <div className="space-y-3 rounded-lg border p-4">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={enableAllocation} onCheckedChange={(v) => setEnableAllocation(Boolean(v))} />
                    Allocation (M)
                  </label>
                  {enableAllocation && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Capital Cost (M)</Label>
                        <Input value={allocationCapital} onChange={(e) => setAllocationCapital(e.target.value)} type="number" min={0} step="any" placeholder="e.g. 0" />
                      </div>
                      <div className="space-y-2">
                        <Label>Revenue Cost (M)</Label>
                        <Input value={allocationRevenue} onChange={(e) => setAllocationRevenue(e.target.value)} type="number" min={0} step="any" placeholder="e.g. 643.615" />
                      </div>
                      <div className="space-y-2">
                        <Label>Total Cost (M)</Label>
                        <Input value={allocationTotal} 
                        // onChange={(e) => setAllocationTotal(e.target.value)} 
                        type="number" min={0} step="any" placeholder="e.g. 643.615" />
                      </div>
                    </div>
                  )}
                </div>

                {/* P&D Release */}
                <div className="space-y-3 rounded-lg border p-4">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={enablePdRelease} onCheckedChange={(v) => setEnablePdRelease(Boolean(v))} />
                    P&amp;D Release (M)
                  </label>
                  {enablePdRelease && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Capital Cost (M)</Label>
                        <Input value={pdReleaseCapital} onChange={(e) => setPdReleaseCapital(e.target.value)} type="number" min={0} step="any" />
                      </div>
                      <div className="space-y-2">
                        <Label>Revenue Cost (M)</Label>
                        <Input value={pdReleaseRevenue} onChange={(e) => setPdReleaseRevenue(e.target.value)} type="number" min={0} step="any" />
                      </div>
                      <div className="space-y-2">
                        <Label>Total Cost (M)</Label>
                        <Input value={pdReleaseTotal} 
                        // onChange={(e) => setPdReleaseTotal(e.target.value)} 
                        type="number" min={0} step="any" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Spending Release */}
                <div className="space-y-3 rounded-lg border p-4">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={enableSpendingRelease} onCheckedChange={(v) => setEnableSpendingRelease(Boolean(v))} />
                    Spending Release (M)
                  </label>
                  {enableSpendingRelease && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Capital Cost (M)</Label>
                        <Input value={spendingReleaseCapital} onChange={(e) => setSpendingReleaseCapital(e.target.value)} type="number" min={0} step="any" />
                      </div>
                      <div className="space-y-2">
                        <Label>Revenue Cost (M)</Label>
                        <Input value={spendingReleaseRevenue} onChange={(e) => setSpendingReleaseRevenue(e.target.value)} type="number" min={0} step="any" />
                      </div>
                      <div className="space-y-2">
                        <Label>Total Cost (M)</Label>
                        <Input value={spendingReleaseTotal} 
                        // onChange={(e) => setSpendingReleaseTotal(e.target.value)} 
                        type="number" min={0} step="any" />
                      </div>
                    </div>
                  )}
                </div>

                {/* PIFRA Utilization */}
                <div className="space-y-3 rounded-lg border p-4">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={enablePifraUtilization} onCheckedChange={(v) => setEnablePifraUtilization(Boolean(v))} />
                    Pifra Utilization (M)
                  </label>
                  {enablePifraUtilization && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Capital Cost (M)</Label>
                        <Input value={pifraCapital} onChange={(e) => setPifraCapital(e.target.value)} type="number" min={0} step="any" />
                      </div>
                      <div className="space-y-2">
                        <Label>Revenue Cost (M)</Label>
                        <Input value={pifraRevenue} onChange={(e) => setPifraRevenue(e.target.value)} type="number" min={0} step="any" />
                      </div>
                      <div className="space-y-2">
                        <Label>Total Cost (M)</Label>
                        <Input value={pifraTotal} 
                        // onChange={(e) => setPifraTotal(e.target.value)}
                         type="number" min={0} step="any" />
                      </div>
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input value={pifraDate} onChange={(e) => setPifraDate(e.target.value)} type="date" />
                      </div>
                    </div>
                  )}
                </div>

                {/* % Utilization against Spending Release */}
                <div className="space-y-3 rounded-lg border p-4">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={enableUtilPct} onCheckedChange={(v) => setEnableUtilPct(Boolean(v))} />
                    %age Utilization against Spending Release
                  </label>
                  {enableUtilPct && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Capital %</Label>
                        <Input value={utilPctCapital} onChange={(e) => setUtilPctCapital(e.target.value)} type="number" min={0} step="any" placeholder="e.g. 0.0" />
                      </div>
                      <div className="space-y-2">
                        <Label>Revenue %</Label>
                        <Input value={utilPctRevenue} onChange={(e) => setUtilPctRevenue(e.target.value)} type="number" min={0} step="any" placeholder="e.g. 38.53" />
                      </div>
                      <div className="space-y-2">
                        <Label>Total Cost %</Label>
                        <Input value={utilPctTotal} 
                        // onChange={(e) => setUtilPctTotal(e.target.value)}
                         type="number" min={0} step="any" placeholder="e.g. 38.53" />
                      </div>
                    </div>
                  )}
                </div>
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
                  <Button type="button" onClick={handleNext} className="gap-2">
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              {currentStep === 3 && (
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

    </Layout>
  );
}
