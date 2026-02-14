-- Get rubrics resources by IDs (batch)
-- Simple data fetching - no business logic
-- Parameters: p_ids (uuid[])
-- Returns: items (array of rubric resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_rubrics_batch_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubrics_batch_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_rubrics_batch_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for rubric item
CREATE TYPE types.q_get_rubrics_batch_v4_item AS (
    rubric_id uuid,
    name text,
    description text,
    total_points float,
    pass_points float,
    standard_group_ids uuid[]
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_rubrics_batch_v4(
    p_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_rubrics_batch_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            r.id,
            r.name,
            r.description,
            r.total_points,
            r.pass_points,
            COALESCE(r.standard_group_ids, ARRAY[]::uuid[])
        )::types.q_get_rubrics_batch_v4_item
        ORDER BY array_position(p_ids, r.id)
    ),
    ARRAY[]::types.q_get_rubrics_batch_v4_item[]
) as items
FROM rubrics_resource r
WHERE r.id = ANY(p_ids)
  AND r.active = TRUE;
$$;
