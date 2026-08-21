"use client";

import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "../lib/api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type Props = {
  enabled: boolean;
  onSuccess: (account: Awaited<ReturnType<typeof loginWithGoogle>>) => void;
  onError: (message: string) => void;
  busy?: boolean;
};

export function GoogleSignInButton({
  enabled,
  onSuccess,
  onError,
  busy,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || !googleClientId || busy) return;

    let cancelled = false;

    async function mount() {
      if (!window.google?.accounts?.id) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>(
            'script[data-life-os-google="1"]',
          );
          if (existing) {
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () =>
              reject(new Error("Google script failed to load")),
            );
            if (window.google?.accounts?.id) resolve();
            return;
          }
          const script = document.createElement("script");
          script.src = "https://accounts.google.com/gsi/client";
          script.async = true;
          script.defer = true;
          script.dataset.lifeOsGoogle = "1";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Google script failed to load"));
          document.head.appendChild(script);
        });
      }
      if (cancelled || !hostRef.current || !window.google?.accounts?.id) return;

      hostRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          void (async () => {
            try {
              const account = await loginWithGoogle(response.credential);
              onSuccess(account);
            } catch (err) {
              onError(
                err instanceof Error ? err.message : "Google sign-in failed",
              );
            }
          })();
        },
      });
      window.google.accounts.id.renderButton(hostRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 320,
      });
      setReady(true);
    }

    void mount().catch((err) => {
      onError(err instanceof Error ? err.message : "Google sign-in unavailable");
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, busy, onSuccess, onError]);

  if (!enabled || !googleClientId) return null;

  return (
    <div className="space-y-2">
      <div ref={hostRef} className="flex min-h-[44px] justify-center" />
      {!ready ? (
        <p className="text-center text-xs text-[#6c7771]">Loading Google…</p>
      ) : null}
    </div>
  );
}
