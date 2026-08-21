# Plan UX — priority migration notes

**Status:** Implemented with `012_plan_ux_priority_migration.sql`  
**Related:** [UX_IA.md](./UX_IA.md) · API `priority-matrix.ts`

## Model

| Layer | Priority model |
|-------|----------------|
| **Project** | `body.priority`: `HIGH` \| `MEDIUM` \| `LOW` only |
| **Action** | `body.important` × `body.urgent` → Eisenhower quadrant (`DO_FIRST` / `SCHEDULE` / `DELEGATE` / `ELIMINATE`) |
| **Matrix** | View of **actions**, not projects |

Hierarchy: Area → Project → Action; Idea → Project → Action. Today / Calendar / Capacity consume actions (estimates drive capacity hours).

## Legacy mapping

Project Eisenhower → High/Med/Low:

| Old `priorityQuadrant` | New `priority` |
|------------------------|----------------|
| `DO_FIRST` | `HIGH` |
| `SCHEDULE` | `MEDIUM` |
| `DELEGATE` | `LOW` |
| `ELIMINATE` | `LOW` |

Before stripping project Eisenhower keys, child actions without `important`/`urgent` inherit flags from the parent project’s old quadrant.

Clients still read legacy keys for one release (`projectPriorityLevel` / `actionPriorityQuadrant` fallbacks).

## Deploy

Run API migrations (`012_plan_ux_priority_migration.sql`) on the Life OS API host after shipping this branch.
