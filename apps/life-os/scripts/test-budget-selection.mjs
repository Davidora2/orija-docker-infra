/**
 * Budget default-selection checks for web Money overview.
 * Run: node apps/life-os/scripts/test-budget-selection.mjs
 */
import assert from "node:assert/strict";
import { pickDefaultBudgetId } from "../../life-os-shared/src/index.ts";

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

console.log("web budget-selection tests passed");
