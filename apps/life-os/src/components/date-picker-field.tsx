"use client";

import {
  canonicalDateOnly,
  formatFriendlyDate,
  quickDateNextWeek,
  quickDateToday,
  quickDateTomorrow,
} from "@life-os/plan-domain";
import { LifeIcon } from "./life-icon";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  id?: string;
};

export function DatePickerField({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  error,
  id,
}: Props) {
  const inputId = id ?? "date-picker";
  const canonical = canonicalDateOnly(value);
  const summary = canonical ? formatFriendlyDate(canonical) : "Pick a date";
  const showClear = !required && Boolean(canonical);

  const quickOptions = [
    { id: "today", label: "Today", date: quickDateToday() },
    { id: "tomorrow", label: "Tomorrow", date: quickDateTomorrow() },
    { id: "next-week", label: "Next week", date: quickDateNextWeek() },
  ] as const;

  return (
    <div className="space-y-2">
      {label ? (
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#6c7771]">
          {label}
        </span>
      ) : null}
      <div
        className={`flex min-h-11 items-center gap-3 rounded-xl border bg-white px-3 py-2.5 ${
          error ? "border-[#c9634f]" : "border-[#dde2dd]"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <LifeIcon name="calendar" size={18} color="#617a57" />
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-semibold ${
              canonical ? "text-[#14241f]" : "text-[#6c7771]"
            }`}
          >
            {summary}
          </p>
          {canonical ? (
            <p className="text-[11px] text-[#6c7771]">{canonical}</p>
          ) : null}
        </div>
        <label
          htmlFor={inputId}
          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-[#dde2dd] bg-[#f7f8f5] px-3 text-xs font-bold text-[#617a57]"
        >
          <span className="sr-only">Open calendar</span>
          <LifeIcon name="calendar" size={16} color="#617a57" />
          <input
            id={inputId}
            type="date"
            className="sr-only"
            disabled={disabled}
            required={required}
            value={canonical ?? ""}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {quickOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              canonical === option.date
                ? "bg-[#14241f] text-[#d6f57a]"
                : "border border-[#dde2dd] bg-white text-[#14241f]"
            }`}
            onClick={() => onChange(option.date)}
          >
            {option.label}
          </button>
        ))}
        {showClear ? (
          <button
            type="button"
            disabled={disabled}
            className="rounded-full border border-[#dde2dd] bg-white px-3 py-1.5 text-xs font-bold text-[#6c7771]"
            onClick={() => onChange("")}
          >
            Clear
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs font-semibold text-[#c9634f]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
