# Life OS — Plan UX (functional developer ticket)

**Status:** Locked functional spec (not pixel-perfect mockup copy)  
**Audience:** Engineering + design  
**Scope:** Plan tab behavior, entities, views, and relationships to Today / Capacity / Calendar  
**Related:** [UX_IA.md](./UX_IA.md) (nav shell) · [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) · [TECHNICAL_REQUIREMENTS.md](./TECHNICAL_REQUIREMENTS.md) · [USER_STORIES.md](./USER_STORIES.md)

> Planning should require thought once. Execution should require almost none.

---

## 1. Purpose

**Plan** is where the user decides **what exists and what matters**.

**Today** is where the user **executes now**.

| Surface | Job | Not for |
|---------|-----|---------|
| **Plan** | Structure life: Areas, Projects, Ideas; set priorities; define Actions | Daily “what do I do this hour?” |
| **Today** | Pick up the next Action and do it | Re-deciding the whole portfolio |
| **Calendar** | See when Actions (and money events) land | Re-entering the same work |
| **Capacity** (You) | Compare available hours to Action estimates | Creating duplicate tasks |

Plan is the **decision surface**. Today / Calendar / Capacity are **read surfaces** over the same Actions.

---

## 2. Architecture rules (non-negotiable)

1. **Plan = decide what exists/matters; Today = execute now.**
2. **Committed hierarchy:** `Area → Project → Action`.  
   **Idea path (pre-commitment):** `Idea → Project → Action` (Idea is not required to sit between Area and Project for day-to-day work).
3. **Project priority = High / Medium / Low** — **not** Eisenhower.
4. **Eisenhower (Do First / Schedule / Delegate / Eliminate)** is **derived** from Action `Important × Urgent`. The priority matrix is a **view of Actions**, not a separate entity type and **not** a Project field.
5. **Today, Calendar, and Capacity read Actions** — one source of truth; no duplicate entry of the same work.
6. **Capacity** sums **Action estimates** for the period (week / day as configured).
7. **Global +** plus **contextual defaults** for create types: Action / Idea / Project / Spend.

### Core implementation rule

- Capture and classify once on Plan (or via Global +).  
- Downstream screens consume Actions; they do not invent parallel “today tasks,” “calendar tasks,” or “capacity tasks.”  
- Changing an Action’s estimate, due/schedule, Importance/Urgency, or project link updates Today / Calendar / Capacity / matrix automatically.

---

## 3. Plan navigation

Plan tab uses a segmented control:

| Segment | Job |
|---------|-----|
| **Areas** | Life domains; health / neglect; drill into projects & ideas for that area |
| **Projects** | Outcomes across areas; list + detail; High/Med/Low priority |
| **Ideas** | Inbox of unclassified captures; evaluate; convert to Project |

Default segment for first open: **Areas** (unless deep-linked to Projects / Ideas / a specific entity).

Segment switches must not destroy in-progress Quick Add draft (best effort: keep sheet/draft until dismissed).

---

## 4. Areas

### 4.1 Area cards (list)

Each Area card shows:

| Field / cue | Required | Notes |
|-------------|----------|-------|
| Name | Yes | e.g. Career, Health, Wealth |
| Health / attention signal | Soft | On track / needs attention / neglected (product rules may evolve) |
| Active project count | Soft | Count of Active projects in area |
| Open idea count | Soft | Optional; Ideas linked or tagged to area |
| Last meaningful activity | Soft | e.g. last Action completion under area’s projects |

Primary tap → Area detail (projects + open ideas for that area).  
Add Area is **secondary** (does not compete with the list).

### 4.2 Area detail

- Linked **Projects** (Active first; Paused/Done collapsed or filtered).  
- Open **Ideas** associated with the area (if any).  
- Neglect / health cue with CTA into Projects or Ideas.  
- Contextual **+** defaults to **Project** (or Idea if user prefers; see §11).

### Acceptance

- [ ] User can browse Areas without opening Projects matrix  
- [ ] Area → Projects path is one tap  
- [ ] Health/neglect is visible without a separate dashboard  

---

## 5. Projects

### 5.1 Project fields

