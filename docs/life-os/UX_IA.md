# Life OS — UX Information Architecture

**Status:** Locked for mockups (docs-only; no UI rewrite in this pass)  
**Audience:** Design + engineering  
**Supersedes for nav / journey / screen inventory:** informal Command-centric labels in shipped UI and older brief wording where they conflict  
**Related:** [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) · [USER_STORIES.md](./USER_STORIES.md) · [FEATURE_BACKLOG.md](./FEATURE_BACKLOG.md)

---

## 1. Purpose

Lock information architecture and the core user journey **before** mockups or a full UI rewrite.

This doc is the acceptance source for:

- Five-tab navigation
- Onboarding sequence
- Six primary screens for the next mockup set
- Global patterns (FAB, privacy, Plan segments)
- Migration from **shipped** labels → **target** labels

---

## 2. Core principles

### Four questions (in order)

1. **Where am I going?** — direction / areas of life  
2. **What matters?** — priorities among ideas and projects  
3. **What can I realistically do?** — capacity and calendar constraints  
4. **What should I do now?** — Today / primary move  

### Mental model

```
Plan → Execute → Review
```

### Hierarchy (day-to-day)

```
Area → Idea → Project → Action
```

| Layer | Role | Who lives here day-to-day |
|-------|------|---------------------------|
| **Area** | Life domain (Career, Wealth, Health…) | Planning |
| **Idea** | Captured possibility; not yet committed | Capture / evaluate |
| **Project** | Outcome that needs several steps | Planning |
| **Action** | Concrete next move with estimate / due | **Daily execution** |

Deeper structure (visions, goals, milestones) remains available for planning; users should not need it to run a normal day.

### Product loops

**Execution loop**

```
Capture → Decide → Plan → Do → Review → Adjust
```

**Structure chain**

```
Idea → Project → Action → Capacity → Calendar → Today
```

**Money (alongside, not inside bottom clutter)**

```
Income → Spending → Saving → Calendar → Life goals
```

---

## 3. Navigation map (5 tabs)

Do **not** put everything in bottom nav. Secondary destinations live inside Plan, Money, or You.

| Tab | Nav label | Page title (optional) | Job |
|-----|-----------|----------------------|-----|
| 1 | **Today** | May still say **COMMAND** | Focus now: available / planned / remaining + primary move |
| 2 | **Plan** | Plan | Segmented: **Areas \| Projects \| Ideas** |
| 3 | **Calendar** | Calendar | Actions, bills, paydays, milestones colliding |
| 4 | **Money** | Money *(not “Budget”)* | Segmented: **Overview \| Spending \| Wealth** |
| 5 | **You** | You | Capacity, Weekly Review, Household, Integrations, Settings |

### Plan segments

| Segment | Shows | Primary CTAs |
|---------|-------|--------------|
| **Areas** | Life areas + health / neglect signals | Open area → projects & ideas |
| **Projects** | Active / paused projects across areas | Open project · add project |
| **Ideas** | Inbox of unclassified captures | Capture · Evaluate · Convert |

### Money segments

| Segment | Shows | Maps from shipped |
|---------|-------|-------------------|
| **Overview** | Cashflow pulse, upcoming bills, runway cues | Budget dashboard / summary |
| **Spending** | Outgoings, categories, daily expenses | Outgoings / Ledger |
| **Wealth** | Savings, debt, investments, timelines | Wealth panel |

### You destinations (not tabs)

- **Capacity** — weekly hours (optional daily breakdown)
- **Weekly Review** — short CEO-style check-in
- **Household** — partner link / shared vs private
- **Integrations** — calendar sync (Google / Microsoft), future connectors
- **Settings** — currency, account, notifications

---

## 4. Shipped UI → target migration

Source of truth for *current* chrome: `apps/life-os` nav chips and `apps/mobile` bottom tab bar (both use seven destinations today).

| Shipped id / label | Target home | Notes |
|--------------------|-------------|-------|
| `command` / **Command** | **Today** | Nav label becomes Today; page eyebrow may remain COMMAND |
| `ideas` / **Ideas** | **Plan → Ideas** | Also reachable via global FAB → Idea |
| `portfolio` / **Areas** | **Plan → Areas** | Same concept; Areas are life domains |
| `capacity` / **Capacity** | **You → Capacity** | Leave primary nav |
| `budget` / **Budget** | **Money** | Rename; keep Overview / Spending / Wealth inside |
| `calendar` / **Calendar** | **Calendar** | Unchanged role; enrich collision types |
| `review` / **Review** | **You → Weekly Review** | Leave primary nav |
| Settings / currency / account sheets | **You → Settings** | Consolidate entry |
| Household / couple link | **You → Household** | Item-level privacy still on objects |
| Calendar OAuth panels | **You → Integrations** | Connect flows stay deep-linked from Calendar as needed |
| FAB capture (mobile) | **Global FAB + sheet** | Expand types: Action / Idea / Project / Spend |

