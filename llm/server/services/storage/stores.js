import { MongoClient } from "mongodb";

const memory = {
  employees: [],
  rawData: [],
  profiles: [],
  alerts: [],
  syncState: [],
  meetings: [],
  systemState: [],
};

let mongoClient = null;
let mongoDb = null;

async function initMongo({ mongoUri, mongoDbName, useMemoryStore }) {
  if (useMemoryStore || !mongoUri) {
    return { mode: "memory" };
  }

  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  mongoDb = mongoClient.db(mongoDbName);

  await mongoDb.collection("employee_profiles").createIndex({ employeeEmail: 1, version: -1 });
  await mongoDb.collection("alerts").createIndex({ employeeEmail: 1, createdAt: -1 });
  await mongoDb.collection("employees").createIndex(
    { employeeEmail: 1 },
    {
      unique: true,
      partialFilterExpression: { employeeEmail: { $type: "string" } },
    }
  );
  await mongoDb.collection("employee_raw_data").createIndex({ employeeEmail: 1, fetchedAt: -1 });
  await mongoDb.collection("sync_state").createIndex(
    { employeeEmail: 1 },
    {
      unique: true,
      partialFilterExpression: { employeeEmail: { $type: "string" } },
    }
  );
  await mongoDb.collection("meetings").createIndex({ employeeEmail: 1, meetingAt: -1 });
  await mongoDb.collection("meetings").createIndex(
    { meetingId: 1 },
    {
      unique: true,
      partialFilterExpression: { meetingId: { $type: "string" } },
    }
  );
  await mongoDb.collection("system_state").createIndex(
    { key: 1 },
    {
      unique: true,
      partialFilterExpression: { key: { $type: "string" } },
    }
  );

  return { mode: "mongo" };
}

function isMongoReady() {
  return Boolean(mongoDb);
}

async function getLatestProfile(employeeEmail) {
  if (!employeeEmail) {
    return null;
  }

  if (!isMongoReady()) {
    const filtered = memory.profiles
      .filter((item) => item.employeeEmail === employeeEmail)
      .sort((a, b) => b.version - a.version);
    return filtered[0] || null;
  }

  return mongoDb.collection("employee_profiles").findOne(
    { employeeEmail },
    { sort: { version: -1 } }
  );
}

async function upsertEmployeeIdentity(identityDoc) {
  if (!identityDoc?.employeeEmail) {
    return null;
  }

  const employeeEmail = String(identityDoc.employeeEmail).toLowerCase();
  const base = {
    employeeEmail,
    employeeId: identityDoc.employeeId || null,
    displayName: identityDoc.displayName || "Unknown",
    role: identityDoc.role || "Unknown",
    department: identityDoc.department || "Unknown",
    source: identityDoc.source || "unknown",
    updatedAt: new Date().toISOString(),
  };

  if (!isMongoReady()) {
    const index = memory.employees.findIndex((item) => item.employeeEmail === employeeEmail);
    if (index >= 0) {
      memory.employees[index] = { ...memory.employees[index], ...base };
      return memory.employees[index];
    }
    memory.employees.push(base);
    return base;
  }

  await mongoDb.collection("employees").updateOne(
    { employeeEmail },
    {
      $set: base,
      $setOnInsert: { createdAt: new Date().toISOString() },
    },
    { upsert: true }
  );

  return mongoDb.collection("employees").findOne({ employeeEmail });
}

async function listEmployees() {
  if (!isMongoReady()) {
    return [...memory.employees];
  }
  return mongoDb.collection("employees").find({}).toArray();
}

async function getSyncState(employeeEmail) {
  const key = String(employeeEmail || "").toLowerCase();
  if (!key) {
    return { employeeEmail: "", slackCursor: 0, meetingCursor: 0 };
  }

  if (!isMongoReady()) {
    const row = memory.syncState.find((item) => item.employeeEmail === key);
    return row || { employeeEmail: key, slackCursor: 0, meetingCursor: 0 };
  }

  const row = await mongoDb.collection("sync_state").findOne({ employeeEmail: key });
  return row || { employeeEmail: key, slackCursor: 0, meetingCursor: 0 };
}

