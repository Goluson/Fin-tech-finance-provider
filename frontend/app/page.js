"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function RootPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace("/login");
    } else if (profile.role === "ADMIN") {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/supplier/dashboard");
    }
  }, [loading, profile, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-navy-500">
      Loading...
    </div>
  );
}
