# Life OS — Technical Requirements Document (TRD)

**Version:** 1.0  
**Status:** Draft for estimation  
**Audience:** Engineering, product, design  
**Related:** [Feature Backlog](./FEATURE_BACKLOG.md) · [User Stories](./USER_STORIES.md) · [Product Brief](./PRODUCT_BRIEF.md)

---

## 1. Purpose

This document translates the Life OS product brief into concrete technical requirements so the team can estimate, sequence, and build the MVP with shared assumptions.

The MVP must deliver this user outcome:

> “I know what matters, what I should work on next, and whether my plan is realistic.”

---

## 2. Product summary (technical view)

Life OS is a **single-user** personal operating system (web-first) that models:

| Layer | Entity | Role |
|-------|--------|------|
| Direction | Vision | Long-term desired future state |
| Life area | Pillar | Career, Business, Wealth, Personal, etc. |
| Outcome | Goal | Measurable result under a pillar |
| Body of work | Project | Defined work to achieve a goal |
| Next step | Action | Concrete, schedulable unit of work |
| Capture | Idea | Low-friction inbox, not a commitment |
| Evaluation | Decision | Scored trade-off record |
| Reality check | Capacity | Available hours vs planned effort |
| Reflection | Weekly Review + Scorecard | Structured review loop |
| Focus | Daily Brief / Command Centre | Daily priority surface |

AI is an **assistive layer** (recommendations editable by the user), not the product itself.

---

## 3. Recommended technical architecture

### 3.1 High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Clients                                                     │
│  Responsive Web (Next.js) · Progressive Web App later        │
│  Future: React Native / Expo (shared API + types)            │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS / JSON
┌───────────────────────────▼─────────────────────────────────┐
│  Application layer (Next.js App Router)                      │
│  · Server Components + Server Actions / Route Handlers       │
│  · Auth middleware · Zod validation · RBAC stubs             │
└───────┬─────────────────────┬───────────────────┬───────────┘
        │                     │                   │
┌───────▼───────┐   ┌─────────▼────────┐   ┌──────▼──────────┐
│ PostgreSQL    │   │ Object storage   │   │ AI gateway      │
│ (primary)     │   │ (S3-compatible)  │   │ (OpenAI/Anthropic│
│ Prisma ORM    │   │ attachments,     │   │  + optional STT)│
│               │   │ voice blobs      │   └─────────────────┘
└───────────────┘   └──────────────────┘
        │
┌───────▼───────┐   ┌──────────────────┐
│ Redis (opt.)  │   │ Email / push     │
│ jobs, cache,  │   │ (Resend / FCM)   │
│ rate limits   │   └──────────────────┘
└───────────────┘
```

### 3.2 Recommended stack (answers to team questions)

| Area | Recommendation | Rationale |
|------|-----------------|-----------|
| **Frontend** | Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS | Fast delivery, SSR/SEO for marketing later, shared types with API, strong mobile-responsive defaults |
| **UI primitives** | Radix UI + custom design tokens (calm executive aesthetic) | Accessible, not gamified; avoid heavy dashboard kits |
| **Backend** | Next.js Route Handlers + Server Actions initially; extract Nest/Fastify service if multi-client load grows | One deployable for MVP; clear path to split API |
| **ORM / DB** | Prisma + **PostgreSQL** | Relational hierarchy fits Vision→Action; Postgres for JSONB, full-text search, future RLS |
| **Auth** | **Clerk** or **Auth.js (NextAuth) + magic link/OAuth** | Secure session handling; MVP needs email/password or magic link only |
| **File storage** | Cloudflare R2 or AWS S3 | Attachments, images, voice notes |
| **Search** | Postgres `tsvector` / `pg_trgm` first; Meilisearch later if needed | Enough for personal-scale data |
| **Jobs** | Inngest or BullMQ (Redis) | Weekly review reminders, AI jobs, capacity recalculation |
| **AI** | Provider-agnostic gateway (OpenAI / Anthropic); structured JSON outputs via Zod | Editable recommendations; consent flag per user |
| **Voice** | Browser MediaRecorder → upload → Whisper (or Deepgram) transcription | MVP voice capture without native apps |
| **Hosting** | Vercel (web) + Neon/Supabase Postgres + R2 | Low ops for founder pilot |
| **Analytics** | PostHog (product) + Sentry (errors) | Privacy-friendly, self-hostable option |
| **Testing** | Vitest (unit) + Playwright (E2E critical flows) + Prisma test DB | Protect hierarchy + capacity invariants |

### 3.3 Web-first vs native

**MVP: responsive web only.**  
Ship a mobile-friendly PWA shell (installable, offline read-cache optional in Phase 5). Defer native iOS/Android until private beta validates retention. Design API and domain models as mobile-ready from day one (no UI-coupled business logic).

### 3.4 Calendar integration strategy

| Phase | Approach |
|-------|----------|
| MVP | **Internal scheduling only**: actions have `scheduledStart` / `scheduledEnd`; fixed commitments stored as `CalendarCommitment` |
| Beta | Google Calendar read-only (OAuth) → import busy blocks → reduce available capacity |
| Post-MVP | Outlook + Apple (CalDAV); write-back of deep-work blocks (opt-in) |

Distinguish commitment types in schema: `FIXED`, `FLEXIBLE`, `DEEP_WORK`, `PERSONAL`, `REST`.

---

## 4. Information architecture & screens (MVP)

1. Sign-in / onboarding  
2. Command Centre (daily brief)  
3. Pillars overview  
4. Pillar detail  
5. Goals overview / detail  
6. Projects overview / detail  
7. Actions / task manager  
8. Idea Studio  
9. Decision Engine  
10. Capacity planner  
11. Weekly CEO Review  
12. Weekly CEO Scorecard  
13. Settings & notifications  

Navigation should surface **Command Centre**, **Ideas**, and **Weekly Review** as primary destinations; hierarchy entities secondary.

---

## 5. Data model (logical)

### 5.1 Core entities

```
User
  ├── Vision[]
  ├── Pillar[]
  │     ├── Goal[]
  │     │     ├── Project[]
  │     │     │     ├── Milestone[]
  │     │     │     ├── Action[]
  │     │     │     └── Attachment[]
  │     └── (health computed)
  ├── Idea[] ──► optional links to Pillar / Goal / Project / Action
  ├── Decision[] ──► DecisionOption[]
  ├── CapacityPlan (weekly templates + overrides)
  ├── CalendarCommitment[]
  ├── DailyBrief[]
  ├── WeeklyReview[] ──► Scorecard
  ├── NotificationPreference
  ├── Notification[]
  ├── Tag[]
  └── ActivityLog[]
