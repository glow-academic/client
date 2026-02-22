-- Get profile personas by resource IDs
-- Returns profile persona values (persona enrichment moves to artifact layer)
-- Parameters: ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_profile_personas_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profile_personas_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_profile_personas_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for profile persona items
CREATE TYPE types.q_get_profile_personas_v4_item AS (
    id uuid,
    profile_id uuid,
    persona_id uuid,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_profile_personas_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_profile_personas_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT
    COALESCE(
        ARRAY_AGG(
            (ppr.id, ppr.profile_id, ppr.persona_id, COALESCE(ppr.generated, false))::types.q_get_profile_personas_v4_item
            ORDER BY ppr.profile_id
        ),
        '{}'::types.q_get_profile_personas_v4_item[]
    ) as items
FROM profile_personas_resource ppr
WHERE ppr.id = ANY(ids)
  AND ppr.active = true;
$$;
