-- Get cohorts resources by IDs
-- Simple data fetching for profile context 2-pass architecture
-- Parameters: ids (uuid[])
-- Returns: items (array of cohort resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_cohorts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_cohorts_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop search function if exists (avoids type dependency conflicts)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_cohorts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_cohorts_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_cohorts_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for cohort item
CREATE TYPE types.q_get_cohorts_v4_item AS (
    cohort_id uuid,
    title text,
    description text,
    active boolean,
    department_ids text[]
);

-- Create function
-- Now accepts resource IDs (from cohorts_resource) and queries directly
CREATE OR REPLACE FUNCTION api_get_cohorts_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_cohorts_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH cohort_artifact_mapping AS (
    -- Map resource IDs back to artifact IDs for junction table lookups
    SELECT
        ccj.cohorts_id AS resource_id,
        ccj.cohort_id AS artifact_id
    FROM cohort_cohorts_junction ccj
    WHERE ccj.cohorts_id = ANY(ids)
      AND ccj.active = true
),
cohort_departments AS (
    SELECT
        cam.resource_id,
        ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
    FROM cohort_artifact_mapping cam
    JOIN cohort_departments_junction cd ON cd.cohort_id = cam.artifact_id
    WHERE cd.active = true
    GROUP BY cam.resource_id
)
SELECT COALESCE(
    ARRAY_AGG(
        (
            cr.id,
            COALESCE(cr.name, ''),
            COALESCE(cr.description, ''),
            cr.active,
            COALESCE(cdd.department_ids, ARRAY[]::text[])
        )::types.q_get_cohorts_v4_item
        ORDER BY array_position(ids, cr.id)
    ),
    ARRAY[]::types.q_get_cohorts_v4_item[]
) as items
FROM cohorts_resource cr
LEFT JOIN cohort_departments cdd ON cdd.resource_id = cr.id
WHERE cr.id = ANY(ids)
  AND cr.active = true;
$$;
