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
    name text,
    description text,
    generated boolean,
    -- Feature flags for visibility control
    problem_statement_enabled boolean,
    objectives_enabled boolean,
    video_enabled boolean,
    images_enabled boolean,
    questions_enabled boolean,
    -- Denormalized persona_ids for list hydration
    persona_ids uuid[]
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
-- Joins through scenario_artifact to ensure deleted scenarios don't appear (like personas pattern)
scenario_data AS (
    SELECT
        s.id as scenario_id,
        s.name,
        COALESCE(s.description, '') as description,
        COALESCE(s.generated, false) as generated,
        s.problem_statement_enabled,
        s.objectives_enabled,
        s.video_enabled,
        s.images_enabled,
        s.questions_enabled,
        COALESCE(s.persona_ids, ARRAY[]::uuid[]) as persona_ids
    FROM params p
    CROSS JOIN LATERAL unnest(p.scenario_ids) AS sid
    JOIN scenarios_resource s ON s.id = sid
    -- Join to scenario_scenarios_junction to get the artifact link
    JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = s.id AND ssj.active = true
    -- Join to scenario_artifact to ensure it exists (not deleted)
    JOIN scenario_artifact sa ON sa.id = ssj.scenario_id
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (sd.scenario_id, sd.name, sd.description, sd.generated, sd.problem_statement_enabled, sd.objectives_enabled, sd.video_enabled, sd.images_enabled, sd.questions_enabled, sd.persona_ids)::types.q_get_scenarios_v4_item
            ORDER BY sd.name
        ) FROM scenario_data sd),
        '{}'::types.q_get_scenarios_v4_item[]
    ) as items;
$$;
