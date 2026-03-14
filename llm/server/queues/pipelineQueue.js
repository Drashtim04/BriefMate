import { Queue, Worker } from "bullmq";
import Redis from "ioredis";

import { normalizeUnifiedSchema } from "../services/normalization/unifiedSchema.js";
import { fetchAllSourcesParallelWithDelta } from "../services/ingestion/fetchSources.js";
import {
  sentimentService,
  retentionService,
  summarizerService,
  briefService,
  comprehensiveSummaryService,
} from "../services/analysis/groqServices.js";
import {
  getNextProfileVersion,
  getLatestProfile,
  saveProfile,
  saveAlerts,
  saveRawDataSnapshot,
  getDashboardSummary,
  upsertEmployeeIdentity,
  getSyncState,
  updateSyncState,
  saveMeetingRecord,
  isColdBootCompleted,
  markColdBootCompleted,
} from "../services/storage/stores.js";
import { warmProfileCache, warmDashboardCache } from "../services/cache/cacheService.js";

const QUEUE_INGESTION = "pipeline-ingestion";
const QUEUE_ANALYSIS = "pipeline-analysis";

let connection = null;
let ingestionQueue = null;
let analysisQueue = null;
let ingestionWorker = null;
let analysisWorker = null;
let queueMode = "inline";
const debounceTimers = new Map();

function createAlerts(profile, previousProfile, reason) {
  const alerts = [];
  const now = new Date().toISOString();

  if (profile.analysis.retentionRisk.level === "critical") {
    alerts.push({
      employeeEmail: profile.employeeEmail,
      severity: "critical",
      kind: "critical_risk",
      message: "Retention risk is critical.",
      reason,
      createdAt: now,
    });
  }

  const previousRisk = Number(previousProfile?.analysis?.retentionRisk?.score || 0);
  const currentRisk = Number(profile.analysis.retentionRisk.score || 0);
  if (previousProfile && currentRisk - previousRisk >= 15) {
    alerts.push({
      employeeEmail: profile.employeeEmail,
      severity: "high",
      kind: "risk_increase",
      message: `Risk increased by ${currentRisk - previousRisk} points.`,
      reason,
      createdAt: now,
    });
  }

  const previousSentiment = Number(previousProfile?.analysis?.sentiment?.score || 0);
  const currentSentiment = Number(profile.analysis.sentiment.score || 0);
  if (previousProfile && previousSentiment - currentSentiment >= 20) {
    alerts.push({
      employeeEmail: profile.employeeEmail,
      severity: "high",
      kind: "sentiment_drop",
      message: `Sentiment dropped by ${previousSentiment - currentSentiment} points.`,
      reason,
      createdAt: now,
    });
  }

  return alerts;
}

function estimateHealth(sentiment, retentionRisk) {
  const retentionSafety = Math.max(0, 100 - Number(retentionRisk.riskScore || 0));
  return Math.max(0, Math.min(100, Math.round(sentiment.score * 0.6 + retentionSafety * 0.4)));
}

function buildMeetingRecord({ profile, rawSources, summary }) {
  const brief = rawSources?.meet?.meeting_brief || {};
  const date = brief?.date || new Date().toISOString().slice(0, 10);
  const meetingId = `${profile.employeeEmail}:${date}`;

  return {
    meetingId,
    employeeEmail: profile.employeeEmail,
    title: brief.previous_meeting || "1:1 Meeting",
    meetingAt: date,
    participants: Array.isArray(brief.attendees)
      ? brief.attendees.map((item) => ({ name: item.name || "Unknown", role: item.role || "Unknown" }))
      : [],
    transcript: Array.isArray(rawSources?.meet?.transcript) ? rawSources.meet.transcript : [],
    transcriptLines: Array.isArray(rawSources?.meet?.transcript)
      ? rawSources.meet.transcript.map((item) => `${item.speaker || "Unknown"}: ${item.text || item.message || ""}`)
      : [],
    summary: summary?.summary || "No summary",
    chunkSummaries: summary?.chunks || [],
    updatedAt: new Date().toISOString(),
  };
}

