-- Unified save simulation function - handles both create (input_simulation_id = NULL) and update (input_simulation_id provided)
-- Converted to function following personas/save_persona_complete.sql pattern
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
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

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_save_simulation_v4(
    draft_id uuid,
    profile_id uuid,
    input_simulation_id uuid DEFAULT NULL
)
RETURNS TABLE (
    simulation_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_simulation_id uuid;
    v_actor_name text;
    is_create boolean;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_practice_flag_id uuid;
    v_department_ids uuid[];
    v_scenario_ids uuid[];
    v_scenario_flag_ids uuid[];
    v_scenario_position_ids uuid[];
    v_scenario_rubric_ids uuid[];
    v_scenario_time_limit_ids uuid[];
BEGIN
    IF draft_id IS NULL THEN
        RAISE EXCEPTION 'draft_id is required';
    END IF;

    SELECT dn.names_id
    INTO v_name_id
    FROM draft_names dn
    WHERE dn.draft_id = draft_id
    LIMIT 1;

    SELECT dd.descriptions_id
    INTO v_description_id
    FROM draft_descriptions dd
    WHERE dd.draft_id = draft_id
    LIMIT 1;

    SELECT df.flags_id
    INTO v_active_flag_id
    FROM draft_flags df
    JOIN flags_resource f ON f.id = df.flags_id
    WHERE df.draft_id = draft_id
      AND f.name = 'active'
    LIMIT 1;

    SELECT df.flags_id
    INTO v_practice_flag_id
    FROM draft_flags df
    JOIN flags_resource f ON f.id = df.flags_id
    WHERE df.draft_id = draft_id
      AND f.name = 'practice'
    LIMIT 1;

    SELECT COALESCE(ARRAY_AGG(dd.departments_id ORDER BY dd.created_at), ARRAY[]::uuid[])
    INTO v_department_ids
    FROM draft_departments dd
    WHERE dd.draft_id = draft_id;

    SELECT COALESCE(ARRAY_AGG(ds.scenarios_id ORDER BY ds.created_at), ARRAY[]::uuid[])
    INTO v_scenario_ids
    FROM draft_scenarios ds
    WHERE ds.draft_id = draft_id;

    SELECT COALESCE(ARRAY_AGG(dsf.scenario_flags_id ORDER BY dsf.created_at), ARRAY[]::uuid[])
    INTO v_scenario_flag_ids
    FROM draft_scenario_flags dsf
    WHERE dsf.draft_id = draft_id;

    SELECT COALESCE(ARRAY_AGG(dsp.scenario_position_id ORDER BY dsp.created_at), ARRAY[]::uuid[])
    INTO v_scenario_position_ids
    FROM draft_scenario_positions dsp
    WHERE dsp.draft_id = draft_id;

    SELECT COALESCE(ARRAY_AGG(dsr.scenario_rubric_id ORDER BY dsr.created_at), ARRAY[]::uuid[])
    INTO v_scenario_rubric_ids
    FROM draft_scenario_rubrics dsr
    WHERE dsr.draft_id = draft_id;

    SELECT COALESCE(ARRAY_AGG(dstl.scenario_time_limit_id ORDER BY dstl.created_at), ARRAY[]::uuid[])
    INTO v_scenario_time_limit_ids
    FROM draft_scenario_time_limits dstl
    WHERE dstl.draft_id = draft_id;

    -- Determine if create or update
    is_create := (input_simulation_id IS NULL);

    -- Create or UPDATE simulation_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO simulation_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_simulation_id;
    ELSE
        -- UPDATE path
        v_simulation_id := input_simulation_id;
        UPDATE simulation_artifact
        SET updated_at = NOW()
        WHERE id = v_simulation_id;

        -- Check if simulation exists
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Simulation not found: %', input_simulation_id;
        END IF;
    END IF;

    -- Validate required resource IDs exist
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    IF v_practice_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_practice_flag_id) THEN
        RAISE EXCEPTION 'Practice flag resource not found: %', v_practice_flag_id;
    END IF;

    IF array_length(v_scenario_ids, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_scenario_ids) AS scenario_id
            WHERE NOT EXISTS (SELECT 1 FROM scenarios_resource WHERE id = scenario_id)
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

    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM simulation_names WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_descriptions WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_departments WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_flags WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_scenarios WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_scenario_flags WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_scenario_positions WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_scenario_rubrics WHERE simulation_id = v_simulation_id;
        DELETE FROM simulation_scenario_time_limits WHERE simulation_id = v_simulation_id;
    END IF;

    -- Continue with simulation save using SQL (simulation already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_simulation_id AS simulation_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_active_flag_id AS active_flag_id,
            v_practice_flag_id AS practice_flag_id,
            COALESCE(v_department_ids, ARRAY[]::uuid[]) AS department_ids,
            COALESCE(v_scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
            COALESCE(v_scenario_flag_ids, ARRAY[]::uuid[]) AS scenario_flag_ids,
            COALESCE(v_scenario_position_ids, ARRAY[]::uuid[]) AS scenario_position_ids,
            COALESCE(v_scenario_rubric_ids, ARRAY[]::uuid[]) AS scenario_rubric_ids,
            COALESCE(v_scenario_time_limit_ids, ARRAY[]::uuid[]) AS scenario_time_limit_ids,
            profile_id
    ),
    user_profile AS (
        SELECT 
            (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
            COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
        FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM simulation_departments
        WHERE simulation_departments.simulation_id = (SELECT p.simulation_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments
        WHERE profile_departments.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
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
        INSERT INTO simulation_names (simulation_id, name_id, created_at, updated_at)
        SELECT 
            x.simulation_id,
            x.name_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT simulation_names_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link simulation description (resource ID already validated)
    link_simulation_description AS (
        INSERT INTO simulation_descriptions (simulation_id, description_id, created_at, updated_at)
        SELECT 
            x.simulation_id,
            x.description_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT simulation_descriptions_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link simulation flags (resource ID already validated)
    link_simulation_active_flag AS (
        INSERT INTO simulation_flags (simulation_id, flag_id, value, created_at, updated_at, generated, mcp)
        SELECT 
            x.simulation_id,
            x.active_flag_id,
            true,
            NOW(),
            NOW(),
            false,
            false
        FROM params x
        WHERE x.active_flag_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT simulation_flags_pkey DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    ),
    link_simulation_practice_flag AS (
        INSERT INTO simulation_flags (simulation_id, flag_id, value, created_at, updated_at, generated, mcp)
        SELECT 
            x.simulation_id,
            x.practice_flag_id,
            true,
            NOW(),
            NOW(),
            false,
            false
        FROM params x
        WHERE x.practice_flag_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT simulation_flags_pkey DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    ),
    link_departments AS (
        INSERT INTO simulation_departments (simulation_id, department_id, active, created_at, updated_at)
        SELECT 
            x.simulation_id,
            dept_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_departments_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    link_scenarios AS (
        INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, created_at, updated_at)
        SELECT 
            x.simulation_id,
            scenario_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.scenario_ids) as scenario_id
        WHERE COALESCE(array_length(x.scenario_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenarios_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    link_scenario_flags AS (
        INSERT INTO simulation_scenario_flags (
            simulation_id,
            scenario_flag_id,
            value,
            created_at,
            updated_at,
            generated,
            mcp,
            active
        )
        SELECT 
            x.simulation_id,
            scenario_flag_id,
            true,
            NOW(),
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN UNNEST(x.scenario_flag_ids) as scenario_flag_id
        WHERE COALESCE(array_length(x.scenario_flag_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_flags_new_pkey DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    link_scenario_positions AS (
        INSERT INTO simulation_scenario_positions (
            simulation_id,
            scenario_position_id,
            created_at,
            updated_at,
            generated,
            mcp,
            active
        )
        SELECT
            x.simulation_id,
            scenario_position_id,
            NOW(),
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN UNNEST(x.scenario_position_ids) as scenario_position_id
        WHERE COALESCE(array_length(x.scenario_position_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_positions_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    link_scenario_rubrics AS (
        INSERT INTO simulation_scenario_rubrics (simulation_id, scenario_rubric_id, created_at, updated_at, generated, mcp, active)
        SELECT 
            x.simulation_id,
            scenario_rubric_id,
            NOW(),
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN UNNEST(x.scenario_rubric_ids) as scenario_rubric_id
        WHERE COALESCE(array_length(x.scenario_rubric_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_rubrics_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    link_scenario_time_limits AS (
        INSERT INTO simulation_scenario_time_limits (
            simulation_id,
            scenario_time_limit_id,
            created_at,
            updated_at,
            generated,
            mcp,
            active
        )
        SELECT
            x.simulation_id,
            scenario_time_limit_id,
            NOW(),
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN UNNEST(x.scenario_time_limit_ids) as scenario_time_limit_id
        WHERE COALESCE(array_length(x.scenario_time_limit_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT simulation_scenario_time_limits_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    )
    SELECT 
        x.simulation_id AS simulation_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap
    CROSS JOIN assert_permissions ap_check;
END;
$$;