async function updateSyncState(employeeEmail, patch = {}) {
  const key = String(employeeEmail || "").toLowerCase();
  const next = {
    employeeEmail: key,
    slackCursor: Number(patch.slackCursor || 0),
    meetingCursor: Number(patch.meetingCursor || 0),
    updatedAt: new Date().toISOString(),
  };

  if (!isMongoReady()) {
    const index = memory.syncState.findIndex((item) => item.employeeEmail === key);
    if (index >= 0) {
      memory.syncState[index] = { ...memory.syncState[index], ...next };
      return memory.syncState[index];
    }
    memory.syncState.push(next);
    return next;
  }

  await mongoDb.collection("sync_state").updateOne(
    { employeeEmail: key },
    {
      $set: next,
      $setOnInsert: { createdAt: new Date().toISOString() },
    },
    { upsert: true }
  );

  return mongoDb.collection("sync_state").findOne({ employeeEmail: key });
}

async function isColdBootCompleted() {
  if (!isMongoReady()) {
    const state = memory.systemState.find((item) => item.key === "cold_boot_completed");
    return Boolean(state?.value);
  }

  const state = await mongoDb.collection("system_state").findOne({ key: "cold_boot_completed" });
  return Boolean(state?.value);
}

async function markColdBootCompleted(details = {}) {
  const payload = {
    key: "cold_boot_completed",
    value: true,
    completedAt: new Date().toISOString(),
    details,
  };

  if (!isMongoReady()) {
    const index = memory.systemState.findIndex((item) => item.key === "cold_boot_completed");
    if (index >= 0) {
      memory.systemState[index] = payload;
    } else {
      memory.systemState.push(payload);
    }
    return payload;
  }

  await mongoDb.collection("system_state").updateOne(
    { key: "cold_boot_completed" },
    { $set: payload },
    { upsert: true }
  );
  return payload;
}

async function getNextProfileVersion(employeeEmail) {
  const latest = await getLatestProfile(employeeEmail);
  return latest ? Number(latest.version || 0) + 1 : 1;
}

async function saveProfile(profileDoc) {
  if (!isMongoReady()) {
    memory.profiles.push(profileDoc);
    return profileDoc;
  }
  await mongoDb.collection("employee_profiles").insertOne(profileDoc);
  return profileDoc;
}

async function saveAlerts(alertDocs) {
  if (!Array.isArray(alertDocs) || alertDocs.length === 0) {
    return;
  }

  if (!isMongoReady()) {
    memory.alerts.push(...alertDocs);
    return;
  }

  await mongoDb.collection("alerts").insertMany(alertDocs);
}

async function saveRawDataSnapshot(rawDoc) {
  if (!rawDoc?.employeeEmail) {
    return null;
  }

  if (!isMongoReady()) {
    memory.rawData.push(rawDoc);
    return rawDoc;
  }

  await mongoDb.collection("employee_raw_data").insertOne(rawDoc);
  return rawDoc;
}

async function saveMeetingRecord(meetingDoc) {
  if (!meetingDoc?.meetingId) {
    return null;
  }

  if (!isMongoReady()) {
    const index = memory.meetings.findIndex((item) => item.meetingId === meetingDoc.meetingId);
    if (index >= 0) {
      memory.meetings[index] = { ...memory.meetings[index], ...meetingDoc };
      return memory.meetings[index];
    }
    memory.meetings.push(meetingDoc);
    return meetingDoc;
  }

  await mongoDb.collection("meetings").updateOne(
    { meetingId: meetingDoc.meetingId },
    {
      $set: meetingDoc,
      $setOnInsert: { createdAt: new Date().toISOString() },
    },
    { upsert: true }
  );

  return mongoDb.collection("meetings").findOne({ meetingId: meetingDoc.meetingId });
}

function toMeetingTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortMeetingsLatestFirst(rows = []) {
  return [...rows].sort((a, b) => {
    const byMeetingAt = toMeetingTime(b?.meetingAt) - toMeetingTime(a?.meetingAt);
    if (byMeetingAt !== 0) {
      return byMeetingAt;
    }
    return toMeetingTime(b?.updatedAt) - toMeetingTime(a?.updatedAt);
  });
}