| Field | Required | Values / notes |
|-------|----------|----------------|
| Title | Yes | Outcome-oriented |
| Area | Yes (MVP) | Parent Area |
| Outcome / why | Soft → warn if Active without | Desired result |
| Status | Yes | Active / Paused / Done (map richer statuses later: Proposed, Waiting, Blocked, Cancelled) |
| **Priority** | Yes | **High / Medium / Low only** |
| Next Action | Required when Active | Pointer to an Action; empty → repair CTA |
| Estimated effort (roll-up) | Soft | Sum of open Action estimates (derived preferred over separate manual field) |
| Target date | Soft | |
| Notes / risks / blockers | Soft | Collapsed / secondary |
| Provenance | Soft | “Converted from Idea …” if applicable |

**Explicitly not a Project field:** Eisenhower quadrant (`DO_FIRST` / `SCHEDULE` / `DELEGATE` / `ELIMINATE`).

### 5.2 Projects list

Show for each row:

- Title  
- Area cue  
- Priority (High / Medium / Low)  
- Status  
- Next Action title + estimate (or “Define next action”)  
- Optional: open Action count / total estimate  

Sort defaults (implementable):

1. Active before Paused/Done  
2. Priority High → Medium → Low  
3. Then by next-action due / urgency of next Action (derived), then title  

### 5.3 Project detail

- Header: title, area, priority (H/M/L), status  
- Outcome / why  
- **Next Action** prominent; if missing and Active → primary repair CTA  
- **Actions list** for this project (estimates, due, Importance/Urgency badges or matrix label)  
- Link: “See these Actions in Priority matrix” (filtered to this project)  
- Time sum of open Actions vs Capacity (link to You → Capacity — not embedded Capacity editor)

### Acceptance

- [ ] Creating/editing a Project never asks for Eisenhower quadrant  
- [ ] Active project without next Action is blocked/flagged with clear CTA  
- [ ] Priority control is only High / Medium / Low  

---

## 6. Actions

Actions are the **unit of execution** and the **unit of capacity**.

## Mockup fidelity corrections (2026-08)

User mockups supersede earlier polish where they conflict:

1. **Importance / Urgency are Low | Medium | High** (not yes/no booleans). Eisenhower is still derived — see mapping below.
2. **Matrix labels:** prefer **Do Now / Schedule / Delegate / Delete** (aliases of Do First / Eliminate).
3. **Matrix layout:** dedicated full **2×2 grid** with Urgency × Importance axes — not stacked “move to” cards.
4. **Ideas:** inbox capture bar, evaluate with **1–10** sliders + overall /10, and a **Turn into project** wizard (project → first action → review).
5. **Area overview:** capacity ring/stats + active projects; Areas cards show hours, % capacity, progress, chevron.
6. **Projects list:** search/filter/sort, capacity summary strip, filter sheet — not matrix-first.

### Importance × Urgency → quadrant

| Importance | Urgency | Quadrant |
|------------|---------|----------|
| High or Medium | High | **Do Now** |
| High or Medium | Medium or Low | **Schedule** |
| Low | High or Medium | **Delegate** |
| Low | Low | **Delete** |

Boolean legacy (`important`/`urgent`) still reads as High/Low for migration.

---

## 7. Quick Add + More options

### 7.1 Quick Add (default path)

Minimal friction create from Plan (and Global + when defaulting to Action/Idea/Project):

| Type | Quick fields |
|------|----------------|
| **Action** | Title, Project (contextual default), Estimate; Importance/Urgency optional with sensible defaults |
| **Idea** | Title (+ optional note); **no** Area/score required |
| **Project** | Title, Area (contextual default), Priority default Medium |
| **Spend** | Amount + category/note (lands in Money → Spending) — available from Global +, not Plan segments |

Quick Add must succeed without opening the full form.

### 7.2 More options (expand)

Reveal secondary fields without leaving the sheet:

- Action: due, schedule, energy, notes, Importance/Urgency if hidden in quick path, visibility  
- Project: outcome/why, target date, status, notes  
- Idea: optional Area link, note  

Dismissing the sheet without save discards draft (or offers keep — product choice; default discard is fine for MVP).

### Acceptance

- [ ] User can add an Action in ≤2 interactions when Project context is known  
- [ ] More options does not force every field on first save  

---

