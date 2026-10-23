"use client";

const STYLES = {
  PENDING: "bg-amber-100 text-amber-800",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
  APPROVED: "bg-brandgreen-100 text-brandgreen-800",
  PARTIALLY_FUNDED: "bg-sky-100 text-sky-800 border border-sky-300 font-medium",
  REJECTED: "bg-red-100 text-red-800",
  FUNDED: "bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium",
  UPLOADED: "bg-slate-100 text-slate-700",
  FINANCING_REQUESTED: "bg-amber-100 text-amber-800",
  CLOSED: "bg-slate-200 text-slate-700",
};

const LABELS = {
  PARTIALLY_FUNDED: "Advance Disbursed (Order Received)",
  FUNDED: "Fully Funded (Order Placed)",
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || "bg-slate-100 text-slate-700";
  const label = LABELS[status] || status?.replace(/_/g, " ");
  return <span className={`badge ${style}`}>{label}</span>;
}
