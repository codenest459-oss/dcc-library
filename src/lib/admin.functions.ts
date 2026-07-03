import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * List every user with their profile + roles. Admin-only.
 * Uses service role (via admin client) to enumerate auth.users.
 */
export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authData, error: aErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (aErr) throw new Error(aErr.message);

    const ids = authData.users.map((u) => u.id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, university_id, department_id");
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);

    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });

    return authData.users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      profile: profMap.get(u.id) ?? null,
      roles: roleMap.get(u.id) ?? [],
    }));
  });

const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "librarian", "student", "faculty"]),
});

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => roleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only.");
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const removeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => roleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only.");
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Search borrowers for the "Issue book" dialog. Admin/librarian only.
 */
export const searchBorrowers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rolesRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesRow ?? []).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("librarian")) {
      throw new Error("Staff only.");
    }
    let query = supabase
      .from("profiles")
      .select("id, full_name, university_id")
      .limit(20);
    if (data.q && data.q.trim().length > 0) {
      query = query.or(`full_name.ilike.%${data.q}%,university_id.ilike.%${data.q}%`);
    }
    const { data: profs, error } = await query;
    if (error) throw new Error(error.message);
    return profs ?? [];
  });
