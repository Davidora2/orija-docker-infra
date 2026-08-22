import { describe, expect, it } from 'vitest';
import {
  calendarEventActionIdFromMeta,
  profileBodySchema,
  publicProfileBody,
} from './user-profile.js';

describe('user profile body', () => {
  it('parses primary move override', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(
      profileBodySchema.safeParse({ primaryMoveActionId: id }).success,
    ).toBe(true);
    expect(
      profileBodySchema.safeParse({ primaryMoveActionId: null }).success,
    ).toBe(true);
    expect(
      profileBodySchema.safeParse({ primaryMoveActionId: 'not-a-uuid' }).success,
    ).toBe(false);
    expect(publicProfileBody({ primaryMoveActionId: id }).primaryMoveActionId).toBe(
      id,
    );
  });
});

describe('calendar event action id', () => {
  it('reads actionId from meta or event id', () => {
    expect(
      calendarEventActionIdFromMeta('task:abc-123:2026-08-22', {
        actionId: 'from-meta',
      }),
    ).toBe('from-meta');
    expect(
      calendarEventActionIdFromMeta('task:abc-123', {}),
    ).toBe('abc-123');
  });
});
