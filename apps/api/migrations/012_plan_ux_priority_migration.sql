-- Plan UX: project priority High/Med/Low; Eisenhower Important×Urgent on actions.
-- Migrates legacy project.body.priorityQuadrant / eisenhower onto child actions, then projects.

-- 1) Seed action Important/Urgent from parent project Eisenhower when action flags are unset.
UPDATE life_items AS a
SET
  body = a.body || jsonb_build_object(
    'important',
    CASE COALESCE(p.body->>'priorityQuadrant', p.body->>'eisenhower', 'SCHEDULE')
      WHEN 'DO_FIRST' THEN true
      WHEN 'SCHEDULE' THEN true
      WHEN 'DELEGATE' THEN false
      WHEN 'ELIMINATE' THEN false
      ELSE true
    END,
    'urgent',
    CASE COALESCE(p.body->>'priorityQuadrant', p.body->>'eisenhower', 'SCHEDULE')
      WHEN 'DO_FIRST' THEN true
      WHEN 'SCHEDULE' THEN false
      WHEN 'DELEGATE' THEN true
      WHEN 'ELIMINATE' THEN false
      ELSE false
    END,
    'priorityQuadrant',
    CASE COALESCE(p.body->>'priorityQuadrant', p.body->>'eisenhower', 'SCHEDULE')
      WHEN 'DO_FIRST' THEN 'DO_FIRST'
      WHEN 'SCHEDULE' THEN 'SCHEDULE'
      WHEN 'DELEGATE' THEN 'DELEGATE'
      WHEN 'ELIMINATE' THEN 'ELIMINATE'
      ELSE 'SCHEDULE'
    END
  ),
  updated_at = now()
FROM life_items AS p
WHERE a.kind = 'ACTION'
  AND a.parent_id = p.id
  AND p.kind = 'PROJECT'
  AND (p.body ? 'priorityQuadrant' OR p.body ? 'eisenhower')
  AND NOT (a.body ? 'important')
  AND NOT (a.body ? 'urgent');

-- 2) Default open actions with neither flags nor quadrant → Schedule (important, not urgent).
UPDATE life_items
SET
  body = body || jsonb_build_object(
    'important', true,
    'urgent', false,
    'priorityQuadrant', 'SCHEDULE'
  ),
  updated_at = now()
WHERE kind = 'ACTION'
  AND NOT (body ? 'important')
  AND NOT (body ? 'urgent')
  AND NOT (body ? 'priorityQuadrant')
  AND NOT (body ? 'eisenhower');

-- 3) Convert project Eisenhower → priority High/Medium/Low; drop Eisenhower keys.
UPDATE life_items
SET
  body = (body - 'priorityQuadrant' - 'eisenhower') || jsonb_build_object(
    'priority',
    CASE COALESCE(body->>'priorityQuadrant', body->>'eisenhower')
      WHEN 'DO_FIRST' THEN 'HIGH'
      WHEN 'SCHEDULE' THEN 'MEDIUM'
      WHEN 'DELEGATE' THEN 'LOW'
      WHEN 'ELIMINATE' THEN 'LOW'
      ELSE COALESCE(body->>'priority', 'MEDIUM')
    END
  ),
  updated_at = now()
WHERE kind = 'PROJECT'
  AND (body ? 'priorityQuadrant' OR body ? 'eisenhower');

-- 4) Ensure projects without priority get Medium.
UPDATE life_items
SET
  body = body || jsonb_build_object('priority', 'MEDIUM'),
  updated_at = now()
WHERE kind = 'PROJECT'
  AND NOT (body ? 'priority');
