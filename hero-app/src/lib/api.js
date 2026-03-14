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

function getScoreCandidate(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function titleCase(input) {
  if (!input || typeof input !== "string") return "";
  const lower = input.trim().toLowerCase();
  if (!lower) return "";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function toMeetingDay(meetingAt) {
  const value = String(meetingAt || "").trim();
  return value ? value.slice(0, 10) : "";
}

function toMillis(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function buildMeetingStats(meetingRows = []) {
  const map = new Map();

  meetingRows.forEach((row) => {
    const email = String(row?.employeeEmail || "").toLowerCase();
    if (!email) return;

    const meetingDay = toMeetingDay(row?.meetingAt);
    const key = meetingDay || String(row?.meetingId || "");

    if (!map.has(email)) {
      map.set(email, {
        keys: new Set(),
        lastMeetingAt: "",
      });
    }

    const bucket = map.get(email);
    if (key) bucket.keys.add(key);

    const candidateAt = String(row?.meetingAt || "");
    if (toMillis(candidateAt) > toMillis(bucket.lastMeetingAt)) {
      bucket.lastMeetingAt = candidateAt;
    }
  });

  return map;
}

export async function getDashboardSummary() {
  const payload = await request("/api/intelligence/dashboard");
  return payload?.data || {};
}

export async function listEmployees() {
  const [employeePayload, meetingsPayload, dashboardPayload] = await Promise.all([
    request("/api/intelligence/employees"),
    request("/api/intelligence/meetings?limit=500").catch(() => ({ data: [] })),
    request("/api/intelligence/dashboard").catch(() => ({ data: { employees: [] } })),
  ]);

  const rows = Array.isArray(employeePayload?.data) ? employeePayload.data : [];
  const meetingRows = Array.isArray(meetingsPayload?.data) ? meetingsPayload.data : [];
  const meetingStats = buildMeetingStats(meetingRows);
  const summaryEmployees = Array.isArray(dashboardPayload?.data?.employees) ? dashboardPayload.data.employees : [];
  const summaryByEmail = new Map(
    summaryEmployees.map((row) => [String(row?.email || row?.employeeEmail || "").toLowerCase(), row])
  );

  return rows.map((row) => {
    const email = String(row?.employeeEmail || row?.email || "").toLowerCase();
    const summaryRow = summaryByEmail.get(email) || {};
    const name = row?.displayName || row?.employeeName || row?.name || "";
    const role = row?.role || row?.title || row?.jobTitle || "";
    const dept = row?.department || row?.dept || "";
    const stats = meetingStats.get(email);

    const riskRaw =
      row?.analysis?.retentionRisk?.level ||
      row?.retentionRisk ||
      row?.riskLevel ||
      summaryRow?.riskLevel ||
      "";
    const sentimentRaw =
      row?.analysis?.sentiment?.trend ||
      row?.analysis?.healthLevel ||
      row?.sentiment ||
      summaryRow?.sentimentTrend ||
      "";

    const scoreCandidate = getScoreCandidate(
      row?.analysis?.sentiment?.score,
      row?.analysis?.health?.score,
      row?.analysis?.healthScore,
      row?.sentimentScore,
      row?.healthScore,
      summaryRow?.sentimentScore,
      summaryRow?.healthScore
    );

    const reportedTotalMeetings = asNumber(row?.totalMeetings ?? row?.meetingCount, 0);
    const computedTotalMeetings = stats ? stats.keys.size : 0;
    const totalMeetings = Math.max(reportedTotalMeetings, computedTotalMeetings);

    const reportedLastMeeting = row?.lastMeetingAt || "";
    const computedLastMeeting = stats?.lastMeetingAt || "";
    const lastMeeting =
      toMillis(reportedLastMeeting) >= toMillis(computedLastMeeting)
        ? reportedLastMeeting || computedLastMeeting
        : computedLastMeeting;

    return {
      id: String(row?.employeeId || row?.id || email),
      email,
      name,
      dept,
      role,
      manager: row?.manager || "",
      joinDate: row?.joinDate || row?.hiredAt || "",
      lastMeeting: lastMeeting || row?.updatedAt || "",
      totalMeetings,
      risk: titleCase(String(riskRaw)),
      sentiment: titleCase(String(sentimentRaw)),
      score: Number.isFinite(scoreCandidate) ? scoreCandidate : 0,
    };
  }).filter((row) => row.email || row.id);
}

export async function getEmployeeProfileByEmail(email) {
  const safeEmail = encodeURIComponent(String(email || "").toLowerCase());
  const payload = await request(`/api/intelligence/employees/${safeEmail}/profile`);
  const data = payload?.data || {};

  let totalMeetings = asNumber(data?.meta?.meetingCount ?? data?.meetingCount, 0);
  let lastMeetingAt = data?.meta?.lastMeetingAt || data?.lastMeetingAt || "";

  if (totalMeetings === 0) {
    const meetingPayload = await request(
      `/api/intelligence/meetings?employeeEmail=${encodeURIComponent(String(email || "").toLowerCase())}&limit=500`
    ).catch(() => ({ data: [] }));

    const meetingRows = Array.isArray(meetingPayload?.data) ? meetingPayload.data : [];
    const stats = buildMeetingStats(meetingRows).get(String(email || "").toLowerCase());
    if (stats) {
      totalMeetings = stats.keys.size;
      if (!lastMeetingAt || toMillis(stats.lastMeetingAt) > toMillis(lastMeetingAt)) {
        lastMeetingAt = stats.lastMeetingAt;
      }
    }
  }

  return {
    email: String(data?.employeeEmail || email || "").toLowerCase(),
    name: data?.employeeName || data?.displayName || data?.name || "",
    dept: data?.department || data?.dept || "",
    role: data?.role || data?.jobTitle || "",
    manager: data?.manager || "",
    joinDate: data?.joinDate || data?.hiredAt || "",
    totalMeetings,
    sentimentScore: `${asNumber(
      getScoreCandidate(
        data?.analysis?.sentiment?.score,
        data?.analysis?.health?.score,
        data?.analysis?.healthScore,
        data?.sentimentScore,
        data?.healthScore
      ),
      0
    )}/100`,
    sentimentTrend: titleCase(data?.analysis?.sentiment?.trend || ""),
    riskLevel: titleCase(data?.analysis?.retentionRisk?.level || data?.analysis?.riskLevel || data?.retentionRisk || ""),
    riskSummary: data?.analysis?.retentionRisk?.summary || "",
    lastMeetingAt,
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

export async function sendChatQuery(query, options = {}) {
  const sessionId = String(options?.sessionId || "").trim();
  const body = { query };
  if (sessionId) {
    body.sessionId = sessionId;
  }

  const payload = await request("/api/intelligence/chat/query", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    sessionId: String(payload?.sessionId || sessionId || ""),
    answer: payload?.answer || "",
    transcriptCards: Array.isArray(payload?.transcriptCards) ? payload.transcriptCards : [],
    filters: payload?.appliedFilters || payload?.filter || {},
    count: asNumber(payload?.count, 0),
  };
}

export async function createChatSession(sessionId = "") {
  const provided = String(sessionId || "").trim();
  const payload = await request("/api/intelligence/chat/sessions", {
    method: "POST",
    body: JSON.stringify(provided ? { sessionId: provided } : {}),
  });

  return payload?.data || {};
}

export async function getChatSessionHistory(sessionId, limit = 120) {
  const key = String(sessionId || "").trim();
  if (!key) {
    return { sessionId: "", data: [] };
  }

  const safeLimit = Math.max(1, Math.min(Number(limit || 120), 500));
  const payload = await request(
    `/api/intelligence/chat/sessions/${encodeURIComponent(key)}/history?limit=${safeLimit}`
  );

  return {
    sessionId: String(payload?.sessionId || key),
    data: Array.isArray(payload?.data) ? payload.data : [],
    session: payload?.session || null,
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
