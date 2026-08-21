import { describe, expect, it } from 'vitest';
import {
  actionBodyWithFlags,
  actionBodyWithLevels,
  actionImportanceLevel,
  actionPriorityQuadrant,
  actionUrgencyLevel,
  flagsFromQuadrant,
  levelsFromQuadrant,
  migrateActionBody,
  migrateProjectBody,
  priorityRank,
  projectBodyWithPriority,
  projectPriorityFromLegacyQuadrant,
  projectPriorityLevel,
  projectPriorityQuadrant,
  quadrantFromFlags,
  quadrantFromLevels,
} from './priority-matrix.js';

describe('action Eisenhower (Importance × Urgency L/M/H)', () => {
  it('derives quadrants from L/M/H levels (mockup mapping)', () => {
    expect(quadrantFromLevels('HIGH', 'HIGH')).toBe('DO_FIRST');
    expect(quadrantFromLevels('HIGH', 'MEDIUM')).toBe('SCHEDULE');
    expect(quadrantFromLevels('HIGH', 'LOW')).toBe('SCHEDULE');
    expect(quadrantFromLevels('MEDIUM', 'HIGH')).toBe('DO_FIRST');
    expect(quadrantFromLevels('MEDIUM', 'LOW')).toBe('SCHEDULE');
    expect(quadrantFromLevels('LOW', 'HIGH')).toBe('DELEGATE');
    expect(quadrantFromLevels('LOW', 'MEDIUM')).toBe('DELEGATE');
    expect(quadrantFromLevels('LOW', 'LOW')).toBe('ELIMINATE');
  });

  it('derives quadrants from legacy boolean flags', () => {
    expect(quadrantFromFlags(true, true)).toBe('DO_FIRST');
    expect(quadrantFromFlags(true, false)).toBe('SCHEDULE');
    expect(quadrantFromFlags(false, true)).toBe('DELEGATE');
    expect(quadrantFromFlags(false, false)).toBe('ELIMINATE');
  });

  it('reads Importance/Urgency levels from action body', () => {
    expect(actionPriorityQuadrant({ importance: 'HIGH', urgency: 'HIGH' })).toBe('DO_FIRST');
    expect(actionPriorityQuadrant({ importance: 'HIGH', urgency: 'LOW' })).toBe('SCHEDULE');
    expect(actionPriorityQuadrant({ importance: 'LOW', urgency: 'HIGH' })).toBe('DELEGATE');
    expect(actionPriorityQuadrant({ importance: 'LOW', urgency: 'LOW' })).toBe('ELIMINATE');
  });

  it('reads legacy boolean Important/Urgent from action body', () => {
    expect(actionPriorityQuadrant({ important: true, urgent: true })).toBe('DO_FIRST');
    expect(actionPriorityQuadrant({ important: true, urgent: false })).toBe('SCHEDULE');
    expect(actionPriorityQuadrant({ important: false, urgent: true })).toBe('DELEGATE');
    expect(actionPriorityQuadrant({ important: false, urgent: false })).toBe('ELIMINATE');
  });

  it('falls back to legacy action priorityQuadrant', () => {
    expect(actionPriorityQuadrant({ priorityQuadrant: 'DELEGATE' })).toBe('DELEGATE');
  });

  it('falls back to parent project Eisenhower when action unset', () => {
    expect(actionPriorityQuadrant({}, { priorityQuadrant: 'DO_FIRST' })).toBe('DO_FIRST');
    expect(actionPriorityQuadrant({}, { eisenhower: 'ELIMINATE' })).toBe('ELIMINATE');
  });

  it('defaults unset actions to Schedule', () => {
    expect(actionPriorityQuadrant({})).toBe('SCHEDULE');
    expect(actionPriorityQuadrant(undefined)).toBe('SCHEDULE');
  });

  it('round-trips flags ↔ quadrant', () => {
    for (const quadrant of ['DO_FIRST', 'SCHEDULE', 'DELEGATE', 'ELIMINATE'] as const) {
      const flags = flagsFromQuadrant(quadrant);
      expect(quadrantFromFlags(flags.important, flags.urgent)).toBe(quadrant);
      const levels = levelsFromQuadrant(quadrant);
      expect(quadrantFromLevels(levels.importance, levels.urgency)).toBe(quadrant);
    }
  });

  it('ranks Do Now highest', () => {
    expect(priorityRank('DO_FIRST')).toBeLessThan(priorityRank('SCHEDULE'));
    expect(priorityRank('SCHEDULE')).toBeLessThan(priorityRank('DELEGATE'));
    expect(priorityRank('DELEGATE')).toBeLessThan(priorityRank('ELIMINATE'));
  });

  it('writes action body with L/M/H levels and mirrored bools', () => {
    const body = actionBodyWithLevels({ hours: 2 }, 'HIGH', 'MEDIUM');
    expect(body.importance).toBe('HIGH');
    expect(body.urgency).toBe('MEDIUM');
    expect(body.important).toBe(true);
    expect(body.urgent).toBe(false);
    expect(body.priorityQuadrant).toBe('SCHEDULE');
    expect(body.hours).toBe(2);
    expect(actionImportanceLevel(body)).toBe('HIGH');
    expect(actionUrgencyLevel(body)).toBe('MEDIUM');
  });

  it('writes action body from legacy flags', () => {
    const body = actionBodyWithFlags({ hours: 2 }, true, true);
    expect(body.important).toBe(true);
    expect(body.urgent).toBe(true);
    expect(body.importance).toBe('HIGH');
    expect(body.urgency).toBe('HIGH');
    expect(body.priorityQuadrant).toBe('DO_FIRST');
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
    expect(projectPriorityLevel({ priorityQuadrant: 'DO_FIRST' })).toBe('HIGH');
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

  it('projectPriorityQuadrant still resolves for legacy callers', () => {
    expect(projectPriorityQuadrant({ priorityQuadrant: 'DO_FIRST' })).toBe('DO_FIRST');
    expect(projectPriorityQuadrant({ priority: 'HIGH' })).toBe('DO_FIRST');
  });
});

describe('migrateActionBody', () => {
  it('preserves L/M/H levels when present', () => {
    const migrated = migrateActionBody({
      hours: 1,
      importance: 'MEDIUM',
      urgency: 'HIGH',
    });
    expect(migrated.importance).toBe('MEDIUM');
    expect(migrated.urgency).toBe('HIGH');
    expect(migrated.priorityQuadrant).toBe('DO_FIRST');
  });

  it('seeds from parent Eisenhower', () => {
    const seeded = migrateActionBody({}, { priorityQuadrant: 'DO_FIRST' });
    expect(seeded.importance).toBe('HIGH');
    expect(seeded.urgency).toBe('HIGH');
    expect(seeded.important).toBe(true);
    expect(seeded.urgent).toBe(true);
  });
});