function dedupeMeetingsByEmployeeDate(rows = []) {
  const ordered = sortMeetingsLatestFirst(rows);
  const seen = new Set();
  const out = [];

  ordered.forEach((row) => {
    const email = String(row?.employeeEmail || "").toLowerCase();
    const meetingAt = String(row?.meetingAt || "");
    const key = email && meetingAt ? `${email}|${meetingAt}` : `id|${String(row?.meetingId || "")}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push(row);
  });

  return out;
}

async function getEmployeeMeetingStats(employeeEmail) {
  const email = String(employeeEmail || "").toLowerCase();
  if (!email) {
    return { totalMeetings: 0, lastMeetingAt: null };
  }

  if (!isMongoReady()) {
    const rows = memory.meetings.filter((row) => String(row?.employeeEmail || "").toLowerCase() === email);
    const deduped = dedupeMeetingsByEmployeeDate(rows);
    return {
      totalMeetings: deduped.length,
      lastMeetingAt: deduped[0]?.meetingAt || null,
    };
  }

  const rows = await mongoDb
    .collection("meetings")
    .find({ employeeEmail: email })
    .sort({ meetingAt: -1, updatedAt: -1 })
    .toArray();
  const deduped = dedupeMeetingsByEmployeeDate(rows);

  return {
    totalMeetings: deduped.length,
    lastMeetingAt: deduped[0]?.meetingAt || null,
  };
}

async function listMeetings({ employeeEmail, query, limit = 20 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 20), 100));
  const q = String(query || "").trim().toLowerCase();

  if (!isMongoReady()) {
    let rows = sortMeetingsLatestFirst(memory.meetings);
    if (employeeEmail) {
      rows = rows.filter((row) => row.employeeEmail === String(employeeEmail).toLowerCase());
    }
    if (q) {
      rows = rows.filter((row) => {
        const text = `${row.title || ""}\n${row.summary || ""}\n${(row.transcriptLines || []).join("\n")}`.toLowerCase();
        return text.includes(q);
      });
    }
    return dedupeMeetingsByEmployeeDate(rows).slice(0, safeLimit);
  }

  const filter = {};
  if (employeeEmail) {
    filter.employeeEmail = String(employeeEmail).toLowerCase();
  }
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { summary: { $regex: q, $options: "i" } },
      { transcriptLines: { $elemMatch: { $regex: q, $options: "i" } } },
    ];
  }

  const rows = await mongoDb
    .collection("meetings")
    .find(filter)
    .sort({ meetingAt: -1, updatedAt: -1 })
    .toArray();

  return dedupeMeetingsByEmployeeDate(rows).slice(0, safeLimit);
}

async function getMeetingById(meetingId) {
  if (!meetingId) {
    return null;
  }

  if (!isMongoReady()) {
    return memory.meetings.find((item) => item.meetingId === meetingId) || null;
  }

  return mongoDb.collection("meetings").findOne({ meetingId });
}

function sanitizeFilter(input = {}) {
  const safe = {};
  const allowedRisk = ["low", "medium", "high", "critical"];

  if (typeof input.employeeEmail === "string" && input.employeeEmail.includes("@")) {
    safe.employeeEmail = input.employeeEmail.toLowerCase();
  }

  if (typeof input.riskLevel === "string" && allowedRisk.includes(input.riskLevel.toLowerCase())) {
    safe["analysis.retentionRisk.level"] = input.riskLevel.toLowerCase();
  }

  if (typeof input.minHealthScore === "number") {
    safe["analysis.health.score"] = { ...(safe["analysis.health.score"] || {}), $gte: input.minHealthScore };
  }

  if (typeof input.maxHealthScore === "number") {
    safe["analysis.health.score"] = { ...(safe["analysis.health.score"] || {}), $lte: input.maxHealthScore };
  }

  if (typeof input.keyword === "string" && input.keyword.trim()) {
    safe["analysis.searchText"] = { $regex: input.keyword.trim(), $options: "i" };
  }

  const limit = Number(input.limit || 5);
  safe.__limit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 20)) : 5;
  return safe;
}

function mapProfileForRead(profile) {
  return {
    employeeEmail: profile.employeeEmail,
    employeeName: profile.employeeName,
    version: profile.version,
    analyzedAt: profile.analyzedAt,
    analysis: profile.analysis,
    sourceStats: profile.sourceStats,
  };
}

function dedupeLatestProfiles(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    const key = String(row?.employeeEmail || "").toLowerCase();
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, row);
    }
  });
  return Array.from(map.values());
}

async function queryProfiles(rawFilter) {
  const safeFilter = sanitizeFilter(rawFilter);
  const limit = safeFilter.__limit || 5;
  delete safeFilter.__limit;

  if (!isMongoReady()) {
    let rows = [...memory.profiles].sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());

    if (safeFilter.employeeEmail) {
      rows = rows.filter((item) => item.employeeEmail === safeFilter.employeeEmail);
    }

    if (safeFilter["analysis.retentionRisk.level"]) {
      rows = rows.filter(
        (item) =>
          String(item?.analysis?.retentionRisk?.level || "").toLowerCase() ===
          String(safeFilter["analysis.retentionRisk.level"])
      );
    }

    const scoreFilter = safeFilter["analysis.health.score"];
    if (scoreFilter?.$gte !== undefined) {
      rows = rows.filter((item) => Number(item?.analysis?.health?.score || 0) >= Number(scoreFilter.$gte));
    }
    if (scoreFilter?.$lte !== undefined) {
      rows = rows.filter((item) => Number(item?.analysis?.health?.score || 0) <= Number(scoreFilter.$lte));
    }

    if (safeFilter["analysis.searchText"]?.$regex) {
      const regex = new RegExp(safeFilter["analysis.searchText"].$regex, "i");
      rows = rows.filter((item) => regex.test(String(item?.analysis?.searchText || "")));
    }

    return rows.slice(0, limit).map(mapProfileForRead);
  }

  const mongoFilter = { ...safeFilter };

  if (mongoFilter["analysis.searchText"]?.$regex) {
    const rx = mongoFilter["analysis.searchText"].$regex;
    mongoFilter["analysis.searchText"] = { $regex: rx, $options: "i" };
  }

  const rows = await mongoDb
    .collection("employee_profiles")
    .find(mongoFilter)
    .sort({ analyzedAt: -1 })
    .limit(limit)
    .toArray();

  return rows.map(mapProfileForRead);
}

async function getDashboardSummary() {
  const rows = await queryProfiles({ limit: 250 });
  const latestRows = dedupeLatestProfiles(rows);

  const todayMeetings = latestRows
    .map((item) => item?.analysis?.brief?.meetingAt)
    .filter(Boolean)
    .slice(0, 10);

  const counts = { low: 0, medium: 0, high: 0, critical: 0 };
  latestRows.forEach((row) => {
    const key = String(row?.analysis?.retentionRisk?.level || "low").toLowerCase();
    if (counts[key] !== undefined) {
      counts[key] += 1;
    }
  });

  const totalEmployees = latestRows.length;
  const atRiskEmployees = counts.high + counts.critical;

  return {
    employees: latestRows.map((row) => ({
      email: row.employeeEmail,
      name: row.employeeName,
      healthScore: row?.analysis?.health?.score,
      riskLevel: row?.analysis?.retentionRisk?.level,
      sentimentTrend: row?.analysis?.sentiment?.trend,
    })),
    totalEmployees,
    employeeCount: totalEmployees,
    atRiskEmployees,
    highRiskCount: atRiskEmployees,
    riskCounts: counts,
    meetingsThisWeek: todayMeetings.length,
    todayMeetings,
    generatedAt: new Date().toISOString(),
  };
}

export {
  initMongo,
  upsertEmployeeIdentity,
  listEmployees,
  getSyncState,
  updateSyncState,
  isColdBootCompleted,
  markColdBootCompleted,
  getLatestProfile,
  getNextProfileVersion,
  saveProfile,
  saveAlerts,
  saveRawDataSnapshot,
  saveMeetingRecord,
  getEmployeeMeetingStats,
  listMeetings,
  getMeetingById,
  queryProfiles,
  getDashboardSummary,
  sanitizeFilter,
};
