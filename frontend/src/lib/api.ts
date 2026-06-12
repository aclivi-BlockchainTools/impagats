export function formatAmount(amount: any, decimals = 2): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return (isNaN(n) ? 0 : n).toFixed(decimals);
}

const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(BASE + url, {
    headers,
    ...options,
  });
  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    window.location.href = "/login";
    throw new Error("Sessió expirada");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error de xarxa" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Dashboard
  getDashboard: () => request<any>("/dashboard"),

  // Clients
  getClients: () => request<any[]>("/clients"),
  getClient: (id: number) => request<any>(`/clients/${id}`),
  createClient: (data: any) => request<any>("/clients", { method: "POST", body: JSON.stringify(data) }),
  updateClient: (id: number, data: any) => request<any>(`/clients/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteClient: (id: number) => request<void>(`/clients/${id}`, { method: "DELETE" }),

  // Invoices
  getInvoices: (clientId?: number) => request<any[]>(`/invoices${clientId ? `?clientId=${clientId}` : ""}`),
  getInvoice: (id: number) => request<any>(`/invoices/${id}`),
  createInvoice: (data: any) => request<any>("/invoices", { method: "POST", body: JSON.stringify(data) }),
  updateInvoice: (id: number, data: any) => request<any>(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteInvoice: (id: number) => request<void>(`/invoices/${id}`, { method: "DELETE" }),

  // Bank movements
  getBankMovements: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/bank-movements${qs}`);
  },
  importCsv: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(BASE + "/bank-movements", { method: "POST", body: formData }).then((r) => r.json());
  },
  importSepaXml: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(BASE + "/bank-movements/xml", { method: "POST", body: formData }).then((r) => r.json());
  },

  // Returned receipts
  getReturnedReceipts: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/returned-receipts${qs}`);
  },
  getReturnedReceipt: (id: number) => request<any>(`/returned-receipts/${id}`),
  createReturnedReceipt: (data: any) => request<any>("/returned-receipts", { method: "POST", body: JSON.stringify(data) }),
  updateReturnedReceipt: (id: number, data: any) => request<any>(`/returned-receipts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  matchReceipt: (id: number, data: any) => request<any>(`/returned-receipts/${id}/match`, { method: "POST", body: JSON.stringify(data) }),
  sendWhatsApp: (id: number) => request<any>(`/returned-receipts/${id}/send-whatsapp`, { method: "POST" }),
  sendBulkWhatsApp: (receiptIds: number[]) => request<any>("/returned-receipts/send-bulk-whatsapp", { method: "POST", body: JSON.stringify({ receiptIds }) }),
  uploadProof: (id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(BASE + `/returned-receipts/${id}/proof`, { method: "POST", body: formData }).then((r) => r.json());
  },

  // Manual reply (agent override)
  sendManualReply: (receiptId: number, text: string) =>
    request<any>(`/returned-receipts/${receiptId}/reply`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  simulateAgent: (receiptId: number, text: string, hasMedia?: boolean) =>
    request<any>(`/returned-receipts/${receiptId}/simulate-agent`, {
      method: "POST",
      body: JSON.stringify({ text, hasMedia }),
    }),
  executeAgent: (receiptId: number, text: string) =>
    request<any>(`/returned-receipts/${receiptId}/execute-agent`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  deleteReturnedReceipt: (id: number) => request<void>(`/returned-receipts/${id}`, { method: "DELETE" }),

  // Messages
  getMessages: (receiptId?: number) => request<any[]>(`/messages${receiptId ? `?receiptId=${receiptId}` : ""}`),

  // Dashboard debtors
  getDashboardDebtors: () => request<any[]>("/dashboard/debtors"),

  // Settings
  getSettings: () => request<Record<string, string>>("/settings"),
  updateSettings: (data: Record<string, string>) => request<any>("/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Auth
  login: (email: string, password: string): Promise<{ token: string; email: string }> => {
    return fetch(BASE + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then((r) => {
      if (!r.ok) return r.json().then((e) => { throw new Error(e.error || "Credencials invàlides"); });
      return r.json();
    });
  },
  getMe: () => request<{ email: string; authenticated: boolean }>("/auth/me"),

  // Outbox
  getOutbox: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/outbox${qs}`);
  },
  getOutboxStats: () => request<any>("/outbox/stats"),
  processOutbox: () => request<any>("/outbox/process", { method: "POST" }),
  retryOutbox: (id: number) => request<any>(`/outbox/${id}/retry`, { method: "POST" }),
  cancelOutbox: (id: number) => request<any>(`/outbox/${id}/cancel`, { method: "POST" }),

  // Case notes
  getCaseNotes: (receiptId: number) => request<any[]>(`/case-notes/${receiptId}/notes`),
  addCaseNote: (receiptId: number, body: string) => request<any>(`/case-notes/${receiptId}/notes`, { method: "POST", body: JSON.stringify({ body }) }),
  getStatusHistory: (receiptId: number) => request<any[]>(`/case-notes/${receiptId}/history`),
};
