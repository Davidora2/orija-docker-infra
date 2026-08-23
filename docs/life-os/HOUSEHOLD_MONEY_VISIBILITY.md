# Life OS — Household money visibility (UX plan)

**Status:** Planning (extends Approach B household/budget UX)  
**Audience:** David + engineering + design  
**Scope:** Household settings for money visibility between partners — no API or UI implementation in this doc  
**Related:** [UX_IA.md](./UX_IA.md) · [TECHNICAL_REQUIREMENTS.md](./TECHNICAL_REQUIREMENTS.md) · Approach B household/budget plan (personal vs household scopes, move-not-copy, combined lens)

> **David’s requirement:** Household settings should include whether users want to share **full visibility** or **shared bills only**.

---

## 1. Codebase grounding (current shipped state)

| Area | What exists today | Gap for this feature |
|------|-----------------|----------------------|
| **You → Household** (`household-panel.tsx`) | Household switcher, member list, partner invite (owner-only, max 2 members) | No money visibility controls |
| **Money selector** (`budget-panel.tsx`) | Per-user **Personal** vs **Shared** budget rows (`visibility: PRIVATE \| SHARED`); `+ Personal` / `+ Shared` when partner linked | “Shared” is a budget container, not yet a combined household lens |
| **API / schema** | `household_members`: `role` only (`OWNER` \| `PARTNER`). Budgets: `owner_user_id`, `household_id`, `visibility` | No member-level money visibility preference |
| **Display dedupe** (`life-os-shared`) | Collapses duplicate empty Personal/Shared budget rows client-side | Does not solve partner visibility or combined outgoings |
| **Outgoings** | Edit/remove recurring bills; no “move to household” action | Move-to-share flow still planned (Approach B) |
| **UX_IA § Partner privacy** | Item-level Private \| Household; household management under You | Money visibility between partners not specified |

**Implication:** Settings belong in **You → Household**, backed by a new per-member grant on `household_members` (or equivalent). Money UI continues to use Personal vs Household lenses; grants control what each partner can read in the Household lens.

---

## 2. Visibility modes (definitions)

| Mode | API enum (planning) | What the granting user exposes to their partner |
|------|---------------------|--------------------------------------------------|
| **Shared bills only** (default) | `SHARED_BILLS_ONLY` | Only outgoings (and related money rows) that live in the **household Shared budget** — i.e. items explicitly **moved** there, not copied |
| **Full visibility** | `FULL_VISIBILITY` | Read access to the granting user’s **Personal budget** outgoings (recurring, entries, pay schedule context) via the partner’s **Household** lens — **no duplicate rows** in storage |

**Not in MVP:** granular category-level visibility, separate Wealth visibility, hiding pay amount while showing bills, or editing partner’s personal rows.

---

## 3. Where settings live

### Primary surface: **You → Household**

Add a **Money visibility** section below Members (only when household has 2 members).

```
Household
├── Your spaces          (existing)
├── Members              (existing)
└── Money visibility     (NEW)
    └── [Partner name]
        What they can see of your money
        ○ Shared bills only (recommended)
        ○ Full visibility
        [helper text per selection]
```

**Why Household, not Money settings?**

- UX_IA already places couple linking under **You → Household**; visibility is a **relationship** setting, not account/currency settings (**You → Settings**).
- Avoids burying a partner consent control inside day-to-day Money navigation.
- Matches item-level privacy pattern: management under You, objects stay in their domain.

### Secondary entry (discovery only): **Money → Overview**

When partner is linked, show a one-line status + deep link:

> “[Partner] can see shared bills only · Change in Household”

Do **not** duplicate the full control in Money for MVP — link only.

### Not recommended

- **Per-partner toggle inside Money space selector** — too easy to change while budgeting; mixes lens switching with consent.
- **Household-level single toggle both must agree on** — blocks asymmetric privacy needs (see §5).

---

## 4. UX by mode — Personal vs Household tabs

Rename user-facing labels to match Approach B (implementation can lag on internal `PRIVATE` / `SHARED` ids):

| Internal | User label |
|----------|------------|
| Personal budget | **Personal** |
| Shared budget + combined lens | **Household** |

Money segments (Overview · Spending · Wealth) apply to whichever lens is selected.

### 4.1 Your view — **Personal** lens

| Mode you granted | What you see |
|------------------|--------------|
| Any | Your full Personal budget — all recurring, entries, pay context. Edit freely. |
| Shared bills only | Household tab shows only items you moved to Shared budget. |
| Full visibility (you granted partner full) | Same Personal view for you; your rows are not duplicated into Shared storage. |

### 4.2 Your view — **Household** lens

| Your grant to partner | Partner’s grant to you | Household lens shows |
|-------------------------|------------------------|----------------------|
| Shared bills only | Shared bills only | **Shared budget only** — union of both partners’ moved/shared rows, attributed by owner |
| Full visibility | Shared bills only | Your personal outgoings (read-only, attributed “You”) **plus** partner’s Shared-budget rows |
| Shared bills only | Full visibility | Your Shared-budget rows **plus** partner’s personal outgoings (read-only, attributed) |
| Full visibility | Full visibility | **Combined lens**: both personal outgoings + any Shared-budget rows, deduped by source row id — still one row per bill in storage |

