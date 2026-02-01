-- Get options resources by IDs (batch)
-- Simple data fetching - no business logic, no active flag check
-- Parameters: p_ids (uuid[])
-- Returns: items (array of option resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_options_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_options_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_options_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for option item
CREATE TYPE types.q_get_options_v4_item AS (
    option_id uuid,
    option_text text,
    is_correct boolean,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_options_v4(
    p_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_options_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            o.id,
            o.option_text,
            COALESCE(o.is_correct, false),
            COALESCE(o.generated, false)
        )::types.q_get_options_v4_item
        ORDER BY array_position(p_ids, o.id)
    ),
    ARRAY[]::types.q_get_options_v4_item[]
) as items
FROM options_resource o
WHERE o.id = ANY(p_ids);
$$;
