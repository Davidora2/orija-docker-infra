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
  },
];

assert.equal(
  pickDefaultBudgetId(davidBudgets, davidId),
  "personal-full",
  "owned personal budget should win over newer shared budget",
);

assert.equal(
  pickDefaultBudgetId(davidBudgets, davidId, { storedId: "shared-empty" }),
  "shared-empty",
  "stored preference should be respected when still valid",
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

console.log("web budget-selection tests passed");
