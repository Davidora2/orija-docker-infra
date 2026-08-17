# Life OS — Prioritized Feature Backlog

**Version:** 1.0  
**Prioritization:** MoSCoW within phases  
**Sizing:** T-shirt (XS/S/M/L/XL) for epic-level estimation; see [USER_STORIES.md](./USER_STORIES.md) for story points  

**Cut line for first shippable MVP:** complete **Phase A–D** (Must). Phase E (AI) is Should for founder pilot if capacity allows; Phase F is Could / later.

---

## Priority legend

| Tag | Meaning |
|-----|---------|
| **Must** | Required for MVP success criteria |
| **Should** | Strongly desired for founder pilot quality |
| **Could** | Valuable if time remains |
| **Won’t** | Explicitly out of MVP |

---

## Epic map

```
E0 Prototype (design)     E1 Platform foundation
E2 Onboarding             E3 Pillars & Visions
E4 Goals                  E5 Projects & Milestones
E6 Actions                E7 Capacity planning
E8 Command Centre         E9 Idea Studio
E10 Decision Engine       E11 Weekly Review & Scorecard
E12 Notifications         E13 Settings, export, privacy
E14 AI assist             E15 Calendar (post-MVP)
```

---

## Phase 0 — Product definition & prototype (pre-build)

| ID | Feature | Priority | Size | Notes |
|----|---------|----------|------|-------|
| F0.1 | Clickable prototype: idea → capacity → Command Centre → weekly review | Must | L | Brief §23 critical path |
| F0.2 | Design system (tokens, typography, calm executive UI) | Must | M | Whitespace, hierarchy, no gamification |
| F0.3 | ERD + Prisma schema draft | Must | M | From TRD §5 |
| F0.4 | Estimation workshop using this backlog | Must | S | Story points → sprint plan |

---

## Phase A — Platform foundation

| ID | Feature | Priority | Size | Depends |
|----|---------|----------|------|---------|
| F1.1 | App shell, routing, responsive layout, nav | Must | M | — |
| F1.2 | Authentication (sign-up, sign-in, session) | Must | M | — |
| F1.3 | PostgreSQL + Prisma migrations + user scoping | Must | M | F1.2 |
| F1.4 | Autosave form primitives | Must | S | F1.1 |
| F1.5 | Search & filter utilities (lists) | Should | S | F1.3 |
| F1.6 | Activity log (write path) | Should | S | F1.3 |
| F1.7 | Error monitoring (Sentry) + basic analytics (PostHog) | Should | S | F1.1 |

---

## Phase B — Hierarchy & execution core

| ID | Feature | Priority | Size | Depends |
|----|---------|----------|------|---------|
| F2.1 | Onboarding wizard (pillars → vision → goals → capacity → planning days → project → action) | Must | L | F1.2, F3.*, F4.*, F5.*, F6.*, F7.1 |
| F2.2 | Skip / resume onboarding | Must | S | F2.1 |
| F3.1 | Pillars CRUD + reorder + archive | Must | M | F1.3 |
| F3.2 | Default pillar seed set | Must | XS | F3.1 |
| F3.3 | Pillar detail (goals, projects, activity, time, health) | Must | M | F3.1, F4, F5 |
| F3.4 | Pillar health indicators + neglect detection | Must | M | F3.3, F6 |
| F3.5 | Visions CRUD (link optional to pillars) | Must | S | F1.3 |
| F4.1 | Goals CRUD + statuses + progress | Must | M | F3.1 |
| F4.2 | Goals overview + filters | Must | S | F4.1 |
| F4.3 | Goal ↔ projects list on detail | Must | S | F5.1 |
| F4.4 | Alert: active goal with no active project | Should | S | F4.1, F5.1 |
| F5.1 | Projects CRUD + statuses | Must | M | F4.1 |
| F5.2 | Project detail (outcome, dates, effort, risks, notes) | Must | M | F5.1 |
| F5.3 | Milestones on project | Should | S | F5.1 |
| F5.4 | Require / flag next action for active projects | Must | S | F5.1, F6.1 |
| F5.5 | Attachments on project (files/images) | Could | M | F1.3 + storage |
| F6.1 | Actions CRUD + statuses + energy + duration | Must | M | F5.1 |
| F6.2 | Action scheduler (internal dates/times) | Must | M | F6.1 |
| F6.3 | Complete / reschedule / move between projects | Must | S | F6.1 |
| F6.4 | Recurrence (basic) | Could | M | F6.1 |
| F6.5 | Actions list / task manager views | Must | M | F6.1 |

