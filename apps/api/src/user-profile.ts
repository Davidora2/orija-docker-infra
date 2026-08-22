import { z } from 'zod';

export const profileBodySchema = z
  .object({
    primaryMoveActionId: z.string().uuid().nullable().optional(),
  })
  .strict();

export function publicProfileBody(value: Record<string, unknown> | null | undefined) {
  const parsed = profileBodySchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function calendarEventActionIdFromMeta(
  eventId: string,
  meta: Record<string, unknown>,
): string | null {
  if (typeof meta.actionId === 'string') return meta.actionId;
  const parts = eventId.split(':');
  if (parts[0] === 'task') return parts[1] ?? null;
  return null;
}
