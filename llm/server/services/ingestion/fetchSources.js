import fs from "fs";
import path from "path";
import { getDatabaseMeetingSource } from "../storage/stores.js";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function toNumericTs(value, fallback = 0) {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalized = String(value).split(".")[0];
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mergeInjectedSlackEvent(payload, event = null) {
  if (!event?.text) {
    return payload;
  }

  const copy = JSON.parse(JSON.stringify(payload));
  if (!Array.isArray(copy.hr_discussions)) {
    copy.hr_discussions = [];
  }

  const nowTs = event.timestamp ? toNumericTs(event.timestamp) : Math.floor(Date.now() / 1000);
  copy.hr_discussions.push({
    userId: event.userId || "U_WEBHOOK",
    realName: event.realName || "Webhook User",
    text: String(event.text),
    timestamp: `${nowTs}.000000`,
    threadTs: null,
    reactions: [],
  });

  return copy;
}

async function fetchSlackMock(dataRoot, employeeEmail) {
  const payload = readJson(path.join(dataRoot, "hr_slack_simulation.json"));
  if (!employeeEmail) {
    return payload;
  }

  const member = Array.isArray(payload?.members)
    ? payload.members.find((item) => String(item.email || "").toLowerCase() === String(employeeEmail).toLowerCase())
    : null;

  if (!member) {
    return payload;
  }

  const copy = { ...payload };
  Object.keys(copy).forEach((key) => {
    if (!Array.isArray(copy[key])) {
      return;
    }
    copy[key] = copy[key].filter((item) => {
      if (item.userId === member.userId || item.realName === member.realName) {
        return true;
      }
      return String(item.text || "").toLowerCase().includes(member.realName.toLowerCase());
    });
  });
  return copy;
}

async function fetchMeetTranscriptMock(dataRoot) {
  return readJson(path.join(dataRoot, "meeting_transcript.json"));
}

function selectMeetingForEmployee(meet, employeeEmail) {
  if (!Array.isArray(meet?.meetings)) {
    return meet;
  }

  const targetEmail = String(employeeEmail || "").toLowerCase();
  const chosen = targetEmail
    ? meet.meetings.find((row) => String(row?.employeeEmail || "").toLowerCase() === targetEmail)
    : meet.meetings[0];

  return chosen || { transcript: [] };
}

async function resolveMeetingSource({ meet, employeeEmail }) {
  const fallbackMeet = selectMeetingForEmployee(meet, employeeEmail) || { transcript: [] };
  try {
    const dbMeet = await getDatabaseMeetingSource(employeeEmail);
    if (Array.isArray(dbMeet?.transcript) && dbMeet.transcript.length > 0) {
      return dbMeet;
    }
  } catch {
    // Fall back to current source if database transcript bridge is unavailable.
  }

  return fallbackMeet;
}

async function fetchBambooHrMock(dataRoot, employeeEmail) {
  const payload = readJson(path.join(dataRoot, "bamboohr_data.json"));
  const targetEmail = String(employeeEmail || "").toLowerCase();

  // New format: { employees: [...] }
  if (Array.isArray(payload?.employees)) {
    if (!targetEmail) {
      return payload;
    }

    const selected = payload.employees.find(
      (row) => String(row?.workEmail || row?.email || "").toLowerCase() === targetEmail
    );

    if (!selected) {
      return payload;
    }

    return {
      ...payload,
      employee: {
        id: selected.id || selected.employeeId || null,
        firstName: selected.firstName || "",
        lastName: selected.lastName || "",
        displayName:
          selected.displayName ||
          [selected.firstName, selected.lastName].filter(Boolean).join(" ") ||
          "Unknown",
        workEmail: selected.workEmail || selected.email || "",
        location: selected.location || "",
      },
      job: {
        title: selected.role || selected.title || selected.jobTitle || "",
        department: selected.department || "",
        hireDate: selected.hireDate || "",
        reportsTo: {
          id: selected.supervisorId || null,
          name: selected.supervisor || selected.managerName || "",
          title: "",
        },
      },
      performance: selected.performance || {},
      timeOff: selected.timeOff || {},
      compensation: selected.compensation || {},
    };
  }

  if (!employeeEmail) {
    return payload;
  }
  const email = String(payload?.employee?.workEmail || "").toLowerCase();
  if (email && email === String(employeeEmail).toLowerCase()) {
    return payload;
  }
  return payload;
}

async function fetchAllSourcesParallel({ dataRoot, employeeEmail }) {
  const [slack, meet, hrms] = await Promise.all([
    fetchSlackMock(dataRoot, employeeEmail),
    fetchMeetTranscriptMock(dataRoot),
    fetchBambooHrMock(dataRoot, employeeEmail),
  ]);

  const selectedMeet = await resolveMeetingSource({ meet, employeeEmail });

  return {
    slack,
    meet: selectedMeet,
    hrms,
    fetchedAt: new Date().toISOString(),
  };
}

function applySlackDelta(slack, slackCursor, historicalMode) {
  const cursor = Number(slackCursor || 0);
  const output = JSON.parse(JSON.stringify(slack || {}));
  let maxTs = cursor;

  Object.keys(output).forEach((channel) => {
    if (!Array.isArray(output[channel])) {
      return;
    }

    const sorted = output[channel].slice().sort((a, b) => toNumericTs(a.timestamp || a.ts) - toNumericTs(b.timestamp || b.ts));
    output[channel] = sorted.filter((item) => {
      const ts = toNumericTs(item.timestamp || item.ts);
      if (ts > maxTs) {
        maxTs = ts;
      }
      return historicalMode ? true : ts > cursor;
    });
  });

  return { data: output, nextCursor: maxTs };
}

function applyMeetingDelta(meet, meetingCursor, historicalMode) {
  const cursor = Number(meetingCursor || 0);
  const transcript = Array.isArray(meet?.transcript) ? meet.transcript : [];
  const enriched = transcript.map((item, index) => ({ ...item, __index: index + 1 }));

  const filtered = historicalMode
    ? enriched
    : enriched.filter((item) => Number(item.__index) > cursor);

  const nextCursor = Math.max(cursor, transcript.length);
  const out = {
    ...meet,
    transcript: filtered.map(({ __index, ...rest }) => rest),
  };

  return { data: out, nextCursor };
}

function extractIdentityCandidates({ hrms, slack }) {
  const candidates = [];

  const slackEmails = new Set(
    Array.isArray(slack?.members)
      ? slack.members
          .map((member) => String(member?.email || "").toLowerCase())
          .filter(Boolean)
      : []
  );

  const employeeRows = Array.isArray(hrms?.employees)
    ? hrms.employees
    : hrms?.employee
      ? [
          {
            ...hrms.employee,
            role: hrms?.job?.title,
            department: hrms?.job?.department,
          },
        ]
      : [];

  employeeRows.forEach((row) => {
    const employeeEmail = String(row?.workEmail || row?.email || "").toLowerCase();
    if (!employeeEmail) {
      return;
    }

    candidates.push({
      employeeEmail,
      employeeId: row?.id || null,
      displayName:
        row?.displayName ||
        [row?.firstName, row?.lastName].filter(Boolean).join(" ") ||
        "Unknown",
      role: row?.role || row?.title || "Unknown",
      department: row?.department || "Unknown",
      source: "bamboohr",
      hasSlackMember: slackEmails.has(employeeEmail),
    });
  });

  return candidates;
}

async function fetchAllSourcesParallelWithDelta({
  dataRoot,
  employeeEmail,
  cursors = {},
  historicalMode = false,
  injectedSlackEvent = null,
}) {
  const [slack, meet, hrms] = await Promise.all([
    fetchSlackMock(dataRoot, employeeEmail),
    fetchMeetTranscriptMock(dataRoot),
    fetchBambooHrMock(dataRoot, employeeEmail),
  ]);

  const selectedMeet = await resolveMeetingSource({ meet, employeeEmail });

  const mergedSlack = mergeInjectedSlackEvent(slack, injectedSlackEvent);
  const slackDelta = applySlackDelta(mergedSlack, cursors.slackCursor, historicalMode);
  const meetDelta = applyMeetingDelta(selectedMeet, cursors.meetingCursor, historicalMode);

  const identityCandidates = extractIdentityCandidates({ hrms, slack: mergedSlack });

  return {
    slack: slackDelta.data,
    meet: meetDelta.data,
    hrms,
    cursors: {
      slackCursor: slackDelta.nextCursor,
      meetingCursor: meetDelta.nextCursor,
    },
    identityCandidates,
    historicalMode,
    fetchedAt: new Date().toISOString(),
  };
}

export { fetchAllSourcesParallel, fetchAllSourcesParallelWithDelta, extractIdentityCandidates };
