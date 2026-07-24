"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { DrivePanel } from "@/components/drive-panel";
import { PhotosPanel } from "@/components/photos-panel";

export function ExportApp() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="shell">
        <p className="muted loading-copy">Checking your session…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="shell">
        <header className="hero">
          <p className="brand">Outbox</p>
          <h1>Move your Google files out.</h1>
          <p className="lede">
            Sign in once, then export Google Drive in full and pull photo batches
            from Google Photos — straight to your computer.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => void signIn("google", { callbackUrl: "/" })}
            >
              Sign in with Google
            </button>
          </div>
          <p className="fine-print">
            Read-only access. Files stay on your machine after download.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="shell signed-in">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand compact">Outbox</span>
          <span className="topbar-user">{session.user?.email}</span>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void signOut({ callbackUrl: "/" })}
        >
          Sign out
        </button>
      </header>

      {session.error === "RefreshAccessTokenError" && (
        <p className="error-line banner">
          Your Google session expired.{" "}
          <button
            type="button"
            className="linkish"
            onClick={() => void signIn("google")}
          >
            Sign in again
          </button>
        </p>
      )}

      <main className="workspace">
        <DrivePanel />
        <PhotosPanel />
      </main>
    </div>
  );
}
