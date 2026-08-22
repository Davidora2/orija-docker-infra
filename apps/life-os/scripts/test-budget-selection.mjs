/**
 * Budget default-selection checks for web Money overview.
 * Run: node apps/life-os/scripts/test-budget-selection.mjs
 */
import assert from "node:assert/strict";
import {
  dedupeBudgetsById,
  dedupeBudgetsForDisplay,
  pickDefaultBudgetId,
  resolveBudgetSelection,
} from "../../life-os-shared/src/index.ts";

const davidId = "f5d5994a-7883-4894-b77e-8bc226a868cd";
const partnerId = "4228f615-219c-4c25-a483-f993a3eaf29f";

const davidBudgets = [
  {
    id: "shared-empty",
    ownerUserId: partnerId,
    visibility: "SHARED",
  },
  {
    id: "personal-full",
    ownerUserId: davidId,
    visibility: "PRIVATE",
    payFrequency: "biweekly",
    typicalPayCents: 197229,
    recurringCount: 8,
    recurringTotalCents: 87540,
  },
];

assert.equal(
  pickDefaultBudgetId(davidBudgets, davidId),
  "personal-full",
  "owned personal budget should win over newer shared budget",
);

assert.equal(
  pickDefaultBudgetId(davidBudgets, davidId, { storedId: "shared-empty" }),
  "personal-full",
  "stored empty shared budget should not hide populated personal budget",
);

assert.equal(
  pickDefaultBudgetId(davidBudgets, davidId, { preferredId: "shared-empty" }),
  "shared-empty",
  "explicit preferred id should win",
);

assert.equal(
  pickDefaultBudgetId(davidBudgets, davidId, { currentId: "personal-full" }),
  "personal-full",
  "current valid selection should stay on refresh",
);

assert.equal(
  pickDefaultBudgetId(
    [{ id: "only-shared", ownerUserId: partnerId, visibility: "SHARED" }],
    davidId,
  ),
  "only-shared",
  "falls back to first budget when user has no owned spaces",
);

const duplicatePersonal = [
  {
    id: "personal-empty-new",
    ownerUserId: davidId,
    visibility: "PRIVATE",
    createdAt: "2026-08-22T23:08:25.261Z",
  },
  {
    id: "personal-full-old",
    ownerUserId: davidId,
    visibility: "PRIVATE",
    createdAt: "2026-08-08T11:45:54.663Z",
    payFrequency: "biweekly",
    typicalPayCents: 197229,
  },
];

assert.equal(
  pickDefaultBudgetId(duplicatePersonal, davidId),
  "personal-full-old",
  "populated personal budget should win over newer empty duplicate",
);

assert.equal(
  pickDefaultBudgetId(duplicatePersonal, davidId, {
    storedId: "personal-empty-new",
  }),
  "personal-full-old",
  "stored thin duplicate should not hide populated personal budget",
);

const duplicateRows = [
  ...duplicatePersonal,
  duplicatePersonal[1],
  duplicatePersonal[0],
];

assert.equal(
  dedupeBudgetsById(duplicateRows).length,
  2,
  "dedupe should collapse repeated budget ids",
);

const resolved = resolveBudgetSelection(duplicateRows, davidId, {
  currentId: "personal-full-old",
  storedId: "personal-empty-new",
});
assert.equal(resolved.budgets.length, 2);
assert.equal(
  resolved.selectedId,
  "personal-full-old",
  "resolve should keep current populated budget on refresh",
);

const entryRich = [
  {
    id: "personal-entries",
    ownerUserId: davidId,
    visibility: "PRIVATE",
    entryCount: 12,
  },
  {
    id: "personal-empty",
    ownerUserId: davidId,
    visibility: "PRIVATE",
  },
];

assert.equal(
  pickDefaultBudgetId(entryRich, davidId),
  "personal-entries",
  "budget with entries should win over empty duplicate",
);

const currencyPair = [
  {
    id: "personal-gbp",
    ownerUserId: davidId,
    visibility: "PRIVATE",
    currency: "GBP",
    payFrequency: "biweekly",
    typicalPayCents: 197229,
    recurringCount: 8,
  },
  {
    id: "personal-cad",
    ownerUserId: davidId,
    visibility: "PRIVATE",
    currency: "CAD",
    payFrequency: "biweekly",
    typicalPayCents: 197229,
    recurringCount: 8,
  },
];

assert.equal(
  pickDefaultBudgetId(currencyPair, davidId, { profileCurrency: "CAD" }),
  "personal-cad",
  "profile currency should win when multiple populated budgets exist",
);

const displayDupes = dedupeBudgetsForDisplay(duplicateRows, "CAD");
assert.equal(displayDupes.length, 1);
assert.equal(
  displayDupes[0].id,
  "personal-full-old",
  "display dedupe should hide thin duplicate personal rows",
);

const resolvedDisplay = resolveBudgetSelection(duplicateRows, davidId, {
  profileCurrency: "CAD",
  currentId: "personal-full-old",
});
assert.equal(resolvedDisplay.displayBudgets.length, 1);
assert.equal(resolvedDisplay.selectedId, "personal-full-old");

console.log("web budget-selection tests passed");
