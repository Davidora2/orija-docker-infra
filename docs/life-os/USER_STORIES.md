# Life OS — User Stories

**Version:** 1.0  
**Format:** As a… I want… So that…  
**Estimates:** Fibonacci story points (1, 2, 3, 5, 8, 13). `13` = split before committing to a sprint.  
**Status values:** Ready for estimation  

Personas for MVP: **Individual User** (primary). Future roles are out of scope.

---

## Conventions

- **AC** = Acceptance Criteria (testable)  
- **Priority** mirrors backlog MoSCoW  
- Story IDs map to features: `US-{epic}.{n}`  

---

## Epic E1 — Platform & auth

### US-1.1 Sign up
**As an** ambitious professional, **I want** to create an account securely, **so that** my personal OS data stays private.

- **Priority:** Must · **Points:** 5 · **Feature:** F1.2  
- **AC:**
  - User can register with email + password or magic link (per chosen auth provider)
  - Duplicate email is rejected with a clear error
  - Session is established on success
  - Passwords never stored in plaintext (or auth is delegated)

### US-1.2 Sign in / sign out
**As a** returning user, **I want** to sign in and sign out, **so that** I can access Life OS on my devices safely.

- **Priority:** Must · **Points:** 3 · **Feature:** F1.2  
- **AC:**
  - Valid credentials create a session
  - Sign out clears session
  - Protected routes redirect unauthenticated users

### US-1.3 App shell navigation
**As a** user, **I want** clear primary navigation to Command Centre, Ideas, hierarchy areas, Capacity, Review, and Settings, **so that** I am not overwhelmed.

- **Priority:** Must · **Points:** 5 · **Feature:** F1.1  
- **AC:**
  - Desktop and mobile layouts usable at 375px+
  - Active route indicated
  - Visual tone is calm / executive (per design system)

### US-1.4 Autosave notes
**As a** user editing descriptions or idea text, **I want** changes to autosave, **so that** I do not lose work.

- **Priority:** Must · **Points:** 3 · **Feature:** F1.4  
- **AC:**
  - Save triggers after short idle debounce
  - Visible saved / saving state
  - Conflicts show a non-destructive message

---

## Epic E2 — Onboarding

### US-2.1 Complete onboarding wizard
**As a** new user, **I want** a short guided setup for pillars, vision, goals, availability, planning days, first project, and first action, **so that** I start with a working OS.

- **Priority:** Must · **Points:** 13 *(split if needed: US-2.1a–c)* · **Feature:** F2.1  
- **AC:**
  - Steps match brief §6.1 order
  - Defaults offered for pillars
  - No personality assessment
  - Completing creates linked sample hierarchy
  - User lands on Command Centre afterward

### US-2.2 Skip or resume onboarding
**As a** new user, **I want** to skip optional steps or resume later, **so that** onboarding stays practical.

- **Priority:** Must · **Points:** 3 · **Feature:** F2.2  
- **AC:**
  - Progress persisted per user
  - Incomplete onboarding shows resume entry point
  - Minimum required: at least one pillar

---

## Epic E3 — Pillars & visions

### US-3.1 Manage pillars
**As a** user, **I want** to add, rename, reorder, describe, and archive pillars, **so that** the OS matches my life areas.

- **Priority:** Must · **Points:** 5 · **Feature:** F3.1, F3.2  
- **AC:**
  - Default pillars seeded (Career, Business, App/Product, Wealth, Personal, Creative) — editable
  - Archive hides from active views without destroying history
  - Reorder persists

### US-3.2 View pillar detail
**As a** user, **I want** to see a pillar’s goals, projects, recent activity, time invested, progress, and health, **so that** I know if that life area is healthy.

- **Priority:** Must · **Points:** 8 · **Feature:** F3.3, F3.4  
- **AC:**
  - Health shows On track / Needs attention / At risk / Paused
  - High-priority pillar with little/no recent attention is flagged
  - Lists link through to goal/project detail

