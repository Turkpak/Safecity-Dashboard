import { Layout } from "@/components/layout/Layout";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    MapPin,
    Upload,
    ChevronRight,
    Check,
    Globe,
    FileJson,
    AlertCircle,
    ArrowLeft,
    Layers,
    Navigation2
} from "lucide-react";
import { CityMap } from "@/components/dashboard/CityMap";
import { useToast } from "@/hooks/use-toast";
import type { LayerType } from "@/pages/GISLayers";

export default function AreaManagement() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        division: "",
        district: "",
        tehsil: "",
    });
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [uploadedGeoData, setUploadedGeoData] = useState<any>(null);
    const { toast } = useToast();

    const handleNext = () => {
        if (step === 1 && (!formData.division || !formData.district || !formData.tehsil)) {
            toast({
                title: "Information Missing",
                description: "Please fill in all area details to proceed.",
                variant: "destructive"
            });
            return;
        }
        setStep(step + 1);
    };

    const handleBack = () => setStep(step - 1);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const extension = file.name.split('.').pop()?.toLowerCase();
            const allowedExtensions = ['zip', 'shp', 'kml', 'kmz', 'json', 'geojson'];

            if (!extension || !allowedExtensions.includes(extension)) {
                toast({
                    title: "Invalid Format",
                    description: "Please upload a valid .shp (zip), .kml, .kmz, or .geojson file.",
                    variant: "destructive"
                });
                return;
            }

            setUploadedFile(file);
            setIsUploading(true);

            // Simulate processing based on format
            setTimeout(() => {
                setIsUploading(false);
                // Get base coordinates based on selection
                const baseCoords = formData.division === "rawalpindi" ? [73.01, 33.56] :
                    formData.division === "gujranwala" ? [74.19, 32.18] :
                        [74.35, 31.52];

                // Mock GeoJSON for the preview (slightly offset polygon)
                setUploadedGeoData({
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [baseCoords[0] - 0.05, baseCoords[1] - 0.05],
                            [baseCoords[0] + 0.05, baseCoords[1] - 0.05],
                            [baseCoords[0] + 0.05, baseCoords[1] + 0.05],
                            [baseCoords[0] - 0.05, baseCoords[1] + 0.05],
                            [baseCoords[0] - 0.05, baseCoords[1] - 0.05]
                        ]]
                    },
                    properties: {
                        name: formData.tehsil,
                        format: extension.toUpperCase(),
                        timestamp: new Date().toISOString()
                    }
                });
                toast({
                    title: "Success",
                    description: `${extension.toUpperCase()} spatial data loaded and projected successfully.`,
                });
            }, 2000);
        }
    };

    return (
        <Layout title="Area & Spatial Management">
            <div className="flex flex-col gap-8 max-w-[1400px] mx-auto pb-20">
                {/* Visual Progress Header */}
                <div className="flex flex-col items-center justify-center w-full py-4">
                    <div className="flex items-start w-full max-w-3xl relative">
                        {/* Connector Line (Background) */}
                        <div className="absolute top-6 left-[25%] right-[25%] h-0.5 bg-muted z-0" />

                        {/* Connector Line (Progress) */}
                        <div className="absolute top-6 left-[25%] right-[25%] h-0.5 z-0 transition-all duration-500 ease-in-out overflow-hidden">
                            <div className={`h-full bg-primary transition-all duration-500 ${step > 1 ? 'w-full' : 'w-0'}`} />
                        </div>

                        {/* Step 1 */}
                        <div className="flex flex-col items-center flex-1 relative z-10">
                            <div className="relative">
                                {step === 1 && (
                                    <div className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
                                )}
                                <div className={`relative flex items-center justify-center h-12 w-12 rounded-full border-2 transition-all duration-300 bg-white ${step >= 1 ? 'border-primary text-primary shadow-xl shadow-primary/10' : 'border-muted text-muted-foreground'}`}>
                                    {step > 1 ? (
                                        <div className="bg-emerald-600 h-full w-full rounded-full flex items-center justify-center text-white scale-100 shadow-lg shadow-emerald-200">
                                            <Check className="h-6 w-6" />
                                        </div>
                                    ) : (
                                        <span className="font-black text-lg">1</span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 text-center px-4">
                                <h3 className={`text-[12px] font-black uppercase tracking-widest leading-none ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>Hierarchy Definition</h3>
                                <p className="text-[10px] text-muted-foreground mt-2 font-medium max-w-[180px] mx-auto">Define Division, District and Tehsil administrative structure</p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex flex-col items-center flex-1 relative z-10">
                            <div className="relative">
                                {step === 2 && (
                                    <div className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
                                )}
                                <div className={`relative flex items-center justify-center h-12 w-12 rounded-full border-2 transition-all duration-300 bg-white ${step >= 2 ? 'border-primary text-white bg-primary shadow-xl shadow-primary/20 scale-110' : 'border-muted text-muted-foreground'}`}>
                                    <span className="font-black text-lg">2</span>
                                </div>
                            </div>
                            <div className="mt-4 text-center px-4">
                                <h3 className={`text-[12px] font-black uppercase tracking-widest leading-none ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>Spatial Integration</h3>
                                <p className="text-[10px] text-muted-foreground mt-2 font-medium max-w-[180px] mx-auto">Upload spatial assets and verify boundaries on the map</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    {/* Form Component */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-full"
                    >
                        <AnimatePresence mode="wait">
                            {step === 1 ? (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.3 }}
                                    className="h-full"
                                >
                                    <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden h-full flex flex-col">
                                        <div className="h-2 bg-primary w-full" />
                                        <CardHeader className="space-y-1 pb-4">
                                            <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
                                                <Layers className="h-5 w-5 text-secondary" /> Area Information
                                            </CardTitle>
                                            <CardDescription className="font-medium">Populate the administrative hierarchy for the new area.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="space-y-3">
                                                <Label className="text-[11px] font-black uppercase tracking-widest text-primary/60">Select Division</Label>
                                                <Select onValueChange={(v) => setFormData({ ...formData, division: v })} value={formData.division}>
                                                    <SelectTrigger className="h-12 rounded-xl border-muted-foreground/20 font-bold focus:ring-primary/10">
                                                        <SelectValue placeholder="Choose Division" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="lahore" className="font-bold">Lahore Division</SelectItem>
                                                        <SelectItem value="rawalpindi" className="font-bold">Rawalpindi Division</SelectItem>
                                                        <SelectItem value="gujranwala" className="font-bold">Gujranwala Division</SelectItem>
                                                        <SelectItem value="new" className="text-secondary font-black italic">+ Propose New Division</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-3">
                                                <Label className="text-[11px] font-black uppercase tracking-widest text-primary/60">Select District</Label>
                                                <Select onValueChange={(v) => setFormData({ ...formData, district: v })} value={formData.district}>
                                                    <SelectTrigger className="h-12 rounded-xl border-muted-foreground/20 font-bold focus:ring-primary/10">
                                                        <SelectValue placeholder="Choose District" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="dist1" className="font-bold">Lahore District</SelectItem>
                                                        <SelectItem value="dist2" className="font-bold">Kasur District</SelectItem>
                                                        <SelectItem value="new_dist" className="text-secondary font-black italic">+ Propose New District</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-3">
                                                <Label className="text-[11px] font-black uppercase tracking-widest text-primary/60">Tehsil Name</Label>
                                                <div className="relative group">
                                                    <Input
                                                        placeholder="e.g. Model Town"
                                                        className="h-12 pl-10 rounded-xl border-muted-foreground/20 font-bold focus:ring-primary/10"
                                                        value={formData.tehsil}
                                                        onChange={(e) => setFormData({ ...formData, tehsil: e.target.value })}
                                                    />
                                                    <Navigation2 className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
                                                </div>
                                            </div>

                                            <Button
                                                onClick={handleNext}
                                                className="w-full h-14 bg-primary hover:bg-primary/95 text-white font-black text-[15px] rounded-xl shadow-xl shadow-primary/10 group mt-4 transition-all"
                                            >
                                                Proceed to Spatial Integration
                                                <ChevronRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.3 }}
                                    className="h-full"
                                >
                                    <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden h-full flex flex-col">
                                        <div className="h-2 bg-secondary w-full" />
                                        <CardHeader className="space-y-1 pb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0 rounded-full hover:bg-muted">
                                                    <ArrowLeft className="h-4 w-4" />
                                                </Button>
                                                <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Go Back</span>
                                            </div>
                                            <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
                                                <Globe className="h-5 w-5 text-secondary" /> Spatial Asset Upload
                                            </CardTitle>
                                            <CardDescription className="font-medium">Upload shapefiles or GeoJSON boundaries for the defined area.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div
                                                className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all ${uploadedFile ? 'border-emerald-600/50 bg-emerald-50/10' : 'border-muted-foreground/20 hover:border-primary/50'}`}
                                            >
                                                <input
                                                    type="file"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={handleFileChange}
                                                    accept=".zip,.shp,.kml,.kmz,.json,.geojson"
                                                />
                                                {isUploading ? (
                                                    <div className="flex flex-col items-center animate-pulse">
                                                        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                                                        <p className="text-sm font-bold text-primary italic">Parsing Geometries...</p>
                                                    </div>
                                                ) : uploadedFile ? (
                                                    <div className="flex flex-col items-center text-center">
                                                        <div className="h-16 w-16 bg-emerald-100/50 text-emerald-700 rounded-2xl flex items-center justify-center mb-4">
                                                            <Globe className="h-8 w-8" />
                                                        </div>
                                                        <p className="font-bold text-sm text-emerald-800">{uploadedFile.name}</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 uppercase font-black tracking-widest">Format: {uploadedFile.name.split('.').pop()?.toUpperCase()} • {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center text-center px-4">
                                                        <div className="h-16 w-16 bg-primary/5 text-primary rounded-2xl flex items-center justify-center mb-4">
                                                            <Upload className="h-8 w-8 transition-transform group-hover:-translate-y-1" />
                                                        </div>
                                                        <p className="font-bold text-sm">Spatial Data Upload</p>
                                                        <p className="text-xs text-muted-foreground mt-2 max-w-[240px]">Supporting .SHP (Zipped), .KML, .KMZ, and .GeoJSON formats</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="bg-primary/5 rounded-xl p-4 flex items-start gap-3 border border-primary/10">
                                                <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                                                <div className="space-y-1">
                                                    <p className="text-xs font-bold text-primary">Spatial Requirement</p>
                                                    <p className="text-[10px] leading-relaxed text-primary/70 font-medium">Coordinate system must be WGS84. Ensure the polygon is closed and without intersections for accurate dashboard projection.</p>
                                                </div>
                                            </div>

                                            <Button
                                                disabled={!uploadedFile || isUploading}
                                                className="w-full h-14 bg-secondary hover:bg-secondary/95 text-white font-black text-[15px] rounded-xl shadow-xl shadow-secondary/10 group mt-4 transition-all"
                                            >
                                                Finalize Area Integration
                                                <Check className="h-5 w-5 ml-2" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Map Component */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-full h-full"
                    >
                        <Card className="border-none shadow-[0_8px_40px_rgb(0,0,0,0.06)] overflow-hidden flex flex-col h-full min-h-[420px] sm:min-h-[520px] lg:min-h-[600px]">
                            <CardHeader className="bg-white/80 backdrop-blur-md border-b z-10 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                            <MapPin className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Integration Preview</CardTitle>
                                            <p className="text-[10px] text-muted-foreground font-bold italic">
                                                {step === 1 ? "Administrative Context Mapping" : `Live Spatial Validation: ${formData.tehsil || 'Pending'}`}
                                            </p>
                                        </div>
                                    </div>
                                    {uploadedFile && (
                                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                                            <div className="h-2 w-2 bg-emerald-600 rounded-full animate-pulse" />
                                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Active {uploadedFile.name.split('.').pop()?.toUpperCase()}</span>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 relative bg-muted">
                                <CityMap
                                    city={formData.division || "lahore"}
                                    activeLayers={new Set<LayerType>()}
                                    geoData={uploadedGeoData}
                                    showStats={false}
                                />

                                <AnimatePresence>
                                    {step === 2 && !uploadedFile && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute inset-0 z-20 bg-primary/20 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"
                                        >
                                            <div className="bg-white/90 px-6 py-4 rounded-2xl shadow-2xl border border-white flex items-center gap-4">
                                                <Upload className="h-6 w-6 text-primary animate-bounce" />
                                                <p className="text-sm font-black text-primary uppercase tracking-widest">Waiting for Spatial Asset</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </Layout>
    );
}
