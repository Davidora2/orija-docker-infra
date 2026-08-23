# Life OS — Planning Package

Personal operating system for ambitious professionals who need to decide **what matters**, **what to do next**, and **whether the plan fits available time**.

This package converts the product brief into estimation-ready planning artifacts for the development team.

## Documents

| Document | Purpose |
|----------|---------|
| [UX_IA.md](./UX_IA.md) | **Locked UX IA** — nav, onboarding, six mockup screens, shipped→target label map |
| [PLAN_UX.md](./PLAN_UX.md) | **Locked Plan UX** — functional developer ticket for Plan (Areas/Projects/Ideas, Action Eisenhower, Capacity Σ) |
| [HOUSEHOLD_MONEY_VISIBILITY.md](./HOUSEHOLD_MONEY_VISIBILITY.md) | Household money visibility — shared bills only vs full visibility (Approach B extension) |
| [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) | Condensed product brief (source of truth for scope) |
| [TECHNICAL_REQUIREMENTS.md](./TECHNICAL_REQUIREMENTS.md) | Architecture, data model, NFRs, security, and team recommendations |
| [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md) | Prioritized MVP backlog (MoSCoW + phases) |
| [USER_STORIES.md](./USER_STORIES.md) | User stories with acceptance criteria and estimate sizing |

## Core promise

> Choose fewer, more valuable priorities and consistently move the most important goals forward.

## Hierarchy

Committed day-to-day work (see [PLAN_UX.md](./PLAN_UX.md)):

```
Area → Project → Action
```

Ideas are a pre-commit path: `Idea → Project → Action`. Nav shell and mockup inventory: [UX_IA.md](./UX_IA.md).

Deeper planning structure (visions / goals / milestones) remains available; users live at **Action** day-to-day.

Legacy brief wording still uses:

```
Vision → Pillar → Goal → Project → Action
```

**Pillar ≡ Area** in UI copy. Idea Studio and Decision Engine sit alongside execution so capture and evaluation do not force premature commitment.

## Navigation (target)

Five tabs — **Today · Plan · Calendar · Money · You**. Full map and shipped→target migration: [UX_IA.md](./UX_IA.md).

## Critical path (prototype workflow)

```
Capture idea → evaluate → connect to area → create project
→ define next action → estimate time → compare capacity
→ schedule → Today → Weekly Review
```

## How to use these docs for estimation

1. Read **TECHNICAL_REQUIREMENTS** for stack, risks, and non-functional scope.
2. Use **FEATURE_BACKLOG** for phase sequencing and cut-line decisions.
3. Estimate **USER_STORIES** (story points / t-shirt sizes already suggested).
4. Validate that P0 stories cover MVP success criteria in the product brief.

## Out of scope for this package

Full UI rewrite, production deploys, and generated mockup image assets are not part of the docs lock. Mockups are the **next** deliverable after [UX_IA.md](./UX_IA.md); implementation follows mockup approval.