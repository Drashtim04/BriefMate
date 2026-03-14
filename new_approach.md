# New Approach: Hybrid Math + LLM Intelligence Pipeline

## 1) Why this approach

The current system already ingests multi-source employee context and generates rich analysis with LLM support. The proposed approach keeps LLM where it is strongest (signal extraction, summaries, contextual language) and moves final scoring logic to deterministic math.

This gives:
- Better score stability over time
- Explainable risk and health scores
- Easier threshold tuning for alerts
- Reduced model drift impact on business metrics

## 2) What exists today in code (current pipeline)

### 2.1 Ingestion and normalization
- Data is fetched with incremental cursors and merged from Slack, HRMS, and meeting sources.
- Unified context is created before analysis.
- Raw snapshots are persisted with fetchedAt for historical traceability.

Current code path:
- llm/server/queues/pipelineQueue.js
  - fetchAllSourcesParallelWithDelta
  - normalizeUnifiedSchema
  - saveRawDataSnapshot
- llm/server/services/storage/stores.js
  - saveRawDataSnapshot
  - getSyncState, updateSyncState

### 2.2 Analysis generation
- sentimentService uses Groq JSON output with heuristic fallback.
- retentionService uses LLM classifier with fallback keyword rules.
- summarizerService generates chunk-level and global summaries.
- briefService generates meeting brief context.

Current code path:
- llm/server/services/analysis/groqServices.js

### 2.3 Health/risk composition
- Health is currently estimated as:
  - health = 0.6 * sentiment + 0.4 * (100 - retentionRisk)
- Alerts are raised for:
  - critical risk level
  - risk increase >= 15 points
  - sentiment drop >= 20 points

Current code path:
- llm/server/queues/pipelineQueue.js
  - estimateHealth
  - createAlerts

### 2.4 Persistence and serving
- Profile versions are incremented and saved as immutable records.
- Dashboard summary is derived from latest profiles and warmed in cache.
- Meeting records and alerts are persisted.

Current code path:
- llm/server/services/storage/stores.js
  - getNextProfileVersion
  - saveProfile
  - saveAlerts
  - saveMeetingRecord
  - getDashboardSummary

### 2.5 Backend operational mirror
- backend/src/services/analysisService.js persists mirrored snapshot in employee_profiles and sentiment_history after upstream pipeline runs.
- backend/src/routes/v1.routes.js serves dashboard summary and reanalyze endpoint.

## 3) Gaps in current design

1. Final scoring depends heavily on direct LLM sentiment and risk outputs.
2. No explicit temporal smoothing for noisy week-to-week sentiment movement.
3. No standalone engagement and HRMS mathematical components in final health score.
4. Limited explainability payload for why score changed.

## 4) Target architecture (proposed pipeline)

## 4.1 Principle: LLM for extraction, math for scoring

LLM output should provide structured features, not final authority over the final numeric health/risk score.

LLM responsibilities:
- Extract sentiment observations and evidence spans
- Detect retention risk signals and severity classes
- Summarize meeting content and interaction context
- Generate conversational guidance and meeting brief language

Math responsibilities:
- Smooth and trend sentiment over time
- Compute engagement and HRMS indices
- Compute calibrated retention risk score
- Produce final health score from weighted components

## 4.2 End-to-end flow

1. Trigger receives event (manual, Slack delta, meeting delta, scheduled).
2. Ingestion fetches source deltas using sync cursors.
3. Raw snapshot is saved in employee_raw_data with fetchedAt.
4. Unified schema is built.
5. LLM services return structured extraction outputs.
6. Deterministic scoring layer computes temporal and composite metrics.
7. Alert engine compares previous profile deltas and raises notifications.
8. Profile is saved as next version with full explainability components.
9. Dashboard/profile caches are warmed.
10. API serves profile, brief, dashboard, and chat with consistent metrics.

## 5) Mathematical model

## 5.1 Sentiment smoothing

Use exponential moving average:

S_t = alpha * x_t + (1 - alpha) * S_(t-1)

Where:
- x_t = current extracted sentiment score (0 to 100)
- S_t = smoothed sentiment score
- alpha = recency weight (example 0.30 to 0.40)

## 5.2 Engagement index

E_t = 100 * (w1*m_t + w2*a_t + w3*r_t)

Where:
- m_t = normalized message activity
- a_t = meeting attendance/participation
- r_t = responsiveness proxy
- w1 + w2 + w3 = 1

## 5.3 HRMS index

H_hrms = 100 * (v1*p_t + v2*l_t + v3*t_t)

Where:
- p_t = performance proxy
- l_t = leave stability proxy
- t_t = tenure/mobility stability proxy
- v1 + v2 + v3 = 1

## 5.4 Retention risk via logistic transform

z_t = b0 + b1*(100 - S_t) + b2*(100 - E_t) + b3*(100 - H_hrms) + b4*C_t + b5*H_t

R_t = 100 * sigmoid(z_t)

Where:
- C_t = critical signal intensity from extracted risk signals
- H_t = high signal intensity from extracted risk signals
- R_t = bounded risk score (0 to 100)

## 5.5 Final health score

Health_t = 0.30*S_t + 0.40*(100 - R_t) + 0.20*E_t + 0.10*H_hrms

