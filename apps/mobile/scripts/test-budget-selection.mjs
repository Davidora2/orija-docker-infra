/**
 * Budget default-selection checks (no device required).
 * Run: node apps/mobile/scripts/test-budget-selection.mjs
 */
import assert from 'node:assert/strict';

function pickDefaultBudgetId(budgets, userId, options = {}) {
  if (!budgets.length) return null;

  const valid = (id) =>
    id && budgets.some((budget) => budget.id === id) ? id : null;

  const preferred = valid(options.preferredId);
  if (preferred) return preferred;

  const stored = valid(options.storedId);
  if (stored) return stored;

  const ownedPrivate = budgets.filter(
    (budget) =>
      budget.visibility === 'PRIVATE' && budget.ownerUserId === userId,
  );
  if (ownedPrivate.length) return ownedPrivate[0].id;

  const owned = budgets.filter((budget) => budget.ownerUserId === userId);
  if (owned.length) return owned[0].id;

  return budgets[0].id;
}

const davidId = 'f5d5994a-7883-4894-b77e-8bc226a868cd';
const partnerId = '4228f615-219c-4c25-a483-f993a3eaf29f';

const davidBudgets = [
  {
    id: 'shared-empty',
    ownerUserId: partnerId,
    visibility: 'SHARED',
  },
  {
    id: 'personal-full',
    ownerUserId: davidId,
    visibility: 'PRIVATE',
  },
];

assert.equal(
  pickDefaultBudgetId(davidBudgets, davidId),
  'personal-full',
  'owned personal budget should win over newer shared budget',
);

assert.equal(
  pickDefaultBudgetId(davidBudgets, davidId, { storedId: 'shared-empty' }),
  'shared-empty',
  'stored preference should be respected when still valid',
);

assert.equal(
  pickDefaultBudgetId(davidBudgets, davidId, { preferredId: 'shared-empty' }),
  'shared-empty',
  'explicit preferred id should win',
);

assert.equal(
  pickDefaultBudgetId(
    [{ id: 'only-shared', ownerUserId: partnerId, visibility: 'SHARED' }],
    davidId,
  ),
  'only-shared',
  'falls back to first budget when user has no owned spaces',
);

console.log('budget-selection tests passed');