## 8. Priority matrix (Actions view)

### 8.1 What it is

A **2×2 view of open Actions** grouped by derived Eisenhower quadrant:

| | Urgent | Not urgent |
|--|--------|------------|
| **Important** | Do First | Schedule |
| **Not important** | Delegate | Eliminate |

### 8.2 List vs matrix views

On Plan → Projects (or a dedicated Actions sub-view if added later), support:

| View | Shows | Primary use |
|------|-------|-------------|
| **List** | Projects (H/M/L) and/or Actions in lists | Browse, edit fields, next actions |
| **Matrix** | Actions in four quadrants | Rebalance Important×Urgent |

Toggle persists per user (or per session minimum).

Matrix cells show Action title + estimate + project cue.  
Moving between cells updates Importance/Urgency.  
Empty cell copy: “No actions here.”

### 8.3 Interaction rules

- Filters (§9) apply to both List and Matrix.  
- Completing an Action removes it from the matrix (or moves to a Done filter).  
- Project priority (H/M/L) may be shown as a badge on the Action chip but **does not** place the chip in a quadrant.

### Acceptance

- [ ] Matrix contains Actions only  
- [ ] Do First / Schedule / Delegate / Eliminate match Important×Urgent table  
- [ ] List ↔ Matrix toggle does not duplicate data entry  

---

## 9. Filtering

Plan list and matrix support filters (combinable):

| Filter | Applies to |
|--------|------------|
| Area | Projects, Actions (via project), Ideas (if linked) |
| Project | Actions |
| Project priority (H/M/L) | Projects; optionally Actions via parent |
| Action status | Actions |
| Quadrant (Do First…) | Actions (derived) |
| Due / scheduled window | Actions |
| Search (title) | All Plan entities |

Clear filters is one control.  
Deep links may pre-set filters (e.g. Area detail → Projects filtered to that Area).

---

## 10. Ideas — inbox / evaluate / convert

### 10.1 Inbox (Capture)

- Title (+ optional note)  
- No Area, score, or project required  
- Entry: Plan → Ideas, or Global + → Idea  

### 10.2 Evaluate

Decide for each Idea:

| Decision | Result |
|----------|--------|
| Keep | Stays in inbox (optionally tag Area) |
| Park | Archived / someday list (implementation may use status) |
| **Convert to Project** | Creates Project (+ optional first Action); Idea marked converted with provenance |
| Discard | Removed or cancelled |

Light scoring / Decision Engine can layer later; not required for this ticket’s MVP path.

### 10.3 Convert flow

`Idea → Project → Action`

1. Confirm Project title (default from Idea title)  
2. Choose Area  
3. Set Project priority High/Medium/Low (default Medium)  
4. Optionally create first Action (title, estimate, Importance/Urgency)  
5. Land on Project detail with next Action set  

### Acceptance

- [ ] Capture never forces classification  
- [ ] Convert creates Project without asking for Eisenhower on the Project  
- [ ] Converted Idea shows provenance on Project  

---

## 11. Relationships to Today / Capacity / Calendar

```
Plan defines: Area → Project → Action (and Idea → Project → Action)
                    │
                    ▼
         ┌──────────┼──────────┐
         ▼          ▼          ▼
       Today     Calendar    Capacity
     (execute)  (when)    (Σ estimates)
```

| Consumer | Reads | Writes (allowed) |
|----------|-------|------------------|
| **Today** | Open Actions (rank by Eisenhower then due/schedule); shows primary + supporting | Complete / reschedule / light edits; does not create parallel task store |
| **Calendar** | Actions with due/schedule (+ bills, paydays, milestones) | Schedule/reschedule Action windows |
| **Capacity** | Sum of Action estimates for period vs available hours | Edit available hours only; remediation links back to Plan |

**No duplicate entry:** scheduling an Action on Calendar is the same Action Today sees; reducing estimate in Plan updates Capacity.

### Acceptance

- [ ] Creating work only happens via Plan or Global + (Action/Idea/Project/Spend)  
- [ ] Capacity planned hours = Σ Action estimates in scope for the period  
- [ ] Today primary move is an Action, never a Project row  

---

## 12. Global + (FAB / sheet)

Single global create control opens a sheet:

