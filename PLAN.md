# UGC / Influencer Campaign Platform — Product & Technical Plan

> Working name: **CreatorMatch** (placeholder)  
> Positioning: An Upfluence-like platform for brands to discover creators by content, run campaigns (paid + affiliate), manage briefs/terms/applications, pay creators, and track posts & ROI.

---

## 1. Vision

Help brands find the right creators **based on what they actually post**, not just follower count — then run the full campaign lifecycle in one place:

1. Discover influencers by niche / content similarity  
2. Outreach with reusable templates & sequences  
3. Share brief + terms for preview  
4. Creators apply / accept  
5. Compensate via **flat fee**, **product gifting**, and/or **affiliate**  
6. Track delivered posts and performance metrics  
7. Attribute sales and measure ROI  

Primary inspiration: **Upfluence** (discovery, marketplace, campaigns, affiliate + payments, analytics). Secondary inspiration: Aspire, Grin, CreatorIQ, Later Influence.

---

## 2. Personas & Roles

| Role | Who | Goals |
|------|-----|--------|
| **Brand Admin** | Marketing lead / founder | Create campaigns, approve budgets, see ROI |
| **Brand Manager** | Campaign operator | Discover, outreach, review apps, track deliverables |
| **Agency** | Multi-brand operator | Same as brand, but across clients/workspaces |
| **Creator / Influencer** | Content creator | Discover campaigns, preview briefs, apply, get paid, share affiliate links |
| **Platform Admin** | Internal ops | Moderation, payouts, fraud, API health |

Auth model: multi-tenant workspaces (Brand / Agency) + Creator accounts. Creators can belong to many campaigns; brands never see each other's private data.

---

## 3. Core Modules (Upfluence-aligned)

### A. Creator Discovery (content-based)

**Goal:** Find influencers whose *content* matches the campaign, not just demographics.

**Features**
- Searchable creator index across Instagram, TikTok, YouTube, X, blogs (MVP: IG + TikTok)
- Filters: niche/topics, keywords in captions/hashtags, location, language, follower range, engagement rate, audience demographics, platform, authenticity score, price range
- **Content similarity search**: paste a brand brief / reference URLs / sample captions → rank creators by content embeddings + topic tags
- Lookalike creators from a seed profile or past high-performers
- Saved lists / CRM lists (“Beauty US Mid-tier”, “Past collaborators”)
- Creator profile page: bio, platforms, recent posts, topics, audience, estimated rates, past campaign history (on-platform), authenticity flags
- Optional later: **Live Capture** (collect social handles from brand site/checkout → score existing customers as creators)

**Data sources**
- Official platform APIs where available (Meta Graph, TikTok, YouTube Data)
- Creator OAuth connect (highest-quality metrics)
- Public enrichment / scraping partners only where ToS-compliant
- Manual / CSV import for brand’s own roster

### B. Campaign Builder

**Campaign types**
1. **Paid promotion** — flat fee per deliverable  
2. **Product gifting** — free product for content  
3. **Affiliate** — commission / unique codes / links  
4. **Hybrid** — gift + fee, or fee + affiliate bonus  

**Campaign fields**
- Objective (awareness, UGC rights, conversions)
- Platforms & required deliverables (e.g. 1 TikTok + 2 IG Stories)
- Brief (markdown / rich text + media assets + do’s/don’ts)
- Terms & usage rights (duration, exclusivity, whitelisting, content ownership)
- Compensation model + budget caps
- Application window, posting window
- Eligibility (min followers, niches, geo, exclusivity conflicts)
- Tracking plan (UTMs, promo codes, affiliate links)

### C. Outreach & CRM

- Email / in-app message templates with merge tags (`{{first_name}}`, `{{brand}}`, `{{fee}}`, `{{brief_link}}`)
- Sequences: Invite → Reminder → Nudge → Close
- Personalization helpers (AI draft from brief + creator niche)
- Pipeline statuses: Sourced → Contacted → Opened → Replied → Applied → Negotiating → Accepted → Active → Completed → Declined / Ghosted
- Notes, tags, relationship history across campaigns
- Bulk actions (add to list, send sequence, export)

### D. Creator Portal (Marketplace + Applications)

Creators can:
- Connect social accounts (OAuth)
- Browse open campaigns / marketplace opportunities they’re eligible for
- **Preview brief + terms** before applying (read-only gated link or logged-in view)
- Apply with pitch, rates, media kit, proposed timeline
- Negotiate / counter-offer (optional MVP+)
- Accept offer → see deliverables checklist
- Submit draft content for approval (optional workflow)
- Submit live post URLs
- View earnings, affiliate performance, invoices/payouts
- Manage tax / payment profile (W-9 / local equivalent, Stripe Connect / Wise)

