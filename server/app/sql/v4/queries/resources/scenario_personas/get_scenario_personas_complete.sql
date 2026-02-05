-- Get scenario personas for a simulation
-- Returns scenario persona values for scenarios in a simulation
-- Parameters: simulation_id (uuid), scenario_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_scenario_personas_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_personas_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_scenario_personas_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for scenario persona items
CREATE TYPE types.q_get_scenario_personas_v4_item AS (
    id uuid,
    simulation_id uuid,
    scenario_id uuid,
    persona_id uuid,
    persona_name text,
    persona_description text,
    persona_icon text,
    persona_color text,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_scenario_personas_v4(
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
persona_data AS (
    SELECT
        spr.id,
        sspj.simulation_id,
        spr.scenario_id,
        spr.persona_id,
        COALESCE(nr.name, '') as persona_name,
        COALESCE(dr.description, '') as persona_description,
        COALESCE(ir.value, '') as persona_icon,
        COALESCE(cr.hex_code, '') as persona_color,
        COALESCE(sspj.generated, false) as generated
    FROM params p
    JOIN simulation_scenario_personas_junction sspj ON sspj.simulation_id = p.sim_id
    JOIN scenario_personas_resource spr ON spr.id = sspj.scenario_persona_id
    -- Join persona details
    LEFT JOIN persona_names_junction pnj ON pnj.persona_id = spr.persona_id
    LEFT JOIN names_resource nr ON nr.id = pnj.name_id
    LEFT JOIN persona_descriptions_junction pdj ON pdj.persona_id = spr.persona_id
    LEFT JOIN descriptions_resource dr ON dr.id = pdj.description_id
    LEFT JOIN persona_icons_junction pij ON pij.persona_id = spr.persona_id
    LEFT JOIN icons_resource ir ON ir.id = pij.icon_id
    LEFT JOIN persona_colors_junction pcj ON pcj.persona_id = spr.persona_id
    LEFT JOIN colors_resource cr ON cr.id = pcj.color_id
    WHERE sspj.active = true
      AND (COALESCE(array_length(p.scen_ids, 1), 0) = 0 OR spr.scenario_id = ANY(p.scen_ids))
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.id, pd.simulation_id, pd.scenario_id, pd.persona_id, pd.persona_name, pd.persona_description, pd.persona_icon, pd.persona_color, pd.generated)::types.q_get_scenario_personas_v4_item
            ORDER BY pd.persona_name, pd.scenario_id
        ) FROM persona_data pd),
        '{}'::types.q_get_scenario_personas_v4_item[]
    ) as items;
$$;
