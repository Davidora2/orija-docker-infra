import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from './auth.js';
import type { Database } from './db.js';
import { ApiError } from './errors.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid date.');

const reviewSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  householdId: z.string().uuid().optional(),
  weekStart: isoDate,
  results: z.object({
    completedActions: z.number().int().min(0).max(100_000),
    totalActions: z.number().int().min(0).max(100_000),
    completionRate: z.number().min(0).max(100),
    highlights: z.string().trim().max(4_000).default(''),
  }),
  capacity: z.object({
    plannedHours: z.number().min(0).max(10_000),
    availableHours: z.number().min(0).max(10_000),
  }),
  bottlenecks: z.string().trim().max(4_000).default(''),
  startDoing: z.string().trim().max(4_000).default(''),
  stopDoing: z.string().trim().max(4_000).default(''),
  continueDoing: z.string().trim().max(4_000).default(''),
  nextWeekPriorities: z
    .array(z.string().trim().min(1).max(500))
    .max(5)
    .default([]),
});

async function authorizedHousehold(
  sql: Database,
  userId: string,
  requestedHouseholdId?: string,
): Promise<string> {
  const [membership] = await sql<{ householdId: string }[]>`
    SELECT hm.household_id
    FROM users u
    JOIN household_members hm
      ON hm.user_id = u.id
      AND hm.household_id = COALESCE(${requestedHouseholdId ?? null}::uuid, u.active_household_id)
    WHERE u.id = ${userId}
  `;
  if (!membership) {
    throw new ApiError(
      requestedHouseholdId ? 403 : 400,
      requestedHouseholdId ? 'not_a_member' : 'no_active_household',
      requestedHouseholdId
        ? 'You are not a member of that household.'
        : 'Choose a household before saving a review.',
    );
  }
  return membership.householdId;
}

export function registerWeeklyReviewRoutes(
  app: FastifyInstance,
  sql: Database,
  auth: AuthService,
): void {
  app.get(
    '/v1/weekly-reviews',
    { preHandler: auth.authenticate },
    async (request) => {
      const query = z
        .object({
          householdId: z.string().uuid().optional(),
          limit: z.coerce.number().int().min(1).max(52).default(12),
        })
        .parse(request.query);
      const householdId = await authorizedHousehold(
        sql,
        request.authUser.id,
        query.householdId,
      );
      return sql`
        SELECT *
        FROM weekly_reviews
        WHERE user_id = ${request.authUser.id}
          AND household_id = ${householdId}
          AND EXISTS (
            SELECT 1
            FROM household_members hm
            WHERE hm.household_id = weekly_reviews.household_id
              AND hm.user_id = ${request.authUser.id}
          )
        ORDER BY week_start DESC, updated_at DESC
        LIMIT ${query.limit}
      `;
    },
  );

  app.get(
    '/v1/weekly-reviews/:id',
    { preHandler: auth.authenticate },
    async (request) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const [review] = await sql`
        SELECT wr.*
        FROM weekly_reviews wr
        WHERE wr.id = ${id}
          AND wr.user_id = ${request.authUser.id}
          AND EXISTS (
            SELECT 1
            FROM household_members hm
            WHERE hm.household_id = wr.household_id
              AND hm.user_id = ${request.authUser.id}
          )
      `;
      if (!review) {
        throw new ApiError(
          404,
          'weekly_review_not_found',
          'The weekly review does not exist or is not yours.',
        );
      }
      return review;
    },
  );

  app.post(
    '/v1/weekly-reviews',
    { preHandler: auth.authenticate },
    async (request, reply) => {
      const body = reviewSchema.parse(request.body);
      const householdId = await authorizedHousehold(
        sql,
        request.authUser.id,
        body.householdId,
      );
      const [review] = await sql`
        INSERT INTO weekly_reviews (
          schema_version,
          user_id,
          household_id,
          week_start,
          results,
          capacity,
          bottlenecks,
          start_doing,
          stop_doing,
          continue_doing,
          next_week_priorities
        ) VALUES (
          ${body.schemaVersion},
          ${request.authUser.id},
          ${householdId},
          ${body.weekStart}::date,
          ${sql.json(body.results)},
          ${sql.json(body.capacity)},
          ${body.bottlenecks},
          ${body.startDoing},
          ${body.stopDoing},
          ${body.continueDoing},
          ${sql.json(body.nextWeekPriorities)}
        )
        ON CONFLICT (user_id, household_id, week_start) DO UPDATE SET
          schema_version = EXCLUDED.schema_version,
          results = EXCLUDED.results,
          capacity = EXCLUDED.capacity,
          bottlenecks = EXCLUDED.bottlenecks,
          start_doing = EXCLUDED.start_doing,
          stop_doing = EXCLUDED.stop_doing,
          continue_doing = EXCLUDED.continue_doing,
          next_week_priorities = EXCLUDED.next_week_priorities,
          updated_at = now()
        RETURNING *
      `;
      return reply.code(201).send(review);
    },
  );
}
