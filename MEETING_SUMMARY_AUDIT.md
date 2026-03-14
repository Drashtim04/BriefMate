# Meeting Summary Audit

Date: 2026-03-14
Scope: Meeting Summary page, calendar interactions, meeting detail panel, and related backend meeting/calendar/transcript routes.

## Executive Summary

The Meeting Summary flow is functional but has data correctness and UX consistency issues.

Most important risks:
- Meetings can be dropped from the UI when one employee has multiple meetings on the same day.
- Source filtering is inconsistent with backend source values (especially fireflies).
- Sync buttons do not refresh visible data after successful sync.

## Findings

### 1) High - Incorrect dedupe removes valid meetings

Problem:
- Frontend dedupes meetings by employeeEmail + date instead of meetingId.
- This collapses distinct meetings into one when the same employee has multiple meetings on a day.

Impact:
- Missing meeting cards in the left panel.
- Missing event markers and month event list items in mini calendar.
- Some meeting detail views become unreachable.

Evidence:
- hero-app/src/pages/MeetingSummary.jsx:279
- hero-app/src/pages/MeetingSummary.jsx:280
- hero-app/src/pages/MeetingSummary.jsx:282

Recommendation:
- Dedupe by stable id (meetingId) only.
- If a fallback is needed, use source + external id + full timestamp, not date-only.

---

### 2) High - Source filter mismatches backend source values

Problem:
- UI filter options include all, google_calendar, llm.
- Backend can return fireflies as a separate source.
- Source badge maps non-google to "Intelligence", which masks actual source.

Impact:
- Meetings labeled as "Intelligence" may disappear when filtering by that option.
- Confusing and unreliable filter behavior.

Evidence:
- hero-app/src/pages/MeetingSummary.jsx:158
- hero-app/src/pages/MeetingSummary.jsx:220
- hero-app/src/pages/MeetingSummary.jsx:602
- backend/src/routes/intelligence.routes.js:273

Recommendation:
- Add explicit filter option for fireflies.
- Keep source labels aligned 1:1 with backend source values.
- Use a central source map for filter values and display labels.

---

### 3) Medium - Sync actions do not refresh page state

Problem:
- Sync Calendar and Sync Transcripts show success notices but do not re-fetch meetings/detail data.

Impact:
- User sees success status while list/calendar/detail remain stale.
- Creates false impression that sync did not work.

Evidence:
- hero-app/src/pages/MeetingSummary.jsx:476
- hero-app/src/pages/MeetingSummary.jsx:489
- hero-app/src/pages/MeetingSummary.jsx:498
- hero-app/src/pages/MeetingSummary.jsx:510

Recommendation:
- Trigger meeting reload after successful sync.
- Rehydrate selected meeting transcript/brief when relevant.

---

### 4) Medium - Department metadata is blank in detail header

Problem:
- Meeting mapping sets dept to empty string.

Impact:
- Missing context in detail panel (users see empty department field).

Evidence:
- hero-app/src/pages/MeetingSummary.jsx:259

Recommendation:
- Populate dept from available participant/profile metadata when available.
- If unavailable, hide the field or show a neutral fallback (for example, "Unknown").

---

### 5) Medium - Date parsing may shift calendar day by timezone

Problem:
- Mini calendar parses YYYY-MM-DD via new Date(m.date), which can shift date in some timezones.

Impact:
- Dot markers or clickable date assignment can render on wrong day.

Evidence:
- hero-app/src/pages/MeetingSummary.jsx:29

Recommendation:
- Parse date-only values as local date parts, not Date constructor on YYYY-MM-DD.

---

### 6) Low - Date-only meetings can show misleading time

Problem:
- toDisplayTime always formats time from date text.
- Date-only values can appear as midnight-like times.

Impact:
- Users may infer a meeting time that is not actually known.

Evidence:
- hero-app/src/pages/MeetingSummary.jsx:214
- hero-app/src/pages/MeetingSummary.jsx:263

Recommendation:
- If value is date-only, show no time (or "All day").

## Prioritized Fix Plan

1. Correct dedupe logic to prevent data loss in meeting list/calendar.
2. Normalize source model and add fireflies filter path.
3. Reload/rehydrate state after sync success.
4. Fix date-only parsing/rendering for calendar and time display.
5. Improve detail metadata population (department and related context).

## Validation Checklist (Post-Fix)

- Same employee with 2+ meetings on same date shows all meetings.
- Source filtering returns stable and expected results for llm, google_calendar, and fireflies.
- After sync success, meetings list and selected detail reflect new data without manual refresh.
- Calendar markers align correctly for date-only meetings across timezone settings.
- Date-only meetings do not show misleading time values.
- Department field is either correctly populated or intentionally hidden with fallback behavior.