```

### 5.2 Key fields (MVP)

**Pillar:** `name`, `description`, `sortOrder`, `archivedAt`, `healthStatus` (`ON_TRACK` | `NEEDS_ATTENTION` | `AT_RISK` | `PAUSED`)

**Goal:** `title`, `pillarId`, `description`, `desiredOutcome`, `successCriteria`, `targetDate`, `priority`, `status` (`DRAFT`|`ACTIVE`|`PAUSED`|`COMPLETED`|`CANCELLED`), `progressPercent`, `reviewFrequency`

**Project:** `title`, `goalId`, `pillarId` (denormalized for queries), `description`, `desiredOutcome`, `startDate`, `targetDate`, `estimatedHours`, `actualHours`, `priority`, `status` (`PROPOSED`|`ACTIVE`|`WAITING`|`BLOCKED`|`COMPLETED`|`PAUSED`|`CANCELLED`), `nextActionId`, `risks`, `blockers`

**Action:** `title`, `projectId`, `dueAt`, `estimatedMinutes`, `actualMinutes`, `priority`, `energy` (`LOW`|`MEDIUM`|`HIGH`|`DEEP_FOCUS`), `status` (`INBOX`|`PLANNED`|`IN_PROGRESS`|`WAITING`|`COMPLETED`|`CANCELLED`), `scheduledStart`, `scheduledEnd`, `recurrenceRule`, `notes`

**Idea:** `content` (rich/text), `mediaRefs[]`, `tags[]`, `status` (`CAPTURED`|`DEVELOP_NOW`|`INCUBATE`|`REFERENCE`|`DISCARD`|`CONVERTED`), `convertedEntityType`, `convertedEntityId`, `pillarId?`

**Decision:** scores per option (1–5): alignment, financialUpside, leverage, urgency, confidence, effort, risk; `weightedScore` computed; `finalDecision`, `decisionDate`, `reviewDate`

**CapacityRecord:** per week + category hours (`EMPLOYMENT`, `BUSINESS`, `PRODUCT`, `PERSONAL`, `HEALTH`, `CREATIVE`, `REST`, `OTHER`)

**WeeklyReview:** structured answers JSON + generated scorecard snapshot

### 5.3 Integrity rules (enforce in domain layer)

1. Every **ACTIVE** project must have ≥1 non-completed next action (or system raises alert).  
2. Goals should link to ≥1 active project when status is ACTIVE (alert if none).  
3. Capacity warnings when `sum(estimatedMinutes of scheduled/planned actions in week) > availableHours * 60`.  
4. Pillar health: if high-priority pillar has no completed actions / progress in N days → `NEEDS_ATTENTION` / `AT_RISK`.  
5. Soft deletes or archive flags preferred over hard deletes for goals/projects (audit + undo).  
6. Ideas never auto-create projects without explicit user conversion.

### 5.4 Multi-link flexibility

MVP allows optional many-to-many via join tables where useful:

- Idea ↔ Tags  
- Decision ↔ Pillar / Goal  
- Action may later link to multiple projects; **MVP: single projectId** for simplicity  

---

## 6. Functional requirements by module

### 6.1 Auth & onboarding

- Secure sign-up / sign-in  
- Guided setup: pillars → vision(s) → goals → weekly availability → planning days → first project → first action  
- Skip optional steps; resume incomplete onboarding  
- No personality assessments  

### 6.2 Command Centre

Show for “today”:

- Primary Move (1)  
- Supporting Actions (≤3)  
- Operational Tasks  
- Upcoming Deadlines  
- Risk Alerts  
- Idea Inbox snippet  
- Capacity Status (`UNDER` | `AT` | `OVER`)  

Clarity over density; whitespace and hierarchy per design direction.

### 6.3 Hierarchy CRUD

Full CRUD for Pillars, Goals, Projects, Actions with filters, search, status changes, reorder pillars.

### 6.4 Idea Studio

- Quick capture (text first; voice/image/link/file in same epic if feasible)  
- Review workflow with statuses  
- Convert to Goal / Project / Action  
- Separate from execution lists  

### 6.5 Decision Engine

- Options with 1–5 scores on seven dimensions  
- Weighted score:  
  - Positive = alignment + financialUpside + leverage + urgency + confidence  
  - Negative = effort + risk  
  - Display `positive - negative` (or normalized later) as **guidance only**  
- Configurable weights post-MVP  

### 6.6 Capacity planning

- Weekly available hours by category  
- Compare available vs scheduled + estimated project effort  
- Explicit overcommit warning copy with remediation prompts (remove / delay / reduce / delegate / reschedule)  

### 6.7 Weekly CEO Review & Scorecard

- Structured prompts (Results, Time, Bottlenecks, Decisions, Priorities, Capacity)  
- Generate one-page scorecard snapshot  
- Export: **print-friendly HTML / PDF** for MVP; email/image/CSV/link later  

### 6.8 Notifications

- Preference centre (frequency + type)  
- Alert types listed in brief; default to quiet (email digest optional)  
- In-app notification list mandatory for MVP; push optional  

### 6.9 AI (MVP subset)

| Capability | Behavior |
|------------|----------|
| Daily priority recommendation | Suggest Primary Move + up to 3 supporting from planned actions + capacity |
| Project → actions breakdown | Propose next actions; user accepts/edits |
| Weekly review summary | Draft narrative from completed work + time |
| Capacity warnings | Explain overcommit in plain language |
| Idea categorization | Suggest tag / status / pillar |

All AI outputs stored as suggestions with `acceptedAt` / `editedPayload`. Require AI consent toggle.

### 6.10 Settings

- Profile, pillars defaults, capacity template, planning days, notification prefs, AI consent, data export, account deletion  

---

## 7. Non-functional requirements

| NFR | Target (MVP) |
|-----|----------------|
| Performance | p95 page interactive < 2.5s on broadband; list views < 500ms API |
| Reliability | 99.5% monthly uptime for pilot |
| Accessibility | WCAG 2.1 AA for core flows |
| Responsiveness | Usable from 375px width up |
| Security | TLS everywhere; hashed passwords or managed auth; least-privilege DB |
| Maintainability | Typed domain, migrations, CI lint/test |
| UX tone | Calm, premium, executive — not gamified |
| Autosave | Forms debounce-save ≤ 1s after idle for notes/ideas |

---

## 8. Security & privacy requirements

- Secure authentication (session cookies httpOnly, secure, sameSite)  
- Encryption in transit (TLS 1.2+)  
- Secure password storage (or delegated IdP)  
- Per-user data isolation (all queries scoped by `userId`)  
- Role stubs for future Assistant/Coach (not exposed in MVP UI)  
- Secure object storage with signed URLs  
- Data export (JSON)  
- Account deletion (hard delete PII within 30 days; legal hold exception documented)  
- AI processing consent + retention note  
- Audit log for sensitive actions (export, delete, AI consent change)  
- Privacy policy / ToS placeholders for pilot  

---

## 9. API design principles

- Resource-oriented REST under `/api/v1/...` (or Server Actions wrapping same services)  
- Zod request/response schemas  
- Idempotent updates where safe  
- Pagination on list endpoints  
- Optimistic concurrency via `updatedAt` for collaborative-future safety  
- OpenAPI generated from Zod/tRPC if team prefers RPC  

Suggested primary resources: `/pillars`, `/goals`, `/projects`, `/actions`, `/ideas`, `/decisions`, `/capacity`, `/briefs/today`, `/reviews/weekly`, `/notifications`, `/ai/...`

---

## 10. Analytics (MVP)

Track product events (no PII in event props beyond userId hash):

- `onboarding_completed`  
- `idea_captured` / `idea_converted`  
- `action_completed`  
- `capacity_over_warning_shown`  
- `weekly_review_completed`  
- `ai_suggestion_accepted` / `edited` / `dismissed`  
- `command_centre_viewed`  

Success metric proxy for pilot: weekly review completion rate + % days with Primary Move set.

---

## 11. Testing strategy

| Layer | Scope |
|-------|--------|
| Unit | Capacity calculator, decision scoring, pillar health rules, recurrence |
| Integration | Prisma repositories, auth scoping, conversion Idea→Project |
| E2E | Onboarding; idea→project→action→capacity→Command Centre→weekly review |
| Manual | Founder pilot checklist (MVP success criteria 1–11) |
| Security | Authz tests ensuring no cross-user reads |

---

## 12. Development phases (technical)

Aligned with product brief phases, with engineering focus:

| Phase | Engineering deliverables |
|-------|--------------------------|
| **0 – Definition** | This TRD, backlog, stories, ERD, clickable prototype (design) |
| **1 – Foundation** | Auth, schema, design system, shell nav, autosave primitives |
| **2 – Core execution** | Pillars, Goals, Projects, Actions, Command Centre, Capacity |
| **3 – Capture & strategy** | Idea Studio, Decision Engine |
| **4 – Review loop** | Weekly Review, Scorecard, notifications |
| **5 – AI assist** | Five MVP AI features behind consent |
| **6 – Pilot hardening** | Analytics, export, delete, performance, security review |

---

## 13. Major technical risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep into full PM / CRM | Delays MVP | Strict MoSCoW; exclusions list enforced |
| Capacity model too naive vs real calendars | Trust loss | Start with hours + internal schedule; validate before Google sync |
| AI hallucinations in priorities | Wrong focus | Suggestions only; show rationale; easy dismiss |
| Over-complex hierarchy UX | Abandonment | Onboarding defaults; allow orphan ideas; progressive disclosure |
| Attachment/voice cost & complexity | Slippage | Text ideas P0; media P1 |
| SQLite-like single-file thinking at scale | Migration pain | Postgres from day one |
| Dual-write calendar sync bugs | Bad capacity math | Read-only sync first |

---

## 14. Hosting & cost (order-of-magnitude, founder pilot)

Assumes <50 users during pilot:

| Service | Est. monthly |
|---------|----------------|
| Vercel Pro (or Hobby) | $0–20 |
| Neon / Supabase Postgres | $0–25 |
| R2 / S3 storage | <$5 |
| Auth (Clerk) | $0–25 |
| AI API | usage-based; budget cap $50–100 |
| PostHog / Sentry | free tiers likely enough |
| **Total** | roughly **$50–200 / month** at pilot scale |

Revisit after private beta concurrent usage and AI adoption.

---

## 15. Maintenance requirements

- Weekly dependency/security updates during pilot  
- Migration review for every schema change  
- AI prompt versioning in repo  
- Runbook: restore from DB backup, revoke sessions, rotate keys  
- Quarterly privacy review (retention, export, deletion)  

---

## 16. MVP exclusions (do not build)

Social networking, public profiles, forums, complex collaboration, accounting/trading/banking, habit gamification, CRM, template marketplace, full PM replacement, email automation, multi-agent AI, advanced forecasting.

---

## 17. MVP success criteria (acceptance at product level)

Users can:

1. Define life pillars  
2. Create goals under pillars  
3. Create projects under goals  
4. Assign actions to projects  
5. Capture ideas quickly  
6. Evaluate ideas/opportunities (Decision Engine or Idea review)  
7. See focused daily brief  
8. Build realistic weekly plan  
9. Receive over-capacity warning  
10. Complete weekly CEO review  
11. Understand how time/actions support goals  

---

## 18. Immediate next engineering steps after estimation

1. Design clickable prototype for critical path (brief §23)  
2. Finalize ERD + Prisma schema draft  
3. Spike: capacity calculator + Command Centre composition  
4. Spike: AI structured suggestion endpoint  
5. Scaffold `apps/life-os` (or dedicated repo) with auth + empty shell  

---

## 19. Open decisions (resolve in estimation workshop)

1. Clerk vs Auth.js  
2. Monorepo app vs new repository  
3. tRPC vs REST Route Handlers  
4. PDF generation library for scorecard  
5. Whether voice capture is P0 or P1 for first founder pilot  
6. Default pillar set final copy  

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-08-06 | Initial TRD from product brief |