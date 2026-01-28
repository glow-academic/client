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
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as title,
        COALESCE(
            (SELECT d.description FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1),
            ''
        ) as description,
        -- Check if scenario has active flag
        COALESCE(
            (SELECT sf.value FROM scenario_flags_junction sf
             JOIN flags_resource f ON sf.flag_id = f.id
             WHERE sf.scenario_id = s.id
               AND f.name = 'scenario_active'
             LIMIT 1),
            false
        ) as active,
        COALESCE(s.generated, false) as generated,
        -- Get department_id from scenario_departments_junction
        (SELECT sd.department_id FROM scenario_departments_junction sd WHERE sd.scenario_id = s.id LIMIT 1) as department_id,
        -- Get persona_id from scenario_personas_junction
        (SELECT sp.persona_id FROM scenario_personas_junction sp WHERE sp.scenario_id = s.id LIMIT 1) as persona_id,
        -- Get persona name
        (SELECT n.name FROM scenario_personas_junction sp
         JOIN persona_names_junction pn ON pn.persona_id = sp.persona_id
         JOIN names_resource n ON n.id = pn.name_id
         WHERE sp.scenario_id = s.id
         LIMIT 1) as persona_name
    FROM params p
    CROSS JOIN LATERAL unnest(p.scenario_ids) AS sid
    JOIN scenario_artifact s ON s.id = sid
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