### US-3.3 Manage visions
**As a** user, **I want** to write one or more long-term visions, **so that** daily work connects to a desired future.

- **Priority:** Must · **Points:** 3 · **Feature:** F3.5  
- **AC:**
  - Create / edit / archive vision text
  - Optional association to pillars

---

## Epic E4 — Goals

### US-4.1 Create and edit outcome-based goals
**As a** user, **I want** goals with outcome, success criteria, target date, priority, status, and review frequency, **so that** I track results not busywork.

- **Priority:** Must · **Points:** 5 · **Feature:** F4.1  
- **AC:**
  - Goal requires a pillar
  - Statuses: Draft, Active, Paused, Completed, Cancelled
  - Progress percentage editable (manual MVP)

### US-4.2 Browse goals
**As a** user, **I want** a goals overview with filters (pillar, status, priority), **so that** I can find what matters.

- **Priority:** Must · **Points:** 3 · **Feature:** F4.2  
- **AC:**
  - Filter + search by title
  - Empty states encourage creating a goal

### US-4.3 See projects on a goal
**As a** user, **I want** connected projects on the goal detail, **so that** I see how work delivers the outcome.

- **Priority:** Must · **Points:** 2 · **Feature:** F4.3  
- **AC:**
  - List active/completed projects
  - CTA to add project

### US-4.4 Goal without project alert
**As a** user, **I want** to be warned when an active goal has no active project, **so that** ambitions do not stall.

- **Priority:** Should · **Points:** 2 · **Feature:** F4.4  
- **AC:**
  - Alert visible on goal detail and Risk Alerts

---

## Epic E5 — Projects

### US-5.1 Manage projects
**As a** user, **I want** projects linked to a goal (and pillar) with dates, effort, priority, status, risks, and notes, **so that** work is defined bodies of effort.

- **Priority:** Must · **Points:** 8 · **Feature:** F5.1, F5.2  
- **AC:**
  - Statuses: Proposed, Active, Waiting, Blocked, Completed, Paused, Cancelled
  - Estimated vs actual time fields
  - Desired outcome required for Active status (or warned)

### US-5.2 Next action requirement
**As a** user, **I want** every active project to have a clear next action, **so that** projects never become zombies.

- **Priority:** Must · **Points:** 3 · **Feature:** F5.4  
- **AC:**
  - Active project without next action is flagged
  - Project detail highlights “Define next action”
  - Feeds Risk Alerts / notifications

### US-5.3 Milestones
**As a** user, **I want** optional milestones on a project, **so that** I can track interim progress.

- **Priority:** Should · **Points:** 3 · **Feature:** F5.3  
- **AC:**
  - Add / complete milestone with target date
  - Shown on project detail and scorecard when completed

---

## Epic E6 — Actions

### US-6.1 Create and manage actions
**As a** user, **I want** actions with due date, estimate, energy, priority, status, schedule, and notes, **so that** I can execute concretely.

- **Priority:** Must · **Points:** 8 · **Feature:** F6.1, F6.5  
- **AC:**
  - Statuses: Inbox, Planned, In progress, Waiting, Completed, Cancelled
  - Energy: Low, Medium, High, Deep focus
  - Must belong to a project (MVP)
  - List/filter by status, project, energy, due date

### US-6.2 Schedule an action
**As a** user, **I want** to assign a scheduled time window to an action, **so that** it appears in my plan and capacity math.

- **Priority:** Must · **Points:** 5 · **Feature:** F6.2  
- **AC:**
  - Set scheduled start/end or date + duration
  - Reschedule updates capacity calculation
  - Scheduled actions eligible for Command Centre

### US-6.3 Complete, reschedule, move
**As a** user, **I want** to complete, reschedule, or move actions between projects quickly, **so that** planning stays fluid.

- **Priority:** Must · **Points:** 3 · **Feature:** F6.3  
- **AC:**
  - Complete records actual duration optionally
  - Move preserves history in activity log
  - Undo complete within session (nice-to-have; Could)

