-- Get standards resources by IDs (batch)
-- Simple data fetching with standard_group_id lookup
-- Parameters: p_ids (uuid[])
-- Returns: items (array of standard resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_standards_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_standards_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_standards_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for standard item
CREATE TYPE types.q_get_standards_v4_item AS (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points float
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_standards_v4(
    p_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_standards_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            s.id,
            s.standard_group_id,
            s.name,
            COALESCE(s.description, ''),
            COALESCE(s.points, 0)::float
        )::types.q_get_standards_v4_item
        ORDER BY array_position(p_ids, s.id)
    ),
    ARRAY[]::types.q_get_standards_v4_item[]
) as items
FROM standards_resource s
WHERE s.id = ANY(p_ids)
  AND s.active = true;
$$;
