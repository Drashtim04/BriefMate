Pre‑meeting prep (highest ROI)

CHRO selects employee → gets a briefing:
“What happened since last check‑in?”
“Open loops / commitments”
“Likely sensitive topics”
“Conversation starters that aren’t cringe”
“Do-not-ask / caution flags” (e.g., medical leave, grievance—access dependent)
In‑meeting assistance (highest risk, optional)

Real-time suggestions from live transcript:
“You promised X on Jan 12; it’s unresolved”
“They mentioned burnout signals last time”
This is powerful but dangerous: latency, accuracy, privacy, and “creepy factor.”
Post‑meeting capture

Auto-summary, decisions, actions, sentiment trend update, follow-up reminders.
Ongoing signals (executive view)

Team-wide themes: morale drivers, attrition risk signals, recurring blockers.
Must avoid pseudo-science; keep it evidence-backed and explainable.


3) The Core Artifact You Must Build: Unified Employee Profile
A good profile has two layers:

A) Official/authoritative (HRMS)

Role, manager chain, tenure, location, comp band (if allowed), performance cycle dates, leave status (if allowed), etc.
B) Contextual memory (derived)

Timeline of interactions (meetings, emails, notes)
Topics and interests (only if appropriate)
Concerns & themes (workload, growth, recognition, conflict)
Commitments: “CHRO said they’d do X”
Sentiment trend (careful: treat as a weak signal, not truth)
“What to ask next” suggestions
The key: this contextual layer must be traceable to sources (“why do we believe this?”).


Data minimization + retention: avoid storing raw transcripts forever; store structured extracts + citations.
Hallucination risk: LLMs will confidently invent “past conversations” unless you force retrieval/citations and constrain generation.
Explainability: CHRO will not trust “the model thinks…”; they need: “In the Feb 2 transcript, employee said…”
Creepiness boundary: “personal interests” can become surveillance. Your UX must feel supportive, not invasive.
Multi-source contradictions: HRMS says role A; spreadsheet says role B; transcript implies promotion—how do you reconcile?
Recency + drift: old context becomes wrong; you need time decay and “last confirmed” fields.


Storage

Relational store: employees, org structure, permissions, action items.
Document store: raw docs (if retained) and processed artifacts.
Vector store: embeddings for semantic retrieval (per-tenant, per-permission partitioning).
Retrieval + Reasoning (RAG, not “just chat”)

Query → permission-filtered retrieval → synthesize answer with citations.
Prefer “briefing templates” over free-form chat for critical flows.
Dashboard + Assistant UX

Employee profile page, timeline, “prep brief” panel, ask-assistant box.
Optional in-meeting panel (only if you can guarantee safety/accuracy boundaries).


6) What “Good Output” Looks Like (Behavioral Specs)
Your assistant should reliably do:

“Summarize last 3 interactions with Alex and list unresolved commitments.”
“Generate 5 conversation starters tied to concrete past topics.”
“What changed since last quarter? (role, manager, projects, sentiment trend)”
“Surface risks with evidence, not guesses.”
Example: “Burnout risk: increased mentions of late hours in 2/3 recent meetings” + citations.
And it should refuse/deflect:

Medical, protected class inferences, mental health diagnoses.
“Is Alex likely to resign?” as a deterministic claim—only evidence-based indicators.



8) MVP vs “Nice but Dangerous”
If you want a high-confidence MVP:

MVP = pre‑meeting prep + unified profile + citations + action items
Defer = live meeting copilot, email ingestion, predictive attrition scoring



Recency weighting — A sentiment signal from 18 months ago should carry far less weight than one from last week. The ML model needs temporal decay built in.


Data freshness SLAs — HRMS data should sync daily; survey data on completion; transcript data within hours of meeting end; engagement signals near real-time.