### E. Compensation

| Model | How it works |
|-------|----------------|
| **Flat fee** | Milestone-based: Accept → Draft approved → Live post verified → Paid |
| **Gifting** | Product catalog / Shopify product pick → shipping address → fulfillment status |
| **Affiliate** | Unique tracking link + optional promo code; commission % or CPA; cookie window |
| **Hybrid** | Base fee + affiliate uplift |

Payments:
- Stripe Connect / PayPal / Wise (MVP: Stripe Connect Express)
- Brand wallet / invoice export
- Mass payouts for completed deliverables
- Escrow-style hold until post verification (optional)

### F. Post Tracking & Metrics

**Deliverable tracking**
- Required posts checklist per creator
- Creator submits permalink(s)
- System pulls metrics on a schedule via APIs
- Brand marks approved / needs revision

**Metrics (per post + aggregated)**
- Reach / impressions, views, likes, comments, shares, saves
- Engagement rate
- Video watch metrics where available
- Clicks (affiliate link / UTM)
- Conversions, revenue, AOV, ROAS
- Cost per engagement / cost per acquisition
- Content sentiment / brand safety flags (later)

**Attribution**
- Unique affiliate links
- Unique discount codes (Shopify / Woo / custom)
- UTMs on landing URLs
- Optional pixel / server events for conversion webhooks

### G. Analytics & Reporting

- Campaign dashboard: creators hired, content live, spend, revenue, ROI
- Creator leaderboard within campaign
- Export CSV / PDF report
- Cross-campaign performance for a brand’s roster

### H. AI Assist (phase 2 — Jaice-like)

- Recommend creators from brief
- Draft outreach sequences
- Auto-generate brief from product URL + goals
- Suggest compensation model from objective + budget
- Flag underperforming creators mid-campaign

---

## 4. End-to-End Flows

### Brand flow

```
Create campaign → Define brief/terms/budget/comp model
       ↓
Discover creators (content search / filters / lists)
       ↓
Add to shortlist → Send outreach sequence (templates)
       ↓
Creators preview brief → Apply / Accept invite
       ↓
Brand reviews applications → Approve / Negotiate
       ↓
Issue affiliate link/code and/or shipping / payment schedule
       ↓
Creator posts → Submit URLs → Metrics sync
       ↓
Verify deliverables → Release payment / accrue commission
       ↓
Report ROI → Save creators to CRM for next campaign
```

### Creator flow

```
Sign up / Connect socials → Complete profile + rates
       ↓
Receive invite OR browse marketplace
       ↓
Preview brief + terms + compensation
       ↓
Apply (or Accept) → Await approval
       ↓
Receive product / affiliate assets / creative pack
       ↓
(Optional) Submit draft → Get feedback
       ↓
Publish → Paste post URL(s)
       ↓
Track performance → Get paid / earn commissions
```

### State machine (campaign membership)

`invited` → `previewed` → `applied` → `under_review` → `accepted` | `rejected` → `active` → `deliverables_submitted` → `verified` → `paid` → `completed`  
Side states: `countered`, `withdrawn`, `disputed`, `canceled`

---

## 5. Information Architecture (Apps)

| Surface | Audience | Key screens |
|---------|----------|-------------|
| **Brand Web App** | Brands / agencies | Dashboard, Discovery, Lists, Campaigns, Inbox/CRM, Payments, Analytics, Settings |
| **Creator Web App / Portal** | Creators | Opportunities, Applications, Active campaigns, Earnings, Profile, Connected accounts |
| **Admin Console** | Platform ops | Users, payouts, abuse, API jobs, feature flags |
| **Public pages** | Both | Landing, campaign preview (tokenized), docs |

Mobile: responsive web first; native apps later if needed for creator notifications.

---

## 6. Suggested Data Model (high level)

```
Workspace (brand/agency)
  └── Members (role)
  └── CreatorLists
  └── Campaigns
        ├── Brief, Terms, Budget, CompPlan
        ├── DeliverableRequirements[]
        ├── TrackingPlan (UTM template, commission rules)
        ├── CampaignCreators (status, offer, notes)
        │     ├── Messages / SequenceEnrollments
        │     ├── Applications
        │     ├── AffiliateAssets (link, code)
        │     ├── Deliverables (platform, url, metrics snapshots)
        │     └── Payouts / CommissionLedger
        └── Reports

Creator
  ├── Profiles / ConnectedAccounts (oauth tokens, handles)
  ├── ContentIndex (posts, embeddings, topics)
  ├── AudienceInsights
  ├── PaymentProfile
  └── Applications / CampaignMemberships

PostMetricSnapshot (time-series)
AffiliateEvent (click, conversion)
Payment / Invoice
Template / Sequence
```