### US-6.4 Recurring actions
**As a** user, **I want** basic recurrence on some actions, **so that** operational tasks repeat without re-entry.

- **Priority:** Could · **Points:** 8 · **Feature:** F6.4  
- **AC:**
  - Support weekly/daily basic rules
  - Completing spawns next occurrence

---

## Epic E7 — Capacity

### US-7.1 Set weekly availability
**As a** user, **I want** to enter weekly available hours by category (employment, business, product, personal, health, creative, rest, other), **so that** the system knows my real capacity.

- **Priority:** Must · **Points:** 5 · **Feature:** F7.1, F7.5  
- **AC:**
  - Template saved per user
  - Categories match brief §6.9
  - Planning days preference stored

### US-7.2 See capacity vs commitments
**As a** user, **I want** the app to compare available hours to scheduled actions and estimated project effort, **so that** I know if my plan is realistic.

- **Priority:** Must · **Points:** 8 · **Feature:** F7.3  
- **AC:**
  - Shows available, planned, remaining
  - Status: under / at / over capacity
  - Uses estimated durations of planned/scheduled actions for the week

### US-7.3 Over-capacity warning
**As a** user, **I want** a clear warning when overcommitted, **so that** I can cut, delay, reduce, delegate, or reschedule.

- **Priority:** Must · **Points:** 3 · **Feature:** F7.4  
- **AC:**
  - Message includes numbers (e.g. “18 hours committed vs 11 available”)
  - Offers remediation prompts (not automated changes)
  - Surfaces on Capacity screen and Command Centre

---

## Epic E8 — Command Centre

### US-8.1 Daily Command Centre overview
**As a** user, **I want** a calm daily dashboard with Primary Move, up to three supporting actions, operational tasks, deadlines, risks, ideas, and capacity status, **so that** I know what to do today.

- **Priority:** Must · **Points:** 13 *(split: composition vs panels)* · **Feature:** F8.1–F8.6  
- **AC:**
  - Primary Move exactly one (or empty CTA)
  - Supporting ≤ 3
  - Clarity over density; no card clutter beyond interactive needs
  - Capacity status visible
  - Risk alerts list truncated with link to details

### US-8.2 Set Primary Move
**As a** user, **I want** to choose or override today’s Primary Move, **so that** I stay intentional.

- **Priority:** Must · **Points:** 3 · **Feature:** F8.7  
- **AC:**
  - Pick from today’s planned actions or type an outcome
  - Persists for the day
  - Completing Primary Move reflects on Command Centre

---

## Epic E9 — Idea Studio

### US-9.1 Capture an idea quickly
**As a** user, **I want** to capture a text idea in seconds without creating a task, **so that** I protect creativity without bloating commitments.

- **Priority:** Must · **Points:** 5 · **Feature:** F9.1  
- **AC:**
  - Capture from global shortcut / Idea Studio
  - Default status Captured / Inbox
  - Does not appear as an Action until converted

### US-9.2 Review and triage ideas
**As a** user, **I want** to set idea status (Develop now, Incubate, Reference, Discard, Convert…), **so that** I process the inbox deliberately.

- **Priority:** Must · **Points:** 5 · **Feature:** F9.2  
- **AC:**
  - All statuses from brief §6.7 available
  - Discard hides from default inbox
  - Unreviewed count available for alerts

### US-9.3 Connect idea to pillar
**As a** user, **I want** to attach an idea to a pillar, **so that** evaluation stays strategically grounded.

- **Priority:** Must · **Points:** 2 · **Feature:** F9.3  
- **AC:**
  - Optional pillar association
  - Filter ideas by pillar

### US-9.4 Convert idea to work
**As a** user, **I want** to convert an idea into a goal, project, or action, **so that** only chosen ideas become commitments.

- **Priority:** Must · **Points:** 8 · **Feature:** F9.4  
- **AC:**
  - Conversion wizard pre-fills title/description
  - Original idea marked Converted with link to entity
  - Requires confirming estimates before scheduling actions

