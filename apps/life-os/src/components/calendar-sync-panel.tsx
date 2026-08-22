"use client";

import { useCallback, useEffect, useState } from "react";
import {
  disconnectCalendar,
  listCalendarConnections,
  startCalendarConnect,
  syncCalendar,
  type CalendarConnection,
} from "../lib/api";

type Props = {
  onError: (message: string | null) => void;
  onNotice?: (message: string) => void;
};

export function CalendarSyncPanel({ onError, onNotice }: Props) {
  const [providers, setProviders] = useState({
    google: false,
    microsoft: false,
  });
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const next = await listCalendarConnections();
    setProviders(next.providers);
    setConnections(next.connections);
  }, []);

  useEffect(() => {
    void load().catch((error) =>
      onError(
        error instanceof Error
          ? error.message
          : "Could not load calendar connections.",
      ),
    );
  }, [load, onError]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("calendar_connected");
    const error = params.get("calendar_error");
    if (connected) {
      onNotice?.(`Connected ${connected} calendar.`);
      void load().catch(() => undefined);
    }
    if (error) onError(error);
  }, [load, onError, onNotice]);

  async function connect(provider: "google" | "microsoft") {
    setBusy(true);
    onError(null);
    try {
      const { url } = await startCalendarConnect(
        provider,
        "/?tab=you&dest=integrations",
      );
      window.location.href = url;
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Could not start calendar connect.",
      );
      setBusy(false);
    }
  }

  async function push(connectionId?: string) {
    setBusy(true);
    onError(null);
    try {
      const result = await syncCalendar(connectionId);
      onNotice?.(
        `Pushed ${result.pushed} event${result.pushed === 1 ? "" : "s"} to your calendar with reminders.`,
      );
      await load();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Calendar sync failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(connectionId: string) {
    setBusy(true);
    try {
      await disconnectCalendar(connectionId);
      await load();
      onNotice?.("Calendar disconnected.");
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Could not disconnect calendar.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
      <div>
        <h3 className="font-serif text-xl">Calendar sync</h3>
        <p className="mt-1 text-sm text-[#6c7771]">
          Connect your own Google or Microsoft account. Life OS will add tasks,
          payments, and paydays with calendar reminders — each user connects their
          own calendar.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {providers.google ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
            onClick={() => void connect("google")}
          >
            Connect Google Calendar
          </button>
        ) : (
          <p className="text-xs text-[#6c7771]">
            Google Calendar sync needs GOOGLE_CLIENT_IDS + GOOGLE_OAUTH_CLIENT_SECRET.
          </p>
        )}
        {providers.microsoft ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border border-[#dde2dd] px-4 py-2 text-xs font-bold disabled:opacity-50"
            onClick={() => void connect("microsoft")}
          >
            Connect Outlook / Microsoft
          </button>
        ) : null}
      </div>

      {connections.length === 0 ? (
        <p className="text-sm text-[#6c7771]">No external calendar connected yet.</p>
      ) : (
        connections.map((connection) => (
          <div
            key={connection.id}
            className="rounded-xl border border-[#dde2dd] bg-[#f7f8f5] p-3"
          >
            <p className="font-semibold capitalize">{connection.provider}</p>
            <p className="text-sm text-[#6c7771]">
              {connection.accountEmail ?? "Connected"}
              {connection.lastSyncedAt
                ? ` · last sync ${new Date(connection.lastSyncedAt).toLocaleString()}`
                : ""}
            </p>
            <p className="mt-1 text-xs text-[#6c7771]">
              Reminders {connection.reminderMinutes} min before · tasks/
              payments/paydays
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-xl bg-[#14241f] px-3 py-2 text-xs font-bold text-[#f4f5f0] disabled:opacity-50"
                onClick={() => void push(connection.id)}
              >
                Sync now
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-xl border border-[#dde2dd] px-3 py-2 text-xs font-bold text-[#c9634f] disabled:opacity-50"
                onClick={() => void remove(connection.id)}
              >
                Disconnect
              </button>
            </div>
          </div>
        ))
      )}
    </article>
  );
}
