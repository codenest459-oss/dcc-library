import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/my-fines")({
  head: () => ({ meta: [{ title: "My fines — DCCLMS" }] }),
  component: MyFines,
});

function MyFines() {
  const { user } = useAuth();
  const { data } = useQuery({
    enabled: !!user,
    queryKey: ["my-fines", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("fines")
        .select("id, amount, reason, status, created_at, paid_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const unpaid = (data ?? []).filter((f) => f.status === "unpaid").reduce((s, f) => s + Number(f.amount), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My fines</h1>
        <p className="text-sm text-muted-foreground">
          You currently owe <span className="font-semibold text-foreground">{unpaid.toFixed(2)}</span>. Pay at the library desk.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All fines</CardTitle></CardHeader>
        <CardContent>
          {!data?.length ? (
            <EmptyState icon={Receipt} title="No fines" description="You're all clear." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.reason ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{Number(f.amount).toFixed(2)}</TableCell>
                    <TableCell>{format(new Date(f.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={f.status === "unpaid" ? "destructive" : "default"} className="capitalize">
                        {f.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
