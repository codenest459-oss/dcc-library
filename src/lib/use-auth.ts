import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "librarian" | "student" | "faculty";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roles: AppRole[];
  primaryRole: AppRole | null;
  fullName: string | null;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadExtras = async (userId: string) => {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      ]);
      if (!mounted) return;
      setRoles((r ?? []).map((x) => x.role as AppRole));
      setFullName(p?.full_name ?? null);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) void loadExtras(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession(s);
      if (s?.user) void loadExtras(s.user.id);
      else {
        setRoles([]);
        setFullName(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const primaryRole: AppRole | null =
    roles.includes("admin")
      ? "admin"
      : roles.includes("librarian")
      ? "librarian"
      : roles.includes("faculty")
      ? "faculty"
      : roles.includes("student")
      ? "student"
      : null;

  return {
    session,
    user: session?.user ?? null,
    loading,
    roles,
    primaryRole,
    fullName,
  };
}