function hasDeltaData(rawSources) {
  const slackCount = Object.values(rawSources?.slack || {}).reduce((acc, value) => {
    if (!Array.isArray(value)) {
      return acc;
    }
    return acc + value.length;
  }, 0);

  const meetingCount = Array.isArray(rawSources?.meet?.transcript) ? rawSources.meet.transcript.length : 0;
  return slackCount > 0 || meetingCount > 0;
}

function pickIdentityCandidate(rawSources, employeeEmail) {
  const candidates = Array.isArray(rawSources?.identityCandidates) ? rawSources.identityCandidates : [];
  if (!candidates.length) {
    return null;
  }

  const targetEmail = String(employeeEmail || "").toLowerCase();
  if (!targetEmail) {
    return candidates[0];
  }

  return (
    candidates.find((item) => String(item?.employeeEmail || "").toLowerCase() === targetEmail) || candidates[0]
  );
}

async function runAnalysisPipeline({ unified, rawSources, reason, model, meetingAt }) {
  const employeeEmail = unified.employee.email.toLowerCase();
  const previousProfile = await getLatestProfile(employeeEmail);
  const previousRiskLevel = previousProfile?.analysis?.retentionRisk?.level || null;

  const [sentiment, retentionRisk, summary] = await Promise.all([
    sentimentService({ unified, model }),
    retentionService({ rawSources }),
    summarizerService({ unified, model }),
  ]);

  const enrichedBrief = await briefService({
    rawSources,
    previousRiskLevel,
    unified,
    sentiment,
    retentionRisk,
    summary,
    meetingAt,
  });

  const healthScore = estimateHealth(sentiment, retentionRisk);
  const version = await getNextProfileVersion(employeeEmail);
  const comprehensive = comprehensiveSummaryService({ unified, sentiment, retentionRisk, summary });

  const profile = {
    employeeEmail,
    employeeName: unified.employee.displayName,
    version,
    reason,
    analyzedAt: new Date().toISOString(),
    sourceStats: unified.sourceStats,
    analysis: {
      health: {
        score: healthScore,
        band: healthScore <= 40 ? "critical" : healthScore <= 60 ? "monitor" : healthScore <= 80 ? "healthy" : "thriving",
      },
      sentiment: {
        score: Number(sentiment.score || 0),
        trend: sentiment.trend || "flat",
        emotions: sentiment.emotions || [],
        evidence: sentiment.evidence || "",
      },
      retentionRisk: {
        score: Number(retentionRisk.riskScore || 0),
        level: retentionRisk.riskLevel || "low",
        signals: retentionRisk.signals || [],
        summary: retentionRisk.summary || "",
      },
      summary,
      brief: enrichedBrief?.brief || {},
      relationshipStatus: comprehensive.behavioralAnalysis.relationshipStatus,
      comprehensive,
      searchText: unified.mergedContextText,
    },
  };

  const alerts = createAlerts(profile, previousProfile, reason);

  await saveProfile(profile);
  await upsertEmployeeIdentity({
    employeeEmail,
    employeeId: unified?.employee?.employeeId || null,
    displayName: unified?.employee?.displayName || profile.employeeName || "Unknown",
    role: unified?.employee?.role || "Unknown",
    department: unified?.employee?.department || "Unknown",
    source: "bamboohr",
  });
  await saveAlerts(alerts);
  await saveMeetingRecord(buildMeetingRecord({ profile, rawSources, summary }));

  await warmProfileCache(profile);
  const dashboard = await getDashboardSummary();
  await warmDashboardCache(dashboard);

  return {
    profile,
    alerts,
    dashboard,
  };
}

