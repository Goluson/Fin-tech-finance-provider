"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import RequireRole from "@/components/RequireRole";
import { useAuth } from "@/lib/AuthContext";
import {
  createUploadUrl,
  uploadFileToSignedUrl,
  createPurchaseOrder,
  createFinancingApplication,
} from "@/lib/api";

const MAX_FINANCING_PCT = 1.0;

function NewRequestInner() {
  const { cognitoUser } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [file, setFile] = useState(null);
  const [s3Key, setS3Key] = useState(null);

  // Step 2
  const [poNumber, setPoNumber] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [currency, setCurrency] = useState("USD");

  // Step 3
  const [requestedAmount, setRequestedAmount] = useState("");

  const maxAllowed = totalValue ? (parseFloat(totalValue) * MAX_FINANCING_PCT).toFixed(2) : null;

  const handleFileUpload = async () => {
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const token = await cognitoUser.getIdToken();
      const { upload_url, s3_key } = await createUploadUrl(token, {
        file_name: file.name,
        content_type: "application/pdf",
      });
      await uploadFileToSignedUrl(upload_url, file);
      setS3Key(s3_key);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePoDetailsSubmit = (e) => {
    e.preventDefault();
    if (!poNumber || !buyerName || !totalValue) {
      setError("Please fill in all PO details.");
      return;
    }
    if (parseFloat(totalValue) <= 0) {
      setError("Total value must be greater than zero.");
      return;
    }
    setError("");
    if (!requestedAmount || parseFloat(requestedAmount) > parseFloat(totalValue)) {
      setRequestedAmount(totalValue);
    }
    setStep(3);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (!requestedAmount || parseFloat(requestedAmount) <= 0) {
      setError("Please enter a valid requested amount.");
      return;
    }
    if (parseFloat(requestedAmount) > parseFloat(maxAllowed)) {
      setError(`Requested amount cannot exceed total PO value (${currency} ${maxAllowed}).`);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const token = await cognitoUser.getIdToken();
      const po = await createPurchaseOrder(token, {
        po_number: poNumber,
        buyer_name: buyerName,
        total_value: parseFloat(totalValue),
        currency,
        document_s3_key: s3Key,
      });
      await createFinancingApplication(token, po.id, parseFloat(requestedAmount));
      router.push("/supplier/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-navy-900">New Financing Request</h1>
        <p className="mt-1 text-sm text-slate-500">
          Follow the three steps below. Your application will be manually reviewed by our underwriting team.
        </p>

        <Stepper step={step} />

        {error && (
          <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {step === 1 && (
          <div className="card mt-6 p-6">
            <h2 className="mb-1 text-lg font-medium text-navy-900">Step 1 &middot; Upload Purchase Order</h2>
            <p className="mb-4 text-sm text-slate-500">
              Upload the signed PO document as a PDF. It's stored in a private, secure bucket and only
              accessible to you and our review team.
            </p>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-navy-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy-800 hover:file:bg-navy-200"
            />
            <div className="mt-6 flex justify-end">
              <button onClick={handleFileUpload} className="btn-primary" disabled={submitting || !file}>
                {submitting ? "Uploading..." : "Upload & Continue"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handlePoDetailsSubmit} className="card mt-6 space-y-4 p-6">
            <h2 className="mb-1 text-lg font-medium text-navy-900">Step 2 &middot; Purchase Order Details</h2>
            <p className="mb-2 text-sm text-slate-500">Enter the PO details exactly as they appear on the document.</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">PO Number</label>
              <input className="input-field" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">Buyer Name</label>
              <input className="input-field" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-navy-800">Total PO Value</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="input-field"
                  value={totalValue}
                  onChange={(e) => setTotalValue(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-navy-800">Currency</label>
                <select className="input-field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="submit" className="btn-primary">
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleFinalSubmit} className="card mt-6 space-y-4 p-6">
            <h2 className="mb-1 text-lg font-medium text-navy-900">Step 3 &middot; Financing Amount</h2>
            <p className="mb-2 text-sm text-slate-500">
              60% of the total order value is provided upon Order Received, and the remaining 40% after the order is placed.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-navy-800">Requested Financing Amount</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={maxAllowed || undefined}
                className="input-field"
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
                required
              />
            </div>

            {requestedAmount && parseFloat(requestedAmount) > 0 && (
              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-navy-900 animate-in fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-navy-900 flex items-center gap-1.5">
                    <span>🏢</span> Company Capital Disbursement Schedule
                  </span>
                  <span className="text-xs bg-sky-200/80 text-sky-900 font-semibold px-2 py-0.5 rounded-full">
                    2 Tranches
                  </span>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  Under our company policy, financing capital is disbursed in two tranches upon milestone verification:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white p-3 border border-emerald-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                        Tranche 1 &middot; Order Received (60%)
                      </span>
                      <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">60%</span>
                    </div>
                    <div className="text-lg font-bold text-navy-950 mt-1.5">
                      {currency} {(parseFloat(requestedAmount) * 0.6).toFixed(2)}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Disbursed immediately once your purchase order is reviewed and approved.
                    </p>
                  </div>

                  <div className="rounded-lg bg-white p-3 border border-blue-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                        Tranche 2 &middot; Order Placed (40%)
                      </span>
                      <span className="text-xs font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">40%</span>
                    </div>
                    <div className="text-lg font-bold text-navy-950 mt-1.5">
                      {currency} {(parseFloat(requestedAmount) * 0.4).toFixed(2)}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Remaining balance disbursed once the order is placed with your supplier/vendor.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
                Back
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function Stepper({ step }) {
  const steps = ["Upload PO", "PO Details", "Financing Amount"];
  return (
    <ol className="mt-6 flex items-center gap-4 text-sm">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? "bg-brandgreen-500 text-white"
                  : active
                  ? "bg-navy-800 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? "✓" : n}
            </span>
            <span className={active ? "font-medium text-navy-900" : "text-slate-500"}>{label}</span>
            {n !== steps.length && <span className="mx-1 h-px w-6 bg-slate-300" />}
          </li>
        );
      })}
    </ol>
  );
}

export default function NewRequestPage() {
  return (
    <RequireRole role="SUPPLIER">
      <NewRequestInner />
    </RequireRole>
  );
}