Key indexes for discovery:
- Full-text on captions/bios
- Vector index on content embeddings (pgvector / OpenSearch / Pinecone)
- Faceted filters (geo, followers, ER, niche tags)

---

## 7. Technical Architecture

### Recommended stack (greenfield)

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js (App Router) + TypeScript + Tailwind | Fast brand + creator portals, SSR for SEO/public pages |
| API | NestJS or Next.js Route Handlers + tRPC/REST | Clear domain modules; Nest if team wants strict backend |
| DB | PostgreSQL | Relational campaign/payment truth |
| Search | OpenSearch or Postgres + pgvector | Filters + semantic content match |
| Queue / jobs | Redis + BullMQ / Inngest | Outreach sends, metric sync, embedding jobs |
| Auth | Clerk / Auth.js + RBAC | Brand workspace + creator accounts |
| File storage | S3 / R2 | Briefs, media kits, invoices |
| Email | Resend / SendGrid + inbound parsing | Outreach + notifications |
| Payments | Stripe Connect | Creator payouts + brand billing |
| E‑com | Shopify Admin API (first) | Codes, products, order attribution |
| Observability | OpenTelemetry + Sentry | Job failures on social sync are common |

### Service boundaries (modular monolith → extract later)

1. **Identity & Workspaces**  
2. **Creator Graph & Discovery** (ingestion, embeddings, search)  
3. **Campaigns & Applications**  
4. **Messaging / Sequences**  
5. **Tracking & Attribution**  
6. **Payments & Ledger**  
7. **Integrations** (Meta, TikTok, YouTube, Shopify)

Start as a modular monolith; split discovery ingestion and metric sync workers first when load grows.

### Content-matching pipeline

```
Ingest posts (API/OAuth)
  → Normalize (caption, hashtags, media type, stats)
  → Topic classify + embed (text; optional vision captions)
  → Upsert into search index
  → Brand query: keyword + semantic + hard filters → ranked list
```

Ranking signals: content similarity, engagement quality, audience fit, past on-platform performance, response rate, brand-safety score.

---

## 8. Integrations Roadmap

| Integration | Purpose | Priority |
|-------------|---------|----------|
| Instagram / Meta Graph | Profiles, media, insights | P0 |
| TikTok | Profiles, videos, metrics | P0 |
| YouTube | Channels, videos | P1 |
| Stripe Connect | Payouts | P0 |
| Shopify | Discount codes, products, orders | P0 |
| Email provider | Outreach | P0 |
| WooCommerce / BigCommerce | Same as Shopify | P2 |
| Amazon Attribution | Affiliate for Amazon brands | P2 |
| Klaviyo | CRM sync | P3 |

**Compliance note:** Prefer creator OAuth + official APIs. Avoid ToS-violating scraping as a core dependency. Cache metrics with clear “last synced” timestamps.

---

## 9. MVP Scope (build this first)

Ship a closed loop that proves value without a 10M-creator database on day one.

### MVP must-haves
1. Brand workspace + creator accounts  
2. Campaign create (paid + affiliate + gift flags) with brief & terms  
3. Creator CRM lists (manual add + CSV import + “connect Instagram/TikTok” enrichment)  
4. Content-based search over **connected / imported** creators (embeddings + tags)  
5. Outreach templates + single email sequence  
6. Tokenized brief/terms preview + apply form  
7. Accept/reject applications  
8. Affiliate link + optional Shopify discount code generation  
9. Deliverable checklist + post URL submission + metric pull (basic)  
10. Mark complete → Stripe payout (flat fee) + commission ledger (affiliate)  
11. Campaign performance dashboard (spend, posts, clicks, revenue if Shopify)

### Explicitly out of MVP
- Full open-web influencer database at Upfluence scale  
- AI co-pilot  
- Live Capture on brand storefronts  
- Multi-currency mass pay wallets  
- Native mobile apps  
- Advanced fraud / fake-follower ML  
- Whitelisting ads permissions workflows  

### Phased roadmap

| Phase | Theme | Outcomes |
|-------|--------|----------|
| **0** | Foundations | Auth, workspaces, schema, design system |
| **1** | Campaign loop | Brief → apply → accept → track → pay |
| **2** | Discovery 1.0 | Content embeddings, filters, lookalikes on owned graph |
| **3** | Marketplace | Creators browse open campaigns; public creator profiles |
| **4** | Scale & AI | Broader social graph, Jaice-like assist, Live Capture |
| **5** | Enterprise | Agency multi-client, SSO, custom reports, SLAs |