Band mapping:
- 0 to 40: critical
- 41 to 60: monitor
- 61 to 80: healthy
- 81 to 100: thriving

## 6) Data contract (no mandatory DB migration)

No mandatory database schema migration is required for first rollout.

Reason:
- employee_profiles already stores nested analysis object and versioned records.
- employee_raw_data already stores fetchedAt and payload snapshots.
- validation mode in dump metadata is warn, not strict blocking.

Add fields inside existing analysis payload:
- analysis.scoringVersion
- analysis.components.sentimentRaw
- analysis.components.sentimentSmoothed
- analysis.components.engagement
- analysis.components.hrms
- analysis.components.riskLogit
- analysis.components.riskScore
- analysis.components.healthScore
- analysis.components.contributors
- analysis.components.confidence
- analysis.temporal.deltaSentiment7d
- analysis.temporal.deltaRisk30d

Optional later hardening:
- Add indexes only if dashboard/profile trend queries become slow.

## 7) Implementation plan (phased)

## Phase 1: Introduce deterministic scoring layer

Goal:
- Keep current LLM extraction, add math module for final scores.

Changes:
1. Create new scoring module:
- llm/server/services/analysis/scoringEngine.js

Functions:
- computeSmoothedSentiment
- computeEngagementIndex
- computeHrmsIndex
- computeRiskLogitAndScore
- computeHealthScore
- deriveBandsAndContributors

2. Integrate in pipeline:
- Update llm/server/queues/pipelineQueue.js
- Replace estimateHealth-only logic with scoring engine output
- Preserve backward compatibility fields analysis.health.score and analysis.retentionRisk.score

Acceptance checks:
- Existing API responses still contain current keys
- New component fields appear in saved profile

## Phase 2: Upgrade LLM extraction outputs

Goal:
- Make LLM output structured features required by scoring engine.

Changes:
1. sentimentService output extends with:
- valenceSignals
- uncertainty score
- keyEvidence array

2. retentionService output extends with:
- criticalCount
- highCount
- mediumCount
- signalStrength map

3. Add strict JSON schema validation on LLM output before scoring.

Files:
- llm/server/services/analysis/groqServices.js
- llm/server/services/analysis/llmRetentionRisk.js

Acceptance checks:
- Pipeline falls back safely when JSON invalid
- Signal counts available for logistic risk inputs

## Phase 3: Temporal context and explainability

Goal:
- Make score movement interpretable and stable.

Changes:
1. Use prior profiles in scoring:
- compare with previous version
- compute 7d and 30d deltas
- compute acceleration for risk trend

2. Persist explainability payload:
- top contributors with signed impact values
- confidence and data sufficiency

Files:
- llm/server/queues/pipelineQueue.js
- llm/server/services/storage/stores.js (read/query helpers only if needed)

Acceptance checks:
- Every profile has whyChanged summary fields
- Alert reason references component deltas

## Phase 4: Alert and dashboard refinement

Goal:
- Ensure dashboard and notifications reflect new scoring system.

Changes:
1. Alert rules use component-aware thresholds:
- risk acceleration
- confidence-aware sentiment drop

2. Dashboard summary includes:
- avg health
- avg sentiment smoothed
- risk distribution
- trend movement indicators

Files:
- llm/server/queues/pipelineQueue.js
- backend/src/routes/v1.routes.js
- hero-app dashboard pages (if UI exposure required)

Acceptance checks:
- No stale-zero regression
- Trend cards align with profile component values

<!-- ## 8) Backward compatibility strategy

1. Keep these fields unchanged for existing consumers:
- analysis.health.score
- analysis.retentionRisk.score
- analysis.retentionRisk.level
- analysis.sentiment.score

2. Add new fields without removing old keys.
3. Version score contract using analysis.scoringVersion. -->

## 9) Reliability and safety controls

1. If LLM unavailable:
- Existing heuristic fallback remains active.
- scoringEngine still runs with fallback values.

2. If partial data available:
- compute confidence and reduce score volatility.

3. If no delta data:
- keep current skip behavior and do not fabricate profile updates.

4. Add structured logs:
- extraction_duration_ms
- scoring_duration_ms
- cache_warm_duration_ms
- pipeline_reason and profile_version

## 10) Validation and rollout checklist

1. Unit tests for scoringEngine formulas and boundaries.
2. Golden test cases for known employee scenarios.
3. Shadow mode run:
- compute new scores in parallel while serving old score
- compare drift and false alert changes
4. Cutover flag:
- enable deterministic final score as source of truth
5. Monitor:
- alert volume changes
- score volatility reduction
- API latency impact

## 11) Success criteria

Technical:
- Deterministic and reproducible health/risk scores for same input
- No API contract break
- No mandatory DB migration required for initial launch

Product:
- More stable score trends
- Improved CHRO trust via explainability
- Better early warning quality for retention risk

## 12) Summary

Current system is already strong on ingestion and LLM-driven synthesis. The proposed approach upgrades it into a hybrid intelligence system where LLM extracts meaning and deterministic math controls decision metrics. This can be implemented incrementally in the existing pipeline and data model, with no required schema migration for phase one.