# Schema Findings + Slack-First Next Steps

This doc captures:
1) The comparison between your proposed schema and the current reference model in [DATA_MODEL.md](DATA_MODEL.md)
2) What we observed from real BambooHR responses (`/employees/directory`, `/meta/fields`)
3) A concrete plan to fetch Slack data next (so we can finalize Slack schema)

---

## 1) Comparison: Your Proposed DB vs DATA_MODEL.md

### 1.1 What already aligns
- **Core pattern**: official HRMS data + multi-source communications → extracted insights stored as immutable events.
- **Multi-source ingestion**: meetings/transcripts, email, calendar, slack map cleanly to `documents` + `document_chunks` + `document_participants`.
- **Derived signals**: concerns, career signals, sentiment, action items, unresolved concerns map to `memory_events` (+ optional `action_items`).
- **Daily sync**: supported via `documents.content_hash` (idempotency), scheduled ingestion, and reprocessing.

### 1.2 What’s missing / should be added

#### A) HRMS domains you listed (employment/comp/perf/leave/tenure/offboarding)
`DATA_MODEL.md` currently has a thin `employee_official_profile`. Your HRMS breakdown is correct and should be modeled explicitly.

Recommendation (MongoDB): split HRMS into domain docs/collections for sensitivity + change cadence:
- `hrms_identity` (name, workEmail, phones, location, pronouns if present)
- `hrms_employment` (jobTitle, department, division, manager ref, join date, status, emp type)
- `hrms_compensation` (base, bonus, equity, pay band, last raise date) **sensitive**
- `hrms_performance` (ratings, review cycles, promotion history, manager feedback) **sensitive**
- `hrms_attendance_leave` (leave balances, sick leave, overtime, pattern observations) **sensitive**
- `hrms_offboarding` (termination date, exit reason, voluntary/involuntary) **very sensitive**

Each should include: `org_id`, `employee_id`, `as_of`, `source_document_id`, `sensitivity`.

#### B) Per-speaker sentiment / signals
Your requirement “sentiment per speaker” needs speaker metadata in `memory_events.payload` (not just employee-level sentiment):
- `speaker_type`: `employee|leader|other`
- `speaker_external_ref`: e.g., Slack user id / email / meeting speaker label
- `target_employee_id`: optional (who the message is about)

#### C) Surveys & employee feedback systems
Not explicitly modeled in `DATA_MODEL.md`.

Add a `survey_responses` collection (or map to `documents` + extracted `memory_events`):
- `employee_id`, `survey_type`, `category`, `score`, `comment`, `timestamp`, `source_document_id`.

#### D) Calendar-derived metrics
Calendar events should be stored as documents, but metrics like meeting load / back-to-back / after-hours should become:
- either `memory_events` of type `workload_signal`
- or an optional rollup collection like `employee_metrics_daily`.

#### E) Slack schema is intentionally pending
We will finalize Slack schema after probing what data we get (channels vs DMs, thread replies, mentions, user mapping).

---

## 2) BambooHR: What we observed from the real API responses

### 2.1 `GET /v1/employees/directory`
Observed response shape:
- Top-level contains `fields[]` and `employees[]`.
- `employees[]` includes (observed):
  - `id` (string)
  - `displayName`, `firstName`, `lastName`, `preferredName` (nullable)
  - `jobTitle`, `department`, `location`, `division`
  - `workEmail`, `workPhone`, `mobilePhone`, `workPhoneExtension`
  - `supervisor` (manager **name string**, not id)
  - `photoUploaded` (bool), `photoUrl` (url)
  - social links fields (facebook/linkedin/twitterFeed), pronouns (nullable)

Important implication:
- Manager relation is not a stable ID in this endpoint; we must store manager display name and optionally resolve to an employee id via best-effort matching.

### 2.2 `GET /v1/meta/fields`
Observed response shape:
- Returns an array of field definitions.
- Some items include `alias` (example: `workPhone`, `zipcode`, `terminationDate`, `jobLevel`, `payBand`), many do not.
- Includes a lot of benefit/custom fields, so **ingestion should be selective** (whitelist aliases you actually need).

---

## 3) Slack: exact endpoints + fields we fetch (storage contract)

This section is the concrete “what Slack data we fetch” list, aligned to the backend implementation (Slack Web API via `@slack/web-api`). Use this to decide what to store.

