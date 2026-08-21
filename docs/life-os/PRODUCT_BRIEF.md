# Life OS — Product Brief (Condensed)

Source brief condensed for planning. Full narrative requirements live here; implementation detail is in [TECHNICAL_REQUIREMENTS.md](./TECHNICAL_REQUIREMENTS.md).

**UX / nav / onboarding lock:** For information architecture, five-tab navigation, onboarding sequence, and the six-screen mockup inventory, use [UX_IA.md](./UX_IA.md). For Plan tab functional behavior (Areas/Projects/Ideas, Project H/M/L vs Action Eisenhower, Capacity Σ Actions), use [PLAN_UX.md](./PLAN_UX.md). Where labels conflict (e.g. Command vs Today, Budget vs Money, Pillar vs Area), **UX_IA wins for UI**. Where Plan entity rules conflict with older brief wording, **PLAN_UX wins**.

---

## 1. Overview

Personal operating system for ambitious professionals, entrepreneurs, creatives, and people managing multiple goals.

Helps users decide:

- What matters most  
- What to work on next  
- What to delay or stop  
- Whether commitments fit available time  
- How daily actions connect to long-term goals  

Feels like a personal Chief of Staff across work, business, finances, health, personal development, and creative projects.

## 2. Promise

> Choose fewer, more valuable priorities and consistently move their most important goals forward.

Does **not** encourage endless task creation. Emphasizes reduced complexity, trade-offs, and realistic plans.

## 3. Target user

Someone who has a job and/or business/side project, multiple goals, feels overwhelmed, generates many ideas, juggles disconnected tools, and wants structure without losing creativity.

Initial testing: founder workflow (project coordinator, entrepreneur, product designer, investor, app builder).

## 4. Principles

1. **Simplicity** — reduce cognitive load  
2. **Strategic alignment** — work connects to goals/life areas  
3. **Realistic planning** — commitments vs time/energy  
4. **Focus** — few meaningful daily/weekly priorities  
5. **Flexible creativity** — capture without forcing commitment  
6. **Decision support** — evaluate trade-offs  

## 5. Hierarchy

Day-to-day (UX):

```
Area → Idea → Project → Action
```

Planning depth (product model):

```
Vision → Pillar (Area) → Goal → Project → Action
```

Default areas: Career, Business, App/Product, Wealth, Personal, Creative (rename/add/archive/reorder).

## 6. MVP feature areas

| Area | Intent |
|------|--------|
| Onboarding | Areas, capacity, idea dump, first project/action — short, practical ([UX_IA.md](./UX_IA.md) §5) |
| Today (Command) | Primary Move, ≤3 supporting, capacity strip, deadlines/risks cues — nav label **Today** |
| Areas (Pillars) | Health indicators, goals/projects, time, neglect detection — under **Plan** |
| Goals | Outcome-based; statuses Draft→Cancelled |
| Projects | Next action required when Active; effort, risks, milestones |
| Actions | Duration, energy, schedule, statuses Inbox→Cancelled |
| Idea Studio | Capture without commitment; triage + convert |
| Decision Engine | Scored options; guidance score, not auto-decide |
| Capacity | Weekly hours; optional daily breakdown; overcommit warnings — under **You** |
| Weekly Review | Results, time, bottlenecks, start/stop/continue, priorities, capacity — under **You** |
| Money | Overview / Spending / Wealth (replaces “Budget” chrome label) |
| Scorecard | One-page weekly summary; export later |
| Notifications | Limited, user-controlled |
| Calendar | Internal scheduling MVP; Google/Outlook/Apple later |
| AI | Assistive: daily priorities, breakdowns, summaries, capacity language, idea tags |

## 7. Critical user flow

Capture idea → evaluate → connect to area → create project → next action → estimate time → capacity check → schedule → Today → Weekly Review → Scorecard.

Nav shell: **Today · Plan · Calendar · Money · You** ([UX_IA.md](./UX_IA.md)).

## 8. Roles

MVP: **Individual User** only. No team collaboration focus.

## 9. Design direction

Strategic, premium, calm, modern, focused, professional, intelligent — private executive dashboard, not a gamified habit tracker.

## 10. Explicit exclusions

Social, public profiles, forums, complex collaboration, accounting/trading/banking, habit gamification, CRM, template marketplace, full PM replacement, email automation, multi-agent AI, advanced forecasting.

## 11. Success criteria

User can define pillars, goals, projects, actions; capture and evaluate ideas; see daily brief; plan the week realistically; get over-capacity warnings; complete weekly review; understand how time supports goals.

Outcome:

> “I know what matters, what I should work on next, and whether my plan is realistic.”

## 12. First deliverable

1. **IA locked** — [UX_IA.md](./UX_IA.md) (this package).  
2. **Mockups** of the six screens in UX_IA §6 before the nav/onboarding rewrite.  
3. Clickable prototype of the critical user flow (backlog F0.1) aligned to those mockups.

Planning package deliverables (this folder): UX IA, TRD, prioritized backlog, user stories for estimation.