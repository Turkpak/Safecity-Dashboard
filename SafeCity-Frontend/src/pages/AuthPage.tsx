import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Lock,
    Mail,
    ArrowRight,
    Eye,
    EyeOff,
    Map as MapIcon,
    TrendingUp,
    BarChart3,
    ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import {
    getCaptcha,
    getCurrentUser,
    login as apiLogin,
} from "@/api/auth";


export default function AuthPage() {
    const [, setLocation] = useLocation();
    const { setUser } = useAuth();
    const { toast } = useToast();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [captchaKey, setCaptchaKey] = useState("");
    const [captchaImage, setCaptchaImage] = useState("");
    const [captchaValue, setCaptchaValue] = useState("");
    const [captchaError, setCaptchaError] = useState("");
    const [isCaptchaLoading, setIsCaptchaLoading] = useState(true);


    const loadCaptcha = useCallback(async () => {
        try {
            setIsCaptchaLoading(true);

            const captcha = await getCaptcha();

            setCaptchaKey(captcha.key);
            setCaptchaImage(captcha.image_url);
            setCaptchaValue("");
            setCaptchaError("");
        } catch {
            setCaptchaKey("");
            setCaptchaImage("");
            setCaptchaValue("");
            setCaptchaError("Unable to load CAPTCHA. Use refresh to try again.");
            toast({
                title: "CAPTCHA error",
                description: "Unable to load security verification.",
                variant: "destructive",
            });
        } finally {
            setIsCaptchaLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadCaptcha();
    }, [loadCaptcha]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!captchaKey || !captchaValue.trim()) {
            toast({
                title: "CAPTCHA required",
                description: "Please enter the characters shown in the CAPTCHA.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        try {
            await apiLogin({
                email,
                password,
                captcha_key: captchaKey,
                captcha_value: captchaValue,
            });

            const currentUser = await getCurrentUser();
            if (!currentUser) {
                throw new Error("Login succeeded, but the session could not be verified.");
            }

            setUser(currentUser);
            // Always enter the dashboard at the clean root Division view after login.
            // This intentionally clears any previous hierarchy drill-down query parameters.
            setLocation("/?view=divisions");

            toast({
                title: "Welcome",
                description: "Login successful.",
            });
        } catch (err) {
            toast({
                title: "Login failed",
                description: err instanceof ApiError && err.status === 429
                    ? "Too many login attempts. Please wait before trying again."
                    : err instanceof ApiError && err.status === 403
                    ? "Login security check failed. Refresh the page and retry."
                    : err instanceof ApiError && err.status >= 500
                    ? "Sign-in is temporarily unavailable. Please try again later."
                    : err instanceof ApiError && err.status === 400
                    ? "Please check your credentials and the CAPTCHA, then try again."
                    : "Login failed. Check your credentials and CAPTCHA.",
                variant: "destructive",
            });

            // Get a fresh CAPTCHA after every failed login
            await loadCaptcha();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white font-sans overflow-x-hidden overflow-y-auto">
            {/* LEFT SIDE: Project Information & Progress "Advertisement" Panel — stacks above form on mobile */}
            <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "circOut" }}
                className="flex w-full lg:w-[55%] bg-primary relative overflow-hidden flex-col justify-between p-6 sm:p-10 lg:p-16 text-white shrink-0"
            >
                {/* Visual Background Noise */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-white/5 blur-[120px]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/15 blur-[100px]" />
                    <div className="absolute inset-0 bg-grid-pattern opacity-[0.07] [mask-image:radial-gradient(ellipse_at_center,black_70%,transparent_100%)]" />
                </div>

                {/* Top Branding Section — visible on all screen sizes */}
                <div className="relative z-10 flex items-center gap-3 sm:gap-5">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center p-2 sm:p-3 shadow-[0_0_40px_rgba(255,255,255,0.15)] flex-shrink-0"
                    >
                        <img src="/Assets/psca logo.png" alt="PSCA" className="h-full w-full object-contain" />
                    </motion.div>
                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-xl lg:text-2xl font-heading font-bold tracking-tight text-white">Punjab Safe Cities Authority</h1>
                        <p className="text-secondary font-bold text-[10px] sm:text-[11px] uppercase tracking-[0.25em]">Project Progress Monitoring</p>
                    </div>
                </div>

                {/* MOBILE: compact — slogan only, centered */}
                <div className="relative z-10 flex flex-1 items-center justify-center text-center lg:hidden">
                    <motion.div
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.7 }}
                        className="max-w-xl w-full mt-8 sm:mt-12"
                    >
                        <h2 className="text-3xl sm:text-4xl font-heading font-bold leading-[1.05] tracking-tight">
                            Smart Governance. <br />
                            <span className="text-secondary italic">Secure</span> Communities.
                        </h2>
                    </motion.div>
                </div>

                {/* DESKTOP (lg+): full content — slogan, paragraph, four points */}
                <div className="relative z-10 hidden lg:block max-w-xl flex-1">
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

                {/* Footer */}
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
                    {/* Mobile/tablet: compact header when left panel is stacked above (logo lives in left panel); keeps form title visible */}
                    <div className="lg:hidden flex flex-col items-center mb-8 text-center">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="h-14 w-14 bg-primary/10 border-2 border-primary/20 rounded-2xl flex items-center justify-center p-2.5 shadow-sm mb-3"
                        >
                            <img src="/Assets/psca logo.png" alt="PSCA" className="h-full w-full object-contain" />
                        </motion.div>
                        <h1 className="text-xl font-heading font-bold text-primary tracking-tight">PSCA Safe City</h1>
                        <p className="text-secondary font-bold text-[10px] uppercase tracking-[0.25em] mt-1">Project Progress Monitoring</p>
                    </div>

                    <div className="mb-12">
                        <div className="space-y-2">
                            <motion.h2
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-4xl font-heading font-black text-primary tracking-tight"
                            >
                                Official Login
                            </motion.h2>
                            <p className="text-muted-foreground font-semibold text-sm">
                                Secure entrance for authorized monitoring personnel.
                            </p>
                        </div>
                    </div>

                    <div className="mb-8 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm font-medium text-primary/80">
                        Accounts are created by authorized administrators. Contact your superadmin if you need access.
                    </div>

                    <motion.form
                        initial={{ x: 30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.4, ease: "circOut" }}
                        onSubmit={handleSubmit}
                        className="space-y-7"
                    >
                        <div className="space-y-5">
                            <div className="space-y-2.5">
                                <Label htmlFor="email" className="text-[11px] font-black uppercase tracking-widest text-primary/60 ml-1">Email</Label>
                                <div className="relative group">
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="admin@psca.gov.pk"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-12 h-14 bg-muted/5 border-2 border-muted/50 hover:border-primary/30 focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-2xl transition-all font-bold text-[15px]"
                                        required
                                    />
                                    <Mail className="absolute left-4.5 top-4.5 h-5 w-5 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <Label htmlFor="password" className="text-[11px] font-black uppercase tracking-widest text-primary/60">Password</Label>
                                <div className="relative group">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
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

                        <div className="space-y-2.5">
                            <Label
                                htmlFor="captcha"
                                className="text-[11px] font-black uppercase tracking-widest text-primary/60 ml-1"
                            >
                                Security Verification
                            </Label>

                            <div className="flex items-center gap-3">
                                {isCaptchaLoading ? (
                                    <div className="h-14 w-[180px] rounded-xl border-2 border-muted/50 flex items-center justify-center text-sm text-muted-foreground">
                                        Loading...
                                    </div>
                                ) : captchaImage ? (
                                    <img
                                        src={captchaImage}
                                        alt="CAPTCHA"
                                        className="h-14 w-[180px] rounded-xl border-2 border-muted/50 bg-white object-contain"
                                    />
                                ) : (
                                    <div
                                        role="status"
                                        className="h-14 w-[180px] rounded-xl border-2 border-muted/50 flex items-center justify-center px-2 text-center text-xs text-destructive"
                                    >
                                        {captchaError || "CAPTCHA unavailable"}
                                    </div>
                                )}

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={loadCaptcha}
                                    disabled={isCaptchaLoading}
                                    className="h-14 rounded-xl px-4"
                                >
                                    ↻
                                </Button>
                            </div>

                            <Input
                                id="captcha"
                                type="text"
                                placeholder="Enter the characters shown above"
                                value={captchaValue}
                                onChange={(e) => setCaptchaValue(e.target.value)}
                                className="h-14 bg-muted/5 border-2 border-muted/50 hover:border-primary/30 focus:border-primary focus:ring-4 focus:ring-primary/5 rounded-2xl transition-all font-bold text-[15px]"
                                autoComplete="off"
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading || !captchaKey || !captchaValue.trim()}
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
