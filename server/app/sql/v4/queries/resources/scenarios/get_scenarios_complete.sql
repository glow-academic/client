-- Get scenarios by IDs
-- Returns scenario details for the given IDs

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_scenarios_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenarios_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_scenarios_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for scenario items
CREATE TYPE types.q_get_scenarios_v4_item AS (
    scenario_id uuid,
    title text,
    description text,
    active boolean,
    generated boolean,
    department_id uuid,
    persona_id uuid,
    persona_name text
);

CREATE OR REPLACE FUNCTION api_get_scenarios_v4(
    ids uuid[]
)
RETURNS TABLE (
    items types.q_get_scenarios_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT ids AS scenario_ids
),
scenario_data AS (
    SELECT
        s.id as scenario_id,
        s.name as title,
        COALESCE(s.description, '') as description,
        s.active as active,
        COALESCE(s.generated, false) as generated,
        -- Get first department_id from array
        CASE WHEN s.department_ids IS NOT NULL AND array_length(s.department_ids, 1) > 0
             THEN s.department_ids[1]
             ELSE NULL
        END as department_id,
        -- Persona info not available for scenarios_resource
        NULL::uuid as persona_id,
        NULL::text as persona_name
    FROM params p
    CROSS JOIN LATERAL unnest(p.scenario_ids) AS sid
    JOIN scenarios_resource s ON s.id = sid
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (sd.scenario_id, sd.title, sd.description, sd.active, sd.generated, sd.department_id, sd.persona_id, sd.persona_name)::types.q_get_scenarios_v4_item
            ORDER BY sd.title
        ) FROM scenario_data sd),
        '{}'::types.q_get_scenarios_v4_item[]
    ) as items;
$$;
