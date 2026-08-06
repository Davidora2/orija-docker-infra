# Creo-Lingo

Duolingo-style lessons for African and Caribbean dialects — built for the diaspora.

Learn **Haitian Creole**, **Jamaican Patois**, **Nigerian Pidgin**, **Trinidadian Creole**, **Ghanaian Pidgin**, and **Cape Verdean Kriolu** with streaks, XP, hearts, and culture notes.

## Quick start

From the repo root:

```bash
pnpm --dir apps/creo-lingo install
pnpm --dir apps/creo-lingo dev
```

Or:

```bash
cd apps/creo-lingo
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## What’s inside

- Brand landing + dialect picker
- Duolingo-style learning path per dialect
- Exercise types: multiple choice, translate, fill-in-the-blank, match pairs
- Local progress (streak, XP, hearts) via `localStorage`
- Culture notes on lesson completion
