import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { useSidebar } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  headerActions?: React.ReactNode;
}

export function Layout({ children, title = "Dashboard", headerActions }: LayoutProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background w-full overflow-x-hidden">
      <Sidebar />
      <div className={cn(
        "flex flex-col min-h-screen min-w-0 transition-all duration-300",
        isCollapsed ? "md:ml-16" : "md:ml-64"
      )}>
        <Header title={title} actions={headerActions} />
        <main className="flex-1 min-h-0 p-3 sm:p-6 space-y-4 sm:space-y-6 w-full max-w-[1600px] mx-auto min-w-0 box-border">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}