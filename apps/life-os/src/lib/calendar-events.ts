import type { CalendarEvent } from "../lib/api";

export function calendarEventActionId(event: CalendarEvent): string | null {
  if (event.type !== "task") return null;
  if (typeof event.meta.actionId === "string") return event.meta.actionId;
  const parts = event.id.split(":");
  return parts[1] ?? null;
}

export function calendarEventProjectId(event: CalendarEvent): string | null {
  if (event.type !== "milestone") return null;
  return typeof event.meta.projectId === "string" ? event.meta.projectId : null;
}

export function calendarEventLabel(type: CalendarEvent["type"]): string {
  switch (type) {
    case "task":
      return "Task";
    case "milestone":
      return "Deadline";
    case "payment":
      return "Payment";
    case "payday":
      return "Payday";
    default:
      return "Event";
  }
}
