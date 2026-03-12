import { Bell, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme.ts";

export function Header({ title }: { title: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-14 sm:h-16 items-center gap-3 sm:gap-4 border-b bg-card/50 backdrop-blur px-4 sm:px-6 sticky top-0 z-40 min-w-0">
      <div className="flex items-center gap-3 md:gap-0 min-w-0">
        <div className="w-10 md:hidden" /> {/* Spacer for the fixed menu button on mobile */}
        <h1 className="text-sm sm:text-lg md:text-xl font-heading font-bold text-foreground truncate block">
          {title}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleTheme}
          className="relative"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
        </Button>
      </div>
    </header>
  );
}