**Attribution:** Every row in Household lens shows a subtle owner chip (“You” / partner display name). Partner-sourced personal rows are **read-only** in Household lens (no edit/delete on partner’s personal budget from Household).

### 4.3 Partner’s view (mirror)

Partner uses the same Personal / Household lenses. What they see of **your** money is determined by **your** grant setting, not theirs.

### 4.4 Wealth segment (MVP boundary)

| Lens | MVP |
|------|-----|
| Personal | Full Wealth panel as today |
| Household | Shared Wealth rows only (`visibility = SHARED` on goals/debts/investments) — **no** full-visibility spill for Wealth in MVP |

Document in settings helper: “Full visibility applies to spending and pay context in MVP, not savings/debt detail.”

---

## 5. Mutual vs individual choice

**Recommendation: individual asymmetric grants — each member sets what *they* expose to their partner.**

| Question | Answer |
|----------|--------|
| Must both agree on full visibility? | **No.** Each user controls their own grant independently. |
| Can one grant full while partner grants shared-only? | **Yes.** Common and expected (e.g. one partner wants transparency, one prefers privacy). |
| Does partner’s setting affect what you see of them? | **Yes.** You see their personal outgoings only if **they** chose full visibility toward you. |
| Notification on partner change? | **Later.** MVP: no push; optional in-app banner on next Money open: “[Partner] updated what they share with you.” |

**Why not mutual unlock?** Couples rarely have symmetric comfort levels; mutual consent creates deadlock (“I won’t show mine until you show yours”) and complicates breakup. Privacy-first default stays **shared bills only** per member.

---

## 6. Interaction with “move to share” when full visibility is on

Approach B: sharing is **MOVE** to household Shared budget, not copy. Visibility grants add a **read lens** without moving rows.

| Grant mode | Partner sees personal row? | Move to household still needed? |
|------------|----------------------------|----------------------------------|
| Shared bills only | No, until moved | **Yes** — required for partner visibility |
| Full visibility | Yes, read-only in Household lens | **Optional** — for joint semantics, not visibility |

### When full visibility is on, move-to-share means:

1. **Joint household obligation** — bill counts toward household cashflow / “our bills” totals and shared reminders.
2. **Payment context** — mark which account pays from the **household** budget (e.g. joint account).
3. **Calendar / reminders** — surface on household bill timeline explicitly (vs “visible but personal”).

### UI on a personal recurring row when you have full visibility granted

- Primary: edit as personal (Personal lens).
- Secondary action in Personal lens: **“Mark as household bill”** (move to Shared budget) — not “Share” when already visible.
- In Household lens on a personal-only row (full vis): badge **“Personal · visible to [Partner]”** + action **“Mark as household bill”** if they want joint semantics.

### Anti-duplication rule

- **Never** copy row on move; **never** show two rows in Household lens for the same underlying outgoing.
- If a row was moved to Shared budget, Household lens shows the **Shared budget row** only (personal source removed). Full-visibility read does not double-count.

---

## 7. Copy / strings

### Section header (You → Household)

| Element | String |
|---------|--------|
| Section title | **Money visibility** |
| Section subtitle | Choose what your partner can see of your spending. They control what you see of theirs. |

### Per-partner control

| Element | String |
|---------|--------|
| Label | What **[Partner display name]** can see |
| Option A (default) | **Shared bills only** |
| Helper A | Only bills you move to the household budget. Everything else stays private. |
| Option B | **Full visibility** |
| Helper B | They can see all your personal outgoings and pay schedule in the Household view. Nothing is copied — they get read-only access. |

### Confirmation when enabling full visibility

| Element | String |
|---------|--------|
| Title | Share full visibility? |
| Body | [Partner] will see your personal recurring bills, daily spending entries, and pay schedule in Household view. They won’t be able to edit your personal budget. You can change this anytime in Household settings. |
| Primary | Turn on full visibility |
| Secondary | Keep shared bills only |

### Money Overview discovery line

| State | String |
|-------|--------|
| You → shared only | [Partner] sees **shared bills only**. Change in Household → |
| You → full | [Partner] sees **full visibility** of your spending. Change in Household → |
| Partner → shared only (info) | [Partner] shares **shared bills only** with you. |
| Partner → full (info) | [Partner] shares **full visibility** with you. |

### Move / household bill actions

| Context | String |
|---------|--------|
| Shared-bills mode, personal row | **Move to household** |
| Full-vis mode, personal row | **Mark as household bill** |
| Already in Shared budget | **In household budget** (disabled) |
| Household lens, read-only partner row | **[Partner]’s bill** · read-only |

### Empty Household lens (shared-bills only, nothing moved)

> No household bills yet. Move a bill from Personal, or ask your partner to share one.

---

## 8. Data model notes (planning level)

### New field on `household_members`

