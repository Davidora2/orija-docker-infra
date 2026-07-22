# What I need from you

To connect Pinterest + Shopify and auto-post searchable pins (~1 every 2 hours), please send the items below. **Do not paste passwords into chat if you can avoid it** — API tokens in a private `.env` (or a password manager share) are safer than store login/password.

---

## 1. Shopify (required)

Create a **custom app** in Shopify Admin → Settings → Apps and sales channels → Develop apps:

1. Create app (e.g. `Pinterest Pin Agent`)
2. Configure Admin API scopes:
   - `read_products` (required)
   - `read_files` (optional, nice to have)
3. Install the app and copy the **Admin API access token**
4. Send:
   - Shop domain: `your-store.myshopify.com`
   - Access token: `shpat_…`
   - Your **public storefront URL** (e.g. `https://orija.com`) so pin links go to the real product pages
   - Optional: product tag filter (only pin products tagged e.g. `pinterest`)

I do **not** need your Shopify login/password if you provide the Admin API token.

---

## 2. Pinterest (required)

You need a **Pinterest Business** account and a developer app:

1. Go to [developers.pinterest.com](https://developers.pinterest.com/) → create an app
2. Note **App ID** and **App secret**
3. Add redirect URI: `http://localhost:8765/callback` (for the OAuth helper)
4. Request/trial access that allows creating pins (Standard access may be required for production posting)
5. Authorize with scopes:
   - `pins:read`, `pins:write`
   - `boards:read`, `boards:write` *(boards:write is required even to create pins)*
   - `user_accounts:read`
6. Send:
   - App ID + App secret
   - Access token + refresh token (or run `python scripts/oauth_pinterest.py` with me)
   - **Board ID(s)** to post onto (from the board URL, or listable via API after auth)
   - Whether you want **sandbox first** or go straight to production

I do **not** need your Pinterest password if OAuth tokens are provided.

---

## 3. Brand / content preferences (required)

- Brand name (defaulting to `Orija` in config)
- Tone of voice (1–2 sentences)
- **Seed keyword list** (10–40 phrases you want to rank for)
- Any seasonal campaigns / products to push
- Preferred CTA phrasing (“Shop now”, “Gift this”, etc.)
- Anything to never say (competitor names, medical claims, etc.)

---

## 4. Scheduling (confirm)

Defaults I will use unless you say otherwise:

- **1 pin every 2 hours** (~12/day)
- Timezone: `America/New_York` (change if needed)
- Quiet hours: optional (e.g. no posts 12am–7am)
- Start in **dry_run** for 1–2 days so you can review drafts, then flip `PIN_AGENT_MODE=live`

---

## 5. Optional but useful

- OpenAI API key — richer AI captions (otherwise template + keyword SEO copy is used)
- Multiple Pinterest boards + which keywords map to which board
- “Only pin these collections / tags”
- Approval workflow: dry-run forever vs auto-live

---

## What I will build / run with that

| Step | Behavior |
|------|----------|
| Pull products | Shopify Admin API → title, tags, images, product URL |
| Trend/keyword eval | Score products against your keyword + seasonal config |
| Create pin copy | SEO title + description + alt text with matched keywords |
| Format image | Crop/resize to 1000×1500 JPEG (Pinterest 2:3) |
| Post | Pinterest API `POST /v5/pins` on the schedule |
| Memory | Skip recently pinned product images (cooldown) |

---

## Reply checklist (copy/paste)

```
Shopify domain:
Shopify Admin API token:
Public storefront URL (https://…):
Product tag filter (or "all active"):

Pinterest App ID:
Pinterest App secret:
Pinterest access token:
Pinterest refresh token:
Pinterest board ID(s):
Sandbox first? (yes/no):

Brand name:
Brand voice:
Seed keywords:
Timezone:
Quiet hours:
Start mode: dry_run / live
OpenAI key (optional):
```
