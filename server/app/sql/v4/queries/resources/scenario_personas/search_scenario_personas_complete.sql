-- Search available scenario personas for scenarios
-- Returns available personas that can be set for scenarios
-- Parameters: simulation_id (uuid), scenario_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_scenario_personas_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_scenario_personas_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Reuses type from get endpoint: types.q_get_scenario_personas_v4_item

CREATE OR REPLACE FUNCTION api_search_scenario_personas_v4(
    simulation_id uuid,
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_scenario_personas_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT simulation_id AS sim_id, scenario_ids AS scen_ids
),
-- Get all available personas for the given scenarios from scenario_personas_junction
available_personas AS (
    SELECT
        spr.id,
        p.sim_id as simulation_id,
        spj.scenario_id,
        spj.persona_id,
        COALESCE(nr.name, '') as persona_name,
        COALESCE(dr.description, '') as persona_description,
        COALESCE(ir.value, '') as persona_icon,
        COALESCE(cr.hex_code, '') as persona_color,
        COALESCE(spr.generated, false) as generated
    FROM params p
    JOIN scenario_personas_junction spj ON true
    LEFT JOIN scenario_personas_resource spr ON spr.scenario_id = spj.scenario_id AND spr.persona_id = spj.persona_id
    -- Join persona details
    LEFT JOIN persona_names_junction pnj ON pnj.persona_id = spj.persona_id
    LEFT JOIN names_resource nr ON nr.id = pnj.name_id
    LEFT JOIN persona_descriptions_junction pdj ON pdj.persona_id = spj.persona_id
    LEFT JOIN descriptions_resource dr ON dr.id = pdj.description_id
    LEFT JOIN persona_icons_junction pij ON pij.persona_id = spj.persona_id
    LEFT JOIN icons_resource ir ON ir.id = pij.icon_id
    LEFT JOIN persona_colors_junction pcj ON pcj.persona_id = spj.persona_id
    LEFT JOIN colors_resource cr ON cr.id = pcj.color_id
    WHERE spj.active = true
      AND (
        COALESCE(array_length(p.scen_ids, 1), 0) = 0
        OR
        spj.scenario_id = ANY(p.scen_ids)
      )
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (ap.id, ap.simulation_id, ap.scenario_id, ap.persona_id, ap.persona_name, ap.persona_description, ap.persona_icon, ap.persona_color, ap.generated)::types.q_get_scenario_personas_v4_item
            ORDER BY ap.persona_name, ap.scenario_id
        ) FROM available_personas ap),
        '{}'::types.q_get_scenario_personas_v4_item[]
    ) as items;
$$;