---

## 10. UX Priorities (parity with Upfluence mental model)

**Brand nav grouping**
- **Discovery** — Search, Lookalikes, Lists  
- **Programs** — Campaigns, Marketplace, Outreach inbox  
- **Community** — CRM / relationships  
- **Analytics** — Dashboards, exports  
- **Finance** — Payouts, affiliate commissions  

**Creator nav**
- Opportunities · My campaigns · Earnings · Profile · Settings  

**Critical UX moments**
- Brief preview must feel clear and trustworthy (rights + pay in plain language)  
- Application should take &lt; 3 minutes  
- Post tracking should make “what’s missing” obvious  
- Affiliate assets one-click copy  

---

## 11. Non-Functional Requirements

- **Security:** RBAC, encrypted tokens at rest, audit log for payouts, 2FA  
- **Privacy:** GDPR/CCPA — data export/delete for creators; DPA for brands  
- **Reliability:** Metric sync & outreach jobs idempotent; retry with backoff  
- **Performance:** Discovery p95 &lt; 1.5s for filtered search  
- **Auditability:** Immutable ledger for payments & commissions  
- **Brand safety:** Basic keyword blocklist on creator bios/captions (expand later)

---

## 12. Monetization (platform)

| Model | Notes |
|-------|--------|
| SaaS subscription (Starter / Growth / Agency) | Seats, campaigns, discovery credits |
| Usage: creator profile unlocks / email sends | Common in influencer platforms |
| Payment fee % on payouts | Optional; transparent to brands |
| Marketplace take-rate | Later, if facilitating matches |

---

## 13. Success Metrics

**Brand**
- Time-to-shortlist, outreach reply rate, application → accept rate  
- Cost per content asset, ER of delivered posts, ROAS  
- % deliverables on time  

**Creator**
- Time-to-first payout, application win rate, NPS  

**Platform**
- Activation: brand creates campaign + invites ≥ N creators in week 1  
- Retention: campaigns per workspace / quarter  
- Sync health: % posts with fresh metrics  

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Social API limits / ToS changes | OAuth-first, multi-platform, graceful degradation |
| Cold-start empty creator DB | CSV import + marketplace opt-in + seed partnerships |
| Attribution gaps | Codes + links + UTMs; set expectations in UI |
| Payment disputes | Clear terms, deliverable verification, escrow option |
| Spam outreach | Rate limits, domain reputation, unsubscribe, template review |
| Fake engagement | Basic authenticity heuristics; escalate to vendors later |

---

## 15. Suggested Repo / Project Structure (when building)

```
/apps
  /web                 # Next.js brand + creator portals
  /admin               # Internal admin (optional early)
/packages
  /ui                  # Design system
  /db                  # Prisma/Drizzle schema
  /api-client
  /emails
/services
  /worker              # queues: sync, embeddings, outreach
/docs
  PLAN.md              # this document
  PRODUCT_SPECS/
  API.md
```

---

## 16. Immediate Next Steps (after plan approval)

1. Lock MVP feature checklist + non-goals with stakeholders  
2. Choose stack confirmations (Next.js + Postgres + Stripe + Shopify assumed)  
3. Write detailed PRDs for: Discovery search, Campaign/Application state machine, Tracking plan, Payouts  
4. Design wireframes for: Brand discovery, Campaign wizard, Creator brief preview/apply, Tracking dashboard  
5. Spike: Instagram OAuth + media insights + pgvector similarity on 1k sample posts  
6. Scaffold monorepo and auth/workspaces  

---

## Appendix A — Feature map vs your requirements

| You asked for | Plan coverage |
|---------------|---------------|
| Find influencers based on content they share | Discovery + embeddings + topic filters |
| Reach out with templates | Outreach sequences + merge tags |
| Preview brief & terms | Tokenized / portal preview |
| Apply | Creator applications + review queue |
| Paid or affiliate | Comp plans + Stripe + links/codes |
| Track posts & metrics | Deliverables + API sync + dashboard |

## Appendix B — Upfluence feature parity (target)

| Upfluence capability | Our phase |
|----------------------|-----------|
| Creator database + filters | 2–4 |
| Content / topic matching | 2 |
| Marketplace | 3 |
| Live Capture (customers → creators) | 4 |
| Outreach automation | 1–2 |
| Gifting + paid + affiliate | 1 |
| Shopify codes / links | 1 |
| Payments | 1 |
| Unified analytics / ROI | 1–2 |
| AI campaign co-pilot (Jaice-like) | 4 |
