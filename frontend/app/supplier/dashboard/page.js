"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import RequireRole from "@/components/RequireRole";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/lib/AuthContext";
import { listApplications } from "@/lib/api";

function SupplierDashboardInner() {
  const { cognitoUser, profile } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy-900">Your financing requests</h1>
            <p className="mt-1 text-sm text-slate-500">
              Welcome back, {profile?.company_name}. Track the status of every purchase order you've submitted.
            </p>
          </div>
          <Link href="/supplier/new-request" className="btn-primary">
            + New Financing Request
          </Link>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">{error}</div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">You haven't submitted any financing requests yet.</p>
              <Link href="/supplier/new-request" className="btn-primary mt-4 inline-flex">
                Create your first request
              </Link>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">PO Number</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Buyer</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">PO Value</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Requested</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-navy-800">{a.po_number}</td>
                    <td className="px-6 py-4 text-slate-600">{a.buyer_name}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {a.po_total_value?.toLocaleString?.() ?? a.po_total_value}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="font-medium text-navy-900">{a.requested_amount?.toLocaleString?.() ?? a.requested_amount}</div>
                      <div className="text-[11px] text-slate-400">
                        {a.status === 'FUNDED'
                          ? '100% Disbursed (Order Placed)'
                          : a.status === 'PARTIALLY_FUNDED'
                          ? '60% Disbursed (Order Received)'
                          : 'Awaiting Review/Disbursement'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
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

export default function SupplierDashboardPage() {
  return (
    <RequireRole role="SUPPLIER">
      <SupplierDashboardInner />
    </RequireRole>
  );
}
