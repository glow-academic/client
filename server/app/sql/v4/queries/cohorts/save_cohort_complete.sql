-- Unified save cohort function - handles create/update with nested resource actions.
-- Includes tool-call tracking for create/link operations.

DO $$
BEGIN
    DROP TYPE IF EXISTS types.cohort_resource_action CASCADE;
    CREATE TYPE types.cohort_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.cohort_multi_resource_action CASCADE;
    CREATE TYPE types.cohort_multi_resource_action AS (
        resource_ids uuid[],
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
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
    simulation_position_values int[] DEFAULT NULL
)
RETURNS TABLE (
    cohort_id uuid,
    actor_name text
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
    v_simulation_position_simulation_ids uuid[] := COALESCE((simulation_positions).resource_ids, COALESCE((simulations).resource_ids, ARRAY[]::uuid[]));
    v_simulation_position_values int[] := COALESCE(simulation_position_values, ARRAY[]::int[]);

    v_cohort_id uuid;
    v_user_role text;
    v_actor_name text;
    v_object_department_ids text[];
    v_user_department_ids text[];
    is_create boolean;

    v_run_id uuid;
    v_call_id uuid;
    v_simulation_position_ids uuid[] := ARRAY[]::uuid[];
BEGIN
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    SELECT role, actor_name
    INTO v_user_role, v_actor_name
    FROM view_user_profile_context
    WHERE view_user_profile_context.profile_id = v_profile_id
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
            WHERE dr.id = dept_id OR dr.department_id = dept_id
        )
    ) THEN
        RAISE EXCEPTION 'Department resource not found for one or more IDs';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_simulation_ids) AS sim_id
        WHERE NOT EXISTS (SELECT 1 FROM simulation_artifact sa WHERE sa.id = sim_id)
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
    END IF;

    INSERT INTO cohort_groups_junction (cohort_id, group_id, created_at, active)
    VALUES (v_cohort_id, v_group_id, NOW(), true)
    ON CONFLICT DO NOTHING;

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

    WITH simulation_positions_upsert AS (
        INSERT INTO simulation_positions_resource (
            simulation_id,
            value,
            created_at,
            generated,
            mcp,
            call_id
        )
        SELECT
            sim.simulation_id,
            COALESCE(v_simulation_position_values[sim.ordinality], sim.ordinality),
            NOW(),
            false,
            false,
            (SELECT id FROM view_calls_entry LIMIT 1)
        FROM UNNEST(v_simulation_position_simulation_ids) WITH ORDINALITY AS sim(simulation_id, ordinality)
        ON CONFLICT (simulation_id, value) DO UPDATE SET created_at = EXCLUDED.created_at
        RETURNING id
    )
    SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::uuid[])
    INTO v_simulation_position_ids
    FROM simulation_positions_upsert;

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
        (simulation_positions).create_tool_id IS NOT NULL OR (simulation_positions).link_tool_id IS NOT NULL
    ) THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, v_group_id, NOW(), NOW());

        IF v_name_id IS NOT NULL AND (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;

        IF v_name_id IS NOT NULL AND (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;

        IF v_description_id IS NOT NULL AND (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;

        IF v_description_id IS NOT NULL AND (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;

        IF v_active_flag_id IS NOT NULL AND (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;

        IF v_active_flag_id IS NOT NULL AND (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;

        IF COALESCE(array_length(v_simulation_ids, 1), 0) > 0 AND (simulations).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_simulations_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((simulations).create_tool_id, v_call_id);
            INSERT INTO simulations_calls_connection (simulations_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_simulation_ids) sid;
        END IF;

        IF COALESCE(array_length(v_simulation_ids, 1), 0) > 0 AND (simulations).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_simulations_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((simulations).link_tool_id, v_call_id);
            INSERT INTO simulations_calls_connection (simulations_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_simulation_ids) sid;
        END IF;

        IF COALESCE(array_length(v_simulation_position_ids, 1), 0) > 0 AND (simulation_positions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_create_simulation_positions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((simulation_positions).create_tool_id, v_call_id);
            INSERT INTO simulation_positions_calls_connection (simulation_positions_id, call_id)
            SELECT spid, v_call_id FROM UNNEST(v_simulation_position_ids) spid;
        END IF;

        IF COALESCE(array_length(v_simulation_position_ids, 1), 0) > 0 AND (simulation_positions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_save_link_simulation_positions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((simulation_positions).link_tool_id, v_call_id);
            INSERT INTO simulation_positions_calls_connection (simulation_positions_id, call_id)
            SELECT spid, v_call_id FROM UNNEST(v_simulation_position_ids) spid;
        END IF;
    END IF;

    RETURN QUERY
    SELECT v_cohort_id, v_actor_name;
END;
$$;
