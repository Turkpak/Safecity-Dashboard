import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Shield,
    Lock,
    Mail,
    User,
    ArrowRight,
    Eye,
    EyeOff,
    Camera,
    Activity,
    ShieldCheck,
    Map as MapIcon,
    ChevronRight,
    TrendingUp,
    BarChart3,
    CheckCircle2,
    Briefcase
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function AuthPage() {
    const [, setLocation] = useLocation();
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [stakeholderType, setStakeholderType] = useState<string>("Client");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Persist role for sidebar visibility
        localStorage.setItem("userRole", stakeholderType);
        setTimeout(() => {
            setIsLoading(false);
            setLocation("/");
        }, 1500);
    };

    return (
        <div className="min-h-screen w-full flex bg-white font-sans overflow-hidden">
            {/* LEFT SIDE: Project Information & Progress "Advertisement" Panel */}
            <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "circOut" }}
                className="hidden lg:flex w-[55%] bg-primary relative overflow-hidden flex-col justify-between p-16 text-white"
            >
                {/* Visual Background Noise */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-white/5 blur-[120px]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/15 blur-[100px]" />
                    <div className="absolute inset-0 bg-grid-pattern opacity-[0.07] [mask-image:radial-gradient(ellipse_at_center,black_70%,transparent_100%)]" />
                </div>

                {/* Top Branding Section */}
                <div className="relative z-10 flex items-center gap-5">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center p-3 shadow-[0_0_40px_rgba(255,255,255,0.15)]"
                    >
                        <img src="/Assets/psca logo.png" alt="PSCA" className="h-full w-full object-contain" />
                    </motion.div>
                    <div>
                        <h1 className="text-2xl font-heading font-bold tracking-tight text-white">Punjab Safe Cities Authority</h1>
                        <p className="text-secondary font-bold text-[11px] uppercase tracking-[0.25em]">Project Progress Monitoring</p>
                    </div>
                </div>

                {/* Main "Dashboard Advertisement" Content */}
                <div className="relative z-10 max-w-xl">
                    <motion.div
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.7 }}
                    >

                        <h2 className="text-6xl font-heading font-bold mb-8 leading-[1.05] tracking-tight">
                            Smart Governance. <br />
                            <span className="text-secondary italic">Secure</span> Communities.
                        </h2>

                        <p className="text-white/80 text-lg mb-12 leading-relaxed font-medium border-l-4 border-secondary pl-6">
                            The central dashboard for monitoring real-time project implementation across every tehsil in Punjab. Track milestones, analyze data, and ensure timely completion of critical infrastructure.
                        </p>

                        <div className="grid grid-cols-2 gap-x-12 gap-y-10">
                            {[
                                { icon: TrendingUp, title: "Milestone Tracking", desc: "Live progress metrics for every project phase." },
                                { icon: MapIcon, title: "140+ Tehsils", desc: "Unified monitoring for localized project status." },
                                { icon: BarChart3, title: "Data Analytics", desc: "Comparative performance metrics across districts." },
                                { icon: ShieldCheck, title: "Quality Assurance", desc: "Verifying project compliance with official standards." }
                            ].map((item, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.6 + (idx * 0.1), duration: 0.5 }}
                                    className="flex items-start gap-4 group"
                                >
                                    <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary/20 transition-colors border border-white/5 group-hover:border-secondary/30 shadow-lg">
                                        <item.icon className="h-6 w-6 text-secondary" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-[15px] text-white group-hover:text-secondary transition-colors">{item.title}</h4>
                                        <p className="text-[11px] text-white/50 mt-1.5 leading-normal">{item.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* Footer section removed as requested */}
                <div className="relative z-10">
                    <div className="border-t border-white/10 pt-10" />
                </div>
            </motion.div>


            {/* RIGHT SIDE: Authentication Form Panel */}
            <div className="w-full lg:w-[45%] flex items-center justify-center p-8 bg-white relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--color-primary-soft),transparent_70%)] opacity-[0.05] pointer-events-none"
                    style={{ '--color-primary-soft': 'hsl(var(--primary))' } as any} />
                <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none lg:hidden" />

                <div className="w-full max-w-sm relative z-10">
                    {/* Mobile Only Header */}
                    <div className="lg:hidden flex flex-col items-center mb-12 text-center">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="h-20 w-20 bg-primary rounded-[22px] flex items-center justify-center p-4 shadow-2xl mb-5"
                        >
                            <img src="/Assets/psca logo.png" alt="PSCA" className="h-full w-full object-contain brightness-0 invert" />
                        </motion.div>
                        <h1 className="text-3xl font-heading font-bold text-primary tracking-tight">PSCA Safe City</h1>
                        <p className="text-secondary font-bold text-[10px] font-bold uppercase tracking-[0.25em] mt-2">Project Progress Monitoring</p>
                    </div>

                    <div className="mb-12">
                        <div className="space-y-2">
                            <motion.h2
                                key={isLogin ? 'login-head' : 'signup-head'}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-4xl font-heading font-black text-primary tracking-tight"
                            >
                                {isLogin ? "Official Login" : "Initialize Account"}
                            </motion.h2>
                            <p className="text-muted-foreground font-semibold text-sm">
                                {isLogin
                                    ? "Secure entrance for authorized monitoring personnel."
                                    : "Register your command credentials for monitoring."}
                            </p>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {isLogin || stakeholderType === "Client" ? (
                            <motion.form
                                key="login"
                                initial={{ x: 30, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -30, opacity: 0 }}
                                transition={{ duration: 0.4, ease: "circOut" }}
                                onSubmit={handleSubmit}
                                className="space-y-7"
                            >
                                <div className="space-y-5">
                                    <div className="space-y-2.5">
                                        <Label htmlFor="stakeholderType" className="text-[11px] font-black uppercase tracking-widest text-primary/60 ml-1">Stakeholder Type</Label>
                                        <div className="relative group">
                                            <Select
                                                value={stakeholderType}
                                                onValueChange={(val) => {
                                                    setStakeholderType(val);
                                                    // If Client is selected, always show login (no signup)
                                                    // If other types are selected, allow signup option
                                                    if (val === "Client") {
                                                        setIsLogin(true);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="pl-12 h-14 bg-muted/5 border-2 border-muted/50 hover:border-primary/30 focus:border-primary rounded-2xl transition-all font-bold text-[15px]">
                                                    <SelectValue placeholder="Select Stakeholder Type" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-2 border-muted shadow-xl">
                                                    <SelectItem value="Consultants" className="py-3 font-bold text-primary">Consultants</SelectItem>
                                                    <SelectItem value="Contractor" className="py-3 font-bold text-primary">Contractor</SelectItem>
                                                    <SelectItem value="Client" className="py-3 font-bold text-primary">Client</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Briefcase className="absolute left-4.5 top-4.5 h-5 w-5 text-muted-foreground/60 transition-colors group-focus-within:text-primary z-10 pointer-events-none" />
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        <Label htmlFor="email" className="text-[11px] font-black uppercase tracking-widest text-primary/60 ml-1">Email</Label>
                                        <div className="relative group">
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="admin@psca.gov.pk"
                                                className="pl-12 h-14 bg-muted/5 border-2 border-muted/50 hover:border-primary/30 focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-2xl transition-all font-bold text-[15px]"
                                                required
                                            />
                                            <Mail className="absolute left-4.5 top-4.5 h-5 w-5 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between px-1">
                                            <Label htmlFor="password" className="text-[11px] font-black uppercase tracking-widest text-primary/60">Password</Label>
                                            <button type="button" className="text-[11px] font-bold text-primary hover:text-secondary transition-colors underline underline-offset-4 decoration-current/30">Reset Password</button>
                                        </div>
                                        <div className="relative group">
                                            <Input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                className="pl-12 pr-12 h-14 bg-muted/5 border-2 border-muted/50 hover:border-primary/30 focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-2xl transition-all font-bold text-[15px]"
                                                required
                                            />
                                            <Lock className="absolute left-4.5 top-4.5 h-5 w-5 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4.5 top-4.5 text-muted-foreground/40 hover:text-primary transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center space-x-2.5">
                                        <Checkbox id="remember" className="h-5 w-5 rounded-lg border-2 border-muted-foreground/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all shadow-sm" />
                                        <label htmlFor="remember" className="text-xs font-bold text-muted-foreground/70 cursor-pointer hover:text-foreground select-none">Persistent Session</label>
                                    </div>




                                </div>

                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-15 bg-primary hover:bg-primary/95 text-white font-black text-[16px] tracking-wide rounded-[20px] shadow-[0_12px_36px_rgba(var(--color-primary-rgb),0.25)] transition-all hover:translate-y-[-2px] active:translate-y-0.5"
                                    style={{ '--color-primary-rgb': '22, 58, 126' } as any}
                                >
                                    {isLoading ? (
                                        <div className="flex items-center gap-3">
                                            <div className="h-5 w-5 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                                            <span>Authenticating Profile...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2">
                                            Enter Monitoring Portal <ArrowRight className="h-5 w-5" />
                                        </div>
                                    )}
                                </Button>
                            </motion.form>
                        ) : (
                            <motion.form
                                key="signup"
                                initial={{ x: 30, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -30, opacity: 0 }}
                                transition={{ duration: 0.4, ease: "circOut" }}
                                onSubmit={handleSubmit}
                                className="space-y-6"
                            >
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2.5">
                                        <Label htmlFor="fname" className="text-[11px] font-black uppercase tracking-widest text-secondary/60 ml-1">First Name</Label>
                                        <div className="relative group">
                                            <Input
                                                id="fname"
                                                placeholder="Officer"
                                                className="pl-12 h-14 bg-muted/5 border-2 border-muted/50 hover:border-secondary/30 focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-2xl transition-all font-bold text-[15px]"
                                                required
                                            />
                                            <User className="absolute left-4.5 top-4.5 h-5 w-5 text-muted-foreground/60 transition-colors group-focus-within:text-secondary" />
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label htmlFor="lname" className="text-[11px] font-black uppercase tracking-widest text-secondary/60 ml-1">Last Name</Label>
                                        <Input
                                            id="lname"
                                            placeholder="Name"
                                            className="h-14 bg-muted/5 border-2 border-muted/50 hover:border-secondary/30 focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-2xl transition-all font-bold text-[15px]"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    <Label htmlFor="reg-email" className="text-[11px] font-black uppercase tracking-widest text-secondary/60 ml-1">Official ID Email</Label>
                                    <div className="relative group">
                                        <Input
                                            id="reg-email"
                                            type="email"
                                            placeholder="id@psca.gov.pk"
                                            className="pl-12 h-14 bg-muted/5 border-2 border-muted/50 hover:border-secondary/30 focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-2xl transition-all font-bold text-[15px]"
                                            required
                                        />
                                        <Mail className="absolute left-4.5 top-4.5 h-5 w-5 text-muted-foreground/60 transition-colors group-focus-within:text-secondary" />
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    <Label htmlFor="reg-pass" className="text-[11px] font-black uppercase tracking-widest text-secondary/60 ml-1">Password</Label>
                                    <div className="relative group">
                                        <Input
                                            id="reg-pass"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            className="pl-12 pr-12 h-14 bg-muted/5 border-2 border-muted/50 hover:border-secondary/30 focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-2xl transition-all font-bold text-[15px]"
                                            required
                                        />
                                        <Lock className="absolute left-4.5 top-4.5 h-5 w-5 text-muted-foreground/60 transition-colors group-focus-within:text-secondary" />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4.5 top-4.5 text-muted-foreground/40 hover:text-secondary transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-15 bg-secondary hover:bg-secondary/95 text-white font-black text-[16px] tracking-wide rounded-[20px] shadow-[0_12px_36px_rgba(239,68,68,0.25)] transition-all hover:translate-y-[-2px] active:translate-y-0.5"
                                >
                                    {isLoading ? "Submitting Registration..." : (
                                        <div className="flex items-center justify-center gap-2">
                                            Request Portal Initiation <CheckCircle2 className="h-5 w-5" />
                                        </div>
                                    )}
                                </Button>

                                <p className="text-[10px] text-center text-muted-foreground font-semibold px-10 leading-relaxed">
                                    Administrative requests are processed within 24-48 hours by the PSCA Security Wing.
                                </p>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    <div className="mt-16 text-center">
                        <div className="flex items-center justify-center gap-4 text-muted-foreground/20">
                            <div className="h-px flex-1 bg-current" />

                            <div className="h-px flex-1 bg-current" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Internal Badge helper for the left pane
function Badge({ variant, className, children, ...props }: any) {
    return (
        <div
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}
