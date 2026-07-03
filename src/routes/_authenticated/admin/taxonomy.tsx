import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/admin/taxonomy")({
  head: () => ({ meta: [{ title: "Taxonomy — DCCLMS Admin" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const list = (roles ?? []).map((r) => r.role);
    if (!list.includes("admin") && !list.includes("librarian")) throw redirect({ to: "/dashboard" });
  },
  component: Taxonomy,
});

function Taxonomy() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Taxonomy</h1>
        <p className="text-sm text-muted-foreground">Manage categories, authors, publishers, and departments.</p>
      </div>
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="authors">Authors</TabsTrigger>
          <TabsTrigger value="publishers">Publishers</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
        </TabsList>
        <TabsContent value="categories"><TableCrud table="categories" fields={["name", "slug"]} /></TabsContent>
        <TabsContent value="authors"><TableCrud table="authors" fields={["name"]} /></TabsContent>
        <TabsContent value="publishers"><TableCrud table="publishers" fields={["name"]} /></TabsContent>
        <TabsContent value="departments"><TableCrud table="departments" fields={["name", "code"]} /></TabsContent>
      </Tabs>
    </div>
  );
}

function TableCrud({ table, fields }: { table: "categories" | "authors" | "publishers" | "departments"; fields: string[] }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const { data } = useQuery({
    queryKey: [table],
    queryFn: async () => (await supabase.from(table).select("*").order("name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      for (const f of fields) if (!values[f]?.trim()) throw new Error(`${f} required`);
      const row: Record<string, string> = {};
      fields.forEach((f) => (row[f] = values[f].trim()));
      const { error } = await (supabase.from(table) as any).insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added");
      setValues({});
      qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: Error) => toast.error("Failed", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: [table] }); },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base capitalize">{table}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
        >
          {fields.map((f) => (
            <Input
              key={f}
              placeholder={f}
              value={values[f] ?? ""}
              onChange={(e) => setValues((s) => ({ ...s, [f]: e.target.value }))}
              className="w-48"
            />
          ))}
          <Button type="submit" disabled={add.isPending}><Plus className="mr-1 h-3 w-3" /> Add</Button>
        </form>

        {!data?.length ? (
          <EmptyState icon={Tags} title="Nothing yet" />
        ) : (
          <ul className="divide-y rounded-md border">
            {data.map((row: Record<string, unknown>) => (
              <li key={String(row.id)} className="flex items-center justify-between p-3 text-sm">
                <div className="flex gap-3">
                  {fields.map((f) => (
                    <span key={f}>{String(row[f] ?? "—")}</span>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => confirm("Delete?") && remove.mutate(String(row.id))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