```text
money_visibility_grant text NOT NULL DEFAULT 'SHARED_BILLS_ONLY'
  CHECK (money_visibility_grant IN ('SHARED_BILLS_ONLY', 'FULL_VISIBILITY'))
```

- Scoped per `(household_id, user_id)` — the **grantor** is `user_id`; the **recipient** is the other member.
- Default on partner join: `SHARED_BILLS_ONLY` for both members.
- Expose in `GET /v1/me` members payload: `moneyVisibilityGrant` (your setting) and `partnerMoneyVisibilityGrant` (what partner granted toward you, if any) for UI labels.

### Query model for Household lens (conceptual)

```text
HouseholdOutgoings(viewer, household) =
  SharedBudgetRows(household)
  ∪ IF partner.grant = FULL_VISIBILITY → PartnerPersonalRows(partner, read_only)
  ∪ IF viewer.grant = FULL_VISIBILITY → ViewerPersonalRows(viewer)  -- for combined totals; UI attributes owner
```

Dedupe key: `source_outgoing_id` or budget row id — moved rows replace personal in combined view.

### Audit / breakup (later table)

`household_money_visibility_audit` — optional post-MVP: who changed grant, when, for support/disputes.

### Relationship to existing `visibility` on budgets/items

| Layer | Role |
|-------|------|
| `budgets.visibility` | Storage partition: Personal vs Shared budget |
| `household_members.money_visibility_grant` | Read grant between members |
| `life_items.visibility` | Unchanged for Plan/Actions — orthogonal |

---

## 9. MVP vs later phasing

### MVP (Phase 1 — aligns with Approach B shared bills)

- [ ] You → Household: Money visibility section with per-partner radio (shared bills only default)
- [ ] API: read/write `money_visibility_grant`
- [ ] Household lens = Shared budget union (both partners’ moved rows)
- [ ] Move to household on personal outgoings (move, not copy)
- [ ] Attribution chips on Household rows
- [ ] Money Overview deep link to Household settings

### MVP (Phase 2 — full visibility read lens)

- [ ] Household lens includes partner personal outgoings when grant = `FULL_VISIBILITY`
- [ ] Read-only enforcement for partner-sourced personal rows
- [ ] Pay schedule context in Household Overview when grant allows (frequency, next pay — amounts per existing privacy comfort)
- [ ] Confirmation sheet on enabling full visibility
- [ ] Deduped combined totals in Overview / Spending

### Later

- [ ] Wealth full visibility (savings, debt, investments)
- [ ] Granular: categories or single bills hidden even under full visibility
- [ ] Pay amount masking (“show bills but hide income”)
- [ ] Change notifications + email
- [ ] Visibility preset at invite accept (“How much do you want to share?”)
- [ ] Export includes visibility metadata for GDPR records

---

## 10. Recommendation summary

| Topic | Recommendation |
|-------|----------------|
| **Default** | `SHARED_BILLS_ONLY` for every member on join — privacy-first |
| **Settings location** | **You → Household**, one control per partner (“what they can see of **your** money”) |
| **Choice model** | **Individual asymmetric** — no mutual lock |
| **Combined view** | Household lens merges Shared budget + conditional read of partner Personal — **no row duplication** |
| **Full vis + move** | Move/mark-as-household still valuable for joint semantics; not required for visibility |
| **Wealth** | Out of full-visibility MVP; Shared Wealth rows only |

### Edge cases

| Scenario | Behavior |
|----------|----------|
| **Breakup / partner removed** | Revoke all grants immediately; partner loses read access to personal rows. Rows in Shared budget: **revert to mover’s Personal budget** (owner = `owner_user_id` on budget row). Notify both in UI on next open. |
| **One full, one shared-only** | Supported. Household lens is asymmetric — each side sees what the other granted. |
| **User switches active household** | Grants are per household; Personal household has no partner grants. |
| **Owner deletes account** | Existing account-deletion flow transfers household ownership; grants reset for remaining member; audit per `account_deletion_audit`. |
| **Partner never opens Money** | Grant still stored; no effect until they view Household lens. |
| **Downgrade full → shared only** | Immediate revoke of read access; no retroactive deletion of partner’s offline cache until sync (follow offline-sync policy). |

---

## 11. Acceptance criteria (planning)

- [ ] David can set shared-bills-only vs full visibility per partner in You → Household  
- [ ] Default for new couple households is shared-bills-only for both members  
- [ ] Household Money view never shows duplicate outgoings for the same bill  
- [ ] Full visibility does not copy rows; partner sees read-only attributed personal outgoings  
- [ ] Move-to-household remains the path for explicit shared bills; optional when full visibility is on  
- [ ] Settings copy states clearly that each person controls their own grant  

---

## 12. Next steps (engineering, after plan sign-off)

1. API migration: `household_members.money_visibility_grant`  
2. Extend `getAccountPayload` member fields  
3. Household outgoings query with grant-aware lens  
4. `household-panel.tsx` Money visibility section  
5. Move-to-household in outgoings UI (Approach B)  
6. Update [USER_STORIES.md](./USER_STORIES.md) with E13/Household money visibility stories  
