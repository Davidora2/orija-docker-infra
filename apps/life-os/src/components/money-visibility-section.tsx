"use client";

import { useEffect, useId, useRef, useState } from "react";
import { updateMoneyVisibilityGrant, type Account } from "../lib/api";

type Grant = "SHARED_BILLS_ONLY" | "FULL_VISIBILITY";

export function MoneyVisibilitySection({
  account,
  onAccountChange,
  onError,
  focus = false,
  onFocusHandled,
  showHouseholdLink = false,
  onOpenHousehold,
  className = "",
}: {
  account: Account;
  onAccountChange: (account: Account) => void;
  onError: (message: string | null) => void;
  focus?: boolean;
  onFocusHandled?: () => void;
  showHouseholdLink?: boolean;
  onOpenHousehold?: () => void;
  className?: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const radioGroupName = useId();
  const [busy, setBusy] = useState(false);
  const [confirmFullVisibility, setConfirmFullVisibility] = useState(false);
  const partner = account.members.find((member) => member.id !== account.user.id);
  const yourGrant = account.moneyVisibilityGrant ?? "SHARED_BILLS_ONLY";

  useEffect(() => {
    if (!focus || !sectionRef.current) return;
    sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    onFocusHandled?.();
  }, [focus, onFocusHandled]);

  if (!partner) return null;

  async function saveGrant(grant: Grant) {
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
    <>
      <article
        ref={sectionRef}
        className={`space-y-4 rounded-2xl border border-[#dde2dd] bg-white p-5 ${className}`.trim()}
      >
        <div>
          <h3 className="font-serif text-xl">Household sharing</h3>
          <p className="mt-1 text-sm text-[#6c7771]">
            Choose what your partner can see of your money. They control what you
            see of theirs.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-[#14241f]">Bills visibility</h4>
          <fieldset className="space-y-3" disabled={busy}>
            <legend className="sr-only">
              What {partner.displayName} can see of your spending
            </legend>
            <p className="text-sm font-semibold text-[#14241f]">
              What {partner.displayName} can see
            </p>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-[#dde2dd] px-3 py-3">
              <input
                type="radio"
                name={radioGroupName}
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
                name={radioGroupName}
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
        </div>

        <div className="space-y-2 rounded-xl border border-[#eef0ec] bg-[#f8faf7] px-3 py-3">
          <h4 className="text-sm font-semibold text-[#14241f]">
            Wealth &amp; savings visibility
          </h4>
          <p className="text-xs leading-5 text-[#6c7771]">
            Household view shows only wealth rows you mark as shared (goals, debts,
            investments). Full visibility applies to spending and pay context — not
            savings or debt detail.
          </p>
          <div className="rounded-lg border border-[#dde2dd] bg-white px-3 py-2">
            <p className="text-xs font-semibold text-[#14241f]">Full wealth visibility</p>
            <p className="text-xs leading-5 text-[#6c7771]">
              Read-only access to all personal wealth in Household view — planned for a
              future release.
            </p>
          </div>
        </div>

        {showHouseholdLink && onOpenHousehold ? (
          <button
            type="button"
            className="text-xs font-bold text-[#617a57] underline"
            onClick={onOpenHousehold}
          >
            Open full Household settings
          </button>
        ) : null}
      </article>

      {confirmFullVisibility ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <article className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5">
            <h3 className="font-serif text-2xl">Share full visibility?</h3>
            <p className="text-sm leading-6 text-[#6c7771]">
              {partner.displayName} will see your personal recurring bills, daily
              spending entries, and pay schedule in Household view. They won&apos;t be
              able to edit your personal budget. You can change this anytime in
              Profile or Household settings.
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
    </>
  );
}
