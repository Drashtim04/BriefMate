const BACKEND_BASE_URL = String(import.meta.env.VITE_BACKEND_BASE_URL || "").replace(/\/+$/, "");
const ORG_ID = String(import.meta.env.VITE_ORG_ID || "").trim();

async function request(path, options = {}) {
  if (!BACKEND_BASE_URL) {
    throw new Error("VITE_BACKEND_BASE_URL is required");
  }

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (ORG_ID) {
    headers["x-org-id"] = ORG_ID;
  }

  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_err) {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function titleCase(input) {
  if (!input || typeof input !== "string") return "";
  const lower = input.trim().toLowerCase();
  if (!lower) return "";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export async function getDashboardSummary() {
  const payload = await request("/api/intelligence/dashboard");
  return payload?.data || {};
}

export async function listEmployees() {
  const payload = await request("/api/intelligence/employees");
  const rows = Array.isArray(payload?.data) ? payload.data : [];

  return rows.map((row) => {
    const email = String(row?.employeeEmail || row?.email || "").toLowerCase();
    const name = row?.displayName || row?.employeeName || row?.name || "";
    const role = row?.role || row?.title || row?.jobTitle || "";
    const dept = row?.department || row?.dept || "";

    const riskRaw = row?.analysis?.retentionRisk?.level || row?.retentionRisk || row?.riskLevel || "";
    const sentimentRaw = row?.analysis?.sentiment?.trend || row?.analysis?.healthLevel || row?.sentiment || "";

    return {
      id: String(row?.employeeId || row?.id || email),
      email,
      name,
      dept,
      role,
      manager: row?.manager || "",
      joinDate: row?.joinDate || row?.hiredAt || "",
      lastMeeting: row?.lastMeetingAt || row?.updatedAt || "",
      totalMeetings: asNumber(row?.totalMeetings ?? row?.meetingCount, 0),
      risk: titleCase(String(riskRaw)),
      sentiment: titleCase(String(sentimentRaw)),
      score: asNumber(row?.analysis?.healthScore ?? row?.healthScore, 0),
    };
  }).filter((row) => row.email || row.id);
}

export async function getEmployeeProfileByEmail(email) {
  const safeEmail = encodeURIComponent(String(email || "").toLowerCase());
  const payload = await request(`/api/intelligence/employees/${safeEmail}/profile`);
  const data = payload?.data || {};

  return {
    email: String(data?.employeeEmail || email || "").toLowerCase(),
    name: data?.employeeName || data?.displayName || data?.name || "",
    dept: data?.department || data?.dept || "",
    role: data?.role || data?.jobTitle || "",
    manager: data?.manager || "",
    joinDate: data?.joinDate || data?.hiredAt || "",
    totalMeetings: asNumber(data?.meta?.meetingCount ?? data?.meetingCount, 0),
    sentimentScore: `${asNumber(data?.analysis?.healthScore ?? data?.healthScore, 0)}/100`,
    sentimentTrend: titleCase(data?.analysis?.sentiment?.trend || ""),
    riskLevel: titleCase(data?.analysis?.retentionRisk?.level || data?.analysis?.riskLevel || data?.retentionRisk || ""),
    riskSummary: data?.analysis?.retentionRisk?.summary || "",
    lastMeetingAt: data?.meta?.lastMeetingAt || "",
    observations: Array.isArray(data?.analysis?.observations)
      ? data.analysis.observations
      : Array.isArray(data?.analysis?.summary?.chunks)
        ? data.analysis.summary.chunks.map((chunk) => chunk.summary).filter(Boolean)
        : [],
  };
}

export async function listMeetings(params = {}) {
  const query = new URLSearchParams();
  if (params.employeeEmail) query.set("employeeEmail", params.employeeEmail);
  if (params.q) query.set("q", params.q);
  if (params.limit) query.set("limit", String(params.limit));

  const suffix = query.toString() ? `?${query.toString()}` : "";
  const payload = await request(`/api/intelligence/meetings${suffix}`);
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function getMeetingTranscript(meetingId, q = "") {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  const suffix = query.toString() ? `?${query.toString()}` : "";

  return request(`/api/intelligence/meetings/${encodeURIComponent(meetingId)}/transcript${suffix}`);
}

export async function sendChatQuery(query) {
  const payload = await request("/api/intelligence/chat/query", {
    method: "POST",
    body: JSON.stringify({ query }),
  });

  return {
    answer: payload?.answer || "",
    transcriptCards: Array.isArray(payload?.transcriptCards) ? payload.transcriptCards : [],
    filters: payload?.appliedFilters || {},
  };
}

export async function getUpcomingBrief(employeeEmail, meetingAt) {
  return request("/api/intelligence/briefs/upcoming", {
    method: "POST",
    body: JSON.stringify({ employeeEmail, meetingAt }),
  });
}

export async function refreshEmployeePipeline(employeeEmail, reason = "manual-refresh") {
  const email = String(employeeEmail || "").toLowerCase();
  if (!email) {
    throw new Error("Employee email is required for refresh");
  }

  return request("/api/intelligence/pipeline/run", {
    method: "POST",
    body: JSON.stringify({
      employeeEmail: email,
      reason,
    }),
  });
}

export { BACKEND_BASE_URL };