### US-9.5 Voice / media capture
**As a** user, **I want** to capture voice notes (and optionally images/links/files), **so that** ideas are frictionless on mobile.

- **Priority:** Should (voice) / Could (files) · **Points:** 8 (voice) · **Feature:** F9.6–F9.8  
- **AC:**
  - Voice uploads and shows transcription when available
  - User can edit transcript
  - Failures do not lose the audio blob

---

## Epic E10 — Decision Engine

### US-10.1 Create a decision record
**As a** user, **I want** to evaluate options with scores for alignment, upside, leverage, urgency, confidence, effort, and risk, **so that** I make better trade-offs.

- **Priority:** Must · **Points:** 8 · **Feature:** F10.1, F10.2  
- **AC:**
  - Multiple options per decision
  - Each dimension scored 1–5
  - Weighted score displayed as guidance (not auto-decision)
  - Formula: (alignment + upside + leverage + urgency + confidence) − (effort + risk)

### US-10.2 Link and conclude decisions
**As a** user, **I want** to relate a decision to pillar/goal, set cost/time/benefit/risks/opportunity cost, and record the final choice + review date, **so that** decisions are auditable.

- **Priority:** Must · **Points:** 5 · **Feature:** F10.3, F10.4  
- **AC:**
  - Fields from brief §6.8 present
  - Final decision and decision date stored
  - Review date can generate reminder

---

## Epic E11 — Weekly CEO Review & Scorecard

### US-11.1 Complete weekly review
**As a** user, **I want** a guided weekly review covering Results, Time, Bottlenecks, Decisions, Priorities, and Capacity, **so that** I course-correct every week.

- **Priority:** Must · **Points:** 13 · **Feature:** F11.1, F11.2  
- **AC:**
  - All sections from brief §6.10 present
  - Prefills completed actions / time summaries where possible
  - User can edit all fields
  - Saves draft and completed states
  - Defines top 3 outcomes for next week

### US-11.2 Weekly scorecard
**As a** user, **I want** a one-page scorecard summarizing outcomes, capacity, pillar health, blockers, deadlines, and next priorities, **so that** I can review performance at a glance.

- **Priority:** Must · **Points:** 8 · **Feature:** F11.3  
- **AC:**
  - Includes items from brief §7
  - Readable on mobile and desktop
  - Generated at review completion; regenerable

### US-11.3 Export scorecard
**As a** user, **I want** to export or print the scorecard, **so that** I can keep or share a record.

- **Priority:** Should · **Points:** 5 · **Feature:** F11.4  
- **AC:**
  - Print-friendly layout and/or PDF download
  - No broken pagination for one-pager

---

## Epic E12 — Notifications

### US-12.1 Notification preferences
**As a** user, **I want** to control which alerts I receive and how often, **so that** notifications stay useful and limited.

- **Priority:** Must · **Points:** 5 · **Feature:** F12.1  
- **AC:**
  - Toggle per alert type
  - Quiet hours or digest option (email optional)
  - Defaults are conservative

### US-12.2 Critical system alerts
**As a** user, **I want** alerts for weekly review due, missing next actions, and over-capacity, **so that** I fix structural problems early.

- **Priority:** Must · **Points:** 5 · **Feature:** F12.3, F12.4, F12.6  
- **AC:**
  - Alerts appear in-app
  - Dismiss / snooze available
  - Respect preference toggles

### US-12.3 Extended alert set
**As a** user, **I want** optional alerts for neglected pillars, blocked projects, unreviewed ideas, deadlines, and decision due dates, **so that** I can deepen oversight when ready.

- **Priority:** Should · **Points:** 5 · **Feature:** F12.2, F12.5, F12.7  
- **AC:**
  - Each type independently toggleable
  - No more than one digest per day by default

---

## Epic E13 — Settings, export, privacy

### US-13.1 Settings hub
**As a** user, **I want** a settings area for profile, capacity defaults, planning days, notifications, and AI consent, **so that** I control my OS.

