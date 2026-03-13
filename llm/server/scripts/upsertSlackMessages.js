import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
const dbName = process.env.MONGO_DB || "chro_intelligence";
const orgId = process.env.ORG_ID || process.env.DEFAULT_ORG_ID || null;
const includeHrDiscussions =
  String(process.env.SLACK_INCLUDE_HR_DISCUSSIONS || "false").toLowerCase() === "true";

if (!mongoUri) {
  throw new Error("Missing MONGO_URI in llm/.env");
}

const payloadPath = path.join(process.cwd(), "mock_data", "hr_slack_simulation.json");
const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));

const members = Array.isArray(payload?.members) ? payload.members : [];
const memberByUserId = new Map(
  members
    .map((member) => {
      const userId = String(member?.userId || "");
      if (!userId) return null;
      return [
        userId,
        {
          email: String(member?.email || "").toLowerCase() || null,
          realName: member?.realName || member?.displayName || null,
        },
      ];
    })
    .filter(Boolean)
);

const channelNameToId = {
  general: process.env.SLACK_GENERAL_CHANNEL_ID || "general",
  random: process.env.SLACK_RANDOM_CHANNEL_ID || "random",
};

const excludedKeys = new Set(["members", "summary"]);
if (!includeHrDiscussions) {
  excludedKeys.add("hr_discussions");
}

const channelEntries = Object.entries(payload || {}).filter(
  ([key, value]) => Array.isArray(value) && !excludedKeys.has(key)
);

function toDateFromTs(tsValue) {
  const asNumber = Number(tsValue);
  if (!Number.isFinite(asNumber) || asNumber <= 0) {
    return null;
  }
  return new Date(Math.floor(asNumber * 1000));
}

const client = new MongoClient(mongoUri);
await client.connect();

const db = client.db(dbName);
const collection = db.collection("slack_messages");

const nowIso = new Date().toISOString();
const operations = [];
let processedMessages = 0;

for (const [channelName, rows] of channelEntries) {
  const channelId = channelNameToId[channelName] || channelName;

  for (const row of rows) {
    const text = String(row?.text || "").trim();
    const ts = String(row?.timestamp || row?.ts || "").trim();
    const userId = String(row?.userId || row?.user || "").trim();

    if (!text || !ts || !userId) {
      continue;
    }

    const member = memberByUserId.get(userId);
    const employeeEmail = member?.email || null;
    const realName = row?.realName || member?.realName || null;
    const tsDate = toDateFromTs(ts);
    const messageKey = `${channelId}:${ts}:${userId}`;

    const doc = {
      messageKey,
      employeeEmail,
      channelId,
      channelName,
      ts,
      tsDate,
      text,
      userId,
      realName,
      threadTs: row?.threadTs || row?.thread_ts || null,
      reactions: Array.isArray(row?.reactions) ? row.reactions : [],
      updatedAt: nowIso,
    };

    if (orgId) {
      doc.orgId = orgId;
    }

    operations.push({
      updateOne: {
        filter: orgId ? { orgId, messageKey } : { messageKey },
        update: {
          $set: doc,
          $setOnInsert: { createdAt: nowIso },
        },
        upsert: true,
      },
    });

    processedMessages += 1;
  }
}

if (operations.length > 0) {
  await collection.bulkWrite(operations, { ordered: false });
}

const countFilter = orgId ? { orgId } : {};
const totalMessages = await collection.countDocuments(countFilter);

const latestSample = await collection
  .find(countFilter)
  .sort({ tsDate: -1, updatedAt: -1 })
  .limit(3)
  .project({ _id: 0, messageKey: 1, employeeEmail: 1, channelName: 1, ts: 1, text: 1 })
  .toArray();

await client.close();

console.log(
  JSON.stringify(
    {
      dbName,
      processedMessages,
      operations: operations.length,
      totalMessages,
      includedChannels: channelEntries.map(([channelName]) => channelName),
      latestSample,
    },
    null,
    2
  )
);
