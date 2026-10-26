import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Shield,
  Activity,
  BarChart3,
  LucideBanknote,
  LayoutDashboard,
  Map as MapIcon,
  LogOut,
  MapPin,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Navigation2,
  Users,
  FolderKanban,
  UserCog,
  Plus,
  Eye,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useEffect, useMemo, useState } from "react";
import { useSidebar } from "@/contexts/SidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { getPermissionForPath } from "@/utils/permissionPaths";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  icon: any;
  label: string;
  href?: string;
  roles?: string[];
  subItems?: { label: string; href: string; icon: any }[];
}

const NAV_ITEMS: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/",
  },
  { icon: Users, label: "Stakeholders", href: "/stakeholder-management" },
  {
    icon: Navigation2,
    label: "Area Management",
    subItems: [
      { icon: MapPin, label: "Province", href: "/province-management" },
      { icon: MapPin, label: "Division", href: "/division-management" },
      { icon: MapPin, label: "District", href: "/district-management" },
      { icon: MapPin, label: "Tehsil", href: "/tehsil-management" },
    ],
  },
  {
    icon: FolderKanban,
    label: "Projects",
    subItems: [
      { icon: Plus, label: "Create New Project", href: "/project-management/create" },
      { icon: Eye, label: "View All Projects", href: "/project-management/view" },
    ],
  },
  // {
  //   icon: FolderKanban,
  //   label: "Project Activities",
  //   href: "/project-activity-management",
  // },
  { icon: LucideBanknote, label: "Finance & Budget", href: "/finance" },
  { icon: MapIcon, label: "GIS Layers", href: "/gis" },
  { icon: BarChart3, label: "Citywise Comparison", href: "/comparison" },
  {
    icon: UserCog,
    label: "User Management",
    href: "/user-management",
    roles: ["super_admin"],
  },
];

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { canView, canCreate, isSuperAdmin } = usePermissions();
  const userRole = user?.role?.trim().toLowerCase() ?? null;
  const {
    isCollapsed,
    toggleSidebar,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useSidebar();
  const [accordionValue, setAccordionValue] = useState<string | undefined>(
    undefined,
  );

  // Auto-open accordion if a sub-item is selected
  useEffect(() => {
    // Close the mobile drawer when navigating to a new route.
    setMobileSidebarOpen(false);

    const itemWithSelectedSub = NAV_ITEMS.find((item) =>
      item.subItems?.some((sub) => location === sub.href),
    );
    if (itemWithSelectedSub) {
      // Always keep open when a sub-item is selected
      setAccordionValue(itemWithSelectedSub.label);
    } else {
      // If no sub-item is selected, check if we should keep current state
      // Only reset if we're navigating away from all Area Management pages
      const isAnyAreaManagementPage = NAV_ITEMS.some((item) =>
        item.subItems?.some((sub) => location === sub.href),
      );
      if (!isAnyAreaManagementPage) {
        // User navigated away, allow accordion to be closed
        // But don't force close it - let user control it
      }
    }
  }, [location]);

  // Filter nav items: by role (e.g. super_admin for User Management) and by page can_view permission.
  // Users must not see sidebar links to pages they are not allowed to view.
  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      // Role-based: e.g. User Management only for super_admin
      if (item.roles && (!userRole || !item.roles.includes(userRole)))
        return false;
      // Single link (no subItems)
      if (item.href) {
        const perm = getPermissionForPath(item.href);
        if (!perm) return true; // no permission mapping = show (e.g. unknown path)
        if (isSuperAdmin) return true;
        return canView(perm.sidebar_label, perm.sub_label);
      }
      // Accordion with subItems (e.g. Area Management)
      if (item.subItems && item.subItems.length > 0) {
        const visibleSubs = item.subItems.filter((sub) => {
          const perm = getPermissionForPath(sub.href);
          if (!perm) return true;
          if (isSuperAdmin) return true;
          if (sub.href === "/project-management/create" && !canCreate("Project Management", "Create") && !canCreate("Project Management", null)) return false;
          return canView(perm.sidebar_label, perm.sub_label);
        });
        return visibleSubs.length > 0; // show parent only if at least one sub is visible
      }
      return true;
    }).map((item) => {
      // For items with subItems, only include the subItems the user can view
      if (item.subItems && item.subItems.length > 0) {
        const visibleSubs = item.subItems.filter((sub) => {
          const perm = getPermissionForPath(sub.href);
          if (!perm) return true;
          if (isSuperAdmin) return true;
          if (sub.href === "/project-management/create" && !canCreate("Project Management", "Create") && !canCreate("Project Management", null)) return false;
          return canView(perm.sidebar_label, perm.sub_label);
        });
        return { ...item, subItems: visibleSubs };
      }
      return item;
    });
  }, [userRole, canView, canCreate, isSuperAdmin]);

  const NavContent = ({ collapsed }: { collapsed: boolean }) => (
    <div className="flex h-full flex-col gap-4">
      <div
        className={cn(
          "flex h-16 items-center border-b border-white/10 transition-all duration-300",
          collapsed ? "px-3 justify-center" : "px-6 justify-between",
        )}
      >
        {!collapsed && (
          <Link
            href="/?view=divisions"
            className="flex items-center gap-3 font-heading font-bold text-2xl text-white tracking-wide"
          >
            <img
              src="/Assets/psca logo.png"
              alt="PSCA Logo"
              className="h-10 w-10 object-contain"
            />
            <div className="flex flex-col leading-none">
              <span>PSCA</span>
              <span className="text-[10px] text-white/50 font-medium tracking-tighter uppercase">
                Safe City Portal
              </span>
            </div>
          </Link>
        )}
        {collapsed && (
          <Link href="/?view=divisions" className="flex items-center justify-center">
            <img
              src="/Assets/psca logo.png"
              alt="PSCA Logo"
              className="h-10 w-10 object-contain"
            />
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
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex-1 overflow-auto py-2 scrollbar-hide">
        <nav
          className={cn(
            "grid items-start text-sm font-medium space-y-1 transition-all duration-300",
            collapsed ? "px-2" : "px-4",
          )}
        >
          {visibleNavItems.map((item) =>
            item.subItems ? (
              <TooltipProvider key={item.label}>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <div>
                      {collapsed ? (
                        <div
                          className={cn(
                            "flex items-center rounded-lg px-2 py-2 justify-center transition-all text-white/80 hover:bg-white/5 hover:text-white font-sans",
                            item.subItems.some((sub) => location === sub.href)
                              ? "bg-secondary text-white font-bold shadow-lg shadow-secondary/20"
                              : "",
                          )}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                        </div>
                      ) : (
                        <Accordion
                          type="single"
                          collapsible
                          className="w-full border-none"
                          value={
                            accordionValue === item.label
                              ? item.label
                              : undefined
                          }
                          onValueChange={(value) => {
                            // Check if a sub-item is currently selected
                            const hasSelectedSub = item.subItems?.some(
                              (sub) => location === sub.href,
                            );

                            if (hasSelectedSub && value === undefined) {
                              // User is trying to close, but we keep it open if sub-item is selected
                              setAccordionValue(item.label);
                            } else {
                              // Allow normal toggle behavior
                              setAccordionValue(value);
                            }
                          }}
                        >
                          <AccordionItem
                            value={item.label}
                            className="border-none"
                          >
                            <AccordionTrigger
                              className={cn(
                                "flex items-center rounded-lg px-3 py-2 gap-3 transition-all hover:bg-white/5 hover:no-underline text-white/80 hover:text-white [&[data-state=open]]:text-white font-sans tracking-normal",
                                item.subItems.some(
                                  (sub) => location === sub.href,
                                )
                                  ? "bg-secondary text-white font-bold shadow-lg shadow-secondary/20"
                                  : "[&[data-state=open]]:bg-white/5",
                              )}
                            >
                              <div className="flex items-center gap-3 font-medium">
                                <item.icon className="h-4 w-4 flex-shrink-0" />
                                <span>{item.label}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-1 pt-1">
                              <div className="flex flex-col gap-0.5 pl-4 ml-3 border-l border-white/10">
                                {item.subItems.map((sub) => (
                                  <Link
                                    key={sub.href}
                                    href={sub.href}
                                    className={cn(
                                      "flex items-center gap-3 rounded-md px-3 py-1.5 transition-all text-xs font-sans",
                                      location === sub.href
                                        ? "bg-secondary text-white font-bold shadow-lg shadow-secondary/20"
                                        : "text-white/60 hover:bg-white/5 hover:text-white font-medium",
                                    )}
                                  >
                                    <sub.icon className="h-3.5 w-3.5" />
                                    {sub.label}
                                  </Link>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </div>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right">
                      <div className="space-y-1">
                        <p className="font-semibold">{item.label}</p>
                        <div className="space-y-0.5">
                          {item.subItems.map((sub) => (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              className="block text-xs text-muted-foreground hover:text-foreground"
                            >
                              {sub.label}
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
                      <Link
                        href={item.label === "Dashboard" ? "/?view=divisions" : item.href!}
                        className={cn(
                          "flex items-center rounded-lg transition-all text-sm font-medium font-sans",
                          collapsed
                            ? "px-2 py-2 justify-center"
                            : "px-3 py-2 gap-3",
                          location === item.href
                            ? "bg-secondary text-white font-bold shadow-lg shadow-secondary/20"
                            : "text-white/80 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </div>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right">
                      <p>{item.label}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            ),
          )}
        </nav>
      </div>
      <div
        className={cn(
          "border-t border-white/10 mt-auto transition-all duration-300",
          collapsed ? "p-2" : "p-4",
        )}
      >
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div>
                <Link
                  href="/auth"
                  onClick={(e) => {
                    e.preventDefault();
                    void logout().then((confirmed) => {
                      if (confirmed) setLocation("/auth");
                      else toast({ title: "Sign-out was not completed", description: "The server could not confirm logout. You are still signed in; please retry.", variant: "destructive" });
                    });
                  }}
                  className={cn(
                    "flex items-center rounded-lg bg-white/5 p-3 hover:bg-white/10 transition-all group pointer-events-auto",
                    collapsed ? "justify-center" : "justify-between gap-3",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center",
                      collapsed ? "justify-center" : "gap-3",
                    )}
                  >
                    <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold border border-secondary/30 flex-shrink-0">
                      {user && (user.first_name || user.last_name)
                        ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase()
                        : "AD"}
                    </div>
                    {!collapsed && (
                      <div className="text-xs">
                        <p className="font-semibold text-white">
                          {user && (user.first_name || user.last_name)
                            ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
                            : "Admin Officer"}
                        </p>
                        <p className="text-white/40 group-hover:text-white/60 transition-colors capitalize">
                          {user?.role ? user.role.replace("_", " ") : "Command Center"}
                        </p>
                      </div>
                    )}
                  </div>
                  {!collapsed && (
                    <LogOut className="h-4 w-4 text-white/40 group-hover:text-white transition-colors" />
                  )}
                </Link>
              </div>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                <div className="text-xs">
                  <p className="font-semibold">
                    {user && (user.first_name || user.last_name)
                      ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
                      : "Admin Officer"}
                  </p>
                  <p className="text-muted-foreground capitalize">
                    {user?.role ? user.role.replace("_", " ") : "Command Center"}
                  </p>
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
      <div
        className={cn(
          "hidden border-r bg-sidebar md:block fixed inset-y-0 left-0 z-30 shadow-2xl transition-all duration-300",
          isCollapsed ? "w-16" : "w-64",
        )}
      >
        <NavContent collapsed={isCollapsed} />
      </div>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-none">
          <NavContent collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}