### Hierarchy wording migration

| Brief / older docs | Target UX language |
|--------------------|--------------------|
| Pillar | **Area** |
| Idea Studio | **Ideas** (Plan segment + capture) |
| Command Centre | **Today** (page may say COMMAND) |
| Budget | **Money** |
| Weekly CEO Review | **Weekly Review** (under You) |

Planning docs that still say Pillar/Command remain valid for product intent; **this file wins for UI labels and nav**.

---

## 5. Onboarding journey

Goal: ~few minutes to a usable Today screen. Practical, not a personality quiz.

### Steps (ordered)

| # | Screen | Must | Acceptance criteria |
|---|--------|------|---------------------|
| 1 | **Account** | Yes | Create account / Sign in; Google + Microsoft social; email+password remains; **no visible Server API URL in production UI** (dev/debug only) |
| 2 | **Welcome** | Yes | Copy: ~2 minutes; CTAs **Get started** / **I'll set this up later** (later → Today with resume entry) |
| 3 | **Choose areas** | Yes | Suggest defaults; recommend **3–5**; gentle warning if **8+**; at least one required to finish |
| 4 | **Capacity setup** | Yes | Weekly hours early; optional daily breakdown; skip keeps a sensible default |
| 5 | **Capture ideas** | Soft | Quick dump, **no classification** required; can skip with empty inbox |
| 6 | **Turn one idea into a project** | Soft | Plain language: “one action” vs “needs several steps”; skip allowed |
| 7 | **Create first action** | Soft | Estimate, due this week, importance — **not** full Eisenhower matrix yet |
| 8 | **Payoff → Today** | Yes | Land on Today showing available / planned / remaining + **primary move** |

### Onboarding AC (summary)

- [ ] User can exit early after Welcome and resume later  
- [ ] Completing through action (or minimum path: areas + capacity) yields a non-empty Today  
- [ ] Production auth screens never show API base URL  
- [ ] Social login buttons match available providers (hide if unconfigured)

---

## 6. Six developer screens (next mockup set)

These are the only screens that must be mocked before implementation. Specs below are inventory + AC style.

### 6.1 Onboarding

- **Surfaces:** Account → Welcome → Areas → Capacity → Ideas dump → Idea→Project → First action → Payoff  
- **Tone:** Calm editorial; one job per step; large serif titles; uppercase micro-labels  
- **AC:** Matches §5; progress indicator optional but non-blocking; primary CTA always one clear verb  

### 6.2 Today

- **Job:** Answer “What should I do now?”  
- **Inventory:**
  - Eyebrow: COMMAND (optional) / title: today date or “Today”
  - Capacity strip: **available · planned · remaining** (hours)
  - **Primary move** card (one action): title, estimate, due / day, project/area cue
  - Supporting moves (≤3)
  - Light operational cues: due soon, over-capacity warning → link to You → Capacity or Plan
  - Empty state: CTA into Plan or FAB
- **AC:**
  - [ ] Primary move is exactly one action when any exist  
  - [ ] Over-capacity is visible without opening Capacity  
  - [ ] Does not dump full project lists or money widgets  

### 6.3 Plan / Areas

- **Job:** “Where am I going?” + browse structure  
- **Inventory:**
  - Segmented control: Areas | Projects | Ideas (default **Areas** for this mockup)
  - Area list: name, optional health (on track / needs attention), project count
  - Area detail (can be same flow): linked projects, open ideas, neglect cue
- **AC:**
  - [ ] 3–5 areas readable without scrolling past fold on phone when possible  
  - [ ] Switching segments does not lose scroll position aggressively (best effort)  
  - [ ] Add area is secondary, not competing with list  

### 6.4 Project

- **Job:** Outcome container with next action  
- **Inventory:**
  - Title, area, outcome / why
  - Status (Active / Paused / Done)
  - **Next action** required when Active (empty → prompt to add)
  - Action list with estimates
  - Optional: milestones, effort, risks (collapsed / secondary)
  - Importance control: simple for MVP of this screen; full Eisenhower later
- **AC:**
  - [ ] Active project without next action shows clear repair CTA  
  - [ ] Convert-from-idea provenance visible if created from Idea  
  - [ ] Time sum of actions visible vs capacity (link, not full Capacity UI)  

