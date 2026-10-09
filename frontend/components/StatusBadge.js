"use client";

const STYLES = {
  PENDING: "bg-amber-100 text-amber-800",
  UNDER_REVIEW: "bg-blue-100 text-blue-800",
  APPROVED: "bg-brandgreen-100 text-brandgreen-800",
  REJECTED: "bg-red-100 text-red-800",
  FUNDED: "bg-navy-100 text-navy-800",
  UPLOADED: "bg-slate-100 text-slate-700",
  FINANCING_REQUESTED: "bg-amber-100 text-amber-800",
  CLOSED: "bg-slate-200 text-slate-700",
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || "bg-slate-100 text-slate-700";
  return <span className={`badge ${style}`}>{status?.replace(/_/g, " ")}</span>;
}