async function runInlinePipeline({ dataRoot, employeeEmail, reason, model, meetingAt, injectedSlackEvent = null }) {
  const syncState = await getSyncState(employeeEmail);
  const historicalMode = reason === "cold-start";
  const rawSources = await fetchAllSourcesParallelWithDelta({
    dataRoot,
    employeeEmail,
    cursors: syncState,
    historicalMode,
    injectedSlackEvent,
  });
  const identity = pickIdentityCandidate(rawSources, employeeEmail);
  if (identity) {
    await upsertEmployeeIdentity(identity);
  }
  await updateSyncState(employeeEmail, rawSources.cursors);

  if (!historicalMode && !hasDeltaData(rawSources)) {
    return {
      skipped: true,
      reason: "No delta data available.",
      employeeEmail,
    };
  }

  const unified = normalizeUnifiedSchema(rawSources);
  await saveRawDataSnapshot({
    employeeEmail: String(employeeEmail).toLowerCase(),
    reason,
    fetchedAt: rawSources.fetchedAt,
    cursors: rawSources.cursors || {},
    payload: rawSources,
  });
  return runAnalysisPipeline({ unified, rawSources, reason, model, meetingAt });
}

async function startPipelineQueues({ redisUrl, dataRoot, model, mode = "auto" }) {
  const forceInline = mode === "inline";

  if (!forceInline) {
    try {
      connection = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        enableReadyCheck: false,
        retryStrategy: () => null,
      });
      connection.on("error", () => {
        // Suppress noisy unhandled event logs when Redis is down.
      });
      await connection.connect();
      await connection.ping();

      ingestionQueue = new Queue(QUEUE_INGESTION, { connection });
      analysisQueue = new Queue(QUEUE_ANALYSIS, { connection });

      ingestionWorker = new Worker(
        QUEUE_INGESTION,
        async (job) => {
          const employeeEmail = String(job.data.employeeEmail || "").toLowerCase();
          const reason = job.data.reason || "manual";

          const syncState = await getSyncState(employeeEmail);
          const historicalMode = Boolean(job.data.historicalMode);
          const rawSources = await fetchAllSourcesParallelWithDelta({
            dataRoot,
            employeeEmail,
            cursors: syncState,
            historicalMode,
            injectedSlackEvent: job.data.injectedSlackEvent || null,
          });

          const identity = pickIdentityCandidate(rawSources, employeeEmail);
          if (identity) {
            await upsertEmployeeIdentity(identity);
          }
          await updateSyncState(employeeEmail, rawSources.cursors);

          if (!historicalMode && !hasDeltaData(rawSources)) {
            return {
              employeeEmail,
              reason,
              skipped: true,
              skipReason: "No delta data available.",
            };
          }

          const unified = normalizeUnifiedSchema(rawSources);

          await saveRawDataSnapshot({
            employeeEmail,
            reason,
            fetchedAt: rawSources.fetchedAt,
            cursors: rawSources.cursors || {},
            payload: rawSources,
          });

          await analysisQueue.add(
            "analyze-profile",
            {
              unified,
              rawSources,
              reason,
              meetingAt: job.data.meetingAt || null,
            },
            { removeOnComplete: true, removeOnFail: 100 }
          );

          return {
            employeeEmail,
            reason,
          };
        },
        { connection }
      );

      analysisWorker = new Worker(
        QUEUE_ANALYSIS,
        async (job) => {
          return runAnalysisPipeline({
            unified: job.data.unified,
            rawSources: job.data.rawSources,
            reason: job.data.reason,
            model,
            meetingAt: job.data.meetingAt || null,
          });
        },
        { connection }
      );

      ingestionWorker.on("failed", (job, error) => {
        console.error("[queue] ingestion job failed", job?.id, error.message);
      });

      analysisWorker.on("failed", (job, error) => {
        console.error("[queue] analysis job failed", job?.id, error.message);
      });

      queueMode = "bullmq";
    } catch (error) {
      if (connection) {
        try {
          connection.disconnect();
        } catch {
          // no-op
        }
      }
      console.warn("[queue] BullMQ unavailable, using inline fallback:", error.message);
      queueMode = "inline";
    }
  } else {
    queueMode = "inline";
  }

  return {
    queues: {
      ingestionQueue,
      analysisQueue,
    },
    queueMode,
    runInlinePipeline: (payload) => runInlinePipeline({ dataRoot, model, ...payload }),
  };
}

