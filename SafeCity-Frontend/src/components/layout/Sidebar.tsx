import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Shield,
  Activity,
  BarChart3,
  LucideBanknote,
  LayoutDashboard,
  Map as MapIcon,
  Settings,
  Menu,
  LogOut,
  MapPin,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Navigation2,
  Users,
  FolderKanban
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useEffect, useState } from "react";
import { useSidebar } from "@/contexts/SidebarContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  icon: any;
  label: string;
  href?: string;
  roles?: string[];
  subItems?: { label: string; href: string; icon: any }[];
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Citywise Progress", href: "/" },
  { icon: BarChart3, label: "City Comparison", href: "/comparison" },
  { icon: LucideBanknote, label: "Finance & Budget", href: "/finance" },
  { icon: MapIcon, label: "GIS Layers", href: "/gis" },
  {
    icon: Navigation2,
    label: "Area Management",
    subItems: [
      { icon: MapPin, label: "Province", href: "/province-management" },
      { icon: MapPin, label: "Division", href: "/division-management" },
      { icon: MapPin, label: "District", href: "/district-management" },
      { icon: MapPin, label: "Tehsil", href: "/tehsil-management" },
    ]
  },
  { icon: FolderKanban, label: "Project Management", href: "/project-management" },
  { icon: Users, label: "Stakeholders", href: "/stakeholder-management" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const [location] = useLocation();
  const [userRole, setUserRole] = useState<string | null>(null);
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [accordionValue, setAccordionValue] = useState<string | undefined>(undefined);

  useEffect(() => {
    setUserRole(localStorage.getItem("userRole"));
  }, []);

  // Auto-open accordion if a sub-item is selected
  useEffect(() => {
    const itemWithSelectedSub = NAV_ITEMS.find(item => 
      item.subItems?.some(sub => location === sub.href)
    );
    if (itemWithSelectedSub) {
      // Always keep open when a sub-item is selected
      setAccordionValue(itemWithSelectedSub.label);
    } else {
      // If no sub-item is selected, check if we should keep current state
      // Only reset if we're navigating away from all Area Management pages
      const isAnyAreaManagementPage = NAV_ITEMS.some(item =>
        item.subItems?.some(sub => location === sub.href)
      );
      if (!isAnyAreaManagementPage) {
        // User navigated away, allow accordion to be closed
        // But don't force close it - let user control it
      }
    }
  }, [location]);

  const visibleNavItems = NAV_ITEMS.filter(item =>
    !item.roles || (userRole && item.roles.includes(userRole))
  );

  const NavContent = () => (
    <div className="flex h-full flex-col gap-4">
      <div className={cn(
        "flex h-16 items-center border-b border-white/10 transition-all duration-300",
        isCollapsed ? "px-3 justify-center" : "px-6 justify-between"
      )}>
        {!isCollapsed && (
          <Link href="/">
            <a className="flex items-center gap-3 font-heading font-bold text-2xl text-white tracking-wide">
              <img
                src="/Assets/psca logo.png"
                alt="PSCA Logo"
                className="h-10 w-10 object-contain"
              />
              <div className="flex flex-col leading-none">
                <span>PSCA</span>
                <span className="text-[10px] text-white/50 font-medium tracking-tighter uppercase">Safe City Portal</span>
              </div>
            </a>
          </Link>
        )}
        {isCollapsed && (
          <Link href="/">
            <a className="flex items-center justify-center">
              <img
                src="/Assets/psca logo.png"
                alt="PSCA Logo"
                className="h-10 w-10 object-contain"
              />
            </a>
          </Link>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 hidden md:flex"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{isCollapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex-1 overflow-auto py-2 scrollbar-hide">
        <nav className={cn(
          "grid items-start text-sm font-medium space-y-1 transition-all duration-300",
          isCollapsed ? "px-2" : "px-4"
        )}>
          {visibleNavItems.map((item) => (
            item.subItems ? (
              <TooltipProvider key={item.label}>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <div>
                      {isCollapsed ? (
                        <div className={cn(
                          "flex items-center rounded-lg px-2 py-2 justify-center transition-all text-white/80 hover:bg-white/5 hover:text-white font-sans",
                          item.subItems.some(sub => location === sub.href)
                            ? "bg-secondary text-white font-bold shadow-lg shadow-secondary/20"
                            : ""
                        )}>
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                        </div>
                      ) : (
                        <Accordion 
                          type="single" 
                          collapsible 
                          className="w-full border-none"
                          value={accordionValue === item.label ? item.label : undefined}
                          onValueChange={(value) => {
                            // Check if a sub-item is currently selected
                            const hasSelectedSub = item.subItems?.some(sub => location === sub.href);
                            
                            if (hasSelectedSub && value === undefined) {
                              // User is trying to close, but we keep it open if sub-item is selected
                              setAccordionValue(item.label);
                            } else {
                              // Allow normal toggle behavior
                              setAccordionValue(value);
                            }
                          }}
                        >
                          <AccordionItem value={item.label} className="border-none">
                            <AccordionTrigger className={cn(
                              "flex items-center rounded-lg px-3 py-2 gap-3 transition-all hover:bg-white/5 hover:no-underline text-white/80 hover:text-white [&[data-state=open]]:text-white font-sans tracking-normal",
                              item.subItems.some(sub => location === sub.href)
                                ? "bg-secondary text-white font-bold shadow-lg shadow-secondary/20"
                                : "[&[data-state=open]]:bg-white/5"
                            )}>
                              <div className="flex items-center gap-3 font-medium">
                                <item.icon className="h-4 w-4 flex-shrink-0" />
                                <span>{item.label}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-1 pt-1">
                              <div className="flex flex-col gap-0.5 pl-4 ml-3 border-l border-white/10">
                                {item.subItems.map((sub) => (
                                  <Link key={sub.href} href={sub.href}>
                                    <a
                                      className={cn(
                                        "flex items-center gap-3 rounded-md px-3 py-1.5 transition-all text-xs font-sans",
                                        location === sub.href
                                          ? "bg-secondary text-white font-bold shadow-lg shadow-secondary/20"
                                          : "text-white/60 hover:bg-white/5 hover:text-white font-medium"
                                      )}
                                    >
                                      <sub.icon className="h-3.5 w-3.5" />
                                      {sub.label}
                                    </a>
                                  </Link>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </div>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">
                      <div className="space-y-1">
                        <p className="font-semibold">{item.label}</p>
                        <div className="space-y-0.5">
                          {item.subItems.map((sub) => (
                            <Link key={sub.href} href={sub.href}>
                              <a className="block text-xs text-muted-foreground hover:text-foreground">
                                {sub.label}
                              </a>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider key={item.href}>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <div>
                      <Link href={item.href!}>
                        <a
                          className={cn(
                            "flex items-center rounded-lg transition-all text-sm font-medium font-sans",
                            isCollapsed ? "px-2 py-2 justify-center" : "px-3 py-2 gap-3",
                            location === item.href
                              ? "bg-secondary text-white font-bold shadow-lg shadow-secondary/20"
                              : "text-white/80 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          {!isCollapsed && <span>{item.label}</span>}
                        </a>
                      </Link>
                    </div>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">
                      <p>{item.label}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )
          ))}
        </nav>
      </div>
      <div className={cn(
        "border-t border-white/10 mt-auto transition-all duration-300",
        isCollapsed ? "p-2" : "p-4"
      )}>
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div>
                <Link href="/auth">
                  <a
                    onClick={() => localStorage.removeItem("userRole")}
                    className={cn(
                      "flex items-center rounded-lg bg-white/5 p-3 hover:bg-white/10 transition-all group pointer-events-auto",
                      isCollapsed ? "justify-center" : "justify-between gap-3"
                    )}
                  >
                    <div className={cn(
                      "flex items-center",
                      isCollapsed ? "justify-center" : "gap-3"
                    )}>
                      <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold border border-secondary/30 flex-shrink-0">
                        {userRole === "Client" ? "CL" : "AD"}
                      </div>
                      {!isCollapsed && (
                        <div className="text-xs">
                          <p className="font-semibold text-white">{userRole === "Client" ? "Client Authority" : "Admin Officer"}</p>
                          <p className="text-white/40 group-hover:text-white/60 transition-colors">{userRole === "Client" ? "Governance Wing" : "Command Center"}</p>
                        </div>
                      )}
                    </div>
                    {!isCollapsed && <LogOut className="h-4 w-4 text-white/40 group-hover:text-white transition-colors" />}
                  </a>
                </Link>
              </div>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                <div className="text-xs">
                  <p className="font-semibold">{userRole === "Client" ? "Client Authority" : "Admin Officer"}</p>
                  <p className="text-muted-foreground">{userRole === "Client" ? "Governance Wing" : "Command Center"}</p>
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );

  return (
    <>
      <div className={cn(
        "hidden border-r bg-sidebar md:block fixed inset-y-0 left-0 z-30 shadow-2xl transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}>
        <NavContent />
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden fixed top-4 left-4 z-50 bg-card">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-none">
          <NavContent />
        </SheetContent>
      </Sheet>
    </>
  );
}