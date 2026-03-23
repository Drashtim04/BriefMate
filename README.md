
## BriefMate – AI-Powered HR Intelligence Dashboard

BriefMate is an AI-driven HR intelligence platform that aggregates employee data from multiple sources and transforms it into actionable insights, health scores, and pre-meeting briefs for HR managers.

---

## Problem

HR managers rely on fragmented data across HR systems, communication tools, and meeting records. This results in poor visibility into employee sentiment, delayed identification of retention risks, and inefficient meeting preparation.

---

## Solution

BriefMate unifies data from multiple sources and generates:

* Employee health scores (0–100)
* Retention risk analysis
* AI-powered pre-meeting briefs
* Real-time insights and alerts

---

## Features

* Multi-source data ingestion (HRMS, Slack, meeting transcripts)
* LLM-based sentiment, risk, and summary analysis
* Deterministic health scoring system
* Real-time dashboard with employee insights
* Pre-meeting brief generation
* Alert generation for critical risk signals

---

## Architecture

The system consists of three main layers:

* **Frontend:** React-based dashboard for visualization and interaction
* **Backend:** Node.js + Express API layer for data handling and integrations
* **LLM Pipeline:** AI orchestration service for analysis, scoring, and alert generation

---

## Health Score Formula

Health = 0.30 × Sentiment + 0.40 × (100 − Risk) + 0.20 × Engagement + 0.10 × HRMS

---

## Tech Stack

**Frontend:** React, Vite, Tailwind CSS

**Backend:** Node.js, Express

**AI/LLM:** Groq (Llama models)

**Database:** MongoDB

**Cache & Queue:** Redis, BullMQ

**Integrations:** Slack API, BambooHR API, Google Calendar, Fireflies

---

## Workflow

1. Ingest data from multiple sources
2. Normalize into a unified employee profile
3. Perform LLM-based analysis (sentiment, risk, summaries)
4. Compute health score using deterministic logic
5. Generate insights and alerts
6. Serve results via dashboard and briefs
