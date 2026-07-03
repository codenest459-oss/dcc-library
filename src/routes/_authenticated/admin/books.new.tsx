import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { BookForm } from "@/components/book-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/books/new")({
  head: () => ({ meta: [{ title: "New book — DCCLMS Admin" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const list = (roles ?? []).map((r) => r.role);
    if (!list.includes("admin") && !list.includes("librarian")) throw redirect({ to: "/dashboard" });
  },
  component: NewBook,
});

function NewBook() {
  const navigate = useNavigate();
  return (
    <BookForm
      mode="create"
      onSubmitAction={async (values, copiesToAdd) => {
        const { data: book, error } = await supabase
          .from("books")
          .insert({
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
          .select("id")
          .single();
        if (error) throw error;
        // Add copies
        if (copiesToAdd > 0) {
          const rows = Array.from({ length: copiesToAdd }).map((_, i) => ({
            book_id: book.id,
            barcode: `${(values.isbn || book.id.slice(0, 6)).toUpperCase()}-${Date.now()}-${i + 1}`,
          }));
          await supabase.from("book_copies").insert(rows);
        }
        toast.success("Book created");
        navigate({ to: "/admin/books" });
      }}
    />
  );
}
