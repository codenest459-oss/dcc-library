import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Shield, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAllUsers, assignRole, removeRole } from "@/lib/admin.functions";
import { EmptyState } from "@/components/empty-state";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users & Roles — DCCLMS Admin" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: UsersAdmin,
});

function UsersAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllUsers);
  const assignFn = useServerFn(assignRole);
  const removeFn = useServerFn(removeRole);

  const { data, isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => listFn(),
  });

  const assign = useMutation({
    mutationFn: assignFn,
    onSuccess: () => { toast.success("Role assigned"); qc.invalidateQueries({ queryKey: ["all-users"] }); },
    onError: (e: Error) => toast.error("Failed", { description: e.message }),
  });

  const rm = useMutation({
    mutationFn: removeFn,
    onSuccess: () => { toast.success("Role removed"); qc.invalidateQueries({ queryKey: ["all-users"] }); },
    onError: (e: Error) => toast.error("Failed", { description: e.message }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users & Roles</h1>
        <p className="text-sm text-muted-foreground">Assign roles to users. Every user starts as a student by default.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All users</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : !data?.length ? (
            <EmptyState icon={Users} title="No users yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Add role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.profile?.full_name ?? "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.created_at ? format(new Date(u.created_at), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                        {u.roles.map((r) => (
                          <Badge key={r} variant="outline" className="gap-1 capitalize">
                            {r === "admin" && <Shield className="h-3 w-3" />}
                            {r}
                            <button
                              className="ml-1 text-muted-foreground hover:text-foreground"
                              onClick={() => confirm(`Remove ${r}?`) && rm.mutate({ data: { user_id: u.id, role: r as any } })}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select onValueChange={(v) => assign.mutate({ data: { user_id: u.id, role: v as any } })}>
                        <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Assign" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="librarian">Librarian</SelectItem>
                          <SelectItem value="faculty">Faculty</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                        </SelectContent>
                      </Select>
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
