/**
 * Soft-convert PROJECT → IDEA (park as idea).
 * Preserves title/area/outcome; archives open actions (titles land in idea notes).
 * Never auto-runs — callers must invoke POST /v1/items/:id/move-to-idea.
 */

export type MoveProjectToIdeaAction = {
  id: string;
  title: string;
  status: string;
  body: Record<string, unknown>;
};

export type MoveProjectToIdeaProject = {
  id: string;
  title: string;
  status: string;
  parentId: string | null;
  visibility: 'PRIVATE' | 'SHARED';
  body: Record<string, unknown>;
  sortOrder: number;
};

export type IdeaDraftFromProject = {
  title: string;
  parentId: string | null;
  visibility: 'PRIVATE' | 'SHARED';
  status: 'ACTIVE' | 'EVALUATED';
  body: Record<string, unknown>;
  sortOrder: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readString(
  body: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readNumber(
  body: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = body[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Copy evaluation scores / notes from a project or linked idea body. */
export function evaluationFieldsFromBody(
  body: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const source = asRecord(body);
  const next: Record<string, unknown> = {};
  for (const key of [
    'impact',
    'effort',
    'alignment',
    'timing',
    'score',
    'evalNotes',
  ] as const) {
    if (key === 'evalNotes') {
      const notes = readString(source, 'evalNotes', 'notes');
      if (notes) next.evalNotes = notes;
      continue;
    }
    const num = readNumber(source, key);
    if (num !== undefined) next[key] = num;
  }
  return next;
}

export function hasLinkedEvaluation(
  body: Record<string, unknown> | null | undefined,
): boolean {
  const fields = evaluationFieldsFromBody(body);
  return (
    typeof fields.impact === 'number' ||
    typeof fields.score === 'number' ||
    typeof fields.evalNotes === 'string'
  );
}

export function isOpenActionStatus(status: string): boolean {
  return (
    status !== 'DONE' &&
    status !== 'ARCHIVED' &&
    status !== 'CANCELLED' &&
    status !== 'CONVERTED'
  );
}

/** Build IDEA payload + archived-action notes from a project + its open actions. */
export function buildIdeaFromProject(
  project: MoveProjectToIdeaProject,
  openActions: MoveProjectToIdeaAction[],
  linkedIdeaBody?: Record<string, unknown> | null,
): IdeaDraftFromProject {
  const projectBody = asRecord(project.body);
  const outcome = readString(projectBody, 'outcome', 'note', 'why');
  const existingNotes = readString(projectBody, 'notes', 'note');
  const actionLines = openActions.map((action) => `- ${action.title}`);

  const noteParts: string[] = [];
  if (outcome) noteParts.push(outcome);
  else if (existingNotes) noteParts.push(existingNotes);

  if (actionLines.length > 0) {
    noteParts.push(
      `Open actions archived when moved from project:\n${actionLines.join('\n')}`,
    );
  }

  const note = noteParts.join('\n\n').trim();
  const fromIdeaId = readString(projectBody, 'fromIdeaId');
  const evaluation = {
    ...evaluationFieldsFromBody(linkedIdeaBody),
    ...evaluationFieldsFromBody(projectBody),
  };
  const evaluated = hasLinkedEvaluation(evaluation);

  const body: Record<string, unknown> = {
    note,
    why: outcome || existingNotes || note,
    impact: 0,
    effort: 0,
    alignment: 0,
    timing: 0,
    ...evaluation,
    fromProjectId: project.id,
    archivedActionTitles: openActions.map((action) => action.title),
    archivedActionIds: openActions.map((action) => action.id),
  };
  if (fromIdeaId) body.fromIdeaId = fromIdeaId;

  return {
    title: project.title,
    parentId: project.parentId,
    visibility: project.visibility,
    sortOrder: project.sortOrder,
    status: evaluated ? 'EVALUATED' : 'ACTIVE',
    body,
  };
}

export function projectBodyAfterMoveToIdea(
  projectBody: Record<string, unknown>,
  ideaId: string,
): Record<string, unknown> {
  return {
    ...projectBody,
    movedToIdeaId: ideaId,
  };
}

export function actionBodyAfterMoveToIdea(
  actionBody: Record<string, unknown>,
  ideaId: string,
): Record<string, unknown> {
  return {
    ...actionBody,
    movedToIdeaId: ideaId,
  };
}