**Phase B exit:** User can model Vision→Pillar→Goal→Project→Action and manage daily work.

---

## Phase C — Capacity & Command Centre

| ID | Feature | Priority | Size | Depends |
|----|---------|----------|------|---------|
| F7.1 | Weekly capacity template by category | Must | M | F1.3 |
| F7.2 | Week override capacity | Should | S | F7.1 |
| F7.3 | Capacity calculator (available vs planned effort) | Must | M | F7.1, F6.2 |
| F7.4 | Over-capacity warning + remediation CTAs | Must | S | F7.3 |
| F7.5 | Capacity planner screen | Must | M | F7.1–F7.4 |
| F8.1 | Daily Command Centre composition | Must | L | F6, F7, F9.1 |
| F8.2 | Primary Move + Supporting (≤3) + Operational | Must | M | F8.1 |
| F8.3 | Upcoming deadlines panel | Must | S | F5, F6 |
| F8.4 | Risk alerts panel | Must | M | F3.4, F5.4, F7.4 |
| F8.5 | Capacity status indicator | Must | S | F7.3 |
| F8.6 | Idea inbox teaser on Command Centre | Must | S | F9.1 |
| F8.7 | Manual set / override Primary Move | Must | S | F8.2 |

**Phase C exit:** Success criteria 7–9 (daily brief, weekly plan realism, over-capacity warning).

---

## Phase D — Ideas, decisions, weekly review

| ID | Feature | Priority | Size | Depends |
|----|---------|----------|------|---------|
| F9.1 | Idea capture (text) + Idea Studio list | Must | M | F1.3 |
| F9.2 | Idea review statuses | Must | S | F9.1 |
| F9.3 | Connect idea to pillar | Must | S | F9.1, F3.1 |
| F9.4 | Convert idea → goal / project / action | Must | M | F9.1, F4–F6 |
| F9.5 | Tags / categories on ideas | Should | S | F9.1 |
| F9.6 | Link capture on ideas | Should | S | F9.1 |
| F9.7 | Image / file attach on ideas | Could | M | storage |
| F9.8 | Voice note capture + transcription | Should | L | storage + STT |
| F10.1 | Decision records + options | Must | M | F1.3 |
| F10.2 | 1–5 scoring dimensions + weighted score | Must | M | F10.1 |
| F10.3 | Link decision to pillar/goal | Must | S | F10.1 |
| F10.4 | Final decision + review date | Must | S | F10.1 |
| F10.5 | Configurable score weights | Won’t (MVP) | — | Post-MVP |
| F11.1 | Weekly CEO Review guided flow | Must | L | F6, F7, F8 |
| F11.2 | Persist review answers | Must | S | F11.1 |
| F11.3 | Generate Weekly CEO Scorecard | Must | M | F11.1 |
| F11.4 | Print / export scorecard (PDF or print CSS) | Should | M | F11.3 |
| F11.5 | Scorecard history | Should | S | F11.3 |

**Phase D exit:** Success criteria 5–6, 10–11; critical path end-to-end.

---

## Phase E — Notifications, settings, privacy

| ID | Feature | Priority | Size | Depends |
|----|---------|----------|------|---------|
| F12.1 | In-app notifications + preference centre | Must | M | F1.3 |
| F12.2 | Daily planning reminder | Should | S | F12.1 |
| F12.3 | Weekly review reminder | Must | S | F12.1, F11 |
| F12.4 | Alert: project without next action | Must | S | F5.4 |
| F12.5 | Alert: goal without project | Should | S | F4.4 |
| F12.6 | Alert: over-capacity | Must | S | F7.4 |
| F12.7 | Alert: neglected pillar / blocked project / unreviewed ideas / decision deadline | Should | M | various |
| F13.1 | Settings screen | Must | S | — |
| F13.2 | Data export (JSON) | Must | M | all entities |
| F13.3 | Account deletion | Must | M | F1.2 |
| F13.4 | AI consent + privacy controls | Must | S | F14 |
| F13.5 | Attachment secure storage | Should | M | — |

