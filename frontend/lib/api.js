/**
 * Thin fetch wrapper around the FastAPI backend. Every call attaches the
 * AWS Cognito ID token as a Bearer credential; the backend re-verifies it
 * and resolves the caller's role server-side (roles are never trusted
 * from the client).
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

async function request(path, { method = "GET", token, body, isFormData = false } = {}) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const errJson = await res.json();
      detail = errJson.detail || detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const registerUser = (token, { company_name, role }) =>
  request("/api/users", { method: "POST", token, body: { company_name, role } });

export const fetchMyProfile = (token) => request("/api/users/me", { token });

// ---------------------------------------------------------------------------
// Documents (signed URLs)
// ---------------------------------------------------------------------------
export const createUploadUrl = (token, { file_name, content_type }) =>
  request("/api/documents/upload-url", { method: "POST", token, body: { file_name, content_type } });

export const uploadFileToSignedUrl = async (uploadUrl, file) => {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/pdf" },
    body: file,
  });
  if (!res.ok) throw new Error("File upload to storage failed. Please try again.");
};

export const getPoDocumentViewUrl = (token, poId) => request(`/api/purchase-orders/${poId}/document-url`, { token });

// ---------------------------------------------------------------------------
// Purchase Orders
// ---------------------------------------------------------------------------
export const createPurchaseOrder = (token, payload) =>
  request("/api/purchase-orders", { method: "POST", token, body: payload });

export const listPurchaseOrders = (token, supplierId) =>
  request(`/api/purchase-orders${supplierId ? `?supplier_id=${supplierId}` : ""}`, { token });

// ---------------------------------------------------------------------------
// Financing Applications
// ---------------------------------------------------------------------------
export const createFinancingApplication = (token, poId, requested_amount) =>
  request(`/api/purchase-orders/${poId}/finance`, { method: "POST", token, body: { requested_amount } });

export const listApplications = (token) => request("/api/applications", { token });

export const getApplication = (token, applicationId) => request(`/api/applications/${applicationId}`, { token });

export const updateApplicationStatus = (token, applicationId, { status, admin_notes }) =>
  request(`/api/applications/${applicationId}/status`, {
    method: "PATCH",
    token,
    body: { status, admin_notes },
  });
