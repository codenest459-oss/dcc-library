import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookForm } from "@/components/book-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/books/$bookId/edit")({
  head: () => ({ meta: [{ title: "Edit book — DCCLMS Admin" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const list = (roles ?? []).map((r) => r.role);
    if (!list.includes("admin") && !list.includes("librarian")) throw redirect({ to: "/dashboard" });
  },
  component: EditBook,
});

function EditBook() {
  const { bookId } = Route.useParams();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["edit-book", bookId],
    queryFn: async () => {
      const { data } = await supabase.from("books").select("*").eq("id", bookId).maybeSingle();
      return data;
    },
  });

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const del = async () => {
    if (!confirm("Delete this book and all copies?")) return;
    const { error } = await supabase.from("books").delete().eq("id", bookId);
    if (error) return toast.error("Delete failed", { description: error.message });
    toast.success("Deleted");
    navigate({ to: "/admin/books" });
  };

  return (
    <div className="space-y-6">
      <BookForm
        mode="edit"
        initial={data}
        onSubmitAction={async (values, copiesToAdd) => {
          const { error } = await supabase
            .from("books")
            .update({
              title: values.title,
              subtitle: values.subtitle || null,
              isbn: values.isbn || null,
              edition: values.edition || null,
              language: values.language || "English",
              description: values.description || null,
              shelf_number: values.shelf_number || null,
              category_id: values.category_id || null,
              publisher_id: values.publisher_id || null,
              department_id: values.department_id || null,
            })
            .eq("id", bookId);
          if (error) throw error;
          if (copiesToAdd > 0) {
            const rows = Array.from({ length: copiesToAdd }).map((_, i) => ({
              book_id: bookId,
              barcode: `${(values.isbn || bookId.slice(0, 6)).toUpperCase()}-${Date.now()}-${i + 1}`,
            }));
            await supabase.from("book_copies").insert(rows);
          }
          toast.success("Book updated");
          navigate({ to: "/admin/books" });
        }}
      />
      <Card className="mx-auto max-w-2xl border-destructive/50">
        <CardHeader><CardTitle className="text-base text-destructive">Danger zone</CardTitle></CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={del}><Trash2 className="mr-2 h-4 w-4" /> Delete book</Button>
        </CardContent>
      </Card>
    </div>
  );
}