| Create | Default landing | Contextual default when opened from… |
|--------|-----------------|--------------------------------------|
| **Action** | Inbox / selected Project | Project detail or Area→Project context → that Project |
| **Idea** | Plan → Ideas | Ideas segment → Ideas inbox |
| **Project** | Plan → Projects | Area detail → that Area |
| **Spend** | Money → Spending | Money tab → Spending |

Do not add more FAB destinations without revisiting [UX_IA.md](./UX_IA.md).

Global + uses the same Quick Add + More options patterns as §7.

---

## 13. Gaps vs current shipped UI (migration intent)

Source of truth for shipped behavior today: `apps/life-os` / `apps/mobile` priority matrix on **projects**, Areas/Portfolio tab chrome, Command Centre sorting by **project** quadrant.

| Shipped today | Target (this spec) | Migration intent |
|---------------|--------------------|------------------|
| Eisenhower on **Project** (`priorityQuadrant` / `eisenhower` on project body) | Eisenhower on **Action** via Important×Urgent; matrix is Actions view | Move quadrant off Project; add Action Importance/Urgency; backfill: map project quadrant → next Action flags or leave Actions default Schedule |
| Project “priority” = Do First / Schedule / … | Project priority = **High / Medium / Low** | Replace project quadrant UI with H/M/L; keep quadrant helper only for Actions |
| Matrix panel lists **projects** | Matrix lists **Actions** | Rework `PriorityMatrixPanel` (and mobile equivalent) to Action chips |
| Command / Today sorts by **parent project** quadrant | Today sorts by **Action** derived quadrant (+ due/schedule) | Update primary-move sort keys |
| Separate Ideas / Areas tabs | Plan segments Areas \| Projects \| Ideas | Nav already specified in [UX_IA.md](./UX_IA.md) |
| Capacity uses Action `hours` (good) | Keep; ensure no project-level hours double-count | Prefer Action estimates only in Σ |

Docs-only lock: **do not** rewrite UI in this pass unless trivial link fixes. Implementation follows mockup + this ticket.

---

## 14. Alignment with UX_IA

| Topic | Authority |
|-------|-----------|
| Five-tab shell, onboarding, Money/You destinations | [UX_IA.md](./UX_IA.md) |
| Plan segment behavior, Project H/M/L, Action Eisenhower, matrix-as-view, Capacity Σ Actions | **This file** |
| Day-to-day wording | Prefer: committed work `Area → Project → Action`; Ideas are a pre-commit path |

Where UX_IA still says “full Eisenhower later” on Project screens, **this file supersedes**: Eisenhower never lands on Project; it lands on Action Important×Urgent and the Actions matrix view.

---

## 15. Out of scope for this docs lock

- Full UI rewrite / Portainer deploy  
- Pixel mockups (next deliverable after IA + this functional ticket)  
- Decision Engine scoring UI  
- Storing quadrant as an independent entity  
- Multiplayer / shared project assignment beyond existing Private/Household visibility  

---

## 16. Developer acceptance checklist

- [ ] Plan segments: Areas | Projects | Ideas  
- [ ] Project priority is High/Medium/Low only  
- [ ] Eisenhower labels only appear for Actions (derived)  
- [ ] Matrix is a view of Actions, not Projects  
- [ ] Today / Calendar / Capacity consume Actions; no duplicate task entry  
- [ ] Capacity = Σ Action estimates for the period  
- [ ] Global + types: Action / Idea / Project / Spend with contextual defaults  
- [ ] Quick Add + More options for Plan creates  
- [ ] Ideas: capture → evaluate → convert → Project (+ optional Action)  
- [ ] Shipped project-level Eisenhower called out for migration (§13)  
- [ ] Spec quote retained as product north star for Plan vs Today  

---

## 17. Next steps

1. Design mockups for Plan (Areas cards, Projects list/detail, Actions matrix/list, Ideas inbox) against this ticket — not against shipped project matrix.  
2. Engineering spike: migrate `priorityQuadrant` from Project → Action Importance/Urgency + derived view.  
3. Update [USER_STORIES.md](./USER_STORIES.md) / backlog items that still treat Eisenhower as a project attribute.  
4. Implement Plan shell + Action matrix after mockup approval.  
