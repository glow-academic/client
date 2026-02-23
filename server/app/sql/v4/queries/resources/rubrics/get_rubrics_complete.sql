-- Get rubrics by IDs
-- Returns distinct rubrics with their names and descriptions
-- CLEAN PATTERN: Query rubrics_resource only by IDs

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_rubrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubrics_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop type if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_rubrics_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for rubric items
CREATE TYPE types.q_get_rubrics_v4_item AS (
    id uuid,
    name text,
    description text,
    standard_group_ids uuid[]
);

CREATE OR REPLACE FUNCTION api_get_rubrics_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_rubrics_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (r.id, COALESCE(r.name, ''), COALESCE(r.description, ''), COALESCE(r.standard_group_ids, ARRAY[]::uuid[]))::types.q_get_rubrics_v4_item
        ORDER BY r.name
    ),
    '{}'::types.q_get_rubrics_v4_item[]
) as items
FROM rubrics_resource r
WHERE r.active = true
  AND (COALESCE(array_length(ids, 1), 0) = 0 OR r.id = ANY(ids));
$$;
