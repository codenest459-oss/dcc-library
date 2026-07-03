import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/my-loans")({
  head: () => ({ meta: [{ title: "My loans — ULMS" }] }),
  component: MyLoans,
});

function MyLoans() {
  const { user } = useAuth();
  const { data } = useQuery({
    enabled: !!user,
    queryKey: ["my-loans", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("borrow_records")
        .select("id, issued_at, due_at, returned_at, status, books(title)")
        .eq("user_id", user!.id)
        .order("issued_at", { ascending: false });
      return data ?? [];
    },
  });
  const active = data?.filter((r) => r.status === "active") ?? [];
  const history = data?.filter((r) => r.status !== "active") ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My loans</h1>
        <p className="text-sm text-muted-foreground">Your current and past borrowed books.</p>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <Card>
            <CardHeader><CardTitle className="text-base">Active loans</CardTitle></CardHeader>
            <CardContent>
              {active.length === 0 ? (
                <EmptyState icon={BookOpen} title="No active loans" description="Ask the librarian to issue a book." />
              ) : (
                <LoanTable rows={active} showReturn={false} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState icon={BookOpen} title="No history yet" />
              ) : (
                <LoanTable rows={history} showReturn />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoanTable({ rows, showReturn }: { rows: any[]; showReturn: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Issued</TableHead>
          <TableHead>Due</TableHead>
          {showReturn && <TableHead>Returned</TableHead>}
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const overdue = r.status === "active" && new Date(r.due_at) < new Date();
          return (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.books?.title}</TableCell>
              <TableCell>{format(new Date(r.issued_at), "MMM d, yyyy")}</TableCell>
              <TableCell className={overdue ? "text-destructive" : ""}>
                {format(new Date(r.due_at), "MMM d, yyyy")}
              </TableCell>
              {showReturn && <TableCell>{r.returned_at ? format(new Date(r.returned_at), "MMM d, yyyy") : "—"}</TableCell>}
              <TableCell>
                <Badge variant={overdue ? "destructive" : r.status === "returned" ? "default" : "secondary"} className="capitalize">
                  {overdue ? "overdue" : r.status}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
