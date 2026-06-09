import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Calculator, ScrollText, Search, Palette, Command as CommandIcon } from "lucide-react";
import { useState } from "react";
import { useGradeway } from "@/lib/gradeway/store";
import { LoginModal } from "./LoginModal";
import { CommandSearch } from "./CommandSearch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calculator", label: "Calculator", icon: Calculator },
  { to: "/transcript", label: "Transcript", icon: ScrollText },
] as const;

export function AppShell() {
  const { studentName, theme, setTheme } = useGradeway();
  const [cmdOpen, setCmdOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen flex">
      <LoginModal />
      <CommandSearch open={cmdOpen} onOpenChange={setCmdOpen} />
      <aside className="hidden lg:flex w-64 shrink-0 flex-col p-4 sticky top-0 h-screen">
        <div className="glass flex flex-1 flex-col p-4">
          <Link to="/" className="flex items-center gap-2 px-2 py-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent glow-primary" />
            <div>
              <div className="text-lg font-bold tracking-tight">Gradeway</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">HAC Premium</div>
            </div>
          </Link>
          <nav className="mt-6 space-y-1">
            {nav.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                    active ? "bg-gradient-to-r from-primary/20 to-accent/10 text-foreground border border-white/10" : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3">
            <button onClick={() => setCmdOpen(true)} className="flex w-full items-center justify-between rounded-xl border border-border bg-white/5 px-3 py-2 text-xs text-muted-foreground hover:bg-white/10">
              <span className="inline-flex items-center gap-2"><Search className="h-3.5 w-3.5" />Search</span>
              <kbd className="inline-flex items-center gap-1 rounded border border-border bg-black/20 px-1.5 py-0.5 font-mono text-[10px]"><CommandIcon className="h-3 w-3" />K</kbd>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
                  <Palette className="h-4 w-4" /> Theme
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-strong">
                <DropdownMenuLabel>Aesthetic</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["obsidian", "slate", "matrix"] as const).map((t) => (
                  <DropdownMenuItem key={t} onClick={() => setTheme(t)}>
                    <span className={cn("mr-2 h-2 w-2 rounded-full", theme === t ? "bg-primary" : "bg-muted-foreground/40")} />
                    {t === "obsidian" ? "Obsidian Glow" : t === "slate" ? "Monochrome Slate" : "Matrix Green"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-white/5 px-3 py-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{studentName}</div>
                <div className="text-[10px] text-muted-foreground">Class of 2026</div>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}