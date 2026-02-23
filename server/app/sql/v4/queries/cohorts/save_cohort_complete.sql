-- Unified save cohort function - handles create/update with nested resource actions.
-- Includes tool-call tracking for create/link operations.

-- Ensure cohort composite types exist before function creation.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'types'
          AND t.typname = 'cohort_resource_action'
    ) THEN
        CREATE TYPE types.cohort_resource_action AS (
            resource_id uuid,
            create_tool_id uuid,
            link_tool_id uuid
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'types'
          AND t.typname = 'cohort_multi_resource_action'
    ) THEN
        CREATE TYPE types.cohort_multi_resource_action AS (
            resource_ids uuid[],
            create_tool_id uuid,
            link_tool_id uuid
        );
    END IF;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_save_cohort_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_cohort_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_cohort_v4(
    profile_id uuid,
    group_id uuid,
    input_cohort_id uuid DEFAULT NULL,
    names types.cohort_resource_action DEFAULT NULL,
    descriptions types.cohort_resource_action DEFAULT NULL,
    flags types.cohort_resource_action DEFAULT NULL,
    departments types.cohort_multi_resource_action DEFAULT NULL,
    simulations types.cohort_multi_resource_action DEFAULT NULL,
    simulation_positions types.cohort_multi_resource_action DEFAULT NULL,
    simulation_availability types.cohort_multi_resource_action DEFAULT NULL,
    profiles types.cohort_multi_resource_action DEFAULT NULL,
    profile_personas types.cohort_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    out_cohort_id uuid,
    out_actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_profile_id uuid := profile_id;
    v_group_id uuid := group_id;
    v_input_cohort_id uuid := input_cohort_id;

    v_name_id uuid := (names).resource_id;
    v_description_id uuid := (descriptions).resource_id;
    v_active_flag_id uuid := (flags).resource_id;
    v_department_ids uuid[] := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_simulation_ids uuid[] := COALESCE((simulations).resource_ids, ARRAY[]::uuid[]);
    v_simulation_position_ids uuid[] := COALESCE((simulation_positions).resource_ids, ARRAY[]::uuid[]);
    v_simulation_availability_ids uuid[] := COALESCE((simulation_availability).resource_ids, ARRAY[]::uuid[]);
    v_profile_ids uuid[] := COALESCE((profiles).resource_ids, ARRAY[]::uuid[]);
    v_profile_persona_ids uuid[] := COALESCE((profile_personas).resource_ids, ARRAY[]::uuid[]);

    v_user_role text;
    v_cohort_id uuid;
    v_object_department_ids text[];
    v_user_department_ids text[];
    is_create boolean;

    v_run_id uuid;
    v_call_id uuid;
BEGIN
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    -- Resolve user role from profile
    SELECT r.role::text INTO v_user_role
    FROM profile_roles_junction prj
    JOIN roles_resource r ON r.id = prj.role_id
    WHERE prj.profile_id = v_profile_id
      AND prj.active = true
    LIMIT 1;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'User context not found for profile: %', v_profile_id;
    END IF;

    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_department_ids) AS dept_id
        WHERE NOT EXISTS (
            SELECT 1
            FROM departments_resource dr
            WHERE dr.id = dept_id OR dept_id = ANY(dr.department_ids)
        )
    ) THEN
        RAISE EXCEPTION 'Department resource not found for one or more IDs';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_simulation_ids) AS sim_id
        WHERE NOT EXISTS (SELECT 1 FROM simulations_resource sr WHERE sr.id = sim_id)
    ) THEN
        RAISE EXCEPTION 'Simulation artifact not found for one or more IDs';
    END IF;

    is_create := (v_input_cohort_id IS NULL);

    IF is_create THEN
        PERFORM validate_department_create_permissions(
            v_user_role,
            ARRAY(SELECT unnest(v_department_ids)::text)
        );

        INSERT INTO cohort_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_cohort_id;
    ELSE
        v_cohort_id := v_input_cohort_id;

        IF NOT EXISTS (SELECT 1 FROM cohort_artifact WHERE id = v_cohort_id) THEN
            RAISE EXCEPTION 'Cohort not found: %', v_cohort_id;
        END IF;

        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[])
        INTO v_object_department_ids
        FROM cohort_departments_junction
        WHERE cohort_departments_junction.cohort_id = v_cohort_id
          AND cohort_departments_junction.active = true;

        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[])
        INTO v_user_department_ids
        FROM profile_departments_junction
        WHERE profile_departments_junction.profile_id = v_profile_id
          AND profile_departments_junction.active = true;

        IF NOT validate_department_update_permissions(
            v_user_role,
            COALESCE(v_object_department_ids, ARRAY[]::text[]),
            COALESCE(v_user_department_ids, ARRAY[]::text[])
        ) THEN
            RAISE EXCEPTION 'DEPARTMENT_PERMISSION_DENIED';
        END IF;

        UPDATE cohort_artifact
        SET updated_at = NOW()
        WHERE id = v_cohort_id;

        UPDATE cohort_names_junction
        SET active = false
        WHERE cohort_id = v_cohort_id AND active = true;

        UPDATE cohort_descriptions_junction
        SET active = false
        WHERE cohort_id = v_cohort_id AND active = true;

        UPDATE cohort_flags_junction
        SET active = false
        WHERE cohort_id = v_cohort_id AND active = true;

        UPDATE cohort_departments_junction
        SET active = false
        WHERE cohort_id = v_cohort_id AND active = true;

        UPDATE cohort_simulations_junction
        SET active = false
        WHERE cohort_id = v_cohort_id AND active = true;

        UPDATE cohort_simulation_positions_junction
        SET active = false
        WHERE cohort_id = v_cohort_id AND active = true;

        UPDATE cohort_simulation_availability_junction
        SET active = false
        WHERE cohort_id = v_cohort_id AND active = true;

        UPDATE cohort_profiles_junction
        SET active = false
        WHERE cohort_id = v_cohort_id AND active = true;

        UPDATE cohort_profile_personas_junction
        SET active = false
        WHERE cohort_id = v_cohort_id AND active = true;
    END IF;

    IF v_name_id IS NOT NULL THEN
        INSERT INTO cohort_names_junction (cohort_id, name_id, created_at, active)
        VALUES (v_cohort_id, v_name_id, NOW(), true)
        ON CONFLICT ON CONSTRAINT cohort_names_pkey DO UPDATE SET active = true;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO cohort_descriptions_junction (cohort_id, description_id, created_at, active)
        VALUES (v_cohort_id, v_description_id, NOW(), true)
        ON CONFLICT ON CONSTRAINT cohort_descriptions_pkey DO UPDATE SET active = true;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO cohort_flags_junction (cohort_id, flag_id, value, created_at, active)
        VALUES (v_cohort_id, v_active_flag_id, true, NOW(), true)
        ON CONFLICT ON CONSTRAINT cohort_flags_pkey DO UPDATE
        SET value = EXCLUDED.value,
            active = true;
    END IF;

    INSERT INTO cohort_departments_junction (cohort_id, department_id, active, created_at)
    SELECT v_cohort_id, dept_id, true, NOW()
    FROM UNNEST(v_department_ids) AS dept_id
    ON CONFLICT ON CONSTRAINT cohort_departments_pkey DO UPDATE
    SET active = true;

    INSERT INTO cohort_simulations_junction (cohort_id, simulation_id, active, created_at)
    SELECT v_cohort_id, sim_id, true, NOW()
    FROM UNNEST(v_simulation_ids) AS sim_id
    ON CONFLICT ON CONSTRAINT cohort_simulations_pkey DO UPDATE
    SET active = true;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_simulation_position_ids) AS sp_id
        WHERE NOT EXISTS (SELECT 1 FROM simulation_positions_resource spr WHERE spr.id = sp_id)
    ) THEN
        RAISE EXCEPTION 'Simulation position resource not found';
    END IF;

    INSERT INTO cohort_simulation_positions_junction (
        cohort_id,
        simulation_position_id,
        active,
        created_at,
        generated,
        mcp
    )
    SELECT v_cohort_id, sp_id, true, NOW(), false, false
    FROM UNNEST(v_simulation_position_ids) AS sp_id
    ON CONFLICT ON CONSTRAINT cohort_simulation_positions_pkey DO UPDATE
    SET active = true;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_simulation_availability_ids) AS sa_id
        WHERE NOT EXISTS (SELECT 1 FROM simulation_availability_resource sar WHERE sar.id = sa_id)
    ) THEN
        RAISE EXCEPTION 'Simulation availability resource not found';
    END IF;

    INSERT INTO cohort_simulation_availability_junction (
        cohort_id,
        simulation_availability_id,
        active,
        created_at,
        generated,
        mcp
    )
    SELECT v_cohort_id, sa_id, true, NOW(), false, false
    FROM UNNEST(v_simulation_availability_ids) AS sa_id
    ON CONFLICT ON CONSTRAINT cohort_simulation_availability_junction_pkey DO UPDATE
    SET active = true;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_profile_ids) AS p_id
        WHERE NOT EXISTS (SELECT 1 FROM profiles_resource pr WHERE pr.id = p_id)
    ) THEN
        RAISE EXCEPTION 'Profile resource not found';
    END IF;

    INSERT INTO cohort_profiles_junction (
        cohort_id,
        profiles_id,
        active,
        created_at,
        generated,
        mcp
    )
    SELECT v_cohort_id, p_id, true, NOW(), false, false
    FROM UNNEST(v_profile_ids) AS p_id
    ON CONFLICT ON CONSTRAINT cohort_profiles_junction_pkey DO UPDATE
    SET active = true;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_profile_persona_ids) AS pp_id
        WHERE NOT EXISTS (SELECT 1 FROM profile_personas_resource ppr WHERE ppr.id = pp_id)
    ) THEN
        RAISE EXCEPTION 'Profile persona resource not found';
    END IF;

    INSERT INTO cohort_profile_personas_junction (
        cohort_id,
        profile_persona_id,
        active,
        created_at,
        generated,
        mcp
    )
    SELECT v_cohort_id, pp_id, true, NOW(), false, false
    FROM UNNEST(v_profile_persona_ids) AS pp_id
    ON CONFLICT ON CONSTRAINT cohort_profile_personas_junction_pkey DO UPDATE
    SET active = true;

    UPDATE cohorts_resource r
    SET name = n.name,
        description = d.description
    FROM cohort_cohorts_junction j
    LEFT JOIN names_resource n ON n.id = v_name_id
    LEFT JOIN descriptions_resource d ON d.id = v_description_id
    WHERE j.cohorts_id = r.id
      AND j.cohort_id = v_cohort_id;

    IF (
        (names).create_tool_id IS NOT NULL OR (names).link_tool_id IS NOT NULL OR
        (descriptions).create_tool_id IS NOT NULL OR (descriptions).link_tool_id IS NOT NULL OR
        (flags).create_tool_id IS NOT NULL OR (flags).link_tool_id IS NOT NULL OR
        (departments).create_tool_id IS NOT NULL OR (departments).link_tool_id IS NOT NULL OR
        (simulations).create_tool_id IS NOT NULL OR (simulations).link_tool_id IS NOT NULL OR
        (simulation_positions).create_tool_id IS NOT NULL OR (simulation_positions).link_tool_id IS NOT NULL OR
        (simulation_availability).create_tool_id IS NOT NULL OR (simulation_availability).link_tool_id IS NOT NULL OR
        (profiles).create_tool_id IS NOT NULL OR (profiles).link_tool_id IS NOT NULL OR
        (profile_personas).create_tool_id IS NOT NULL OR (profile_personas).link_tool_id IS NOT NULL
    ) THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, v_group_id, NOW(), NOW());

        IF v_name_id IS NOT NULL AND (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;

        IF v_name_id IS NOT NULL AND (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;

        IF v_description_id IS NOT NULL AND (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;

        IF v_description_id IS NOT NULL AND (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;

        IF v_active_flag_id IS NOT NULL AND (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;

        IF v_active_flag_id IS NOT NULL AND (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;

        IF COALESCE(array_length(v_simulation_ids, 1), 0) > 0 AND (simulations).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_simulations_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((simulations).create_tool_id, v_call_id);
            INSERT INTO simulations_calls_connection (simulations_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_simulation_ids) sid;
        END IF;

        IF COALESCE(array_length(v_simulation_ids, 1), 0) > 0 AND (simulations).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_simulations_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((simulations).link_tool_id, v_call_id);
            INSERT INTO simulations_calls_connection (simulations_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_simulation_ids) sid;
        END IF;

        IF COALESCE(array_length(v_simulation_position_ids, 1), 0) > 0 AND (simulation_positions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_simulation_positions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((simulation_positions).create_tool_id, v_call_id);
            INSERT INTO simulation_positions_calls_connection (simulation_positions_id, call_id)
            SELECT spid, v_call_id FROM UNNEST(v_simulation_position_ids) spid;
        END IF;

        IF COALESCE(array_length(v_simulation_position_ids, 1), 0) > 0 AND (simulation_positions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_simulation_positions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((simulation_positions).link_tool_id, v_call_id);
            INSERT INTO simulation_positions_calls_connection (simulation_positions_id, call_id)
            SELECT spid, v_call_id FROM UNNEST(v_simulation_position_ids) spid;
        END IF;

        IF COALESCE(array_length(v_simulation_availability_ids, 1), 0) > 0 AND (simulation_availability).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_simulation_availability_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((simulation_availability).create_tool_id, v_call_id);
            INSERT INTO simulation_availability_calls_connection (simulation_availability_id, call_id)
            SELECT said, v_call_id FROM UNNEST(v_simulation_availability_ids) said;
        END IF;

        IF COALESCE(array_length(v_simulation_availability_ids, 1), 0) > 0 AND (simulation_availability).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_simulation_availability_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((simulation_availability).link_tool_id, v_call_id);
            INSERT INTO simulation_availability_calls_connection (simulation_availability_id, call_id)
            SELECT said, v_call_id FROM UNNEST(v_simulation_availability_ids) said;
        END IF;

        IF COALESCE(array_length(v_profile_ids, 1), 0) > 0 AND (profiles).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_profiles_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((profiles).create_tool_id, v_call_id);
            INSERT INTO profiles_calls_connection (profiles_id, call_id)
            SELECT pid, v_call_id FROM UNNEST(v_profile_ids) pid;
        END IF;

        IF COALESCE(array_length(v_profile_ids, 1), 0) > 0 AND (profiles).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_profiles_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((profiles).link_tool_id, v_call_id);
            INSERT INTO profiles_calls_connection (profiles_id, call_id)
            SELECT pid, v_call_id FROM UNNEST(v_profile_ids) pid;
        END IF;

        IF COALESCE(array_length(v_profile_persona_ids, 1), 0) > 0 AND (profile_personas).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_profile_personas_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((profile_personas).create_tool_id, v_call_id);
            INSERT INTO profile_personas_calls_connection (profile_personas_id, call_id)
            SELECT ppid, v_call_id FROM UNNEST(v_profile_persona_ids) ppid;
        END IF;

        IF COALESCE(array_length(v_profile_persona_ids, 1), 0) > 0 AND (profile_personas).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_profile_personas_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((profile_personas).link_tool_id, v_call_id);
            INSERT INTO profile_personas_calls_connection (profile_personas_id, call_id)
            SELECT ppid, v_call_id FROM UNNEST(v_profile_persona_ids) ppid;
        END IF;
    END IF;

    RETURN QUERY
    SELECT v_cohort_id, NULL::text;
END;
$$;

