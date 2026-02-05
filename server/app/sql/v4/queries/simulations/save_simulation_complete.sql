-- Unified save simulation function - handles both create (input_simulation_id = NULL) and update (input_simulation_id provided)
-- Accepts form fields directly (no draft_id dependency)

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

-- 2) Recreate function with direct form data parameters (no draft_id)
CREATE OR REPLACE FUNCTION api_save_simulation_v4(
    profile_id uuid,
    group_id uuid,
    input_simulation_id uuid DEFAULT NULL,
    -- Required form data
    name_id uuid DEFAULT NULL,
    -- Optional single-select form data
    description_id uuid DEFAULT NULL,
    -- Optional multi-select form data
    flag_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    scenario_flag_ids uuid[] DEFAULT NULL,
    scenario_position_ids uuid[] DEFAULT NULL,
    scenario_rubric_ids uuid[] DEFAULT NULL,
    scenario_time_limit_ids uuid[] DEFAULT NULL,
    scenario_persona_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    simulation_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_simulation_id uuid;
    v_actor_name text;
    v_group_id uuid;
    v_profile_id uuid;
    v_input_simulation_id uuid;
    is_create boolean;
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
BEGIN
    -- Assign parameters to local variables
    v_profile_id := profile_id;
    v_group_id := group_id;
    v_input_simulation_id := input_simulation_id;
    v_name_id := name_id;
    v_description_id := description_id;
    v_flag_ids := COALESCE(flag_ids, ARRAY[]::uuid[]);
    v_department_ids := COALESCE(department_ids, ARRAY[]::uuid[]);
    v_scenario_ids := COALESCE(scenario_ids, ARRAY[]::uuid[]);
    v_scenario_flag_ids := COALESCE(scenario_flag_ids, ARRAY[]::uuid[]);
    v_scenario_position_ids := COALESCE(scenario_position_ids, ARRAY[]::uuid[]);
    v_scenario_rubric_ids := COALESCE(scenario_rubric_ids, ARRAY[]::uuid[]);
    v_scenario_time_limit_ids := COALESCE(scenario_time_limit_ids, ARRAY[]::uuid[]);
    v_scenario_persona_ids := COALESCE(scenario_persona_ids, ARRAY[]::uuid[]);

    -- Validate required fields
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'name_id is required';
    END IF;

    -- Determine if create or update
    is_create := (v_input_simulation_id IS NULL);

    -- Create or UPDATE simulation_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO simulation_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_simulation_id;
        -- Link group via junction table
        INSERT INTO simulation_groups_junction (simulation_id, group_id)
        VALUES (v_simulation_id, v_group_id)
        ON CONFLICT DO NOTHING;
    ELSE
        -- UPDATE path
        v_simulation_id := v_input_simulation_id;
        UPDATE simulation_artifact
        SET updated_at = NOW()
        WHERE id = v_simulation_id;

        -- Check if simulation exists (must be right after UPDATE, before any other statements)
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Simulation not found: %', v_input_simulation_id;
        END IF;

        -- Upsert group via junction table
        INSERT INTO simulation_groups_junction (simulation_id, group_id)
        VALUES (v_simulation_id, v_group_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Validate required resource IDs exist
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF array_length(v_flag_ids, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_flag_ids) AS fid
            WHERE NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = fid)
        ) THEN
            RAISE EXCEPTION 'One or more flag_ids not found';
        END IF;
    END IF;

    IF array_length(v_scenario_ids, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_scenario_ids) AS sid
            WHERE NOT EXISTS (SELECT 1 FROM scenarios_resource WHERE id = sid)
        ) THEN
            RAISE EXCEPTION 'One or more scenario_ids not found';
        END IF;
    END IF;

    IF array_length(v_scenario_flag_ids, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_scenario_flag_ids) AS scenario_flag_id
            WHERE NOT EXISTS (SELECT 1 FROM scenario_flags_resource WHERE id = scenario_flag_id)
        ) THEN
            RAISE EXCEPTION 'One or more scenario_flag_ids not found';
        END IF;
    END IF;

    IF array_length(v_scenario_position_ids, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_scenario_position_ids) AS scenario_position_id
            WHERE NOT EXISTS (SELECT 1 FROM scenario_positions_resource WHERE id = scenario_position_id)
        ) THEN
            RAISE EXCEPTION 'One or more scenario_position_ids not found';
        END IF;
    END IF;

    IF array_length(v_scenario_rubric_ids, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_scenario_rubric_ids) AS scenario_rubric_id
            WHERE NOT EXISTS (SELECT 1 FROM scenario_rubrics_resource WHERE id = scenario_rubric_id)
        ) THEN
            RAISE EXCEPTION 'One or more scenario_rubric_ids not found';
        END IF;
    END IF;

    IF array_length(v_scenario_time_limit_ids, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_scenario_time_limit_ids) AS scenario_time_limit_id
            WHERE NOT EXISTS (SELECT 1 FROM scenario_time_limits_resource WHERE id = scenario_time_limit_id)
        ) THEN
            RAISE EXCEPTION 'One or more scenario_time_limit_ids not found';
        END IF;
    END IF;

    IF array_length(v_scenario_persona_ids, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_scenario_persona_ids) AS scenario_persona_id
            WHERE NOT EXISTS (SELECT 1 FROM scenario_personas_resource WHERE id = scenario_persona_id)
        ) THEN
            RAISE EXCEPTION 'One or more scenario_persona_ids not found';
        END IF;
    END IF;

    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM simulation_names_junction WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_descriptions_junction WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_departments_junction WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_flags_junction WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_scenarios_junction WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_scenario_flags_junction WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_scenario_positions_junction WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_scenario_rubrics_junction WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_scenario_time_limits_junction WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_scenario_personas_junction WHERE simulation_id = v_simulation_id;
    END IF;

    -- Continue with simulation save using SQL (simulation already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_simulation_id AS simulation_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_flag_ids AS flag_ids,
            v_department_ids AS department_ids,
            v_scenario_ids AS scenario_ids,
            v_scenario_flag_ids AS scenario_flag_ids,
            v_scenario_position_ids AS scenario_position_ids,
            v_scenario_rubric_ids AS scenario_rubric_ids,
            v_scenario_time_limit_ids AS scenario_time_limit_ids,
            v_scenario_persona_ids AS scenario_persona_ids,
            v_profile_id AS profile_id
    ),
    user_profile AS (
        SELECT role, actor_name
        FROM view_user_profile_context
        WHERE profile_id = (SELECT profile_id FROM params)
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM simulation_departments_junction
        WHERE simulation_departments_junction.simulation_id = (SELECT p.simulation_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments_junction
        WHERE profile_departments_junction.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT
            CASE
                WHEN (SELECT p.simulation_id FROM params p) IS NULL THEN
                    -- Validate create permissions
                    (SELECT validate_department_create_permissions(
                        up.role::text,
                        x.department_ids::text[]
                    ) FROM params x CROSS JOIN user_profile up)
                ELSE
                    -- Validate update permissions
                    (SELECT validate_department_update_permissions(
                        up.role::text,
                        ocd.department_ids,
                        ud.department_ids
                    ) FROM user_profile up
                    CROSS JOIN object_current_departments ocd
                    CROSS JOIN user_departments ud)
            END as validation_passed
    ),
    assert_permissions AS (
        SELECT 1
        FROM validate_permissions
        WHERE validation_passed = true
    ),
    actor_profile AS (
        SELECT
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link simulation name (resource ID already validated)
    link_simulation_name AS (
        INSERT INTO simulation_names_junction (simulation_id, name_id, created_at)
        SELECT
            x.simulation_id,
            x.name_id,
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT simulation_names_pkey DO NOTHING
    ),
    -- Link simulation description (resource ID already validated)
    link_simulation_description AS (
        INSERT INTO simulation_descriptions_junction (simulation_id, description_id, created_at)
        SELECT
            x.simulation_id,
            x.description_id,
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT simulation_descriptions_pkey DO NOTHING
    ),
    -- Link simulation flags (resource IDs already validated)
    link_simulation_flags AS (
        INSERT INTO simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp)
        SELECT
            x.simulation_id,
            flag_id,
            true,
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN UNNEST(x.flag_ids) AS flag_id
        WHERE COALESCE(array_length(x.flag_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_flags_pkey DO UPDATE SET value = EXCLUDED.value
    ),
    link_departments AS (
        INSERT INTO simulation_departments_junction (simulation_id, department_id, active, created_at)
        SELECT
            x.simulation_id,
            dept_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_departments_pkey DO UPDATE SET
            active = true
    ),
    link_scenarios AS (
        INSERT INTO simulation_scenarios_junction (simulation_id, scenario_id, active, created_at)
        SELECT
            x.simulation_id,
            scenario_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.scenario_ids) as scenario_id
        WHERE COALESCE(array_length(x.scenario_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenarios_pkey DO UPDATE SET
            active = true
    ),
    link_scenario_flags AS (
        INSERT INTO simulation_scenario_flags_junction (
            simulation_id,
            scenario_flag_id,
            value,
            created_at,
            generated,
            mcp,
            active
        )
        SELECT
            x.simulation_id,
            scenario_flag_id,
            true,
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN UNNEST(x.scenario_flag_ids) as scenario_flag_id
        WHERE COALESCE(array_length(x.scenario_flag_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_flags_new_pkey DO UPDATE SET
            value = EXCLUDED.value
    ),
    link_scenario_positions AS (
        INSERT INTO simulation_scenario_positions_junction (
            simulation_id,
            scenario_position_id,
            created_at,
            generated,
            mcp,
            active
        )
        SELECT
            x.simulation_id,
            scenario_position_id,
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN UNNEST(x.scenario_position_ids) as scenario_position_id
        WHERE COALESCE(array_length(x.scenario_position_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_positions_pkey DO UPDATE SET
            active = true
    ),
    link_scenario_rubrics AS (
        INSERT INTO simulation_scenario_rubrics_junction (simulation_id, scenario_rubric_id, created_at, generated, mcp, active)
        SELECT
            x.simulation_id,
            scenario_rubric_id,
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN UNNEST(x.scenario_rubric_ids) as scenario_rubric_id
        WHERE COALESCE(array_length(x.scenario_rubric_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_rubrics_pkey DO UPDATE SET
            active = true
    ),
    link_scenario_time_limits AS (
        INSERT INTO simulation_scenario_time_limits_junction (
            simulation_id,
            scenario_time_limit_id,
            created_at,
            generated,
            mcp,
            active
        )
        SELECT
            x.simulation_id,
            scenario_time_limit_id,
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN UNNEST(x.scenario_time_limit_ids) as scenario_time_limit_id
        WHERE COALESCE(array_length(x.scenario_time_limit_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_time_limits_pkey DO UPDATE SET
            active = true
    ),
    link_scenario_personas AS (
        INSERT INTO simulation_scenario_personas_junction (
            simulation_id,
            scenario_persona_id,
            created_at,
            generated,
            mcp,
            active
        )
        SELECT
            x.simulation_id,
            scenario_persona_id,
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN UNNEST(x.scenario_persona_ids) as scenario_persona_id
        WHERE COALESCE(array_length(x.scenario_persona_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_personas_pkey DO UPDATE SET
            active = true
    ),
    -- Sync linked resources with name/description
    sync_artifact_resources AS (
        UPDATE simulations_resource r
        SET name = n.name,
            description = d.description
        FROM simulation_simulations_junction j
        CROSS JOIN params p
        LEFT JOIN names_resource n ON n.id = p.name_id
        LEFT JOIN descriptions_resource d ON d.id = p.description_id
        WHERE j.simulations_id = r.id
          AND j.simulation_id = p.simulation_id
        RETURNING r.id
    )
    SELECT
        x.simulation_id AS simulation_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap
    CROSS JOIN assert_permissions ap_check;
END;
$$;
