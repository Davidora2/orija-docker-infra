"use client";

import { useState } from "react";
import {
  createPartnerInvite,
  setActiveHousehold,
  updateMoneyVisibilityGrant,
  type Account,
} from "../lib/api";

export function HouseholdPanel({
  account,
  onAccountChange,
  onError,
}: {
  account: Account;
  onAccountChange: (account: Account) => void;
  onError: (message: string | null) => void;
}) {
  const [partnerEmail, setPartnerEmail] = useState("");
  const [invite, setInvite] = useState<{
    token: string;
    webUrl: string;
    expiresAt: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmFullVisibility, setConfirmFullVisibility] = useState(false);
  const active = account.households.find((household) => household.active);
  const canInvite = active?.role === "OWNER" && account.members.length < 2;
  const partner = account.members.find((member) => member.id !== account.user.id);
  const yourGrant = account.moneyVisibilityGrant ?? "SHARED_BILLS_ONLY";

  async function saveGrant(grant: "SHARED_BILLS_ONLY" | "FULL_VISIBILITY") {
    setBusy(true);
    onError(null);
    try {
      onAccountChange(await updateMoneyVisibilityGrant(grant));
      setConfirmFullVisibility(false);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not update money visibility.",
      );
    } finally {
      setBusy(false);
    }
  }

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
        <article className="space-y-4 rounded-2xl border border-[#dde2dd] bg-white p-5">
          <div>
            <h3 className="font-serif text-xl">Money visibility</h3>
            <p className="mt-1 text-sm text-[#6c7771]">
              Choose what your partner can see of your spending. They control what
              you see of theirs.
            </p>
          </div>
          <fieldset className="space-y-3" disabled={busy}>
            <legend className="text-sm font-semibold text-[#14241f]">
              What {partner.displayName} can see
            </legend>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-[#dde2dd] px-3 py-3">
              <input
                type="radio"
                name="money-visibility"
                checked={yourGrant === "SHARED_BILLS_ONLY"}
                onChange={() => void saveGrant("SHARED_BILLS_ONLY")}
              />
              <span>
                <span className="block font-semibold">Shared bills only</span>
                <span className="block text-xs text-[#6c7771]">
                  Only bills you move to the household budget. Everything else stays
                  private.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-[#dde2dd] px-3 py-3">
              <input
                type="radio"
                name="money-visibility"
                checked={yourGrant === "FULL_VISIBILITY"}
                onChange={() => setConfirmFullVisibility(true)}
              />
              <span>
                <span className="block font-semibold">Full visibility</span>
                <span className="block text-xs text-[#6c7771]">
                  They can see all your personal outgoings and pay schedule in the
                  Household view. Nothing is copied — they get read-only access.
                </span>
              </span>
            </label>
          </fieldset>
          <p className="text-xs text-[#87918c]">
            Full visibility applies to spending and pay context in MVP, not
            savings/debt detail.
          </p>
        </article>
      ) : null}

      {confirmFullVisibility ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <article className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5">
            <h3 className="font-serif text-2xl">Share full visibility?</h3>
            <p className="text-sm leading-6 text-[#6c7771]">
              {partner?.displayName} will see your personal recurring bills, daily
              spending entries, and pay schedule in Household view. They won&apos;t be
              able to edit your personal budget. You can change this anytime in
              Household settings.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-[#f4f5f0] disabled:opacity-50"
                onClick={() => void saveGrant("FULL_VISIBILITY")}
              >
                Turn on full visibility
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-xl border border-[#dde2dd] px-4 py-3 text-sm font-bold disabled:opacity-50"
                onClick={() => setConfirmFullVisibility(false)}
              >
                Keep shared bills only
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
