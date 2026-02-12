-- Get scenarios by IDs
-- Returns scenario details for the given IDs
-- CLEAN PATTERN: Query scenarios_resource only (filter on active = true)

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
SELECT COALESCE(
    ARRAY_AGG(
        (
            s.id,
            s.name,
            COALESCE(s.description, ''),
            COALESCE(s.generated, false),
            s.problem_statement_enabled,
            s.objectives_enabled,
            s.video_enabled,
            s.images_enabled,
            s.questions_enabled,
            COALESCE(s.persona_ids, ARRAY[]::uuid[])
        )::types.q_get_scenarios_v4_item
        ORDER BY s.name
    ),
    '{}'::types.q_get_scenarios_v4_item[]
) as items
FROM scenarios_resource s
WHERE s.id = ANY(ids)
  AND s.active = true;
$$;