Important: our **probe routes** intentionally return **safe summaries** (no message text), but the underlying Slack API responses include full fields like `text`, `blocks`, etc. Your ingestion/storage layer can store the full payload (recommended) while the probe stays privacy-safe.

### 3.1 `auth.test` (connectivity + token identity)
Used via `GET /api/slack/auth/test`.

Fetches:
- Workspace identity: `team`, `team_id`
- Bot/user identity: `user`, `user_id`, `bot_id`

Store (recommended):
- `slack_installation.team_id`, `slack_installation.bot_id` (used to scope all other Slack entities)

### 3.2 `users.list` (user directory)
Used via `GET /api/slack/users/list` (probe returns counts + sample ids).

Slack returns (key fields you should store):
- Top-level: `members[]`
- Per member:
  - `id`, `name`, `real_name`
  - flags: `deleted`, `is_bot`, `is_restricted`, `is_ultra_restricted`
  - `profile.*`:
    - `email` (critical for HRMS join)
    - `first_name`, `last_name`
    - `display_name`
    - `real_name`, `real_name_normalized`

Store (minimum):
- `slack_users`: `slack_user_id`, `email` (if present), `display_name`, `real_name`, flags, plus `team_id`.

### 3.3 `conversations.list` (channel discovery)
Used via `GET /api/slack/conversations/list?types=public_channel,private_channel`.

Slack returns (key fields to store):
- Top-level: `channels[]`
- Per channel:
  - `id`, `name`
  - `is_private`, `is_member`, `is_archived`
  - `num_members` (may be missing depending on type/scopes)

Store (minimum):
- `slack_channels`: `channel_id`, `name`, `is_private`, `is_archived`, `team_id`

### 3.4 `conversations.info` (channel metadata)
Used via `GET /api/slack/conversations/:channelId/info`.

Slack returns (key fields to store):
- `channel.id`, `channel.name`
- channel type flags: `is_channel`, `is_group`, `is_im`, `is_private`
- membership flags: `is_member`, `is_archived`
- `created`, `num_members`
- `topic.value`, `purpose.value`

Store (recommended):
- `slack_channels` add: `topic`, `purpose`, `created`

### 3.5 `conversations.history` (channel messages)
Used via `GET /api/slack/conversations/:channelId/history?limit=25&oldest=&latest=`.

Slack returns (key fields to store per message):
- Identifiers:
  - `ts` (message id)
  - `thread_ts` (if part of a thread or thread root)
- Actor:
  - `user` (author user id)
  - bot/system: `bot_id`, `subtype`
- Content:
  - `text` (probe hides this, ingestion should store)
  - `blocks[]` (rich formatting)
  - `files[]` (attachments; store metadata)
- Thread + engagement:
  - `reply_count`, `reply_users_count`

Store (minimum):
- `slack_messages`: `channel_id`, `ts`, `thread_ts`, `user_id`, `subtype`, `text`, `has_blocks`, `has_files`, `file_count`, `reply_count`, plus `team_id`.

Idempotency key (recommended):
- `external_id = <team_id>:<channel_id>:<ts>`

### 3.6 `conversations.replies` (thread messages)
Used via `GET /api/slack/conversations/:channelId/replies?ts=<thread_ts>&limit=25`.

Slack returns:
- `messages[]` in the thread (root + replies)
- Same per-message fields as `conversations.history` (`ts`, `user`, `text`, `blocks`, `files`, etc.)

Store (recommended):
- Store replies in the same `slack_messages` collection/table; use `thread_ts` to group.

### 3.7 How this maps to our `documents` model
If you keep the generic `documents` approach:
- `documents.document_type = slack_message`
- `documents.source_system = slack`
- `documents.external_id = <team_id>:<channel_id>:<ts>`
- `documents.metadata = { channel_id, channel_name, thread_ts, subtype, reply_count, file_count, ... }`
- `documents.content = text` (or raw Slack payload if you prefer)

Participants:
- Author: map `message.user` → `slack_users.email` → BambooHR `workEmail` (best-effort)

---

## 4) What to change in DATA_MODEL.md after Slack probe (confirmed)
Now that Slack probe confirms message shapes and user mapping viability, we should:
- add Slack-specific fields to `documents` metadata (channel id/name, thread_ts)
- add an `external_id` convention per source (Slack ts, Gmail id, Calendar event id, Zoom meeting id)
- formalize HRMS domain collections for your detailed HRMS plan
- add surveys/feedback collections

