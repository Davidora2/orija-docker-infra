"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SUGGESTED_LIFE_AREAS,
  completeOnboarding,
  listAreaSuggestions,
  type Account,
  type AreaSuggestion,
} from "../lib/api";

type Props = {
  onComplete: (account: Account) => void;
  onError: (message: string) => void;
};

export function OnboardingPanel({ onComplete, onError }: Props) {
  const [suggestions, setSuggestions] =
    useState<AreaSuggestion[]>(SUGGESTED_LIFE_AREAS);
  const [selected, setSelected] = useState<Record<string, AreaSuggestion>>({});
  const [customTitle, setCustomTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listAreaSuggestions()
      .then(setSuggestions)
      .catch(() => {
        // keep local defaults
      });
  }, []);

  const selectedList = useMemo(() => Object.values(selected), [selected]);

  function toggle(area: AreaSuggestion) {
    setSelected((current) => {
      const next = { ...current };
      if (next[area.title]) delete next[area.title];
      else next[area.title] = area;
      return next;
    });
  }

  function addCustom() {
    const title = customTitle.trim();
    if (!title) return;
    setSelected((current) => ({
      ...current,
      [title]: { title, icon: "compass-outline" },
    }));
    setCustomTitle("");
  }

  async function finish() {
    if (selectedList.length === 0) {
      onError("Pick at least one life area to track.");
      return;
    }
    setBusy(true);
    try {
      const account = await completeOnboarding(selectedList);
      onComplete(account);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save areas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14241f]/70 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#f4f5f0] p-6 text-[#14241f] shadow-xl">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#617a57]">
          Get started
        </p>
        <h2 className="mt-2 font-serif text-3xl">What do you want to track?</h2>
        <p className="mt-2 text-sm text-[#6c7771]">
          Choose the life areas that matter now. You can add or remove them later.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((area) => {
            const active = Boolean(selected[area.title]);
            return (
              <button
                key={area.title}
                type="button"
                onClick={() => toggle(area)}
                className={`rounded-full px-3 py-2 text-xs font-bold ${
                  active
                    ? "bg-[#14241f] text-[#d6f57a]"
                    : "border border-[#dde2dd] bg-white"
                }`}
              >
                {area.title}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded-xl border border-[#dde2dd] bg-white px-3 py-3"
            placeholder="Add your own area"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCustom();
            }}
          />
          <button
            type="button"
            className="rounded-xl bg-[#dbe8d7] px-4 py-3 text-xs font-bold text-[#617a57]"
            onClick={addCustom}
          >
            Add
          </button>
        </div>

        {selectedList.length > 0 ? (
          <div className="mt-4 space-y-2 rounded-2xl border border-[#dde2dd] bg-white p-4">
            <p className="text-xs font-bold text-[#6c7771]">
              Selected ({selectedList.length})
            </p>
            {selectedList.map((area) => (
              <button
                key={area.title}
                type="button"
                className="flex w-full items-center justify-between text-sm font-semibold"
                onClick={() => toggle(area)}
              >
                <span>{area.title}</span>
                <span className="text-xs font-bold text-[#c9634f]">Remove</span>
              </button>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-[#14241f] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          onClick={() => void finish()}
        >
          {busy ? "Saving…" : "Continue to Life OS"}
        </button>
      </div>
    </div>
  );
}
