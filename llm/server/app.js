import "dotenv/config";
import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { env } from "./config/env.js";
import {
  initMongo,
  queryProfiles,
  getLatestProfile,
  getDashboardSummary,
  sanitizeFilter,
  listMeetings,
  getMeetingById,
  listEmployees,
  getEmployeeMeetingStats,
  getChatSession,
  createChatSession,
  appendChatMessage,
  listChatMessages,
} from "./services/storage/stores.js";
import { initCache, getJson, warmDashboardCache } from "./services/cache/cacheService.js";
import {
  startPipelineQueues,
  enqueuePipelineRun,
  enqueueDebouncedSlackReanalysis,
  runColdStartBootstrap,
} from "./queues/pipelineQueue.js";
import {
  intentExtractorService,
  chatAssistantService,
} from "./services/analysis/groqServices.js";
import { initGroqDispatcher, getGroqDispatcherInfo } from "./services/analysis/groqDispatcher.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const runPipelineSchema = z.object({
  employeeEmail: z.string().email(),
  reason: z.string().optional(),
  meetingAt: z.string().optional(),
});

const slackWebhookSchema = z.object({
  employeeEmail: z.string().email(),
  message: z.string().default(""),
  timestamp: z.string().optional(),
});

const chatSchema = z.object({
  query: z.string().min(3),
  stream: z.boolean().optional().default(false),
  sessionId: z.string().min(3).max(120).optional(),
});

const createChatSessionSchema = z.object({
  sessionId: z.string().min(3).max(120).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

const bootstrapSchema = z.object({
  force: z.boolean().optional().default(false),
});

const upcomingBriefSchema = z.object({
  employeeEmail: z.string().email(),
  meetingAt: z.string().optional(),
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "chro-ai-orchestrator",
    at: new Date().toISOString(),
    groqDispatcher: getGroqDispatcherInfo(),
  });
});

app.get("/employees", async (_req, res) => {
  try {
    const rows = await listEmployees();
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const stats = await getEmployeeMeetingStats(row.employeeEmail);
        return {
          ...row,
          totalMeetings: stats.totalMeetings,
          lastMeetingAt: stats.lastMeetingAt || row.lastMeetingAt || row.updatedAt || null,
        };
      })
    );
    return res.json({ count: enriched.length, data: enriched });
  } catch (error) {
    return res.status(500).json({ error: error.message || "failed to list employees" });
  }
});

app.post("/bootstrap/init", async (req, res) => {
  try {
    bootstrapSchema.parse(req.body || {});
    const output = await runColdStartBootstrap({
      dataRoot: env.DATA_ROOT,
      model: env.GROQ_MODEL,
    });
    return res.status(202).json(output);
  } catch (error) {
    return res.status(400).json({ error: error.message || "bootstrap failed" });
  }
});

app.post("/pipeline/run", async (req, res) => {
  try {
    const parsed = runPipelineSchema.parse(req.body || {});
    const job = await enqueuePipelineRun({
      employeeEmail: parsed.employeeEmail,
      reason: parsed.reason || "manual",
      dataRoot: env.DATA_ROOT,
      model: env.GROQ_MODEL,
      meetingAt: parsed.meetingAt || null,
    });
    res.status(202).json({ accepted: true, jobId: job.id });
  } catch (error) {
    res.status(400).json({ error: error.message || "invalid request" });
  }
});

app.post("/webhooks/slack", async (req, res) => {
  try {
    const parsed = slackWebhookSchema.parse(req.body || {});

    const job = await enqueueDebouncedSlackReanalysis({
      employeeEmail: parsed.employeeEmail,
      message: parsed.message,
      debounceMs: env.SLACK_DEBOUNCE_MS,
      dataRoot: env.DATA_ROOT,
      model: env.GROQ_MODEL,
    });

    res.status(202).json({
      accepted: true,
      debounceMs: env.SLACK_DEBOUNCE_MS,
      jobId: job.id,
      reason: "New Slack message queued for debounced batch reanalysis",
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "invalid webhook payload" });
  }
});

app.get("/dashboard", async (_req, res) => {
  try {
    const cached = await getJson("dashboard");
    if (cached) {
      return res.json({ source: "cache", data: cached });
    }

    const summary = await getDashboardSummary();
    await warmDashboardCache(summary);
    return res.json({ source: "store", data: summary });
  } catch (error) {
    return res.status(500).json({ error: error.message || "failed to load dashboard" });
  }
});

