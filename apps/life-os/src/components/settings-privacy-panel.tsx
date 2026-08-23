"use client";

import { useEffect, useState } from "react";
import {
  deleteAccount,
  getDataExport,
  getNotificationPreferences,
  requestDeletionCode,
  updateNotificationPreferences,
  updateProfile,
  type Account,
} from "../lib/api";
import { MoneyVisibilitySection } from "./money-visibility-section";

export function SettingsPrivacyPanel({
  account,
  currencies,
  onAccountChange,
  onDeleted,
  onError,
  focusMoneyVisibility = false,
  onFocusMoneyVisibilityHandled,
  onOpenHousehold,
}: {
  account: Account;
  currencies: string[];
  onAccountChange: (account: Account) => void;
  onDeleted: () => void;
  onError: (message: string | null) => void;
  focusMoneyVisibility?: boolean;
  onFocusMoneyVisibilityHandled?: () => void;
  onOpenHousehold?: () => void;
}) {
  const [currency, setCurrency] = useState(account.user.preferredCurrency || "GBP");
  const [emailReminders, setEmailReminders] = useState(true);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getNotificationPreferences()
      .then((preferences) => setEmailReminders(preferences.emailRemindersEnabled))
      .catch((error) =>
        onError(error instanceof Error ? error.message : "Could not load preferences."),
      );
  }, [onError]);

  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    onError(null);
    try {
      await work();
    } catch (error) {
      onError(error instanceof Error ? error.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl">Settings & privacy</h2>
        <p className="text-sm text-[#6c7771]">
          Profile, real email delivery preferences, data export, and account control.
        </p>
      </div>
      {notice ? (
        <p className="rounded-xl bg-[#dbe8d7] px-3 py-2 text-sm">{notice}</p>
      ) : null}

      <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <h3 className="font-serif text-xl">Profile</h3>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
            Preferred currency
          </span>
          <select
            className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {currencies.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-[#14241f] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          onClick={() =>
            void perform(async () => {
              onAccountChange(await updateProfile({ preferredCurrency: currency }));
              setNotice("Profile updated.");
            })
          }
        >
          Save profile
        </button>
      </article>

      <MoneyVisibilitySection
        account={account}
        focus={focusMoneyVisibility}
        onAccountChange={onAccountChange}
        onError={onError}
        onFocusHandled={onFocusMoneyVisibilityHandled}
        onOpenHousehold={onOpenHousehold}
        showHouseholdLink={Boolean(onOpenHousehold)}
      />

      <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <h3 className="font-serif text-xl">Email reminders</h3>
        <p className="text-sm text-[#6c7771]">
          Life OS can email reminders for outstanding bills, savings, and debt payments.
          Push notifications are not available.
        </p>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-[#dde2dd] px-3 py-3">
          <span className="text-sm font-semibold">Payment reminder emails</span>
          <input
            type="checkbox"
            checked={emailReminders}
            disabled={busy}
            onChange={(event) => {
              const enabled = event.target.checked;
              setEmailReminders(enabled);
              void perform(async () => {
                await updateNotificationPreferences(enabled);
                setNotice(enabled ? "Email reminders enabled." : "Email reminders disabled.");
              });
            }}
          />
        </label>
      </article>

      <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <h3 className="font-serif text-xl">Export your data</h3>
        <p className="text-sm text-[#6c7771]">
          Download account-owned Life OS data as JSON. OAuth, calendar, and session tokens
          are never included.
        </p>
        <button
          type="button"
          disabled={busy}
          className="rounded-xl border border-[#dde2dd] px-4 py-2 text-xs font-bold disabled:opacity-50"
          onClick={() =>
            void perform(async () => {
              const data = await getDataExport();
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                }),
              );
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = `life-os-export-${new Date().toISOString().slice(0, 10)}.json`;
              anchor.click();
              URL.revokeObjectURL(url);
              setNotice("Your scoped JSON export is ready.");
            })
          }
        >
          Download JSON export
        </button>
      </article>

      <article className="space-y-3 rounded-2xl border border-[#e4b6ad] bg-[#fff8f6] p-5">
        <h3 className="font-serif text-xl text-[#8a3d30]">Delete account</h3>
        <p className="text-sm text-[#6c7771]">
          This permanently deletes your account-owned data. If you own a household with a
          partner, ownership transfers to them. A privacy-safe audit record is retained.
        </p>
        <input
          className="w-full rounded-xl border border-[#e4b6ad] px-3 py-3"
          value={confirmation}
          placeholder={`Type DELETE ${account.user.email}`}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <input
          className="w-full rounded-xl border border-[#e4b6ad] px-3 py-3"
          type="password"
          value={password}
          placeholder="Current password (password accounts)"
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-[#e4b6ad] px-3 py-3"
            inputMode="numeric"
            value={verificationCode}
            placeholder="Email code (OAuth-only accounts)"
            onChange={(event) => setVerificationCode(event.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border border-[#e4b6ad] px-3 py-2 text-xs font-bold"
            onClick={() =>
              void perform(async () => {
                const result = await requestDeletionCode();
                setNotice(result.message);
              })
            }
          >
            Send code
          </button>
        </div>
        <button
          type="button"
          disabled={busy || confirmation !== `DELETE ${account.user.email}`}
          className="rounded-xl bg-[#8a3d30] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          onClick={() =>
            void perform(async () => {
              await deleteAccount({
                confirmation,
                currentPassword: password || undefined,
                verificationCode: verificationCode || undefined,
              });
              onDeleted();
            })
          }
        >
          Permanently delete account
        </button>
      </article>
    </section>
  );
}
