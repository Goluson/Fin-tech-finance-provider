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

  const maxAdvance = totalValue ? (parseFloat(totalValue) * 0.60).toFixed(2) : null;
  const remainingBuffer = (totalValue && requestedAmount)
    ? Math.max(0, parseFloat(totalValue) - parseFloat(requestedAmount)).toFixed(2)
    : totalValue ? (parseFloat(totalValue) * 0.40).toFixed(2) : null;

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
    const maxAdv = (parseFloat(totalValue) * 0.60).toFixed(2);
    if (!requestedAmount || parseFloat(requestedAmount) > parseFloat(maxAdv)) {
      setRequestedAmount(maxAdv);
    }
    setStep(3);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (!requestedAmount || parseFloat(requestedAmount) <= 0) {
      setError("Please enter a valid requested advance amount.");
      return;
    }
    if (parseFloat(requestedAmount) > parseFloat(maxAdvance)) {
      setError(`Initial advance cannot exceed 60% of the total order value (${currency} ${maxAdvance}). Remaining balance is accessible once order is placed.`);
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
            <h2 className="mb-1 text-lg font-medium text-navy-900">Step 3 &middot; Initial Working Capital Advance</h2>
            <p className="mb-3 text-sm text-slate-500">
              Your buyer gave an order of <strong className="text-navy-900">{currency} {parseFloat(totalValue).toLocaleString()}</strong>.
              You may take up to 60% upfront (<strong className="text-emerald-700">{currency} {maxAdvance}</strong>) to run your business operations continuously.
              The remaining amount can be taken (if needed) once the order is confirmed placed.
            </p>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-navy-800">
                  How much capital do you desire now? (Up to 60%)
                </label>
                <span className="text-xs text-slate-500 font-medium">
                  Max: {currency} {maxAdvance}
                </span>
              </div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={maxAdvance || undefined}
                className="input-field text-lg font-semibold text-navy-900"
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
                required
              />
            </div>

            {/* Quick-choice percentage chips */}
            {totalValue && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-400 font-medium mr-1">Quick select:</span>
                {[
                  { label: "60% (Max)", pct: 0.60 },
                  { label: "50%", pct: 0.50 },
                  { label: "40%", pct: 0.40 },
                  { label: "25%", pct: 0.25 },
                ].map(({ label, pct }) => {
                  const val = (parseFloat(totalValue) * pct).toFixed(2);
                  const isSelected = requestedAmount === val;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setRequestedAmount(val)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        isSelected
                          ? "bg-navy-900 text-white border-navy-900 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {label} &middot; {currency} {parseFloat(val).toLocaleString()}
                    </button>
                  );
                })}
              </div>
            )}

            {requestedAmount && parseFloat(requestedAmount) > 0 && (
              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-navy-900 animate-in fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-navy-900 flex items-center gap-1.5">
                    <span>🏢</span> Capital Flow Breakdown
                  </span>
                  <span className="text-xs bg-sky-200/80 text-sky-900 font-semibold px-2 py-0.5 rounded-full">
                    Total Order: {currency} {parseFloat(totalValue).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div className="rounded-lg bg-white p-3.5 border border-emerald-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                        Advance Taken Now (Order Received)
                      </span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {totalValue ? ((parseFloat(requestedAmount) / parseFloat(totalValue)) * 100).toFixed(0) : "60"}%
                      </span>
                    </div>
                    <div className="text-xl font-black text-navy-950 mt-1.5">
                      {currency} {parseFloat(requestedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Disbursed upfront upon PO approval to fund your operations continuously.
                    </p>
                  </div>

                  <div className="rounded-lg bg-white p-3.5 border border-blue-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                        Remaining Available (Order Placed)
                      </span>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        {totalValue ? (100 - (parseFloat(requestedAmount) / parseFloat(totalValue)) * 100).toFixed(0) : "40"}%
                      </span>
                    </div>
                    <div className="text-xl font-black text-navy-950 mt-1.5">
                      {currency} {remainingBuffer ? parseFloat(remainingBuffer).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Can be taken (if needed) once the order is placed firmly with vendors.
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
