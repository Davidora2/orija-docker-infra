import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRIORITY_FILTERS,
  addLocalDays,
  canonicalDateOnly,
  filterPriorityActions,
  formatFriendlyDate,
  ideaConversionMetadata,
  ideaOverallScore,
  ideaScoreNarrative,
  ideaStatusForAction,
  isValidDateOnly,
  localDayKey,
  quickDateNextWeek,
  quickDateToday,
  quickDateTomorrow,
  resetPriorityFilters,
  type PlanItemLike,
} from './index.js';

const projects: PlanItemLike[] = [
  {
    id: 'project-high',
    parentId: 'area-work',
    title: 'Launch',
    status: 'ACTIVE',
    body: { priority: 'HIGH' },
  },
  {
    id: 'project-low',
    parentId: 'area-home',
    title: 'House',
    status: 'ACTIVE',
    body: { priority: 'LOW' },
  },
];

const actions: PlanItemLike[] = [
  {
    id: 'a1',
    parentId: 'project-high',
    title: 'Write launch brief',
    status: 'ACTIVE',
    body: {
      importance: 'HIGH',
      urgency: 'HIGH',
      scheduledDate: '2026-08-24',
    },
  },
  {
    id: 'a2',
    parentId: 'project-high',
    title: 'Review launch metrics',
    status: 'DONE',
    body: {
      importance: 'HIGH',
      urgency: 'LOW',
      scheduledDate: '2026-08-20',
    },
  },
  {
    id: 'a3',
    parentId: 'project-low',
    title: 'Paint spare room',
    status: 'ACTIVE',
    body: { importance: 'LOW', urgency: 'LOW', day: 'Later' },
  },
];

describe('Priority filters', () => {
  it('combines title, area, project priority, status, quadrant, and window', () => {
    const result = filterPriorityActions(
      actions,
      projects,
      {
        query: 'launch',
        areaId: 'area-work',
        projectId: 'project-high',
        projectPriority: 'HIGH',
        actionStatus: 'OPEN',
        quadrant: 'DO_FIRST',
        window: 'NEXT_7_DAYS',
      },
      new Date(2026, 7, 22, 12),
    );
    expect(result.map((item) => item.id)).toEqual(['a1']);
  });

  it('supports done and overdue as a combined filter', () => {
    const result = filterPriorityActions(
      actions,
      projects,
      {
        ...DEFAULT_PRIORITY_FILTERS,
        actionStatus: 'DONE',
        window: 'OVERDUE',
      },
      new Date(2026, 7, 22, 12),
    );
    expect(result.map((item) => item.id)).toEqual(['a2']);
  });

  it('returns a fresh default filter object when reset', () => {
    const reset = resetPriorityFilters();
    expect(reset).toEqual(DEFAULT_PRIORITY_FILTERS);
    expect(reset).not.toBe(DEFAULT_PRIORITY_FILTERS);
  });
});

describe('Local date helpers', () => {
  const fixed = new Date(2026, 7, 22, 23, 59, 59);

  it('canonicalizes valid day keys and rejects invalid ones', () => {
    expect(canonicalDateOnly('2026-08-22')).toBe('2026-08-22');
    expect(canonicalDateOnly(' 2026-08-22 ')).toBe('2026-08-22');
    expect(canonicalDateOnly('2026-02-30')).toBeNull();
    expect(canonicalDateOnly('not-a-date')).toBeNull();
    expect(isValidDateOnly('2026-08-22')).toBe(true);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
  });

  it('uses local calendar days without UTC drift near midnight', () => {
    expect(localDayKey(fixed)).toBe('2026-08-22');
    expect(quickDateToday(fixed)).toBe('2026-08-22');
    expect(quickDateTomorrow(fixed)).toBe('2026-08-23');
    expect(quickDateNextWeek(fixed)).toBe('2026-08-29');
    expect(addLocalDays(fixed, 1).getDate()).toBe(23);
  });

  it('formats friendly labels for today, tomorrow, and other dates', () => {
    expect(formatFriendlyDate('2026-08-22', fixed)).toBe('Today');
    expect(formatFriendlyDate('2026-08-23', fixed)).toBe('Tomorrow');
    expect(formatFriendlyDate('2026-08-25', fixed)).toMatch(/25 Aug/);
  });
});

describe('Ideas lifecycle and conversion', () => {
  it('maps explicit actions to recoverable statuses', () => {
    expect(ideaStatusForAction('KEEP')).toBe('ACTIVE');
    expect(ideaStatusForAction('PARK')).toBe('PARKED');
    expect(ideaStatusForAction('CONVERT')).toBe('CONVERTED');
    expect(ideaStatusForAction('DISCARD')).toBe('ARCHIVED');
  });

  it('links a conversion and only then marks its source converted', () => {
    expect(ideaConversionMetadata('idea-42')).toEqual({
      projectBody: { fromIdeaId: 'idea-42' },
      sourceIdeaStatus: 'CONVERTED',
    });
    expect(() => ideaConversionMetadata('')).toThrow(/source idea/i);
  });

  it('calculates the /10 score and matching narrative', () => {
    const score = ideaOverallScore({
      impact: 8,
      effort: 3,
      alignment: 8,
      timing: 7,
    });
    expect(score).toBe(7.5);
    expect(ideaScoreNarrative(score)).toMatch(/Strong candidate/);
  });
});
