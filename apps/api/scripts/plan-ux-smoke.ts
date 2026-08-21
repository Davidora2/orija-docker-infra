/**
 * Scripted smoke: Plan UX Areas → Project → Action → matrix derivation.
 * Run: npx tsx scripts/plan-ux-smoke.ts
 */
import {
  actionBodyWithFlags,
  actionBodyWithLevels,
  actionPriorityQuadrant,
  migrateActionBody,
  migrateProjectBody,
  projectBodyWithPriority,
  projectPriorityLevel,
  quadrantFromFlags,
  quadrantFromLevels,
} from '../src/priority-matrix.js';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// Area → Project (High/Med/Low) → Action (Importance×Urgency L/M/H)
const project = projectBodyWithPriority(
  { outcome: 'Ship Plan UX', fromIdeaId: 'idea-1' },
  'HIGH',
);
assert(project.priority === 'HIGH', 'project priority HIGH');
assert(project.priorityQuadrant === undefined, 'no Eisenhower on project');

const action = actionBodyWithLevels(
  { hours: 2, day: 'Mon' },
  'HIGH',
  'HIGH',
);
assert(action.importance === 'HIGH' && action.urgency === 'HIGH', 'action levels');
assert(action.important === true && action.urgent === true, 'mirrored bools');
assert(action.priorityQuadrant === 'DO_FIRST', 'Do Now derived');
assert(
  actionPriorityQuadrant(action) === 'DO_FIRST',
  'matrix view reads Do Now',
);

// High + Medium urgency → Schedule (mockup mapping)
assert(quadrantFromLevels('HIGH', 'MEDIUM') === 'SCHEDULE', 'High×Med → Schedule');
assert(quadrantFromLevels('LOW', 'HIGH') === 'DELEGATE', 'Low×High → Delegate');
assert(quadrantFromLevels('LOW', 'LOW') === 'ELIMINATE', 'Low×Low → Delete');

// Legacy boolean flags still work
const legacyFlags = actionBodyWithFlags({ hours: 1 }, true, false);
assert(legacyFlags.importance === 'HIGH' && legacyFlags.urgency === 'LOW', 'bool→levels');
assert(quadrantFromFlags(true, false) === 'SCHEDULE', 'Schedule');
assert(quadrantFromFlags(false, true) === 'DELEGATE', 'Delegate');
assert(quadrantFromFlags(false, false) === 'ELIMINATE', 'Eliminate');

// Legacy project Eisenhower migrates to action + High/Med/Low
const legacyProject = migrateProjectBody({ priorityQuadrant: 'SCHEDULE' });
assert(projectPriorityLevel(legacyProject) === 'MEDIUM', 'legacy → MEDIUM');
const seeded = migrateActionBody({ hours: 1 }, { priorityQuadrant: 'DO_FIRST' });
assert(seeded.importance === 'HIGH' && seeded.urgency === 'HIGH', 'seed from parent');

console.log('plan-ux-smoke: OK — Area→Project→Action→L/M/H matrix path verified');
