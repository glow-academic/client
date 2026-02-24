-- Unified save simulation function - handles both create (input_simulation_id = NULL) and update (input_simulation_id provided)
-- Accepts flat resource IDs directly. Tool call tracking handled by create/link internals.
-- Denormalized simulations_resource created inline or by Python (create_simulations_internal).

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_simulation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_simulation_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_simulation_v4(
    profile_id uuid,
    input_simulation_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    flag_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    scenario_flag_ids uuid[] DEFAULT NULL,
    scenario_position_ids uuid[] DEFAULT NULL,
    scenario_rubric_ids uuid[] DEFAULT NULL,
    scenario_time_limit_ids uuid[] DEFAULT NULL,
    simulations_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    simulation_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_simulation_id uuid;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_simulation_id IS NULL);

    -- Validate required fields (only on create)
    IF is_create THEN
        IF name_id IS NULL THEN
            RAISE EXCEPTION 'Name resource is required';
        END IF;
    END IF;

    -- Create or update simulation_artifact
    IF is_create THEN
        INSERT INTO simulation_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_simulation_id;
    ELSE
        v_simulation_id := input_simulation_id;
        UPDATE simulation_artifact
        SET updated_at = NOW()
        WHERE id = v_simulation_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Simulation not found: %', input_simulation_id;
        END IF;

        -- COALESCE: fill NULL params from existing active junctions (partial update support)
        -- Single-select resources
        IF name_id IS NULL THEN
            name_id := (SELECT j.name_id FROM simulation_names_junction j WHERE j.simulation_id = v_simulation_id AND j.active LIMIT 1);
        END IF;
        IF description_id IS NULL THEN
            description_id := (SELECT j.description_id FROM simulation_descriptions_junction j WHERE j.simulation_id = v_simulation_id AND j.active LIMIT 1);
        END IF;

        -- Multi-select arrays: preserve existing if NULL passed
        IF flag_ids IS NULL THEN
            flag_ids := COALESCE((SELECT ARRAY_AGG(j.flag_id) FROM simulation_flags_junction j WHERE j.simulation_id = v_simulation_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF department_ids IS NULL THEN
            department_ids := COALESCE((SELECT ARRAY_AGG(j.department_id) FROM simulation_departments_junction j WHERE j.simulation_id = v_simulation_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF scenario_ids IS NULL THEN
            scenario_ids := COALESCE((SELECT ARRAY_AGG(j.scenario_id) FROM simulation_scenarios_junction j WHERE j.simulation_id = v_simulation_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF scenario_flag_ids IS NULL THEN
            scenario_flag_ids := COALESCE((SELECT ARRAY_AGG(j.scenario_flag_id) FROM simulation_scenario_flags_junction j WHERE j.simulation_id = v_simulation_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF scenario_position_ids IS NULL THEN
            scenario_position_ids := COALESCE((SELECT ARRAY_AGG(j.scenario_position_id) FROM simulation_scenario_positions_junction j WHERE j.simulation_id = v_simulation_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF scenario_rubric_ids IS NULL THEN
            scenario_rubric_ids := COALESCE((SELECT ARRAY_AGG(j.scenario_rubric_id) FROM simulation_scenario_rubrics_junction j WHERE j.simulation_id = v_simulation_id AND j.active), ARRAY[]::uuid[]);
        END IF;
        IF scenario_time_limit_ids IS NULL THEN
            scenario_time_limit_ids := COALESCE((SELECT ARRAY_AGG(j.scenario_time_limit_id) FROM simulation_scenario_time_limits_junction j WHERE j.simulation_id = v_simulation_id AND j.active), ARRAY[]::uuid[]);
        END IF;
    END IF;

    -- Create simulations_resource inline if not provided (partial update path)
    IF simulations_resource_id IS NULL THEN
        INSERT INTO simulations_resource (
            name, description, department_ids, scenario_ids, mcp, generated
        )
        SELECT
            n.name,
            d.description,
            COALESCE(api_save_simulation_v4.department_ids, ARRAY[]::uuid[]),
            COALESCE(api_save_simulation_v4.scenario_ids, ARRAY[]::uuid[]),
            false,
            false
        FROM (SELECT 1) AS dummy
        LEFT JOIN names_resource n ON n.id = api_save_simulation_v4.name_id
        LEFT JOIN descriptions_resource d ON d.id = api_save_simulation_v4.description_id
        RETURNING id INTO simulations_resource_id;
    END IF;

    -- For update: deactivate old junction rows (preserves history)
    IF NOT is_create THEN
        UPDATE simulation_names_junction SET active = false WHERE simulation_id = v_simulation_id AND active = true;
        UPDATE simulation_descriptions_junction SET active = false WHERE simulation_id = v_simulation_id AND active = true;
        UPDATE simulation_flags_junction SET active = false WHERE simulation_id = v_simulation_id AND active = true;
        UPDATE simulation_departments_junction SET active = false WHERE simulation_id = v_simulation_id AND active = true;
        UPDATE simulation_scenarios_junction SET active = false WHERE simulation_id = v_simulation_id AND active = true;
        UPDATE simulation_scenario_flags_junction SET active = false WHERE simulation_id = v_simulation_id AND active = true;
        UPDATE simulation_scenario_positions_junction SET active = false WHERE simulation_id = v_simulation_id AND active = true;
        UPDATE simulation_scenario_rubrics_junction SET active = false WHERE simulation_id = v_simulation_id AND active = true;
        UPDATE simulation_scenario_time_limits_junction SET active = false WHERE simulation_id = v_simulation_id AND active = true;
    END IF;

    -- Upsert junction rows
    RETURN QUERY
    WITH params AS (
        SELECT
            v_simulation_id AS simulation_id,
            api_save_simulation_v4.name_id AS name_id,
            api_save_simulation_v4.description_id AS description_id,
            api_save_simulation_v4.flag_ids AS flag_ids,
            api_save_simulation_v4.department_ids AS department_ids,
            api_save_simulation_v4.scenario_ids AS scenario_ids,
            api_save_simulation_v4.scenario_flag_ids AS scenario_flag_ids,
            api_save_simulation_v4.scenario_position_ids AS scenario_position_ids,
            api_save_simulation_v4.scenario_rubric_ids AS scenario_rubric_ids,
            api_save_simulation_v4.scenario_time_limit_ids AS scenario_time_limit_ids,
            api_save_simulation_v4.simulations_resource_id AS simulations_resource_id
    ),
    -- Link name
    link_name AS (
        INSERT INTO simulation_names_junction (simulation_id, name_id, active, created_at, generated, mcp)
        SELECT x.simulation_id, x.name_id, true, NOW(), false, false
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT simulation_names_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link description
    link_description AS (
        INSERT INTO simulation_descriptions_junction (simulation_id, description_id, active, created_at, generated, mcp)
        SELECT x.simulation_id, x.description_id, true, NOW(), false, false
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT simulation_descriptions_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link flags
    link_flags AS (
        INSERT INTO simulation_flags_junction (simulation_id, flag_id, value, active, created_at, generated, mcp)
        SELECT x.simulation_id, fid, true, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.flag_ids) AS fid
        WHERE COALESCE(array_length(x.flag_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_flags_pkey DO UPDATE SET value = true, active = true, generated = false, mcp = false
    ),
    -- Link departments
    link_departments AS (
        INSERT INTO simulation_departments_junction (simulation_id, department_id, active, created_at, generated, mcp)
        SELECT x.simulation_id, did, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) AS did
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_departments_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link scenarios
    link_scenarios AS (
        INSERT INTO simulation_scenarios_junction (simulation_id, scenario_id, active, created_at, generated, mcp)
        SELECT x.simulation_id, sid, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.scenario_ids) AS sid
        WHERE COALESCE(array_length(x.scenario_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenarios_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link scenario flags
    link_scenario_flags AS (
        INSERT INTO simulation_scenario_flags_junction (simulation_id, scenario_flag_id, value, active, created_at, generated, mcp)
        SELECT x.simulation_id, sfid, true, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.scenario_flag_ids) AS sfid
        WHERE COALESCE(array_length(x.scenario_flag_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_flags_new_pkey DO UPDATE SET value = true, active = true, generated = false, mcp = false
    ),
    -- Link scenario positions
    link_scenario_positions AS (
        INSERT INTO simulation_scenario_positions_junction (simulation_id, scenario_position_id, active, created_at, generated, mcp)
        SELECT x.simulation_id, spid, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.scenario_position_ids) AS spid
        WHERE COALESCE(array_length(x.scenario_position_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_positions_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link scenario rubrics
    link_scenario_rubrics AS (
        INSERT INTO simulation_scenario_rubrics_junction (simulation_id, scenario_rubric_id, active, created_at, generated, mcp)
        SELECT x.simulation_id, srid, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.scenario_rubric_ids) AS srid
        WHERE COALESCE(array_length(x.scenario_rubric_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_rubrics_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Link scenario time limits
    link_scenario_time_limits AS (
        INSERT INTO simulation_scenario_time_limits_junction (simulation_id, scenario_time_limit_id, active, created_at, generated, mcp)
        SELECT x.simulation_id, stid, true, NOW(), false, false
        FROM params x
        CROSS JOIN UNNEST(x.scenario_time_limit_ids) AS stid
        WHERE COALESCE(array_length(x.scenario_time_limit_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_time_limits_pkey DO UPDATE SET active = true, generated = false, mcp = false
    ),
    -- Deactivate old simulations_resource link
    deactivate_old_resource AS (
        UPDATE simulation_simulations_junction
        SET active = false
        FROM params p
        WHERE simulation_simulations_junction.simulation_id = p.simulation_id
          AND simulation_simulations_junction.active = true
    ),
    -- Link new simulations_resource
    link_new_resource AS (
        INSERT INTO simulation_simulations_junction (simulation_id, simulations_id, active)
        SELECT x.simulation_id, x.simulations_resource_id, true
        FROM params x
        WHERE x.simulations_resource_id IS NOT NULL
    )
    SELECT x.simulation_id AS simulation_id
    FROM params x;
END;
$$;
