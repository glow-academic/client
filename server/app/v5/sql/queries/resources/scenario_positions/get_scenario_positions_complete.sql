-- Get scenario positions by resource IDs
-- Returns scenario position values
-- Parameters: ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_scenario_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_positions_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_scenario_positions_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for scenario position items
CREATE TYPE types.q_get_scenario_positions_v4_item AS (
    id uuid,
    scenario_id uuid,
    value integer,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_scenario_positions_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_scenario_positions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT
    COALESCE(
        ARRAY_AGG(
            (spr.id, spr.scenario_id, spr.value, COALESCE(spr.generated, false))::types.q_get_scenario_positions_v4_item
            ORDER BY spr.value, spr.scenario_id
        ),
        '{}'::types.q_get_scenario_positions_v4_item[]
    ) as items
FROM scenario_positions_resource spr
WHERE spr.id = ANY(ids)
  AND spr.active = true;
$$;
