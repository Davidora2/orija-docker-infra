"use client";

import { useCallback, useEffect, useState } from "react";
import { loginWithMicrosoft } from "../lib/api";

declare global {
  interface Window {
    msal?: {
      PublicClientApplication: new (config: Record<string, unknown>) => {
        initialize: () => Promise<void>;
        loginPopup: (request: {
          scopes: string[];
        }) => Promise<{ idToken: string }>;
      };
    };
  }
}

const microsoftClientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID ?? "";
const microsoftTenant = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID ?? "common";

type Props = {
  enabled: boolean;
  onSuccess: (account: Awaited<ReturnType<typeof loginWithMicrosoft>>) => void;
  onError: (message: string) => void;
  busy?: boolean;
};

export function MicrosoftSignInButton({
  enabled,
  onSuccess,
  onError,
  busy,
}: Props) {
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async () => {
    if (!microsoftClientId) {
      onError("Microsoft sign-in is not configured.");
      return;
    }
    setLoading(true);
    try {
      if (!window.msal?.PublicClientApplication) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>(
            'script[data-life-os-msal="1"]',
          );
          if (existing) {
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () =>
              reject(new Error("Microsoft script failed to load")),
            );
            if (window.msal?.PublicClientApplication) resolve();
            return;
          }
          const script = document.createElement("script");
          script.src =
            "https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js";
          script.async = true;
          script.dataset.lifeOsMsal = "1";
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("Microsoft script failed to load"));
          document.head.appendChild(script);
        });
      }
      if (!window.msal?.PublicClientApplication) {
        throw new Error("Microsoft sign-in unavailable");
      }
      const app = new window.msal.PublicClientApplication({
        auth: {
          clientId: microsoftClientId,
          authority: `https://login.microsoftonline.com/${microsoftTenant}`,
        },
      });
      await app.initialize();
      const result = await app.loginPopup({
        scopes: ["openid", "profile", "email"],
      });
      const account = await loginWithMicrosoft(result.idToken);
      onSuccess(account);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Microsoft sign-in failed",
      );
    } finally {
      setLoading(false);
    }
  }, [onError, onSuccess]);

  if (!enabled || !microsoftClientId) return null;

  return (
    <button
      type="button"
      disabled={busy || loading}
      onClick={() => void signIn()}
      className="w-full rounded-full border border-[#dde2dd] bg-white px-4 py-3 text-sm font-bold text-[#14241f] disabled:opacity-50"
    >
      {loading ? "Connecting Microsoft…" : "Continue with Microsoft"}
    </button>
  );
}
