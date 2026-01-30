-- Get rubrics for a simulation
-- Returns distinct rubrics with their names and descriptions
-- Parameters: simulation_id (uuid)

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
    description text
);

CREATE OR REPLACE FUNCTION api_get_rubrics_v4(
    simulation_id uuid
)
RETURNS TABLE (
    items types.q_get_rubrics_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH rubric_data AS (
    -- When simulation_id is sentinel UUID (all zeros), return ALL active rubrics
    -- Otherwise return rubrics associated with the simulation
    SELECT DISTINCT
        r.id,
        COALESCE(r.name, '') as name,
        COALESCE(r.description, '') as description
    FROM rubrics_resource r
    WHERE r.active = true
      AND (
        -- Sentinel UUID means return all rubrics (for new simulations)
        api_get_rubrics_v4.simulation_id = '00000000-0000-0000-0000-000000000000'::uuid
        OR
        -- Otherwise return rubrics associated with the simulation
        EXISTS (
            SELECT 1 FROM simulation_scenario_rubrics_junction ssrj
            JOIN scenario_rubrics_resource srr ON srr.id = ssrj.scenario_rubric_id
            WHERE ssrj.simulation_id = api_get_rubrics_v4.simulation_id
              AND ssrj.active = true
              AND srr.rubric_id = r.id
        )
      )
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (rd.id, rd.name, rd.description)::types.q_get_rubrics_v4_item
            ORDER BY rd.name
        ) FROM rubric_data rd),
        '{}'::types.q_get_rubrics_v4_item[]
    ) as items;
$$;
