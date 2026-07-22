# Credentials checklist — Lifestyle Studio

## Required for real Nano Banana output

- [ ] `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey)
- [ ] Copy `services/lifestyle-studio/.env.example` → `.env` and paste the key

## Optional

- [ ] `NANOBANANA_DRAFT_MODEL` (default `gemini-3.1-flash-image`)
- [ ] `NANOBANANA_BAKE_MODEL` (default `gemini-3-pro-image`)
- [ ] `NANOBANANA_BAKE_SIZE` (`2K` or `4K`)

## Without a key

Leave `ALLOW_MOCK_WITHOUT_KEY=true` to explore the UI with placeholder drafts.
