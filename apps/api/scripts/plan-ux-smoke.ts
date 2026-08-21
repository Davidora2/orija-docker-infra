/**
 * Scripted smoke: Plan UX Areas → Project → Action → matrix derivation.
 * Run: npx tsx scripts/plan-ux-smoke.ts
 */
import {
  actionBodyWithFlags,
  actionPriorityQuadrant,
  migrateActionBody,
  migrateProjectBody,
  projectBodyWithPriority,
  projectPriorityLevel,
  quadrantFromFlags,
} from '../src/priority-matrix.js';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// Area → Project (High/Med/Low) → Action (Important×Urgent)
const project = projectBodyWithPriority(
  { outcome: 'Ship Plan UX', fromIdeaId: 'idea-1' },
  'HIGH',
);
assert(project.priority === 'HIGH', 'project priority HIGH');
assert(project.priorityQuadrant === undefined, 'no Eisenhower on project');

const action = actionBodyWithFlags(
  { hours: 2, day: 'Mon' },
  true,
  true,
);
assert(action.important === true && action.urgent === true, 'action flags');
assert(action.priorityQuadrant === 'DO_FIRST', 'Do First derived');
assert(
  actionPriorityQuadrant(action) === 'DO_FIRST',
  'matrix view reads Do First',
);

// Legacy project Eisenhower migrates to action + High/Med/Low
const legacyProject = migrateProjectBody({ priorityQuadrant: 'SCHEDULE' });
assert(projectPriorityLevel(legacyProject) === 'MEDIUM', 'legacy → MEDIUM');
const seeded = migrateActionBody({ hours: 1 }, { priorityQuadrant: 'DO_FIRST' });
assert(seeded.important === true && seeded.urgent === true, 'seed from parent');

// Matrix covers all quadrants
assert(quadrantFromFlags(true, false) === 'SCHEDULE', 'Schedule');
assert(quadrantFromFlags(false, true) === 'DELEGATE', 'Delegate');
assert(quadrantFromFlags(false, false) === 'ELIMINATE', 'Eliminate');

console.log('plan-ux-smoke: OK — Area→Project→Action→matrix path verified');
