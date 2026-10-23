"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import RequireRole from "@/components/RequireRole";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/lib/AuthContext";
import { listApplications } from "@/lib/api";

const FILTERS = ["ALL", "PENDING", "UNDER_REVIEW", "APPROVED", "PARTIALLY_FUNDED", "FUNDED", "REJECTED"];

function AdminDashboardInner() {
  const { cognitoUser } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    const load = async () => {
      try {
        const token = await cognitoUser.getIdToken();
        const apps = await listApplications(token);
        setApplications(apps);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (cognitoUser) load();
  }, [cognitoUser]);

  const filtered = useMemo(
    () => (filter === "ALL" ? applications : applications.filter((a) => a.status === filter)),
    [applications, filter]
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-2xl font-semibold text-navy-900">All financing requests</h1>
        <p className="mt-1 text-sm text-slate-500">Review supplier applications and manage underwriting decisions.</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f ? "bg-navy-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {f.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <div className="card mt-4 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No applications match this filter.</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Supplier</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">PO Number</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Buyer</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">PO Value</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Requested</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/admin/review/${a.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-navy-800">{a.supplier_company_name}</div>
                      <div className="text-xs text-slate-400">{a.supplier_email}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{a.po_number}</td>
                    <td className="px-6 py-4 text-slate-600">{a.buyer_name}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {a.po_total_value?.toLocaleString?.() ?? a.po_total_value}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="font-medium text-navy-900">{a.requested_amount?.toLocaleString?.() ?? a.requested_amount}</div>
                      <div className="text-[11px] text-slate-400">
                        {a.status === 'FUNDED'
                          ? '100% Disbursed'
                          : a.status === 'PARTIALLY_FUNDED'
                          ? '60% Disbursed (Order Received)'
                          : 'Awaiting Disbursement'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-500">{new Date(a.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <RequireRole role="ADMIN">
      <AdminDashboardInner />
    </RequireRole>
  );
}
