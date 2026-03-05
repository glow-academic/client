-- Patch simulation draft - accepts nested resource action composites.
-- Creates draft if input_draft_id is NULL, updates if exists.

-- Ensure simulation draft composite types exist before function creation.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'types'
          AND t.typname = 'simulation_resource_action'
    ) THEN
        CREATE TYPE types.simulation_resource_action AS (
            resources_id uuid,
            create_tool_id uuid,
            link_tool_id uuid
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'types'
          AND t.typname = 'simulation_multi_resource_action'
    ) THEN
        CREATE TYPE types.simulation_multi_resource_action AS (
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
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_patch_simulation_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_simulation_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_simulation_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
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

    v_profile_id uuid := profile_id;
    v_profiles_resource_id uuid;
    v_group_id uuid := group_id;

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

    -- Tool-call logging
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    v_name_id := (names).resources_id;
    v_description_id := (descriptions).resources_id;
    v_flag_ids := COALESCE((flags).resource_ids, ARRAY[]::uuid[]);
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_scenario_ids := COALESCE((scenarios).resource_ids, ARRAY[]::uuid[]);
    v_scenario_flag_ids := COALESCE((scenario_flags).resource_ids, ARRAY[]::uuid[]);
    v_scenario_position_ids := COALESCE((scenario_positions).resource_ids, ARRAY[]::uuid[]);
    v_scenario_rubric_ids := COALESCE((scenario_rubrics).resource_ids, ARRAY[]::uuid[]);
    v_scenario_time_limit_ids := COALESCE((scenario_time_limits).resource_ids, ARRAY[]::uuid[]);

    SELECT ppj.profile_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = v_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', v_profile_id;
    END IF;

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
        SELECT 1 FROM UNNEST(v_scenario_flag_ids) AS sid
        WHERE NOT EXISTS (SELECT 1 FROM scenario_flags_resource WHERE id = sid)
    ) THEN
        RAISE EXCEPTION 'One or more scenario_flag_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_scenario_position_ids) AS sid
        WHERE NOT EXISTS (SELECT 1 FROM scenario_positions_resource WHERE id = sid)
    ) THEN
        RAISE EXCEPTION 'One or more scenario_position_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_scenario_rubric_ids) AS sid
        WHERE NOT EXISTS (SELECT 1 FROM scenario_rubrics_resource WHERE id = sid)
    ) THEN
        RAISE EXCEPTION 'One or more scenario_rubric_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_scenario_time_limit_ids) AS sid
        WHERE NOT EXISTS (SELECT 1 FROM scenario_time_limits_resource WHERE id = sid)
    ) THEN
        RAISE EXCEPTION 'One or more scenario_time_limit_ids not found';
    END IF;

    -- Try update path first
    IF input_draft_id IS NOT NULL THEN
        SELECT vde.group_id INTO v_group_id
        FROM simulation_drafts_entry vde
        WHERE vde.id = input_draft_id;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, session_id)
            VALUES (
                NOW(),
                (SELECT s.id FROM sessions_entry s JOIN profiles_sessions_connection psc ON psc.session_id = s.id
                 WHERE psc.profile_id = v_profile_id
                   AND s.active = true
                 ORDER BY s.created_at DESC
                 LIMIT 1)
            )
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE simulation_drafts_entry
        SET version = simulation_drafts_entry.version + 1,
            updated_at = NOW(),
            group_id = COALESCE(simulation_drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (
              SELECT 1
              FROM simulation_drafts_profiles_connection pdc
              WHERE pdc.draft_id = simulation_drafts_entry.id
                AND pdc.profile_id = v_profiles_resource_id
          )
          AND simulation_drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
        END IF;
    END IF;

    -- Create path (new draft or failed optimistic update)
    IF v_draft_id IS NULL THEN
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, session_id)
            VALUES (
                NOW(),
                (SELECT s.id FROM sessions_entry s JOIN profiles_sessions_connection psc ON psc.session_id = s.id
                 WHERE psc.profile_id = v_profile_id
                   AND s.active = true
                 ORDER BY s.created_at DESC
                 LIMIT 1)
            )
            RETURNING id INTO v_group_id;
        END IF;

        INSERT INTO simulation_drafts_entry (group_id)
        VALUES (v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO simulation_drafts_profiles_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profiles_resource_id, v_new_version);
    END IF;

    -- Replace draft links
    DELETE FROM simulation_drafts_names_connection WHERE simulation_drafts_names_connection.draft_id = v_draft_id;
    DELETE FROM simulation_drafts_descriptions_connection WHERE simulation_drafts_descriptions_connection.draft_id = v_draft_id;
    DELETE FROM simulation_drafts_flags_connection WHERE simulation_drafts_flags_connection.draft_id = v_draft_id;
    DELETE FROM simulation_drafts_departments_connection WHERE simulation_drafts_departments_connection.draft_id = v_draft_id;
    DELETE FROM simulation_drafts_scenarios_connection WHERE simulation_drafts_scenarios_connection.draft_id = v_draft_id;
    DELETE FROM simulation_drafts_scenario_flags_connection WHERE simulation_drafts_scenario_flags_connection.draft_id = v_draft_id;
    DELETE FROM simulation_drafts_scenario_positions_connection WHERE simulation_drafts_scenario_positions_connection.draft_id = v_draft_id;
    DELETE FROM simulation_drafts_scenario_rubrics_connection WHERE simulation_drafts_scenario_rubrics_connection.draft_id = v_draft_id;
    DELETE FROM simulation_drafts_scenario_time_limits_connection WHERE simulation_drafts_scenario_time_limits_connection.draft_id = v_draft_id;

    IF v_name_id IS NOT NULL THEN
        INSERT INTO simulation_drafts_names_connection (draft_id, names_id, version)
        VALUES (v_draft_id, v_name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT simulation_drafts_names_connection_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO simulation_drafts_descriptions_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, v_description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT simulation_drafts_descriptions_connection_pkey DO UPDATE SET version = v_new_version;
    END IF;

    INSERT INTO simulation_drafts_flags_connection (draft_id, flags_id, version)
    SELECT v_draft_id, fid, v_new_version
    FROM UNNEST(v_flag_ids) fid
    ON CONFLICT ON CONSTRAINT simulation_drafts_flags_connection_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO simulation_drafts_departments_connection (draft_id, departments_id, version)
    SELECT v_draft_id, did, v_new_version
    FROM UNNEST(v_department_ids) did
    ON CONFLICT ON CONSTRAINT simulation_drafts_departments_connection_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO simulation_drafts_scenarios_connection (draft_id, scenarios_id, version)
    SELECT v_draft_id, sid, v_new_version
    FROM UNNEST(v_scenario_ids) sid
    ON CONFLICT ON CONSTRAINT simulation_drafts_scenarios_connection_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO simulation_drafts_scenario_flags_connection (draft_id, scenario_flags_id, version)
    SELECT v_draft_id, sid, v_new_version
    FROM UNNEST(v_scenario_flag_ids) sid
    ON CONFLICT ON CONSTRAINT simulation_drafts_scenario_flags_connection_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO simulation_drafts_scenario_positions_connection (draft_id, scenario_positions_id, version)
    SELECT v_draft_id, sid, v_new_version
    FROM UNNEST(v_scenario_position_ids) sid
    ON CONFLICT ON CONSTRAINT simulation_drafts_scenario_positions_connection_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO simulation_drafts_scenario_rubrics_connection (draft_id, scenario_rubrics_id, version)
    SELECT v_draft_id, sid, v_new_version
    FROM UNNEST(v_scenario_rubric_ids) sid
    ON CONFLICT ON CONSTRAINT simulation_drafts_scenario_rubrics_connection_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO simulation_drafts_scenario_time_limits_connection (draft_id, scenario_time_limits_id, version)
    SELECT v_draft_id, sid, v_new_version
    FROM UNNEST(v_scenario_time_limit_ids) sid
    ON CONFLICT ON CONSTRAINT simulation_drafts_scenario_time_limits_connection_pkey DO UPDATE SET version = v_new_version;

    -- Tool-call tracking: one run per draft patch
    IF v_group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, v_group_id, NOW(), NOW());

        IF v_name_id IS NOT NULL THEN
            IF (names).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_create_names_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
                INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
            END IF;
            IF (names).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_link_names_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
                INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
            END IF;
        END IF;

        IF v_description_id IS NOT NULL THEN
            IF (descriptions).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_create_descriptions_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
                INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
            END IF;
            IF (descriptions).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_link_descriptions_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
                INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
            END IF;
        END IF;

        IF COALESCE(array_length(v_flag_ids, 1), 0) > 0 THEN
            IF (flags).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_create_flags_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
                INSERT INTO flags_calls_connection (flags_id, call_id)
                SELECT fid, v_call_id FROM UNNEST(v_flag_ids) fid;
            END IF;
            IF (flags).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_link_flags_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
                INSERT INTO flags_calls_connection (flags_id, call_id)
                SELECT fid, v_call_id FROM UNNEST(v_flag_ids) fid;
            END IF;
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
            IF (departments).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_create_departments_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
            END IF;
            IF (departments).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_link_departments_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
            END IF;
        END IF;

        IF COALESCE(array_length(v_scenario_ids, 1), 0) > 0 THEN
            IF (scenarios).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_create_scenarios_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenarios).create_tool_id, v_call_id);
                INSERT INTO scenarios_calls_connection (scenarios_id, call_id)
                SELECT sid, v_call_id FROM UNNEST(v_scenario_ids) sid;
            END IF;
            IF (scenarios).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_link_scenarios_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenarios).link_tool_id, v_call_id);
                INSERT INTO scenarios_calls_connection (scenarios_id, call_id)
                SELECT sid, v_call_id FROM UNNEST(v_scenario_ids) sid;
            END IF;
        END IF;

        IF COALESCE(array_length(v_scenario_flag_ids, 1), 0) > 0 THEN
            IF (scenario_flags).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_create_scenario_flags_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_flags).create_tool_id, v_call_id);
                INSERT INTO scenario_flags_calls_connection (scenario_flags_id, call_id)
                SELECT sid, v_call_id FROM UNNEST(v_scenario_flag_ids) sid;
            END IF;
            IF (scenario_flags).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_link_scenario_flags_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_flags).link_tool_id, v_call_id);
                INSERT INTO scenario_flags_calls_connection (scenario_flags_id, call_id)
                SELECT sid, v_call_id FROM UNNEST(v_scenario_flag_ids) sid;
            END IF;
        END IF;

        IF COALESCE(array_length(v_scenario_position_ids, 1), 0) > 0 THEN
            IF (scenario_positions).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_create_scenario_positions_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_positions).create_tool_id, v_call_id);
                INSERT INTO scenario_positions_calls_connection (scenario_positions_id, call_id)
                SELECT sid, v_call_id FROM UNNEST(v_scenario_position_ids) sid;
            END IF;
            IF (scenario_positions).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_link_scenario_positions_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_positions).link_tool_id, v_call_id);
                INSERT INTO scenario_positions_calls_connection (scenario_positions_id, call_id)
                SELECT sid, v_call_id FROM UNNEST(v_scenario_position_ids) sid;
            END IF;
        END IF;

        IF COALESCE(array_length(v_scenario_rubric_ids, 1), 0) > 0 THEN
            IF (scenario_rubrics).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_create_scenario_rubrics_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_rubrics).create_tool_id, v_call_id);
                INSERT INTO scenario_rubrics_calls_connection (scenario_rubrics_id, call_id)
                SELECT sid, v_call_id FROM UNNEST(v_scenario_rubric_ids) sid;
            END IF;
            IF (scenario_rubrics).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_link_scenario_rubrics_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_rubrics).link_tool_id, v_call_id);
                INSERT INTO scenario_rubrics_calls_connection (scenario_rubrics_id, call_id)
                SELECT sid, v_call_id FROM UNNEST(v_scenario_rubric_ids) sid;
            END IF;
        END IF;

        IF COALESCE(array_length(v_scenario_time_limit_ids, 1), 0) > 0 THEN
            IF (scenario_time_limits).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_create_scenario_time_limits_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_time_limits).create_tool_id, v_call_id);
                INSERT INTO scenario_time_limits_calls_connection (scenario_time_limits_id, call_id)
                SELECT sid, v_call_id FROM UNNEST(v_scenario_time_limit_ids) sid;
            END IF;
            IF (scenario_time_limits).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'simulation_draft_link_scenario_time_limits_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((scenario_time_limits).link_tool_id, v_call_id);
                INSERT INTO scenario_time_limits_calls_connection (scenario_time_limits_id, call_id)
                SELECT sid, v_call_id FROM UNNEST(v_scenario_time_limit_ids) sid;
            END IF;
        END IF;

    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
