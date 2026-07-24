# Outbox

Local web app to sign in with Google and transfer files **out** of Google Drive and Google Photos.

## What it does

- **Google Drive** — browse folders, download individual files, or export selected/all files as a zip (Google Docs/Sheets/Slides are exported as DOCX/XLSX/PPTX).
- **Google Photos** — Google no longer allows third-party apps to auto-read your full library. Outbox uses the official **Photos Picker** so you can select batches and download them as a zip. For a complete Photos dump, use [Google Takeout](https://takeout.google.com/).

Access is read-only. Downloads land on your computer.

## Setup

### 1. Create Google Cloud credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or pick an existing one).
3. Enable these APIs:
   - **Google Drive API**
   - **Google Photos Picker API**
4. Configure the OAuth consent screen (External is fine for personal use).
   - Add scopes:
     - `.../auth/drive.readonly`
     - `.../auth/photospicker.mediaitems.readonly`
     - `openid`, `email`, `profile`
5. Create **OAuth client ID** → application type **Web application**.
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
6. Copy the client ID and client secret.

### 2. Configure the app

```bash
cp .env.example .env.local
```

Fill in:

```env
AUTH_SECRET=generate-a-long-random-string
AUTH_GOOGLE_ID=your-client-id
AUTH_GOOGLE_SECRET=your-client-secret
AUTH_URL=http://localhost:3000
```

Generate a secret with:

```bash
openssl rand -base64 32
```

### 3. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, then export.

## Notes

- Large Drive libraries can take a long time to zip; keep the tab open until the download starts.
- Shared drives are included when your account can access them.
- Photos Picker sessions expire; if polling stalls, start a new pick.
- This app is meant to run locally with your own Google Cloud project. Publishing it publicly requires Google verification for sensitive scopes.
