-- Get cohorts resources by IDs
-- Simple data fetching from cohorts_resource only (department_ids denormalized)
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
    department_ids text[],
    profile_ids text[],
    profile_persona_ids text[]
);

-- Create function - query cohorts_resource directly (department_ids denormalized)
CREATE OR REPLACE FUNCTION api_get_cohorts_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_cohorts_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            cr.id,
            COALESCE(cr.name, ''),
            COALESCE(cr.description, ''),
            cr.active,
            COALESCE(
                (SELECT ARRAY_AGG(d::text) FROM unnest(cr.department_ids) d),
                ARRAY[]::text[]
            ),
            COALESCE(
                (SELECT ARRAY_AGG(p::text) FROM unnest(cr.profile_ids) p),
                ARRAY[]::text[]
            ),
            COALESCE(
                (SELECT ARRAY_AGG(pp::text) FROM unnest(cr.profile_persona_ids) pp),
                ARRAY[]::text[]
            )
        )::types.q_get_cohorts_v4_item
        ORDER BY array_position(ids, cr.id)
    ),
    ARRAY[]::types.q_get_cohorts_v4_item[]
) as items
FROM cohorts_resource cr
WHERE cr.id = ANY(ids);
$$;
