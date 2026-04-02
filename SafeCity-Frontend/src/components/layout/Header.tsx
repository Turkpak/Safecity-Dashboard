import { Bell, Sun, Moon, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme.ts";
import { useSidebar } from "@/contexts/SidebarContext";

export function Header({ title }: { title: string }) {
  const { theme, toggleTheme } = useTheme();
  const { setMobileSidebarOpen } = useSidebar();

  return (
    <header className="flex h-16 sm:h-16 items-center border-b bg-card/50 backdrop-blur px-4 sm:px-6 sticky top-0 z-40 min-w-0">
      <div className="grid w-full grid-cols-3 items-center">
        <div className="flex items-center">
          <Button
            variant="outline"
            size="icon"
            className="md:hidden h-8 w-8 bg-card/90 backdrop-blur-sm transform-none"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        <h1
          className="col-start-2 text-center text-xl sm:text-xl md:text-2xl lg:text-2xl font-heading font-bold text-foreground break-words leading-tight block
          md:col-start-1 md:col-span-2 md:text-left whitespace-normal"
        >
          {title}
        </h1>

        <div className="col-start-3 justify-self-end hidden md:flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="relative"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
          </Button>
        </div>
      </div>
    </header>
  );
}