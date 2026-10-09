"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

/**
 * Client-side route guard. Redirects to /login if unauthenticated, or to
 * the correct dashboard if the signed-in user's role doesn't match.
 *
 * NOTE: This is a UX convenience only. The FastAPI backend is the real
 * enforcement point — every API route independently re-checks the
 * caller's role from the verified AWS Cognito token, so this guard cannot
 * be relied upon (or bypassed) for actual access control.
 */
export default function RequireRole({ role, children }) {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/login");
      return;
    }
    if (role && profile.role !== role) {
      router.replace(profile.role === "ADMIN" ? "/admin/dashboard" : "/supplier/dashboard");
    }
  }, [loading, profile, role, router]);

  if (loading || !profile || (role && profile.role !== role)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-navy-500">
        Loading...
      </div>
    );
  }

  return children;
}
