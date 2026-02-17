-- Unified save simulation function - handles both create (input_simulation_id = NULL)
-- and update (input_simulation_id provided)
-- Uses nested resource action composites with tool call tracking.

-- 0) Drop and recreate composite types for resource actions
DO $$
BEGIN
    DROP TYPE IF EXISTS types.simulation_resource_action CASCADE;
    CREATE TYPE types.simulation_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.simulation_multi_resource_action CASCADE;
    CREATE TYPE types.simulation_multi_resource_action AS (
        resource_ids uuid[],
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1) Drop function first (breaks dependency on types)
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

-- 2) Recreate function with composite resource action parameters
CREATE OR REPLACE FUNCTION api_save_simulation_v4(
    profile_id uuid,
    input_simulation_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.simulation_resource_action DEFAULT NULL,
    descriptions types.simulation_resource_action DEFAULT NULL,
    flags types.simulation_multi_resource_action DEFAULT NULL,
    departments types.simulation_multi_resource_action DEFAULT NULL,
    scenarios types.simulation_multi_resource_action DEFAULT NULL,
    scenario_flags types.simulation_multi_resource_action DEFAULT NULL,
    scenario_positions types.simulation_multi_resource_action DEFAULT NULL,
    scenario_rubrics types.simulation_multi_resource_action DEFAULT NULL,
    scenario_time_limits types.simulation_multi_resource_action DEFAULT NULL,
    scenario_personas types.simulation_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    simulation_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_simulation_id uuid;
    v_profile_id uuid;
    v_input_simulation_id uuid;
    v_group_id uuid;
    is_create boolean;

    -- Extracted resource IDs
    v_name_id uuid;
    v_description_id uuid;
    v_flag_ids uuid[];
    v_department_ids uuid[];
    v_scenario_ids uuid[];
    v_scenario_flag_ids uuid[];
    v_scenario_position_ids uuid[];
    v_scenario_rubric_ids uuid[];
    v_scenario_time_limit_ids uuid[];
    v_scenario_persona_ids uuid[];

    -- Call tracking
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    v_profile_id := profile_id;
    v_input_simulation_id := input_simulation_id;
    v_group_id := group_id;

    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_flag_ids := COALESCE((flags).resource_ids, ARRAY[]::uuid[]);
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_scenario_ids := COALESCE((scenarios).resource_ids, ARRAY[]::uuid[]);
    v_scenario_flag_ids := COALESCE((scenario_flags).resource_ids, ARRAY[]::uuid[]);
    v_scenario_position_ids := COALESCE((scenario_positions).resource_ids, ARRAY[]::uuid[]);
    v_scenario_rubric_ids := COALESCE((scenario_rubrics).resource_ids, ARRAY[]::uuid[]);
    v_scenario_time_limit_ids := COALESCE((scenario_time_limits).resource_ids, ARRAY[]::uuid[]);
    v_scenario_persona_ids := COALESCE((scenario_personas).resource_ids, ARRAY[]::uuid[]);

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    is_create := (v_input_simulation_id IS NULL);

    IF is_create THEN
        INSERT INTO simulation_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_simulation_id;
    ELSE
        v_simulation_id := v_input_simulation_id;
        UPDATE simulation_artifact
        SET updated_at = NOW()
        WHERE id = v_simulation_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Simulation not found: %', v_input_simulation_id;
        END IF;
    END IF;

    -- NOTE: simulation_groups_junction was dropped in migration 407

    -- Validate IDs
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_flag_ids) AS fid
        WHERE NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = fid)
    ) THEN
        RAISE EXCEPTION 'One or more flag_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_department_ids) AS did
        WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = did)
    ) THEN
        RAISE EXCEPTION 'One or more department_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_scenario_ids) AS sid
        WHERE NOT EXISTS (SELECT 1 FROM scenarios_resource WHERE id = sid)
    ) THEN
        RAISE EXCEPTION 'One or more scenario_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_scenario_flag_ids) AS x
        WHERE NOT EXISTS (SELECT 1 FROM scenario_flags_resource WHERE id = x)
    ) THEN
        RAISE EXCEPTION 'One or more scenario_flag_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_scenario_position_ids) AS x
        WHERE NOT EXISTS (SELECT 1 FROM scenario_positions_resource WHERE id = x)
    ) THEN
        RAISE EXCEPTION 'One or more scenario_position_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_scenario_rubric_ids) AS x
        WHERE NOT EXISTS (SELECT 1 FROM scenario_rubrics_resource WHERE id = x)
    ) THEN
        RAISE EXCEPTION 'One or more scenario_rubric_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_scenario_time_limit_ids) AS x
        WHERE NOT EXISTS (SELECT 1 FROM scenario_time_limits_resource WHERE id = x)
    ) THEN
        RAISE EXCEPTION 'One or more scenario_time_limit_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_scenario_persona_ids) AS x
        WHERE NOT EXISTS (SELECT 1 FROM scenario_personas_resource WHERE id = x)
    ) THEN
        RAISE EXCEPTION 'One or more scenario_persona_ids not found';
    END IF;

    -- Deactivate old links on update (workflow semantics)
    IF NOT is_create THEN
        UPDATE simulation_names_junction SET active = false WHERE simulation_names_junction.simulation_id = v_simulation_id AND simulation_names_junction.active = true;
        UPDATE simulation_descriptions_junction SET active = false WHERE simulation_descriptions_junction.simulation_id = v_simulation_id AND simulation_descriptions_junction.active = true;
        UPDATE simulation_flags_junction SET active = false WHERE simulation_flags_junction.simulation_id = v_simulation_id AND simulation_flags_junction.active = true;
        UPDATE simulation_departments_junction SET active = false WHERE simulation_departments_junction.simulation_id = v_simulation_id AND simulation_departments_junction.active = true;
        UPDATE simulation_scenarios_junction SET active = false WHERE simulation_scenarios_junction.simulation_id = v_simulation_id AND simulation_scenarios_junction.active = true;
        UPDATE simulation_scenario_flags_junction SET active = false WHERE simulation_scenario_flags_junction.simulation_id = v_simulation_id AND simulation_scenario_flags_junction.active = true;
        UPDATE simulation_scenario_positions_junction SET active = false WHERE simulation_scenario_positions_junction.simulation_id = v_simulation_id AND simulation_scenario_positions_junction.active = true;
        UPDATE simulation_scenario_rubrics_junction SET active = false WHERE simulation_scenario_rubrics_junction.simulation_id = v_simulation_id AND simulation_scenario_rubrics_junction.active = true;
        UPDATE simulation_scenario_time_limits_junction SET active = false WHERE simulation_scenario_time_limits_junction.simulation_id = v_simulation_id AND simulation_scenario_time_limits_junction.active = true;
        UPDATE simulation_scenario_personas_junction SET active = false WHERE simulation_scenario_personas_junction.simulation_id = v_simulation_id AND simulation_scenario_personas_junction.active = true;
    END IF;

    -- Tool-call tracking: one run per save
    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, group_id, created_at, updated_at)
    VALUES (v_run_id, v_group_id, NOW(), NOW());

    -- names
    IF v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    -- descriptions
    IF v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    -- Multi-resource trackers
    IF COALESCE(array_length(v_flag_ids, 1), 0) > 0 THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id)
            SELECT fid, v_call_id FROM UNNEST(v_flag_ids) fid;
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id)
            SELECT fid, v_call_id FROM UNNEST(v_flag_ids) fid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;
        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;
    END IF;

    IF COALESCE(array_length(v_scenario_ids, 1), 0) > 0 THEN
        IF (scenarios).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_create_scenarios_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenarios).create_tool_id, v_call_id);
            INSERT INTO scenarios_calls_connection (scenarios_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_scenario_ids) sid;
        END IF;
        IF (scenarios).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_link_scenarios_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenarios).link_tool_id, v_call_id);
            INSERT INTO scenarios_calls_connection (scenarios_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_scenario_ids) sid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_scenario_flag_ids, 1), 0) > 0 THEN
        IF (scenario_flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_create_scenario_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_flags).create_tool_id, v_call_id);
            INSERT INTO scenario_flags_calls_connection (scenario_flags_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_scenario_flag_ids) sid;
        END IF;
        IF (scenario_flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_link_scenario_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_flags).link_tool_id, v_call_id);
            INSERT INTO scenario_flags_calls_connection (scenario_flags_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_scenario_flag_ids) sid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_scenario_position_ids, 1), 0) > 0 THEN
        IF (scenario_positions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_create_scenario_positions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_positions).create_tool_id, v_call_id);
            INSERT INTO scenario_positions_calls_connection (scenario_positions_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_scenario_position_ids) sid;
        END IF;
        IF (scenario_positions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_link_scenario_positions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_positions).link_tool_id, v_call_id);
            INSERT INTO scenario_positions_calls_connection (scenario_positions_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_scenario_position_ids) sid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_scenario_rubric_ids, 1), 0) > 0 THEN
        IF (scenario_rubrics).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_create_scenario_rubrics_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_rubrics).create_tool_id, v_call_id);
            INSERT INTO scenario_rubrics_calls_connection (scenario_rubrics_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_scenario_rubric_ids) sid;
        END IF;
        IF (scenario_rubrics).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_link_scenario_rubrics_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_rubrics).link_tool_id, v_call_id);
            INSERT INTO scenario_rubrics_calls_connection (scenario_rubrics_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_scenario_rubric_ids) sid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_scenario_time_limit_ids, 1), 0) > 0 THEN
        IF (scenario_time_limits).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_create_scenario_time_limits_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_time_limits).create_tool_id, v_call_id);
            INSERT INTO scenario_time_limits_calls_connection (scenario_time_limits_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_scenario_time_limit_ids) sid;
        END IF;
        IF (scenario_time_limits).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_link_scenario_time_limits_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_time_limits).link_tool_id, v_call_id);
            INSERT INTO scenario_time_limits_calls_connection (scenario_time_limits_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_scenario_time_limit_ids) sid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_scenario_persona_ids, 1), 0) > 0 THEN
        IF (scenario_personas).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_create_scenario_personas_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_personas).create_tool_id, v_call_id);
            INSERT INTO personas_calls_connection (personas_id, call_id)
            SELECT DISTINCT spr.persona_id, v_call_id
            FROM scenario_personas_resource spr
            WHERE spr.id = ANY(v_scenario_persona_ids);
        END IF;
        IF (scenario_personas).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'simulation_save_link_scenario_personas_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_personas).link_tool_id, v_call_id);
            INSERT INTO personas_calls_connection (personas_id, call_id)
            SELECT DISTINCT spr.persona_id, v_call_id
            FROM scenario_personas_resource spr
            WHERE spr.id = ANY(v_scenario_persona_ids);
        END IF;
    END IF;

    -- Upsert active links
    IF v_name_id IS NOT NULL THEN
        INSERT INTO simulation_names_junction (simulation_id, name_id, created_at, generated, mcp, active)
        VALUES (v_simulation_id, v_name_id, NOW(), false, false, true)
        ON CONFLICT ON CONSTRAINT simulation_names_pkey DO UPDATE
        SET active = true, generated = false, mcp = false;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO simulation_descriptions_junction (simulation_id, description_id, created_at, generated, mcp, active)
        VALUES (v_simulation_id, v_description_id, NOW(), false, false, true)
        ON CONFLICT ON CONSTRAINT simulation_descriptions_pkey DO UPDATE
        SET active = true, generated = false, mcp = false;
    END IF;

    INSERT INTO simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active)
    SELECT v_simulation_id, fid, true, NOW(), false, false, true
    FROM UNNEST(v_flag_ids) fid
    ON CONFLICT ON CONSTRAINT simulation_flags_pkey DO UPDATE
    SET value = true, active = true, generated = false, mcp = false;

    INSERT INTO simulation_departments_junction (simulation_id, department_id, active, created_at, generated, mcp)
    SELECT v_simulation_id, did, true, NOW(), false, false
    FROM UNNEST(v_department_ids) did
    ON CONFLICT ON CONSTRAINT simulation_departments_pkey DO UPDATE
    SET active = true, generated = false, mcp = false;

    INSERT INTO simulation_scenarios_junction (simulation_id, scenario_id, active, created_at, generated, mcp)
    SELECT v_simulation_id, sid, true, NOW(), false, false
    FROM UNNEST(v_scenario_ids) sid
    ON CONFLICT ON CONSTRAINT simulation_scenarios_pkey DO UPDATE
    SET active = true, generated = false, mcp = false;

    INSERT INTO simulation_scenario_flags_junction (simulation_id, scenario_flag_id, value, created_at, generated, mcp, active)
    SELECT v_simulation_id, sid, true, NOW(), false, false, true
    FROM UNNEST(v_scenario_flag_ids) sid
    ON CONFLICT ON CONSTRAINT simulation_scenario_flags_new_pkey DO UPDATE
    SET value = true, active = true, generated = false, mcp = false;

    INSERT INTO simulation_scenario_positions_junction (simulation_id, scenario_position_id, created_at, generated, mcp, active)
    SELECT v_simulation_id, sid, NOW(), false, false, true
    FROM UNNEST(v_scenario_position_ids) sid
    ON CONFLICT ON CONSTRAINT simulation_scenario_positions_pkey DO UPDATE
    SET active = true, generated = false, mcp = false;

    INSERT INTO simulation_scenario_rubrics_junction (simulation_id, scenario_rubric_id, created_at, generated, mcp, active)
    SELECT v_simulation_id, sid, NOW(), false, false, true
    FROM UNNEST(v_scenario_rubric_ids) sid
    ON CONFLICT ON CONSTRAINT simulation_scenario_rubrics_pkey DO UPDATE
    SET active = true, generated = false, mcp = false;

    INSERT INTO simulation_scenario_time_limits_junction (simulation_id, scenario_time_limit_id, created_at, generated, mcp, active)
    SELECT v_simulation_id, sid, NOW(), false, false, true
    FROM UNNEST(v_scenario_time_limit_ids) sid
    ON CONFLICT ON CONSTRAINT simulation_scenario_time_limits_pkey DO UPDATE
    SET active = true, generated = false, mcp = false;

    INSERT INTO simulation_scenario_personas_junction (simulation_id, scenario_persona_id, created_at, generated, mcp, active)
    SELECT v_simulation_id, sid, NOW(), false, false, true
    FROM UNNEST(v_scenario_persona_ids) sid
    ON CONFLICT ON CONSTRAINT simulation_scenario_personas_pkey DO UPDATE
    SET active = true, generated = false, mcp = false;

    -- Sync linked simulations_resource with name/description
    UPDATE simulations_resource r
    SET name = n.name,
        description = d.description
    FROM simulation_simulations_junction j
    LEFT JOIN names_resource n ON n.id = v_name_id
    LEFT JOIN descriptions_resource d ON d.id = v_description_id
    WHERE j.simulations_id = r.id
      AND j.simulation_id = v_simulation_id;

    RETURN QUERY SELECT v_simulation_id;
END;
$$;

