# Implementation Milestones — CXO HR Intelligence Dashboard

This roadmap assumes you must support HRMS + spreadsheets + transcripts **and** in-meeting assistance.

## Milestone 0 — Foundations (day 1–2)
Deliverables:
- Confirm demo sources: BambooHR, Slack, Zoom, Google Calendar, Gmail/Outlook, spreadsheet formats.
- Decide which integrations will use full OAuth vs pre-configured tokens for the MVP timeframe.
- Define controlled taxonomy for topics/concerns.
- Define permission roles (CHRO/HRBP/People Ops) and sensitivity categories.
- Set up repositories, env config, secrets handling.

Exit criteria:
- Sample HRMS export + spreadsheet + transcript available.
- Agreed schema for `employees`, `documents`, `memory_events`.

## Milestone 1 — Ingestion & identity resolution (day 3–5)
Build:
- BambooHR ingestion (or mock adapter) → employees + official profile snapshots.
- Spreadsheet ingestion (CSV upload) → documents + rows mapped to employees.
- Zoom ingestion (meetings + transcripts/recordings metadata) → documents.
- Slack ingestion (API fetch and/or events) → documents.
- Google Calendar ingestion (events + attendees) → documents.
- Email ingestion (Gmail/Outlook) → documents.
- Identity resolution rules: email exact first; fallback to HRMS key; fuzzy name with thresholds.

Auth note:
- Implement OAuth if time permits; otherwise use single-org pre-configured tokens/keys while keeping connector interfaces OAuth-ready.

Exit criteria:
- One employee’s profile can be assembled from all three sources.
- Ingestion is idempotent (re-upload does not duplicate).

## Milestone 2 — Extraction pipeline & event store (day 6–9)
Build:
- Chunking strategy for transcripts and message-style text (Slack/Email).
- Event extraction for: action items, commitments, topic mentions, concern signals, sentiment signals.
- Store `memory_events` with citations (doc + chunk + excerpt).

STT:
- Add speech-to-text for non-transcribed meetings (Zoom recording audio → transcript) and for live meeting mode if needed.

Exit criteria:
- Timeline shows extracted events with clickable “why/citation.”
- Action items list is generated and persisted.

## Milestone 3 — Retrieval + assistant (RAG) (day 10–13)
Build:
- Embeddings for chunks/events into vector store.
- Permission-safe retrieval pipeline.
- Assistant prompts that enforce “use retrieved sources only” + citations.
- Prep briefing generator template.

Exit criteria:
- Queries like “what changed since last check-in” return grounded answers.
- Conversation starters are tied to specific topics with citations.

## Milestone 4 — Dashboard + employee profile UI (day 14–16)
Build:
- Dashboard: employee search/select + quick indicators.
- Employee profile: official fields + timeline + open loops + prep brief.
- Assistant panel integrated on profile.

Exit criteria:
- End-to-end flow works: select employee → prep brief → ask assistant.

## Milestone 5 — In-meeting assistance (streaming) (day 17–20)
Build:
- Meeting session start/end.
- Streaming transcript ingestion (Zoom live transcript if available; otherwise live audio → STT; simulate with pasted chunks if needed).
- Low-latency extraction + retrieval.
- Suggestion feed UI (3–7 items) with citations.

Exit criteria:
- p95 suggestion latency under target (measure in logs).
- Suggestions never reference non-retrieved content.

## Milestone 6 — Safety, audit, and polish (day 21–23)
Build:
- Refusal rules (protected class, medical/mental health inference, deterministic attrition prediction).
- Audit logging for profile views, chat queries, meeting suggestions.
- Retention configuration for raw transcripts.

Exit criteria:
- Red-team prompt set passes.
- Audit log entries exist for key actions.

## Milestone 7 — Demo readiness (day 24–25)
Build:
- Seed dataset and scripted demo journey.
- “Failure mode” handling: missing transcripts, conflicting data.
- Evaluation rubric and quick quality checklist.

Exit criteria:
- Demo script runs reliably.
- 3–5 employee profiles show meaningful, grounded context.