- **Priority:** Must · **Points:** 3 · **Feature:** F13.1, F13.4  
- **AC:**
  - All controls reachable
  - AI consent required before AI features run

### US-13.2 Export my data
**As a** user, **I want** to export my data, **so that** I retain ownership of my information.

- **Priority:** Must · **Points:** 5 · **Feature:** F13.2  
- **AC:**
  - JSON export of core entities
  - Initiated from settings
  - Completes for pilot-scale datasets without timeout

### US-13.3 Delete account
**As a** user, **I want** to delete my account and personal data, **so that** I can leave cleanly.

- **Priority:** Must · **Points:** 5 · **Feature:** F13.3  
- **AC:**
  - Confirmation step
  - Deletes or schedules deletion of PII and files
  - Session invalidated

---

## Epic E14 — AI assist

### US-14.1 Daily priority recommendation
**As a** user, **I want** AI to suggest today’s Primary Move and supporting actions, **so that** I start focused — while staying in control.

- **Priority:** Should · **Points:** 8 · **Feature:** F14.2  
- **AC:**
  - Requires AI consent
  - Suggestions editable / dismissible
  - Shows short rationale
  - Does not auto-schedule without confirmation

### US-14.2 Project breakdown
**As a** user, **I want** AI to propose next actions for a project, **so that** I unblock planning faster.

- **Priority:** Should · **Points:** 5 · **Feature:** F14.3  
- **AC:**
  - User selects which suggestions to accept
  - Accepted items become Actions in Inbox/Planned

### US-14.3 Weekly summary draft
**As a** user, **I want** AI to draft my weekly review summary, **so that** reflection is faster.

- **Priority:** Should · **Points:** 5 · **Feature:** F14.4  
- **AC:**
  - Draft inserted into review fields
  - Fully editable before save

### US-14.4 Idea categorization help
**As a** user, **I want** AI to suggest idea tags/status/pillar, **so that** triage is quicker.

- **Priority:** Could · **Points:** 3 · **Feature:** F14.6  
- **AC:**
  - Suggestions only; one-tap apply

---

## Critical-path story sequence (prototype / E2E)

Use this sequence for the clickable prototype and first E2E test:

| Step | Story |
|------|-------|
| 1 | US-9.1 Capture idea |
| 2 | US-9.2 Evaluate idea |
| 3 | US-9.3 Connect to pillar |
| 4 | US-9.4 Convert to project |
| 5 | US-6.1 Define next action |
| 6 | US-6.1 Assign estimated time |
| 7 | US-7.2 Compare against capacity |
| 8 | US-6.2 Schedule action |
| 9 | US-8.1 Display in Command Centre |
| 10 | US-11.1 Review in Weekly CEO Review |

---

## Suggested point roll-up (Must only, Phases A–D + E settings)

| Epic | Must points (approx.) |
|------|------------------------|
| E1 Platform | 16 |
| E2 Onboarding | 16 |
| E3 Pillars | 16 |
| E4 Goals | 10 |
| E5 Projects | 11 |
| E6 Actions | 16 |
| E7 Capacity | 16 |
| E8 Command Centre | 16 |
| E9 Ideas | 20 |
| E10 Decisions | 13 |
| E11 Review | 21 |
| E12 Notifications | 10 |
| E13 Settings/privacy | 13 |
| **Total Must** | **~194 pts** |

*Interpretation:* At 20–30 pts/week for a small team, MVP Must scope is a multi-sprint program — not a single sprint. Split US-2.1, US-8.1, and US-11.1 before sprint commitment. Should AI (~21 pts) is additive for founder pilot.

---

## Estimation workshop checklist

- [ ] Confirm auth provider (affects US-1.1 points)  
- [ ] Confirm voice in/out of MVP (US-9.5)  
- [ ] Confirm PDF vs print CSS for US-11.3  
- [ ] Split all 13-point stories  
- [ ] Assign owners per slice (see backlog delivery slices)  
- [ ] Define “done” includes mobile responsive + empty states  

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-08-06 | Initial user-story list from product brief |