async function enqueuePipelineRun({ employeeEmail, reason, dataRoot, model, meetingAt = null }) {
  if (queueMode === "inline") {
    const result = await runInlinePipeline({
      dataRoot,
      employeeEmail,
      reason: reason || "manual",
      model,
      meetingAt,
    });
    return {
      id: `inline-${Date.now()}`,
      mode: "inline",
      result,
    };
  }

  return ingestionQueue.add(
    "fetch-normalize",
    {
      employeeEmail,
      reason: reason || "manual",
      historicalMode: reason === "cold-start",
      meetingAt,
    },
    {
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}

async function enqueueDebouncedSlackReanalysis({ employeeEmail, message, debounceMs, dataRoot, model }) {
  if (queueMode === "inline") {
    const key = String(employeeEmail || "").toLowerCase();
    const existing = debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(async () => {
      try {
        await runInlinePipeline({
          dataRoot,
          employeeEmail,
          reason: "slack-webhook",
          model,
          injectedSlackEvent: message
            ? {
                text: message,
                timestamp: Math.floor(Date.now() / 1000),
                realName: "Webhook User",
              }
            : null,
        });
      } catch (error) {
        console.error("[queue] inline debounced run failed", error.message);
      }
    }, debounceMs);

    debounceTimers.set(key, timeout);

    return {
      id: `inline-debounce-${key}`,
      mode: "inline",
    };
  }

  const jobId = `slack-reanalysis:${String(employeeEmail || "").toLowerCase()}`;
  const existing = await ingestionQueue.getJob(jobId);
  if (existing) {
    await existing.remove();
  }

  return ingestionQueue.add(
    "fetch-normalize",
    {
      employeeEmail,
      reason: "slack-webhook",
      webhookMessage: message || "",
      injectedSlackEvent: message
        ? {
            text: message,
            timestamp: Math.floor(Date.now() / 1000),
            realName: "Webhook User",
          }
        : null,
    },
    {
      delay: debounceMs,
      jobId,
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}

async function runColdStartBootstrap({ dataRoot, model }) {
  const alreadyBooted = await isColdBootCompleted();
  if (alreadyBooted) {
    return {
      skipped: true,
      reason: "Cold boot already completed",
    };
  }

  const sources = await fetchAllSourcesParallelWithDelta({
    dataRoot,
    employeeEmail: null,
    historicalMode: true,
    cursors: {},
  });

  const requireSlackMatch = String(process.env.BOOTSTRAP_REQUIRE_SLACK_MATCH || "true").toLowerCase() !== "false";
  const maxEmployees = Math.max(1, Number.parseInt(String(process.env.BOOTSTRAP_EMPLOYEE_LIMIT || "5"), 10) || 5);

  const identitiesAll = Array.isArray(sources.identityCandidates) ? sources.identityCandidates : [];
  const identities = identitiesAll
    .filter((identity) => !requireSlackMatch || identity?.hasSlackMember)
    .slice(0, maxEmployees);
  const results = [];

  for (const identity of identities) {
    if (!identity?.employeeEmail) {
      continue;
    }
    await upsertEmployeeIdentity(identity);
    const run = await enqueuePipelineRun({
      employeeEmail: identity.employeeEmail,
      reason: "cold-start",
      dataRoot,
      model,
    });
    results.push({ employeeEmail: identity.employeeEmail, jobId: run?.id || null });
  }

  await markColdBootCompleted({
    initializedEmployees: results.length,
    at: new Date().toISOString(),
  });

  return {
    skipped: false,
    initializedEmployees: results.length,
    jobs: results,
  };
}

export {
  startPipelineQueues,
  enqueuePipelineRun,
  enqueueDebouncedSlackReanalysis,
  runColdStartBootstrap,
  queueMode,
};
