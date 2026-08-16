import { describe, expect, it } from 'vitest';
import {
  isPriorityQuadrant,
  priorityRank,
  projectPriorityQuadrant,
} from './priority-matrix.js';

describe('priority matrix', () => {
  it('defaults unset projects to Schedule', () => {
    expect(projectPriorityQuadrant({})).toBe('SCHEDULE');
    expect(projectPriorityQuadrant(undefined)).toBe('SCHEDULE');
  });

  it('reads priorityQuadrant from body', () => {
    expect(projectPriorityQuadrant({ priorityQuadrant: 'DO_FIRST' })).toBe(
      'DO_FIRST',
    );
    expect(projectPriorityQuadrant({ eisenhower: 'ELIMINATE' })).toBe(
      'ELIMINATE',
    );
  });

  it('rejects unknown values', () => {
    expect(isPriorityQuadrant('DO_FIRST')).toBe(true);
    expect(isPriorityQuadrant('maybe')).toBe(false);
    expect(projectPriorityQuadrant({ priorityQuadrant: 'maybe' })).toBe(
      'SCHEDULE',
    );
  });

  it('ranks Do First highest', () => {
    expect(priorityRank('DO_FIRST')).toBeLessThan(priorityRank('SCHEDULE'));
    expect(priorityRank('SCHEDULE')).toBeLessThan(priorityRank('DELEGATE'));
    expect(priorityRank('DELEGATE')).toBeLessThan(priorityRank('ELIMINATE'));
  });
});
