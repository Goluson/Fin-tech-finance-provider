"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const homeHref = profile?.role === "ADMIN" ? "/admin/dashboard" : "/supplier/dashboard";

  return (
    <nav className="bg-navy-900 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href={homeHref} className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brandgreen-500 text-navy-950">
            PF
          </span>
          <span>PO Finance Platform</span>
        </Link>
        {profile && (
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden sm:inline text-navy-200">
              {profile.company_name} &middot; {profile.role}
            </span>
            <button onClick={handleSignOut} className="btn-secondary !bg-transparent !border-navy-600 !text-white hover:!bg-navy-800">
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
