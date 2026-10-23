"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import RequireRole from "@/components/RequireRole";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/lib/AuthContext";
import { getApplication, getPoDocumentViewUrl, updateApplicationStatus } from "@/lib/api";

function AdminReviewInner() {
  const { id } = useParams();
  const router = useRouter();
  const { cognitoUser } = useAuth();

  const [application, setApplication] = useState(null);
  const [docUrl, setDocUrl] = useState(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    try {
      const token = await cognitoUser.getIdToken();
      const app = await getApplication(token, id);
      setApplication(app);
      setNotes(app.admin_notes || "");
      const { view_url } = await getPoDocumentViewUrl(token, app.po_id);
      setDocUrl(view_url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cognitoUser && id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cognitoUser, id]);

  const handleStatusChange = async (status) => {
    setActionLoading(true);
    setError("");
    try {
      const token = await cognitoUser.getIdToken();
      const updated = await updateApplicationStatus(token, id, { status, admin_notes: notes });
      setApplication(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="p-12 text-center text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="p-12 text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <button onClick={() => router.push("/admin/dashboard")} className="mb-4 text-sm text-navy-600 hover:underline">
          &larr; Back to all requests
        </button>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-navy-900">
              PO #{application.po_number} &middot; {application.buyer_name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Submitted by {application.supplier_company_name} ({application.supplier_email})
            </p>
          </div>
          <StatusBadge status={application.status} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: PO details + document */}
          <div className="space-y-6">
            <div className="card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Purchase Order Details
              </h2>
              <dl className="space-y-3 text-sm">
                <Row label="PO Number" value={application.po_number} />
                <Row label="Buyer Name" value={application.buyer_name} />
                <Row
                  label="Total Order Value"
                  value={application.po_total_value?.toLocaleString?.() ?? application.po_total_value}
                />
                <Row
                  label="Advance Drawn (Order Received)"
                  value={application.requested_amount?.toLocaleString?.() ?? application.requested_amount}
                />
                <Row
                  label="Remaining Balance (Order Placed, if needed)"
                  value={application.remaining_disbursement_amount?.toLocaleString?.() ?? (application.po_total_value && application.requested_amount ? (application.po_total_value - application.requested_amount).toFixed(2) : "-")}
                />
                <Row
                  label="Total Disbursed to Date"
                  value={application.disbursed_amount?.toLocaleString?.() ?? (application.status === "FUNDED" ? application.po_total_value : application.status === "PARTIALLY_FUNDED" ? application.requested_amount : "0.00")}
                />
                <Row label="Supplier" value={application.supplier_company_name} />
                <Row label="Submitted" value={new Date(application.created_at).toLocaleString()} />
              </dl>
            </div>

            <div className="card p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Purchase Order Document
              </h2>
              {docUrl ? (
                <iframe src={docUrl} className="h-[500px] w-full rounded-md border border-slate-200" title="PO Document" />
              ) : (
                <p className="text-sm text-slate-500">Document preview unavailable.</p>
              )}
              {docUrl && (
                <a href={docUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-navy-600 hover:underline">
                  Open in new tab &rarr;
                </a>
              )}
            </div>
          </div>

          {/* Right: manual underwriting decision */}
          <div className="card h-fit p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Manual Underwriting Decision
            </h2>

            {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <label className="mb-1 block text-sm font-medium text-navy-800">Underwriting notes</label>
            <textarea
              className="input-field mb-4 min-h-[120px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record the rationale for your decision..."
            />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                className="btn-approve"
                disabled={actionLoading}
                onClick={() => handleStatusChange("APPROVED")}
              >
                Approve
              </button>
              <button
                className="btn-reject"
                disabled={actionLoading}
                onClick={() => handleStatusChange("REJECTED")}
              >
                Reject
              </button>
              <button
                className="btn-secondary"
                disabled={actionLoading}
                onClick={() => handleStatusChange("UNDER_REVIEW")}
              >
                Under Review
              </button>
            </div>

            {/* 2-Stage Capital Disbursement Controls */}
            <div className="mt-5 pt-4 border-t border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Capital Disbursement Tranches
              </h3>

              {application.status === "PENDING" || application.status === "UNDER_REVIEW" ? (
                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                  Application must be <strong>Approved</strong> first before capital tranches can be disbursed.
                </div>
              ) : application.status === "REJECTED" ? (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  This application was rejected. No capital is disbursed.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Tranche 1: Order Received (Advance up to 60%) */}
                  <div className={`p-3 rounded-lg border ${
                    application.status === "PARTIALLY_FUNDED" || application.status === "FUNDED"
                      ? "bg-emerald-50/60 border-emerald-200"
                      : "bg-slate-50 border-slate-200"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-bold text-navy-900">
                        Tranche 1 &middot; Order Received (Advance Taken)
                      </div>
                      <span className="text-xs font-bold text-navy-900">
                        ${application.requested_amount?.toLocaleString?.() ?? application.requested_amount}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Working capital advance requested by supplier to fund ongoing business operations.
                    </p>
                    {application.status === "APPROVED" && (
                      <button
                        className="btn-primary w-full text-xs py-2 bg-sky-700 hover:bg-sky-800"
                        disabled={actionLoading}
                        onClick={() => handleStatusChange("PARTIALLY_FUNDED")}
                      >
                        {actionLoading ? "Processing..." : `Disburse Advance ($${application.requested_amount}) · Order Received`}
                      </button>
                    )}
                    {(application.status === "PARTIALLY_FUNDED" || application.status === "FUNDED") && (
                      <div className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                        <span>✓</span> Advance Disbursed to Supplier
                      </div>
                    )}
                  </div>

                  {/* Tranche 2: Order Placed (Remaining balance if needed) */}
                  <div className={`p-3 rounded-lg border ${
                    application.status === "FUNDED"
                      ? "bg-emerald-50/60 border-emerald-200"
                      : application.status === "PARTIALLY_FUNDED"
                      ? "bg-amber-50/60 border-amber-200"
                      : "bg-slate-50 border-slate-200"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-bold text-navy-900">
                        Tranche 2 &middot; Order Placed (Remaining Balance)
                      </div>
                      <span className="text-xs font-bold text-navy-900">
                        ${application.remaining_disbursement_amount?.toLocaleString?.() ?? (application.po_total_value && application.requested_amount ? (application.po_total_value - application.requested_amount).toFixed(2) : "-")}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Remaining order balance released once order is confirmed placed with vendors.
                    </p>
                    {application.status === "PARTIALLY_FUNDED" && (
                      <button
                        className="btn-primary w-full text-xs py-2 bg-brandgreen-600 hover:bg-brandgreen-700"
                        disabled={actionLoading}
                        onClick={() => handleStatusChange("FUNDED")}
                      >
                        {actionLoading ? "Processing..." : `Disburse Remaining Balance ($${application.remaining_disbursement_amount}) · Order Placed`}
                      </button>
                    )}
                    {application.status === "APPROVED" && (
                      <button
                        className="btn-secondary w-full text-xs py-1.5 text-slate-600 border border-slate-300"
                        disabled={actionLoading}
                        onClick={() => handleStatusChange("FUNDED")}
                        title="Directly disburse 100% full order value if needed"
                      >
                        Directly Disburse Full Order Value
                      </button>
                    )}
                    {application.status === "FUNDED" && (
                      <div className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                        <span>✓</span> 100% Fully Disbursed & PO Closed
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-navy-900">{value}</dd>
    </div>
  );
}

export default function AdminReviewPage() {
  return (
    <RequireRole role="ADMIN">
      <AdminReviewInner />
    </RequireRole>
  );
}
