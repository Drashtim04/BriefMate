# MongoDB collection population summary

Generated: 2026-03-13T16:20:18.503Z

Mongo connection (from app):
- DB: `hrx`
- Host: `ac-gcablt1-shard-00-00.tfzcvvo.mongodb.net`
- Org sampled: `demo`

## Quick stats

- Collections found: **19**
- Non-empty: **18**
- Empty: **1**

## Collection counts

| Collection | Total docs | Docs where `orgId=demo` | Status | What populates it |
|---|---:|---:|---|---|
| `documents` | 175 | 175 | Populated | Ingestion endpoints that store a “source document” (Bamboo directory + per-employee profiles, Slack user snapshot, calendar events, seeded transcripts) |
| `document_chunks` | 170 | 170 | Populated | `POST /api/ingest/documents` with `chunks` payload |
| `external_identities` | 92 | 92 | Populated | `POST /api/ingest/slack/users` (Slack identities) + `POST /api/ingest/bamboohr/directory` (Bamboo identities) + manual linking |
| `employees` | 85 | 85 | Populated | `POST /api/ingest/bamboohr/directory` |
| `hrms_attendance_leave_snapshots` | 85 | 85 | Populated | `POST /api/ingest/bamboohr/employees/:id` |
| `hrms_compensation_snapshots` | 85 | 85 | Populated | `POST /api/ingest/bamboohr/employees/:id` |
| `hrms_employment_snapshots` | 85 | 85 | Populated | `POST /api/ingest/bamboohr/directory` + per-employee ingest enrichments |
| `hrms_identity_snapshots` | 85 | 85 | Populated | `POST /api/ingest/bamboohr/directory` + per-employee ingest enrichments |
| `hrms_offboarding_snapshots` | 85 | 85 | Populated | `POST /api/ingest/bamboohr/employees/:id` |
| `hrms_performance_snapshots` | 85 | 85 | Populated | `POST /api/ingest/bamboohr/employees/:id` |
| `hrms_tenure_mobility_snapshots` | 85 | 85 | Populated | `POST /api/ingest/bamboohr/employees/:id` |
| `memory_events` | 85 | 85 | Populated | `POST /api/memory/events` (seeded via `npm run seed:all`) |
| `survey_responses` | 85 | 85 | Populated | Seeded via `backend/src/scripts/seedDemoData.js` |
| `audit_logs` | 10 | 10 | Populated | Seeded via `backend/src/scripts/seedDemoData.js` |
| `calendar_metrics_daily` | 3 | 3 | Populated | Seeded via `backend/src/scripts/seedDemoData.js` (Google OAuth ingest still optional) |
| `document_participants` | 3 | 3 | Populated | Seeded via `backend/src/scripts/seedDemoData.js` (Google OAuth ingest still optional) |
| `ingestion_cursors` | 3 | 3 | Populated | Any ingestion endpoint run with cursor tracking (`incremental=true` default) |
| `organizations` | 1 | 1 | Populated | Auto-upserted during ingestion + seeded via `backend/src/scripts/seedDemoData.js` |
| `hrx` | 0 | 0 | Empty/Unexpected | This looks like an unexpected collection (same as DB name). Safe to ignore unless something is writing to it. |

## Notes

Most collections are now populated via the Node seed runner.

The only remaining empty collection is `hrx`, which is likely a stray/unused collection name.

Slack channel/message ingestion is still skipped until the Slack token has the required OAuth scopes.

## Next actions (optional)

- Slack channels/messages: fix Slack token scopes and rerun `npm run seed:all` (or call `POST /api/ingest/slack/channels` + `POST /api/ingest/slack/channels/:channelId/messages`).
- Calendar: complete Google OAuth and run `POST /api/ingest/calendar/events` to ingest real events (instead of demo seed rows).

---

_Data source: `backend/src/scripts/mongoCollectionSummary.js` executed against Atlas._