---

## Phase F — AI assist (MVP subset)

| ID | Feature | Priority | Size | Depends |
|----|---------|----------|------|---------|
| F14.1 | AI gateway + prompt versioning + consent gate | Should | M | F13.4 |
| F14.2 | Daily priority recommendations | Should | M | F8, F14.1 |
| F14.3 | Project → task breakdown suggestions | Should | M | F5, F6, F14.1 |
| F14.4 | Weekly review summary draft | Should | M | F11, F14.1 |
| F14.5 | Capacity warning narrative | Could | S | F7.4, F14.1 |
| F14.6 | Idea categorization suggestions | Could | S | F9, F14.1 |
| F14.7 | Duplicate/overlapping project detection | Won’t (MVP) | — | Later |
| F14.8 | Multi-agent autonomous AI | Won’t | — | Excluded |

All AI features: suggestions editable; never auto-commit without confirmation.

---

## Phase G — Post-MVP / Won’t for first release

| ID | Feature | Priority |
|----|---------|----------|
| F15.1 | Google Calendar read-only sync | Could (beta) |
| F15.2 | Outlook / Apple calendar | Won’t (MVP) |
| F15.3 | Write-back deep-work blocks | Won’t (MVP) |
| F15.4 | Native iOS / Android apps | Won’t (MVP) |
| F15.5 | Team roles (assistant, coach, etc.) | Won’t (MVP) |
| F15.6 | Social / community / marketplace | Won’t |
| F15.7 | Banking / trading / accounting | Won’t |
| F15.8 | Advanced habit gamification | Won’t |
| F15.9 | Email / CSV / shareable scorecard link | Could |
| F15.10 | Configurable decision weight matrix UI | Could |

---

## Suggested delivery slices (for sprint planning)

### Slice 1 — “Can structure my life”
F1.*, F3.*, F4.*, F5.1–F5.4, F6.1–F6.3, F6.5, F2.1 (thin)

### Slice 2 — “Can plan realistically”
F7.*, F8.*, F2.1 (complete)

### Slice 3 — “Can capture & decide”
F9.1–F9.4, F10.1–F10.4

### Slice 4 — “Can review like a CEO”
F11.*, F12.1, F12.3, F12.4, F12.6, F13.*

### Slice 5 — “AI co-pilot”
F14.1–F14.4

### Slice 0 (parallel) — Prototype
F0.* before or overlapping Slice 1

---

## Dependency graph (simplified)

```
F1 Platform ──► F3 Pillars ──► F4 Goals ──► F5 Projects ──► F6 Actions
                     │                           │              │
                     ├──────────► F9 Ideas ◄─────┴──────────────┤
                     │                           │              │
                     └──────────► F10 Decisions  │              │
                                                 ▼              ▼
                                              F7 Capacity ◄─────┘
                                                 │
                                                 ▼
                                              F8 Command Centre
                                                 │
                                                 ▼
                                              F11 Weekly Review
                                                 │
                                    F12 Notifs · F13 Settings · F14 AI
```

---

## Estimation guidance

- Treat **Must** items in Phases A–D as the MVP commitment.  
- Use story points in [USER_STORIES.md](./USER_STORIES.md); sum by slice.  
- Spike spikes (capacity math, Command Centre queries, AI JSON) early in Slice 1–2.  
- Hold a 15–20% buffer for design polish (calm UI is a product requirement, not polish-only).  

---

## Traceability to MVP success criteria

| # | Criterion | Features |
|---|-----------|----------|
| 1 | Define pillars | F3.1, F2.1 |
| 2 | Goals connected to pillars | F4.1 |
| 3 | Projects connected to goals | F5.1 |
| 4 | Actions on projects | F6.1 |
| 5 | Capture ideas quickly | F9.1 |
| 6 | Evaluate ideas/opportunities | F9.2–F9.4, F10.* |
| 7 | Focused daily brief | F8.* |
| 8 | Realistic weekly plan | F7.*, F6.2 |
| 9 | Over-capacity warning | F7.4 |
| 10 | Weekly CEO review | F11.* |
| 11 | See time/actions → goals | F3.3, F8, F11.3 |