app.get("/employees/:email/profile", async (req, res) => {
  try {
    const email = String(req.params.email || "").toLowerCase();
    const stats = await getEmployeeMeetingStats(email);

    const withStats = (doc) => {
      const existingMeta = doc?.meta && typeof doc.meta === "object" ? doc.meta : {};
      const meetingCount = Number(stats.totalMeetings || existingMeta.meetingCount || doc?.meetingCount || 0);
      const lastMeetingAt = stats.lastMeetingAt || existingMeta.lastMeetingAt || doc?.lastMeetingAt || null;

      return {
        ...doc,
        meta: {
          ...existingMeta,
          meetingCount,
          lastMeetingAt,
        },
        meetingCount,
        lastMeetingAt,
      };
    };

    const cached = await getJson(`profile:${email}`);
    if (cached) {
      return res.json({ source: "cache", data: withStats(cached) });
    }

    const latest = await getLatestProfile(email);
    if (!latest) {
      return res.status(404).json({ error: "profile not found" });
    }

    return res.json({ source: "store", data: withStats(latest) });
  } catch (error) {
    return res.status(500).json({ error: error.message || "failed to load profile" });
  }
});

app.get("/meetings", async (req, res) => {
  try {
    const email = req.query.employeeEmail ? String(req.query.employeeEmail).toLowerCase() : undefined;
    const query = req.query.q ? String(req.query.q) : "";
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const rows = await listMeetings({ employeeEmail: email, query, limit });
    return res.json({
      count: rows.length,
      data: rows.map((row) => ({
        meetingId: row.meetingId,
        title: row.title,
        meetingAt: row.meetingAt,
        employeeEmail: row.employeeEmail,
        participants: row.participants || [],
        summary: row.summary || "",
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "failed to load meetings" });
  }
});

app.get("/meetings/:id/transcript", async (req, res) => {
  try {
    const meeting = await getMeetingById(String(req.params.id || ""));
    if (!meeting) {
      return res.status(404).json({ error: "meeting not found" });
    }

    const q = req.query.q ? String(req.query.q).toLowerCase() : "";
    const transcript = Array.isArray(meeting.transcript) ? meeting.transcript : [];
    const filteredTranscript = q
      ? transcript.filter((line) => String(line.text || line.message || "").toLowerCase().includes(q))
      : transcript;

    return res.json({
      meetingId: meeting.meetingId,
      title: meeting.title,
      meetingAt: meeting.meetingAt,
      participants: meeting.participants || [],
      summary: meeting.summary || "",
      transcript: filteredTranscript,
      transcriptCount: filteredTranscript.length,
      totalTranscriptCount: transcript.length,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "failed to load transcript" });
  }
});

app.post("/briefs/upcoming", async (req, res) => {
  try {
    const parsed = upcomingBriefSchema.parse(req.body || {});
    const run = await enqueuePipelineRun({
      employeeEmail: parsed.employeeEmail,
      reason: "upcoming-brief",
      dataRoot: env.DATA_ROOT,
      model: env.GROQ_MODEL,
      meetingAt: parsed.meetingAt || null,
    });

    const latest = await getLatestProfile(parsed.employeeEmail.toLowerCase());
    if (!latest) {
      return res.status(202).json({ accepted: true, jobId: run.id, message: "brief generation queued" });
    }

    return res.status(202).json({
      accepted: true,
      jobId: run.id,
      employeeEmail: parsed.employeeEmail.toLowerCase(),
      brief: latest?.analysis?.brief || null,
      relationshipStatus: latest?.analysis?.relationshipStatus || null,
      guidance: {
        conversationStarters: latest?.analysis?.brief?.conversationStarters || [],
        recommendedTone: latest?.analysis?.brief?.recommendedTone || "supportive and direct",
      },
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "failed to generate upcoming brief" });
  }
});

app.post("/chat/sessions", async (req, res) => {
  try {
    const parsed = createChatSessionSchema.parse(req.body || {});
    const sessionId = String(parsed.sessionId || randomUUID());
    const session = await createChatSession({
      sessionId,
      status: parsed.status || "active",
    });

    return res.status(201).json({
      ok: true,
      data: {
        sessionId: session?.sessionId || sessionId,
        status: session?.status || "active",
        startedAt: session?.startedAt || new Date().toISOString(),
        lastMessageAt: session?.lastMessageAt || new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "failed to create chat session" });
  }
});

app.get("/chat/sessions/:sessionId/history", async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || "").trim();
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const limit = Math.max(1, Math.min(Number(req.query.limit || 120), 500));
    const session = await getChatSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "chat session not found" });
    }

    const rows = await listChatMessages(sessionId, { limit });
    return res.json({
      sessionId,
      count: rows.length,
      data: rows.map((row) => ({
        sessionId: row.sessionId,
        messageIndex: Number(row.messageIndex || 0),
        role: row.role || "assistant",
        content: row.content || "",
        metadata: row.metadata || {},
        createdAt: row.createdAt || null,
      })),
      session: {
        status: session.status || "active",
        startedAt: session.startedAt || null,
        lastMessageAt: session.lastMessageAt || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "failed to load chat history" });
  }
});

