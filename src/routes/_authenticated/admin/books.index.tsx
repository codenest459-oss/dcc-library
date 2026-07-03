import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, BookOpen, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/admin/books")({
  head: () => ({ meta: [{ title: "Books — DCCLMS Admin" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const list = (roles ?? []).map((r) => r.role);
    if (!list.includes("admin") && !list.includes("librarian")) throw redirect({ to: "/dashboard" });
  },
  component: BooksAdmin,
});

function BooksAdmin() {
  const { data } = useQuery({
    queryKey: ["admin-books"],
    queryFn: async () => {
      const { data } = await supabase
        .from("books")
        .select("id, title, isbn, shelf_number, categories(name), book_copies(id, status)")
        .order("title")
        .limit(500);
      return (data ?? []).map((b) => {
        const total = b.book_copies?.length ?? 0;
        const avail = b.book_copies?.filter((c) => c.status === "available").length ?? 0;
        return { ...b, total, avail };
      });
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Books</h1>
          <p className="text-sm text-muted-foreground">Manage the library catalog.</p>
        </div>
        <Link to="/admin/books/new"><Button><Plus className="mr-2 h-4 w-4" /> Add book</Button></Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {!data?.length ? (
            <EmptyState icon={BookOpen} title="No books yet" description="Add your first book to the catalog." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>ISBN</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Shelf</TableHead>
                  <TableHead>Copies</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.title}</TableCell>
                    <TableCell className="font-mono text-xs">{b.isbn ?? "—"}</TableCell>
                    <TableCell>{b.categories?.name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{b.shelf_number ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{b.avail}/{b.total}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to="/admin/books/$bookId/edit" params={{ bookId: b.id }}>
                        <Button variant="ghost" size="sm"><Pencil className="mr-1 h-3 w-3" /> Edit</Button>
                      </Link>
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
