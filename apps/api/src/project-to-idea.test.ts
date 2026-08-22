import { describe, expect, it } from 'vitest';
import {
  actionBodyAfterMoveToIdea,
  buildIdeaFromProject,
  isOpenActionStatus,
  projectBodyAfterMoveToIdea,
} from './project-to-idea.js';

describe('move project to idea', () => {
  it('treats only unfinished actions as open', () => {
    expect(isOpenActionStatus('ACTIVE')).toBe(true);
    expect(isOpenActionStatus('PAUSED')).toBe(true);
    expect(isOpenActionStatus('DONE')).toBe(false);
    expect(isOpenActionStatus('ARCHIVED')).toBe(false);
    expect(isOpenActionStatus('CANCELLED')).toBe(false);
  });

  it('builds idea with title, area, outcome, and archived action notes', () => {
    const draft = buildIdeaFromProject(
      {
        id: 'proj-1',
        title: 'Ship Plan UX',
        status: 'ACTIVE',
        parentId: 'area-1',
        visibility: 'PRIVATE',
        sortOrder: 2,
        body: { outcome: 'Users finish projects', priority: 'LOW' },
      },
      [
        {
          id: 'act-1',
          title: 'Wire Move to Ideas',
          status: 'ACTIVE',
          body: { hours: 2 },
        },
        {
          id: 'act-2',
          title: 'Update badges',
          status: 'ACTIVE',
          body: {},
        },
      ],
    );

    expect(draft.title).toBe('Ship Plan UX');
    expect(draft.parentId).toBe('area-1');
    expect(draft.status).toBe('ACTIVE');
    expect(draft.body.fromProjectId).toBe('proj-1');
    expect(draft.body.why).toBe('Users finish projects');
    expect(String(draft.body.note)).toContain('Users finish projects');
    expect(String(draft.body.note)).toContain('Wire Move to Ideas');
    expect(String(draft.body.note)).toContain('Update badges');
    expect(draft.body.archivedActionTitles).toEqual([
      'Wire Move to Ideas',
      'Update badges',
    ]);
  });

  it('links evaluation from project or prior idea', () => {
    const draft = buildIdeaFromProject(
      {
        id: 'proj-2',
        title: 'Evaluated park',
        status: 'ACTIVE',
        parentId: 'area-1',
        visibility: 'PRIVATE',
        sortOrder: 0,
        body: {
          outcome: 'Ship',
          fromIdeaId: 'idea-old',
          impact: 8,
          score: 7.5,
        },
      },
      [],
      { effort: 3, alignment: 9, timing: 6, evalNotes: 'Worth parking' },
    );
    expect(draft.status).toBe('EVALUATED');
    expect(draft.body.fromIdeaId).toBe('idea-old');
    expect(draft.body.impact).toBe(8);
    expect(draft.body.effort).toBe(3);
    expect(draft.body.evalNotes).toBe('Worth parking');
  });

  it('marks project and actions with movedToIdeaId', () => {
    expect(
      projectBodyAfterMoveToIdea({ outcome: 'X', priority: 'HIGH' }, 'idea-9'),
    ).toEqual({
      outcome: 'X',
      priority: 'HIGH',
      movedToIdeaId: 'idea-9',
    });
    expect(actionBodyAfterMoveToIdea({ hours: 1 }, 'idea-9')).toEqual({
      hours: 1,
      movedToIdeaId: 'idea-9',
    });
  });
});
