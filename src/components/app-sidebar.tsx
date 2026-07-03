import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  LayoutDashboard,
  Library,
  ClipboardList,
  Receipt,
  Bell,
  User,
  Users,
  Settings,
  Tags,
  ScrollText,
  ArrowLeftRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { AppRole } from "@/lib/use-auth";

export function AppSidebar({ roles }: { roles: AppRole[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (p: string) =>
    p === "/dashboard" ? pathname === p : pathname === p || pathname.startsWith(p + "/");
  const isStaff = roles.includes("admin") || roles.includes("librarian");
  const isAdmin = roles.includes("admin");

  const primary = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Catalog", url: "/catalog", icon: Library },
    { title: "My Loans", url: "/my-loans", icon: BookOpen },
    { title: "My Fines", url: "/my-fines", icon: Receipt },
    { title: "Notifications", url: "/notifications", icon: Bell },
    { title: "Profile", url: "/profile", icon: User },
  ];

  const staffItems = [
    { title: "Issue / Return", url: "/admin/loans", icon: ArrowLeftRight },
    { title: "Books", url: "/admin/books", icon: BookOpen },
    { title: "Taxonomy", url: "/admin/taxonomy", icon: Tags },
  ];

  const adminItems = [
    { title: "Users & Roles", url: "/admin/users", icon: Users },
    { title: "Audit Logs", url: "/admin/audit-logs", icon: ScrollText },
    { title: "Settings", url: "/admin/settings", icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Library className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">DCCLMS</span>
            <span className="text-xs text-muted-foreground">University Library</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Library</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isStaff && (
          <SidebarGroup>
            <SidebarGroupLabel>Staff</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {staffItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/">
                    <ClipboardList />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
