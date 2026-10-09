"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SupplierIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/supplier/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
      Redirecting to supplier dashboard...
    </div>
  );
}
