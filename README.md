# Outbox

Local web app to sign in with Google and transfer files **out** of Google Drive and Google Photos onto a folder on this server.

## What it does

- **Save location** — browse allowed server folders, create subfolders, and pick where exports land.
- **Google Drive** — browse folders, download individual files in-browser, or save selected/all files to the chosen server path (Google Docs/Sheets/Slides become DOCX/XLSX/PPTX). Folder structure is preserved.
- **Google Photos** — Google no longer allows third-party apps to auto-read your full library. Outbox uses the official **Photos Picker** so you can select batches and save them to the server folder. For a complete Photos dump, use [Google Takeout](https://takeout.google.com/).

Google access is read-only. Files are written under configured export roots only.

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
EXPORT_ROOTS=/workspace/exports,/home/ubuntu
```

`EXPORT_ROOTS` is a comma-separated list of absolute directories the app may write into. The UI only lets you browse and save under those roots.

Generate a secret with:

```bash
openssl rand -base64 32
```

### 3. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, pick a save folder, then export.

## Notes

- Large Drive libraries can take a long time to write; keep the tab open until the status says files were saved.
- Shared drives are included when your account can access them.
- Photos Picker sessions expire; if polling stalls, start a new pick.
- This app is meant to run locally with your own Google Cloud project. Publishing it publicly requires Google verification for sensitive scopes.
