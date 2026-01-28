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
CREATE OR REPLACE FUNCTION api_get_cohorts_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_cohorts_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH cohort_departments AS (
    SELECT
        cd.cohort_id,
        ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
    FROM cohort_departments_junction cd
    WHERE cd.active = true
      AND cd.cohort_id = ANY(ids)
    GROUP BY cd.cohort_id
)
SELECT COALESCE(
    ARRAY_AGG(
        (
            c.id,
            (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1),
            COALESCE((SELECT d.description FROM cohort_descriptions_junction cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), ''),
            EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'cohort_active' AND cf.value = TRUE),
            COALESCE(cdd.department_ids, ARRAY[]::text[])
        )::types.q_get_cohorts_v4_item
        ORDER BY array_position(ids, c.id)
    ),
    ARRAY[]::types.q_get_cohorts_v4_item[]
) as items
FROM cohort_artifact c
LEFT JOIN cohort_departments cdd ON cdd.cohort_id = c.id
WHERE c.id = ANY(ids)
  AND EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'cohort_active' AND cf.value = true);
$$;
