import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Library,
  Receipt,
  AlertCircle,
  Users,
  ClipboardList,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ULMS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, primaryRole, fullName, roles } = useAuth();
  const isStaff = roles.includes("admin") || roles.includes("librarian");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}.
        </h1>
        <p className="text-sm text-muted-foreground">
          {isStaff
            ? "Here's a snapshot of library activity."
            : "Here's a snapshot of your library account."}
        </p>
      </div>

      {isStaff ? <StaffStats /> : <MemberStats userId={user!.id} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {isStaff ? <RecentLoans /> : <MyActiveLoans userId={user!.id} />}
        <PopularBooks />
      </div>

      {primaryRole && (
        <div className="text-xs text-muted-foreground">
          Signed in as <Badge variant="outline">{primaryRole}</Badge>
        </div>
      )}
    </div>
  );
}

function StaffStats() {
  const { data } = useQuery({
    queryKey: ["staff-stats"],
    queryFn: async () => {
      const [books, copies, borrowed, overdue, activeLoans, fines, students] = await Promise.all([
        supabase.from("books").select("id", { count: "exact", head: true }),
        supabase.from("book_copies").select("id", { count: "exact", head: true }),
        supabase.from("book_copies").select("id", { count: "exact", head: true }).eq("status", "borrowed"),
        supabase
          .from("borrow_records")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .lt("due_at", new Date().toISOString()),
        supabase.from("borrow_records").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("fines").select("amount").eq("status", "unpaid"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).in("role", ["student", "faculty"]),
      ]);
      const totalFines = (fines.data ?? []).reduce((s, f) => s + Number(f.amount), 0);
      return {
        totalBooks: books.count ?? 0,
        totalCopies: copies.count ?? 0,
        available: (copies.count ?? 0) - (borrowed.count ?? 0),
        overdue: overdue.count ?? 0,
        activeLoans: activeLoans.count ?? 0,
        totalFines,
        members: students.count ?? 0,
      };
    },
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total titles" value={data?.totalBooks ?? "—"} icon={BookOpen} />
      <StatCard label="Available copies" value={data?.available ?? "—"} icon={Library} tone="success" />
      <StatCard label="Active loans" value={data?.activeLoans ?? "—"} icon={ClipboardList} />
      <StatCard label="Overdue" value={data?.overdue ?? "—"} icon={AlertCircle} tone="destructive" />
      <StatCard label="Members" value={data?.members ?? "—"} icon={Users} />
      <StatCard label="Unpaid fines" value={data ? data.totalFines.toFixed(2) : "—"} icon={Receipt} tone="warning" />
    </div>
  );
}

function MemberStats({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["my-stats", userId],
    queryFn: async () => {
      const [active, history, fines] = await Promise.all([
        supabase.from("borrow_records").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active"),
        supabase.from("borrow_records").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("fines").select("amount").eq("user_id", userId).eq("status", "unpaid"),
      ]);
      const unpaid = (fines.data ?? []).reduce((s, f) => s + Number(f.amount), 0);
      return {
        active: active.count ?? 0,
        history: history.count ?? 0,
        unpaid,
      };
    },
  });
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Active loans" value={data?.active ?? "—"} icon={BookOpen} />
      <StatCard label="Total borrows" value={data?.history ?? "—"} icon={ClipboardList} />
      <StatCard label="Unpaid fines" value={data ? data.unpaid.toFixed(2) : "—"} icon={Receipt} tone="warning" />
    </div>
  );
}

function MyActiveLoans({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["my-active-loans", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("borrow_records")
        .select("id, due_at, books(title)")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("due_at", { ascending: true })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Your active loans</CardTitle>
        <Link to="/my-loans"><Button variant="ghost" size="sm">View all</Button></Link>
      </CardHeader>
      <CardContent>
        {!data?.length ? (
          <EmptyState icon={BookOpen} title="No active loans" description="Browse the catalog to borrow." />
        ) : (
          <ul className="divide-y">
            {data.map((r) => {
              const overdue = new Date(r.due_at) < new Date();
              return (
                <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium">{r.books?.title}</span>
                  <span className={overdue ? "text-destructive" : "text-muted-foreground"}>
                    <Clock className="mr-1 inline h-3 w-3" />
                    Due {format(new Date(r.due_at), "MMM d")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentLoans() {
  const { data } = useQuery({
    queryKey: ["recent-loans"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("borrow_records")
        .select("id, issued_at, status, user_id, books(title)")
        .order("issued_at", { ascending: false })
        .limit(6);
      const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
        : { data: [] as { id: string; full_name: string | null }[] };
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return (rows ?? []).map((r) => ({ ...r, borrower: nameMap.get(r.user_id) ?? "—" }));
    },
  });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recent activity</CardTitle>
        <Link to="/admin/loans"><Button variant="ghost" size="sm">Manage</Button></Link>
      </CardHeader>
      <CardContent>
        {!data?.length ? (
          <EmptyState icon={ClipboardList} title="No loans yet" />
        ) : (
          <ul className="divide-y">
            {data.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{r.books?.title}</span>
                  <span className="text-xs text-muted-foreground">
                    to {r.borrower} · {format(new Date(r.issued_at), "MMM d")}
                  </span>
                </div>
                <Badge variant="outline" className="capitalize">{r.status === "returned" ? <><CheckCircle2 className="mr-1 h-3 w-3" /> {r.status}</> : r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PopularBooks() {
  const { data } = useQuery({
    queryKey: ["popular-books"],
    queryFn: async () => {
      const { data } = await supabase
        .from("borrow_records")
        .select("book_id, books(title, cover_url)")
        .limit(200);
      const counts = new Map<string, { title: string; count: number }>();
      (data ?? []).forEach((r) => {
        if (!r.books) return;
        const cur = counts.get(r.book_id) ?? { title: r.books.title, count: 0 };
        cur.count += 1;
        counts.set(r.book_id, cur);
      });
      return Array.from(counts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([id, v]) => ({ id, ...v }));
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Popular books</CardTitle>
      </CardHeader>
      <CardContent>
        {!data?.length ? (
          <EmptyState icon={Library} title="Not enough data yet" />
        ) : (
          <ul className="divide-y">
            {data.map((b, i) => (
              <li key={b.id} className="flex items-center justify-between py-3 text-sm">
                <span>
                  <span className="mr-2 text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                  {b.title}
                </span>
                <span className="text-xs text-muted-foreground">{b.count} loans</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
