import { describe, expect, it } from 'vitest';
import {
  summarizeAreasPlan,
  summarizeIdeasPlan,
  summarizeProjectsPlan,
} from './summaries.js';

const pillars = [
  { id: 'area-1', parentId: null, status: 'ACTIVE', body: {} },
  { id: 'area-2', parentId: null, status: 'ACTIVE', body: {} },
];

const projects = [
  {
    id: 'project-1',
    parentId: 'area-1',
    status: 'ACTIVE',
    body: { targetDate: '2026-08-28' },
  },
  {
    id: 'project-2',
    parentId: 'area-2',
    status: 'ACTIVE',
    body: {},
  },
  {
    id: 'project-3',
    parentId: 'area-1',
    status: 'DONE',
    body: {},
  },
];

const actions = [
  {
    id: 'action-1',
    parentId: 'project-1',
    status: 'ACTIVE',
    body: { hours: 4 },
  },
  {
    id: 'action-2',
    parentId: 'project-2',
    status: 'ACTIVE',
    body: { hours: 2 },
  },
];

const ideas = [
  { id: 'idea-1', parentId: null, status: 'ACTIVE', body: {} },
  { id: 'idea-2', parentId: null, status: 'EVALUATED', body: {} },
  { id: 'idea-3', parentId: null, status: 'PARKED', body: {} },
  { id: 'idea-4', parentId: null, status: 'ARCHIVED', body: {} },
];

describe('summarizeAreasPlan', () => {
  it('counts areas, active projects, and attention signals', () => {
    const summary = summarizeAreasPlan({
      pillars,
      projects,
      actions,
      availableHours: 10,
    });
    expect(summary.areaCount).toBe(2);
    expect(summary.activeProjectCount).toBe(2);
    expect(summary.plannedHours).toBe(6);
    expect(summary.line).toContain('2 areas');
    expect(summary.line).toContain('2 active projects');
  });
});

describe('summarizeProjectsPlan', () => {
  it('tracks capacity, due soon, and missing next steps', () => {
    const summary = summarizeProjectsPlan({
      projects,
      actions: [actions[0]],
      availableHours: 10,
      now: new Date('2026-08-22T12:00:00'),
    });
    expect(summary.activeProjectCount).toBe(2);
    expect(summary.plannedHours).toBe(4);
    expect(summary.dueSoonCount).toBe(1);
    expect(summary.missingNextActionCount).toBe(1);
    expect(summary.line).toContain('1 due soon');
    expect(summary.line).toContain('1 missing next step');
  });
});

describe('summarizeIdeasPlan', () => {
  it('reports inbox, evaluated, and parked counts', () => {
    const summary = summarizeIdeasPlan(ideas);
    expect(summary.inboxCount).toBe(1);
    expect(summary.evaluatedCount).toBe(1);
    expect(summary.parkedCount).toBe(1);
    expect(summary.line).toBe('1 inbox · 1 evaluated · 1 parked');
    expect(summary.stateLabel).toBe('1 to review');
  });
});
