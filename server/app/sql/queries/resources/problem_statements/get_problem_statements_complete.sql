-- Get problem statements resources by IDs (batch)
-- Simple data fetching - no business logic, no active flag check
-- Parameters: p_ids (uuid[])
-- Returns: items (array of problem statement resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_problem_statements_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_problem_statements_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop search function that depends on types (must happen before type drop)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_problem_statements_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_problem_statements_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_problem_statements_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for problem statement item
CREATE TYPE types.q_get_problem_statements_v4_item AS (
    problem_statements_id uuid,
    name text,
    problem_statement text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_problem_statements_v4(
    p_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_problem_statements_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            ps.id,
            ps.name,
            ps.problem_statement,
            COALESCE(ps.generated, false)
        )::types.q_get_problem_statements_v4_item
        ORDER BY array_position(p_ids, ps.id)
    ),
    ARRAY[]::types.q_get_problem_statements_v4_item[]
) as items
FROM problem_statements_resource ps
WHERE ps.id = ANY(p_ids);
$$;
