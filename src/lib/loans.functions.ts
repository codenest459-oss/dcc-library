import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const issueSchema = z.object({
  copy_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

/**
 * Issue a book copy to a user. Callable by admin/librarian only.
 * Validates: user has no unpaid fines, is under the borrow limit for their role,
 * and the copy is currently available. Sets due_at based on system_settings and role.
 */
export const issueBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => issueSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Actor must be admin or librarian
    const { data: rolesRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const actorRoles = (rolesRow ?? []).map((r) => r.role);
    if (!actorRoles.includes("admin") && !actorRoles.includes("librarian")) {
      throw new Error("Only librarians or admins can issue books.");
    }

    // Load settings
    const { data: settings, error: sErr } = await supabase
      .from("system_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (sErr || !settings) throw new Error("Unable to load system settings.");

    // Recipient role
    const { data: recipientRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id);
    const rRoles = (recipientRoles ?? []).map((r) => r.role);
    const isFaculty = rRoles.includes("faculty");
    const loanLimit = isFaculty ? settings.faculty_limit : settings.student_limit;
    const loanDays = isFaculty ? settings.faculty_days : settings.student_days;

    // Unpaid fines?
    const { count: unpaid } = await supabase
      .from("fines")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user_id)
      .eq("status", "unpaid");
    if ((unpaid ?? 0) > 0) {
      throw new Error("Recipient has unpaid fines and cannot borrow.");
    }

    // Active loan count
    const { count: activeCount } = await supabase
      .from("borrow_records")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user_id)
      .eq("status", "active");
    if ((activeCount ?? 0) >= loanLimit) {
      throw new Error(`Recipient has reached the borrow limit (${loanLimit}).`);
    }

    // Copy availability
    const { data: copy, error: cErr } = await supabase
      .from("book_copies")
      .select("id, book_id, status")
      .eq("id", data.copy_id)
      .maybeSingle();
    if (cErr || !copy) throw new Error("Copy not found.");
    if (copy.status !== "available") throw new Error("This copy is not available.");

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + loanDays);

    // Mark copy borrowed
    const { error: uErr } = await supabase
      .from("book_copies")
      .update({ status: "borrowed" })
      .eq("id", data.copy_id);
    if (uErr) throw new Error(uErr.message);

    // Insert record
    const { data: record, error: rErr } = await supabase
      .from("borrow_records")
      .insert({
        copy_id: data.copy_id,
        book_id: copy.book_id,
        user_id: data.user_id,
        issued_by: userId,
        due_at: dueAt.toISOString(),
        status: "active",
      })
      .select("id")
      .single();
    if (rErr) {
      await supabase.from("book_copies").update({ status: "available" }).eq("id", data.copy_id);
      throw new Error(rErr.message);
    }

    // Notification
    await supabase.from("notifications").insert({
      user_id: data.user_id,
      type: "borrow_confirmation",
      title: "Book issued",
      body: `A book has been issued to you. Due on ${dueAt.toDateString()}.`,
    });

    return { id: record.id, due_at: dueAt.toISOString() };
  });

const returnSchema = z.object({ borrow_record_id: z.string().uuid() });

/**
 * Return a book. Marks the record returned, releases the copy, and if late,
 * creates an unpaid fine at daily_fine_rate × late_days.
 */
export const returnBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => returnSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: rolesRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const actorRoles = (rolesRow ?? []).map((r) => r.role);
    if (!actorRoles.includes("admin") && !actorRoles.includes("librarian")) {
      throw new Error("Only librarians or admins can process returns.");
    }

    const { data: rec, error: rErr } = await supabase
      .from("borrow_records")
      .select("id, copy_id, user_id, due_at, status")
      .eq("id", data.borrow_record_id)
      .maybeSingle();
    if (rErr || !rec) throw new Error("Borrow record not found.");
    if (rec.status !== "active") throw new Error("This loan is already closed.");

    const { data: settings } = await supabase
      .from("system_settings")
      .select("daily_fine_rate")
      .eq("id", true)
      .maybeSingle();

    const now = new Date();
    const due = new Date(rec.due_at);
    const lateMs = now.getTime() - due.getTime();
    const lateDays = lateMs > 0 ? Math.ceil(lateMs / (1000 * 60 * 60 * 24)) : 0;
    const fineAmount = lateDays * Number(settings?.daily_fine_rate ?? 0);

    const { error: uErr } = await supabase
      .from("borrow_records")
      .update({
        status: "returned",
        returned_at: now.toISOString(),
        returned_by: userId,
      })
      .eq("id", rec.id);
    if (uErr) throw new Error(uErr.message);

    await supabase.from("book_copies").update({ status: "available" }).eq("id", rec.copy_id);

    if (lateDays > 0 && fineAmount > 0) {
      await supabase.from("fines").insert({
        borrow_record_id: rec.id,
        user_id: rec.user_id,
        amount: fineAmount,
        reason: `Late return: ${lateDays} day(s)`,
      });
      await supabase.from("notifications").insert({
        user_id: rec.user_id,
        type: "fine_notice",
        title: "Late return fine",
        body: `You returned a book ${lateDays} day(s) late. A fine of ${fineAmount.toFixed(2)} has been issued.`,
      });
    } else {
      await supabase.from("notifications").insert({
        user_id: rec.user_id,
        type: "return_confirmation",
        title: "Book returned",
        body: "Thanks for returning your book on time.",
      });
    }

    return { late_days: lateDays, fine_amount: fineAmount };
  });

const fineActionSchema = z.object({ fine_id: z.string().uuid() });

export const markFinePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => fineActionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rolesRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesRow ?? []).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("librarian")) {
      throw new Error("Only librarians or admins can update fines.");
    }
    const { error } = await supabase
      .from("fines")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.fine_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const waiveFine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => fineActionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rolesRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesRow ?? []).map((r) => r.role);
    if (!roles.includes("admin")) throw new Error("Only admins can waive fines.");
    const { error } = await supabase.from("fines").update({ status: "waived" }).eq("id", data.fine_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
