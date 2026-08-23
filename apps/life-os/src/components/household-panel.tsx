"use client";

import { useState } from "react";
import {
  createPartnerInvite,
  setActiveHousehold,
  type Account,
} from "../lib/api";
import { MoneyVisibilitySection } from "./money-visibility-section";

export function HouseholdPanel({
  account,
  onAccountChange,
  onError,
  focusMoneyVisibility = false,
  onFocusMoneyVisibilityHandled,
}: {
  account: Account;
  onAccountChange: (account: Account) => void;
  onError: (message: string | null) => void;
  focusMoneyVisibility?: boolean;
  onFocusMoneyVisibilityHandled?: () => void;
}) {
  const [partnerEmail, setPartnerEmail] = useState("");
  const [invite, setInvite] = useState<{
    token: string;
    webUrl: string;
    expiresAt: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const active = account.households.find((household) => household.active);
  const canInvite = active?.role === "OWNER" && account.members.length < 2;
  const partner = account.members.find((member) => member.id !== account.user.id);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl">Household</h2>
        <p className="text-sm text-[#6c7771]">
          One shared space for at most two independently secured accounts.
        </p>
      </div>
      <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <h3 className="font-serif text-xl">Your spaces</h3>
        {account.households.map((household) => (
          <button
            key={household.id}
            type="button"
            disabled={busy || household.active}
            className="flex w-full items-center justify-between rounded-xl border border-[#dde2dd] px-3 py-3 text-left disabled:opacity-70"
            onClick={() => {
              setBusy(true);
              onError(null);
              void setActiveHousehold(household.id)
                .then(onAccountChange)
                .catch((error) =>
                  onError(error instanceof Error ? error.message : "Could not switch."),
                )
                .finally(() => setBusy(false));
            }}
          >
            <span>
              <span className="block font-semibold">{household.name}</span>
              <span className="block text-xs text-[#6c7771]">{household.role}</span>
            </span>
            <span className="text-xs font-bold text-[#617a57]">
              {household.active ? "Active" : "Switch"}
            </span>
          </button>
        ))}
      </article>
      <article className="space-y-3 rounded-2xl border border-[#dde2dd] bg-white p-5">
        <h3 className="font-serif text-xl">Members</h3>
        {account.members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between border-b border-[#eef0ec] py-2 last:border-0"
          >
            <span>
              <span className="block font-semibold">{member.displayName}</span>
              <span className="block text-xs text-[#6c7771]">{member.email}</span>
            </span>
            <span className="text-xs font-bold text-[#617a57]">{member.role}</span>
          </div>
        ))}
        {canInvite ? (
          <>
            <input
              className="w-full rounded-xl border border-[#dde2dd] px-3 py-3"
              type="email"
              placeholder="Partner email (optional)"
              value={partnerEmail}
              onChange={(event) => setPartnerEmail(event.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              className="rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              onClick={() => {
                setBusy(true);
                onError(null);
                void createPartnerInvite(partnerEmail)
                  .then(setInvite)
                  .catch((error) =>
                    onError(
                      error instanceof Error
                        ? error.message
                        : "Could not create invitation.",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Create secure invite
            </button>
          </>
        ) : null}
        {invite ? (
          <div className="rounded-xl bg-[#dbe8d7] p-3 text-sm">
            <p className="font-semibold">Invite ready</p>
            <p className="break-all text-xs">{invite.webUrl}</p>
            <button
              type="button"
              className="mt-2 text-xs font-bold underline"
              onClick={() => void navigator.clipboard.writeText(invite.webUrl)}
            >
              Copy invite link
            </button>
          </div>
        ) : null}
      </article>

      {partner ? (
        <MoneyVisibilitySection
          account={account}
          focus={focusMoneyVisibility}
          onAccountChange={onAccountChange}
          onError={onError}
          onFocusHandled={onFocusMoneyVisibilityHandled}
        />
      ) : null}
    </section>
  );
}