app.post("/chat/query", async (req, res) => {
  try {
    const parsed = chatSchema.parse(req.body || {});
    const sessionId = String(parsed.sessionId || randomUUID());

    await createChatSession({ sessionId, status: "active" });
    await appendChatMessage({
      sessionId,
      role: "user",
      content: parsed.query,
      metadata: { source: "chat-query" },
    });

    const rawFilter = await intentExtractorService({
      query: parsed.query,
      model: env.GROQ_MODEL,
    });

    const validatedFilter = sanitizeFilter(rawFilter);
    const rows = await queryProfiles(rawFilter);

    const response = await chatAssistantService({
      query: parsed.query,
      rows,
      model: env.GROQ_MODEL,
    });

    await appendChatMessage({
      sessionId,
      role: "assistant",
      content: String(response.answer || "No response generated."),
      metadata: {
        count: rows.length,
        filters: validatedFilter,
        transcriptCards: Array.isArray(response.transcriptCards) ? response.transcriptCards : [],
      },
    });

    if (parsed.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const tokens = String(response.answer || "").split(" ");
      for (let index = 0; index < tokens.length; index += 1) {
        const chunk = tokens[index];
        res.write(`event: token\n`);
        res.write(`data: ${JSON.stringify({ token: chunk, index })}\n\n`);
      }

      res.write("event: session\n");
      res.write(`data: ${JSON.stringify({ sessionId })}\n\n`);
      res.write("event: cards\n");
      res.write(`data: ${JSON.stringify({ transcriptCards: response.transcriptCards })}\n\n`);
      res.write("event: end\n");
      res.write("data: {}\n\n");
      res.end();
      return;
    }

    return res.json({
      sessionId,
      query: parsed.query,
      filter: validatedFilter,
      count: rows.length,
      answer: response.answer,
      transcriptCards: response.transcriptCards,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "chat request failed" });
  }
});

async function start() {
  const groqDispatchInfo = await initGroqDispatcher({
    redisUrl: env.REDIS_URL,
    mode: env.GROQ_DISPATCH_MODE,
    requestsPerMinute: env.GROQ_REQUESTS_PER_MINUTE,
    windowMs: env.GROQ_RATE_WINDOW_MS,
  });

  const mongoInfo = await initMongo({
    mongoUri: env.MONGO_URI,
    mongoDbName: env.MONGO_DB,
    useMemoryStore: env.USE_MEMORY_STORE,
  });

  const cacheInfo = await initCache({
    redisUrl: env.REDIS_URL,
    useMemoryCache: env.USE_MEMORY_CACHE,
  });

  const queueInfo = await startPipelineQueues({
    redisUrl: env.REDIS_URL,
    dataRoot: env.DATA_ROOT,
    model: env.GROQ_MODEL,
    mode: env.QUEUE_MODE,
  });

  const shouldBoot = String(process.env.COLD_BOOT_ON_START || "true").toLowerCase() === "true";
  if (shouldBoot) {
    const boot = await runColdStartBootstrap({
      dataRoot: env.DATA_ROOT,
      model: env.GROQ_MODEL,
    });
    console.log("[server] cold boot:", boot);
  }

  app.listen(env.PORT, () => {
    console.log(`[server] listening on :${env.PORT}`);
    console.log(`[server] mongo mode: ${mongoInfo.mode}`);
    console.log(`[server] cache mode: ${cacheInfo.mode}`);
    console.log(`[server] data root: ${env.DATA_ROOT}`);
    console.log(`[server] queue mode: ${queueInfo.queueMode}`);
    console.log(`[server] groq dispatch mode: ${groqDispatchInfo.mode}`);
    console.log(`[server] groq rpm limit: ${groqDispatchInfo.rpmLimit} (reserve ${Math.max(0, 30 - groqDispatchInfo.rpmLimit)} for demo)`);
  });
}

start().catch((error) => {
  console.error("[server] startup failed", error.message);
  process.exit(1);
});