---

## 5) Key question: BambooHR endpoints we wrote — is that all BambooHR provides?
Short answer: **No**.

What we implemented in the backend so far are just a **safe starter subset**:
- `GET /api/bamboohr/meta/fields` → proxies BambooHR `GET /v1/meta/fields`
- `GET /api/bamboohr/employees/directory` → proxies BambooHR `GET /v1/employees/directory`
- `GET /api/bamboohr/employees/:id?fields=...` → proxies BambooHR `GET /v1/employees/{id}` with an optional `fields` query

Important:
- These endpoints currently return the **full upstream payload** (we are not filtering the returned JSON).
- The only “selection” we do is optional: for `/employees/:id`, you can pass `?fields=a,b,c` to request selected fields from BambooHR.
- BambooHR has many more endpoints (time off, reports, etc.). We’ll add them as needed once we finalize which HRMS domains you actually want for MVP (and what your BambooHR plan permits).

---

## 6) MongoDB: storage contract we are implementing (MVP)

This section is now the **source of truth** for the MongoDB persistence layer (not `DATA_MODEL.md`).

Principles:
- Keep **official HRMS identity** (`employees`) separate from **ingested artifacts** (`documents`) and **derived insights** (`memory_events`).
- Store upstream payloads in `documents.raw` for fast iteration, and keep normalized/queried fields in top-level columns + `documents.metadata`.
- Everything is scoped by `orgId` so we can multi-tenant later.

### 6.1 Required env
- In `backend/.env` set:
  - `MONGODB_URI=mongodb://localhost:27017/intellihr` (example)

DB connect behavior:
- If `MONGODB_URI` is not set, the server still starts (DB is “disabled”).
- Health check endpoint: `GET /api/db/health`.

### 6.2 Collections + key fields

#### `organizations`
- `orgId` (unique), `name`, `createdAt`

#### `employees`
Canonical “HR employee record” used for joins.
- `orgId`
- `employeeId` (unique within org)
- `workEmail` (unique within org when present)
- `fullName`, `status`
- optional: `bamboohrEmployeeId`

Indexes:
- unique: `(orgId, employeeId)`
- unique (partial): `(orgId, workEmail)`

#### `external_identities`
Links employees to external systems for stable joins.
- `orgId`, `employeeId`
- `sourceSystem`: `slack | bamboohr | google_calendar`
- `externalUserId` (e.g., Slack `U…`, BambooHR `id`)
- optional: `email`, `displayName`

Indexes:
- unique: `(orgId, sourceSystem, externalUserId)`

#### `documents`
All ingested artifacts across sources (Slack messages, Calendar events, HRMS snapshots, etc.).
- `orgId`
- `documentType`: `hrms_snapshot | slack_message | email_message | calendar_event | transcript | spreadsheet | zoom_recording_audio`
- `sourceSystem` (string, e.g. `slack_api`, `google_calendar_api`, `bamboohr`)
- optional: `externalId` (Slack `<team>:<channel>:<ts>`, Calendar event id, etc.)
- `ingestedAt`, `sensitivity`
- `content` (optional normalized text)
- `metadata` (small normalized subset)
- `raw` (full upstream JSON)

Indexes:
- unique (sparse): `(orgId, sourceSystem, externalId)`
- `(orgId, documentType, ingestedAt desc)`

#### `document_participants`
Maps a document to one or more employees.
- `orgId`
- `documentId` (ObjectId)
- `employeeId` (string)
- `matchMethod`: `email_exact | hrms_key | name_fuzzy`
- `matchConfidence` (0..1)

Indexes:
- unique: `(orgId, documentId, employeeId)`

#### `memory_events`
Derived immutable insights.
- `orgId`, `employeeId`
- `eventType`: `meeting_summary | action_item | commitment | topic_mention | concern_signal | sentiment_signal | profile_change | workload_signal`
- `eventTime`
- `summary`, `payload`
- `sourceDocumentId` (ObjectId), optional `sourceExcerpt`

Indexes:
- `(orgId, employeeId, eventTime desc)`

### 6.3 What’s implemented in backend
- Mongoose models exist under `backend/src/db/models/*`.
- DB connector: `backend/src/db/mongo.js`.
- Endpoint: `GET /api/db/health`.
