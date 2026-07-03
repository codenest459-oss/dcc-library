import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Bell } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppRole } from "@/lib/use-auth";

const roleColor: Record<AppRole, string> = {
  admin: "bg-primary text-primary-foreground",
  librarian: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  faculty: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  student: "bg-muted text-muted-foreground border-border",
};

export function AppHeader({
  primaryRole,
  fullName,
  email,
}: {
  primaryRole: AppRole | null;
  fullName: string | null;
  email: string | null;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: unread } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const initials = (fullName ?? email ?? "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur px-4">
      <SidebarTrigger />
      <div className="flex-1" />
      {primaryRole && (
        <Badge variant="outline" className={roleColor[primaryRole]}>
          {primaryRole}
        </Badge>
      )}
      <ThemeToggle />
      <Link to="/notifications" aria-label="Notifications">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {(unread ?? 0) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground px-1">
              {unread}
            </span>
          )}
        </Button>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {initials}
            </span>
            <span className="hidden text-sm md:inline">{fullName ?? email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{fullName ?? "Account"}</span>
              <span className="text-xs text-muted-foreground">{email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/profile">Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
