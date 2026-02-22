-- Patch cohort draft - nested resource actions with tool-call tracking.

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
        WHERE proname = 'api_patch_cohort_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_cohort_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_cohort_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.cohort_resource_action DEFAULT NULL,
    descriptions types.cohort_resource_action DEFAULT NULL,
    flags types.cohort_resource_action DEFAULT NULL,
    departments types.cohort_multi_resource_action DEFAULT NULL,
    simulations types.cohort_multi_resource_action DEFAULT NULL,
    simulation_positions types.cohort_multi_resource_action DEFAULT NULL,
    simulation_availability types.cohort_multi_resource_action DEFAULT NULL,
    expected_version int DEFAULT 0
)
RETURNS TABLE (
    draft_id uuid,
    new_version int,
    draft_exists boolean
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_draft_id uuid;
    v_new_version int;
    v_draft_exists boolean := false;

    v_profile_artifact_id uuid := profile_id;
    v_profile_resource_id uuid;
    v_group_id uuid := group_id;

    v_name_id uuid := (names).resource_id;
    v_description_id uuid := (descriptions).resource_id;
    v_active_flag_id uuid := (flags).resource_id;
    v_department_ids uuid[] := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_simulation_ids uuid[] := COALESCE((simulations).resource_ids, ARRAY[]::uuid[]);
    v_simulation_position_ids uuid[] := COALESCE((simulation_positions).resource_ids, ARRAY[]::uuid[]);
    v_simulation_availability_ids uuid[] := COALESCE((simulation_availability).resource_ids, ARRAY[]::uuid[]);

    v_run_id uuid;
    v_call_id uuid;
BEGIN
    SELECT pp.profiles_id INTO v_profile_resource_id
    FROM profile_profiles_junction pp
    WHERE pp.profile_id = v_profile_artifact_id
    LIMIT 1;

    IF v_profile_resource_id IS NULL THEN
        RAISE EXCEPTION 'Profile resource not found for artifact: %', v_profile_artifact_id;
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
        FROM unnest(v_simulation_ids) AS sim_id
        WHERE NOT EXISTS (SELECT 1 FROM simulations_resource sr WHERE sr.id = sim_id)
    ) THEN
        RAISE EXCEPTION 'Simulation resource not found';
    END IF;

    IF input_draft_id IS NOT NULL THEN
        SELECT cohort_drafts_entry.group_id INTO v_group_id
        FROM cohort_drafts_entry
        WHERE cohort_drafts_entry.id = input_draft_id;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (
                    SELECT id
                    FROM sessions_entry
                    WHERE sessions_entry.profile_id = v_profile_artifact_id
                      AND sessions_entry.active = true
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE cohort_drafts_entry
        SET version = cohort_drafts_entry.version + 1,
            updated_at = NOW(),
            group_id = COALESCE(cohort_drafts_entry.group_id, v_group_id)
        WHERE cohort_drafts_entry.id = input_draft_id
          AND EXISTS (
              SELECT 1
              FROM cohort_drafts_profiles_connection pdc
              WHERE pdc.draft_id = cohort_drafts_entry.id
                AND pdc.profiles_id = v_profile_resource_id
          )
          AND cohort_drafts_entry.version = expected_version
        RETURNING cohort_drafts_entry.id, cohort_drafts_entry.version
        INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
        END IF;
    END IF;

    IF v_draft_id IS NULL THEN
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (
                    SELECT id
                    FROM sessions_entry
                    WHERE sessions_entry.profile_id = v_profile_artifact_id
                      AND sessions_entry.active = true
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            RETURNING id INTO v_group_id;
        END IF;

        INSERT INTO cohort_drafts_entry (group_id)
        VALUES (v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO cohort_drafts_profiles_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profile_resource_id, v_new_version);
    END IF;

    DELETE FROM cohort_drafts_names_connection WHERE cohort_drafts_names_connection.draft_id = v_draft_id;
    DELETE FROM cohort_drafts_descriptions_connection WHERE cohort_drafts_descriptions_connection.draft_id = v_draft_id;
    DELETE FROM cohort_drafts_flags_connection WHERE cohort_drafts_flags_connection.draft_id = v_draft_id;
    DELETE FROM cohort_drafts_departments_connection WHERE cohort_drafts_departments_connection.draft_id = v_draft_id;
    DELETE FROM cohort_drafts_simulations_connection WHERE cohort_drafts_simulations_connection.draft_id = v_draft_id;
    DELETE FROM cohort_drafts_simulation_positions_connection WHERE cohort_drafts_simulation_positions_connection.draft_id = v_draft_id;
    DELETE FROM cohort_drafts_simulation_availability_connection WHERE cohort_drafts_simulation_availability_connection.draft_id = v_draft_id;

    IF v_name_id IS NOT NULL THEN
        INSERT INTO cohort_drafts_names_connection (draft_id, names_id, version)
        VALUES (v_draft_id, v_name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT cohort_drafts_names_connection_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO cohort_drafts_descriptions_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, v_description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT cohort_drafts_descriptions_connection_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO cohort_drafts_flags_connection (draft_id, flags_id, version)
        VALUES (v_draft_id, v_active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT cohort_drafts_flags_connection_pkey DO UPDATE SET version = v_new_version;
    END IF;

    INSERT INTO cohort_drafts_departments_connection (draft_id, departments_id, version)
    SELECT v_draft_id, dept_id, v_new_version
    FROM UNNEST(v_department_ids) AS dept_id
    ON CONFLICT ON CONSTRAINT cohort_drafts_departments_connection_pkey DO UPDATE
    SET version = v_new_version;

    INSERT INTO cohort_drafts_simulations_connection (draft_id, simulations_id, version)
    SELECT v_draft_id, sim_id, v_new_version
    FROM UNNEST(v_simulation_ids) AS sim_id
    ON CONFLICT ON CONSTRAINT cohort_drafts_simulations_connection_pkey DO UPDATE
    SET version = v_new_version;

    INSERT INTO cohort_drafts_simulation_positions_connection (draft_id, simulation_positions_id, version)
    SELECT v_draft_id, spid, v_new_version
    FROM UNNEST(v_simulation_position_ids) AS spid
    ON CONFLICT ON CONSTRAINT cohort_drafts_simulation_positions_connection_pkey DO UPDATE
    SET version = v_new_version;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_simulation_availability_ids) AS sa_id
        WHERE NOT EXISTS (SELECT 1 FROM simulation_availability_resource sar WHERE sar.id = sa_id)
    ) THEN
        RAISE EXCEPTION 'Simulation availability resource not found';
    END IF;

    INSERT INTO cohort_drafts_simulation_availability_connection (draft_id, simulation_availability_id)
    SELECT v_draft_id, said
    FROM UNNEST(v_simulation_availability_ids) AS said
    ON CONFLICT ON CONSTRAINT cohort_drafts_simulation_availability_connection_draft_availability_unique DO NOTHING;

    IF EXISTS (
        SELECT 1
        FROM unnest(v_simulation_position_ids) AS sp_id
        WHERE NOT EXISTS (SELECT 1 FROM simulation_positions_resource spr WHERE spr.id = sp_id)
    ) THEN
        RAISE EXCEPTION 'Simulation position resource not found';
    END IF;

    IF (
        (names).create_tool_id IS NOT NULL OR (names).link_tool_id IS NOT NULL OR
        (descriptions).create_tool_id IS NOT NULL OR (descriptions).link_tool_id IS NOT NULL OR
        (flags).create_tool_id IS NOT NULL OR (flags).link_tool_id IS NOT NULL OR
        (departments).create_tool_id IS NOT NULL OR (departments).link_tool_id IS NOT NULL OR
        (simulations).create_tool_id IS NOT NULL OR (simulations).link_tool_id IS NOT NULL OR
        (simulation_positions).create_tool_id IS NOT NULL OR (simulation_positions).link_tool_id IS NOT NULL OR
        (simulation_availability).create_tool_id IS NOT NULL OR (simulation_availability).link_tool_id IS NOT NULL
    ) THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, v_group_id, NOW(), NOW());

        IF v_name_id IS NOT NULL AND (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;

        IF v_name_id IS NOT NULL AND (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;

        IF v_description_id IS NOT NULL AND (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;

        IF v_description_id IS NOT NULL AND (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;

        IF v_active_flag_id IS NOT NULL AND (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;

        IF v_active_flag_id IS NOT NULL AND (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;

        IF COALESCE(array_length(v_simulation_ids, 1), 0) > 0 AND (simulations).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_create_simulations_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((simulations).create_tool_id, v_call_id);
            INSERT INTO simulations_calls_connection (simulations_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_simulation_ids) sid;
        END IF;

        IF COALESCE(array_length(v_simulation_ids, 1), 0) > 0 AND (simulations).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_link_simulations_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((simulations).link_tool_id, v_call_id);
            INSERT INTO simulations_calls_connection (simulations_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_simulation_ids) sid;
        END IF;

        IF COALESCE(array_length(v_simulation_position_ids, 1), 0) > 0 AND (simulation_positions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_create_simulation_positions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((simulation_positions).create_tool_id, v_call_id);
            INSERT INTO simulation_positions_calls_connection (simulation_positions_id, call_id)
            SELECT spid, v_call_id FROM UNNEST(v_simulation_position_ids) spid;
        END IF;

        IF COALESCE(array_length(v_simulation_position_ids, 1), 0) > 0 AND (simulation_positions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_link_simulation_positions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((simulation_positions).link_tool_id, v_call_id);
            INSERT INTO simulation_positions_calls_connection (simulation_positions_id, call_id)
            SELECT spid, v_call_id FROM UNNEST(v_simulation_position_ids) spid;
        END IF;

        IF COALESCE(array_length(v_simulation_availability_ids, 1), 0) > 0 AND (simulation_availability).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_create_simulation_availability_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((simulation_availability).create_tool_id, v_call_id);
            INSERT INTO simulation_availability_calls_connection (simulation_availability_id, call_id)
            SELECT said, v_call_id FROM UNNEST(v_simulation_availability_ids) said;
        END IF;

        IF COALESCE(array_length(v_simulation_availability_ids, 1), 0) > 0 AND (simulation_availability).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'cohort_draft_link_simulation_availability_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((simulation_availability).link_tool_id, v_call_id);
            INSERT INTO simulation_availability_calls_connection (simulation_availability_id, call_id)
            SELECT said, v_call_id FROM UNNEST(v_simulation_availability_ids) said;
        END IF;
    END IF;

    RETURN QUERY
    SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