### 6.5 Capacity

- **Job:** “What can I realistically do?”  
- **Entry:** You → Capacity (also deep-linked from Today warnings)  
- **Inventory:**
  - Weekly available hours (editable)
  - Optional daily breakdown
  - Planned vs available summary
  - Overcommit warning with “reduce scope” guidance → Plan / Projects
- **AC:**
  - [ ] Weekly hours editable without leaving screen  
  - [ ] Planned hours derived from scheduled / dated actions  
  - [ ] No dense dashboard charts required for v1 mockup  

### 6.6 Money Overview

- **Job:** Calm financial pulse — not a ledger dump  
- **Entry:** Money tab → **Overview** segment  
- **Inventory:**
  - Income vs spending vs planned (period)
  - Upcoming bills / payday markers (tease Calendar)
  - Shortcuts into **Spending** and **Wealth**
  - Household vs personal scope if applicable
- **AC:**
  - [ ] Tab label is Money, never Budget, in chrome  
  - [ ] Overview does not require creating a budget before showing empty guidance  
  - [ ] One primary insight + two clear next steps max above the fold  

---

## 7. Secondary surfaces (specify, mock later)

### Ideas — Capture vs Evaluate

| Mode | Behavior |
|------|----------|
| **Capture** | Title (+ optional note); no area / score required; FAB or Plan → Ideas |
| **Evaluate** | Decide: keep, park, convert to project, discard; optional area link; light scoring later |

### Calendar event types

Show collisions in one timeline:

- Actions (scheduled / due)
- Bills / outgoings
- Paydays
- Project milestones

### Wealth timelines

Under Money → Wealth: savings goals, debt paydown, investment shortfalls — timelines that can surface milestones on Calendar.

### Weekly Review (short)

Under You: results, time used vs capacity, bottlenecks, start/stop/continue, next-week priorities. Keep short — not a report builder in v1.

### Partner privacy

- **Item-level:** Private | Household (apply to actions, projects, money items as product already supports visibility)
- Household management lives under **You**; privacy toggles live on the item

### Global FAB + sheet

Single FAB opens a sheet with:

| Create | Lands in |
|--------|----------|
| **Action** | Inbox / selected project |
| **Idea** | Ideas inbox |
| **Project** | Plan → Projects |
| **Spend** | Money → Spending |

Do not add more FAB destinations without revisiting this IA.

---

## 8. Visual direction (document, don’t reinvent)

Align with shipped Life OS tokens in `apps/mobile` and `apps/life-os`:

| Token | Direction |
|-------|-----------|
| Canvas | Warm off-white (`#F4F5F0`) |
| Paper / cards | White, **generous rounded** cards (`rounded-2xl` / `rounded-3xl`) |
| Accent wash | Muted sage (`#DBE8D7`, deep `#617A57`) |
| Type | Charcoal / dark green ink (`#14241F`); **serif/display + sans** |
| Micro-labels | Uppercase, tracked, sage-deep |
| Icons | Restrained (outline), not emoji-heavy |
| Mood | Calm editorial premium — **not** a dense multi-widget dashboard |

Motion (when implemented): subtle presence (sheet rise, segment crossfade, primary-move emphasis) — 2–3 intentional motions, not noise.

---

## 9. Out of scope for this docs pass

- Full UI rewrite or tab refactor in app code  
- Generating image mockups in-repo  
- Portainer / production deploys  
- Changing API contracts solely for rename (labels can change first; ids may lag)  
- Full Eisenhower on first-action onboarding  
- New product surfaces beyond the inventory above  

---

## 10. Next steps

1. **Mockups** for the six screens in §6 (Onboarding, Today, Plan/Areas, Project, Capacity, Money Overview)  
2. Engineering spike: map route/tab ids (`command` → `today`, `budget` → `money`) without breaking deep links  
3. Update [USER_STORIES.md](./USER_STORIES.md) nav/onboarding stories to match this IA in a follow-up  
4. Implement nav shell + onboarding sequence against mockups  

---

## 11. Quick acceptance checklist (IA locked)

- [ ] Five tabs only: Today, Plan, Calendar, Money, You  
- [ ] Plan has Areas | Projects | Ideas  
- [ ] Money has Overview | Spending | Wealth  
- [ ] Onboarding matches §5 order  
- [ ] Six screens specified for mockups  
- [ ] FAB sheet: Action / Idea / Project / Spend  
- [ ] Shipped → target map in §4 reviewed by eng  
