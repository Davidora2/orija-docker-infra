import { describe, expect, it } from 'vitest';
import {
  actionBodyWithFlags,
  actionPriorityQuadrant,
  flagsFromQuadrant,
  migrateActionBody,
  migrateProjectBody,
  priorityRank,
  projectBodyWithPriority,
  projectPriorityFromLegacyQuadrant,
  projectPriorityLevel,
  projectPriorityQuadrant,
  quadrantFromFlags,
} from './priority-matrix.js';

describe('action Eisenhower (Important × Urgent)', () => {
  it('derives quadrants from flags', () => {
    expect(quadrantFromFlags(true, true)).toBe('DO_FIRST');
    expect(quadrantFromFlags(true, false)).toBe('SCHEDULE');
    expect(quadrantFromFlags(false, true)).toBe('DELEGATE');
    expect(quadrantFromFlags(false, false)).toBe('ELIMINATE');
  });

  it('reads Important/Urgent from action body', () => {
    expect(
      actionPriorityQuadrant({ important: true, urgent: true }),
    ).toBe('DO_FIRST');
    expect(
      actionPriorityQuadrant({ important: true, urgent: false }),
    ).toBe('SCHEDULE');
    expect(
      actionPriorityQuadrant({ important: false, urgent: true }),
    ).toBe('DELEGATE');
    expect(
      actionPriorityQuadrant({ important: false, urgent: false }),
    ).toBe('ELIMINATE');
  });

  it('falls back to legacy action priorityQuadrant', () => {
    expect(actionPriorityQuadrant({ priorityQuadrant: 'DELEGATE' })).toBe(
      'DELEGATE',
    );
  });

  it('falls back to parent project Eisenhower when action unset', () => {
    expect(
      actionPriorityQuadrant({}, { priorityQuadrant: 'DO_FIRST' }),
    ).toBe('DO_FIRST');
    expect(actionPriorityQuadrant({}, { eisenhower: 'ELIMINATE' })).toBe(
      'ELIMINATE',
    );
  });

  it('defaults unset actions to Schedule', () => {
    expect(actionPriorityQuadrant({})).toBe('SCHEDULE');
    expect(actionPriorityQuadrant(undefined)).toBe('SCHEDULE');
  });

  it('round-trips flags ↔ quadrant', () => {
    for (const quadrant of [
      'DO_FIRST',
      'SCHEDULE',
      'DELEGATE',
      'ELIMINATE',
    ] as const) {
      const flags = flagsFromQuadrant(quadrant);
      expect(quadrantFromFlags(flags.important, flags.urgent)).toBe(quadrant);
    }
  });

  it('ranks Do First highest', () => {
    expect(priorityRank('DO_FIRST')).toBeLessThan(priorityRank('SCHEDULE'));
    expect(priorityRank('SCHEDULE')).toBeLessThan(priorityRank('DELEGATE'));
    expect(priorityRank('DELEGATE')).toBeLessThan(priorityRank('ELIMINATE'));
  });

  it('writes action body with derived quadrant', () => {
    const body = actionBodyWithFlags({ hours: 2 }, true, true);
    expect(body.important).toBe(true);
    expect(body.urgent).toBe(true);
    expect(body.priorityQuadrant).toBe('DO_FIRST');
    expect(body.hours).toBe(2);
  });
});

describe('project High/Medium/Low', () => {
  it('reads explicit priority', () => {
    expect(projectPriorityLevel({ priority: 'HIGH' })).toBe('HIGH');
    expect(projectPriorityLevel({ priority: 'LOW' })).toBe('LOW');
  });

  it('migrates legacy Eisenhower on project to High/Med/Low', () => {
    expect(projectPriorityFromLegacyQuadrant('DO_FIRST')).toBe('HIGH');
    expect(projectPriorityFromLegacyQuadrant('SCHEDULE')).toBe('MEDIUM');
    expect(projectPriorityFromLegacyQuadrant('DELEGATE')).toBe('LOW');
    expect(projectPriorityFromLegacyQuadrant('ELIMINATE')).toBe('LOW');
    expect(projectPriorityLevel({ priorityQuadrant: 'DO_FIRST' })).toBe(
      'HIGH',
    );
    expect(projectPriorityLevel({ eisenhower: 'SCHEDULE' })).toBe('MEDIUM');
  });

  it('defaults unset projects to Medium', () => {
    expect(projectPriorityLevel({})).toBe('MEDIUM');
    expect(projectPriorityLevel(undefined)).toBe('MEDIUM');
  });

  it('strips Eisenhower keys when writing project priority', () => {
    const body = projectBodyWithPriority(
      { outcome: 'Ship', priorityQuadrant: 'DO_FIRST', eisenhower: 'DO_FIRST' },
      'HIGH',
    );
    expect(body.priority).toBe('HIGH');
    expect(body.outcome).toBe('Ship');
    expect(body.priorityQuadrant).toBeUndefined();
    expect(body.eisenhower).toBeUndefined();
  });

  it('migrateProjectBody normalizes legacy project bodies', () => {
    const migrated = migrateProjectBody({
      outcome: 'X',
      priorityQuadrant: 'DO_FIRST',
    });
    expect(migrated.priority).toBe('HIGH');
    expect(migrated.priorityQuadrant).toBeUndefined();
  });

  it('legacy projectPriorityQuadrant still resolves for compat', () => {
    expect(projectPriorityQuadrant({ priorityQuadrant: 'DO_FIRST' })).toBe(
      'DO_FIRST',
    );
    expect(projectPriorityQuadrant({ priority: 'HIGH' })).toBe('DO_FIRST');
    expect(projectPriorityQuadrant({ priority: 'MEDIUM' })).toBe('SCHEDULE');
    expect(projectPriorityQuadrant({ priority: 'LOW' })).toBe('ELIMINATE');
  });
});

describe('migrate action from parent project Eisenhower', () => {
  it('seeds Important/Urgent from parent legacy quadrant', () => {
    const migrated = migrateActionBody(
      { hours: 1 },
      { priorityQuadrant: 'DO_FIRST' },
    );
    expect(migrated.important).toBe(true);
    expect(migrated.urgent).toBe(true);
    expect(migrated.priorityQuadrant).toBe('DO_FIRST');
    expect(migrated.hours).toBe(1);
  });

  it('keeps explicit action flags over parent', () => {
    const migrated = migrateActionBody(
      { important: false, urgent: false },
      { priorityQuadrant: 'DO_FIRST' },
    );
    expect(migrated.priorityQuadrant).toBe('ELIMINATE');
  });
});
