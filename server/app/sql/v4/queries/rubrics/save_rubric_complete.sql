-- Unified save rubric function - handles both create (input_rubric_id = NULL) and update (input_rubric_id provided)
-- Persona-parity signature: composite resource actions + tool call tracking.

-- 0) Drop and recreate composite types for resource actions
DO $$
BEGIN
    DROP TYPE IF EXISTS types.rubric_resource_action CASCADE;
    CREATE TYPE types.rubric_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.rubric_multi_resource_action CASCADE;
    CREATE TYPE types.rubric_multi_resource_action AS (
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
        WHERE proname = 'api_save_rubric_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_rubric_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function with composite resource action parameters
CREATE OR REPLACE FUNCTION api_save_rubric_v4(
    profile_id uuid,
    group_id uuid,
    input_rubric_id uuid DEFAULT NULL,
    names types.rubric_resource_action DEFAULT NULL,
    descriptions types.rubric_resource_action DEFAULT NULL,
    flags types.rubric_resource_action DEFAULT NULL,
    departments types.rubric_multi_resource_action DEFAULT NULL,
    points types.rubric_resource_action DEFAULT NULL,
    pass_points types.rubric_resource_action DEFAULT NULL,
    standard_groups types.rubric_multi_resource_action DEFAULT NULL,
    standards types.rubric_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    rubric_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_rubric_id uuid;
    v_profile_id uuid;
    v_group_id uuid;
    v_input_rubric_id uuid;
    is_create boolean;

    -- Extracted resource IDs
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_total_points_id uuid;
    v_pass_points_id uuid;
    v_department_ids uuid[];
    v_standard_group_ids uuid[];
    v_standard_ids uuid[];

    -- Call tracking variables
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Assign params to local vars
    v_profile_id := profile_id;
    v_group_id := group_id;
    v_input_rubric_id := input_rubric_id;

    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_active_flag_id := (flags).resource_id;
    v_total_points_id := (points).resource_id;
    v_pass_points_id := (pass_points).resource_id;
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_standard_group_ids := COALESCE((standard_groups).resource_ids, ARRAY[]::uuid[]);
    v_standard_ids := COALESCE((standards).resource_ids, ARRAY[]::uuid[]);

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    -- Determine if create or update
    is_create := (v_input_rubric_id IS NULL);

    -- Create or update artifact first
    IF is_create THEN
        INSERT INTO rubric_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_rubric_id;
    ELSE
        v_rubric_id := v_input_rubric_id;
        UPDATE rubric_artifact
        SET updated_at = NOW()
        WHERE id = v_rubric_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Rubric not found: %', v_input_rubric_id;
        END IF;
    END IF;

    -- Validate scalar resources
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    IF v_total_points_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM points_resource WHERE id = v_total_points_id) THEN
        RAISE EXCEPTION 'Total points resource not found: %', v_total_points_id;
    END IF;

    IF v_pass_points_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM points_resource WHERE id = v_pass_points_id) THEN
        RAISE EXCEPTION 'Pass points resource not found: %', v_pass_points_id;
    END IF;

    -- Validate arrays
    IF EXISTS (
        SELECT 1 FROM UNNEST(v_department_ids) AS did
        WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = did)
    ) THEN
        RAISE EXCEPTION 'One or more department_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_standard_group_ids) AS sgid
        WHERE NOT EXISTS (SELECT 1 FROM standard_groups_resource WHERE id = sgid)
    ) THEN
        RAISE EXCEPTION 'One or more standard_group_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_standard_ids) AS sid
        WHERE NOT EXISTS (SELECT 1 FROM standards_resource WHERE id = sid)
    ) THEN
        RAISE EXCEPTION 'One or more standard_ids not found';
    END IF;

    -- Update path cleanup
    IF NOT is_create THEN
        DELETE FROM rubric_names_junction WHERE rubric_id = v_rubric_id;
        DELETE FROM rubric_descriptions_junction WHERE rubric_id = v_rubric_id;
        DELETE FROM rubric_points_junction WHERE rubric_id = v_rubric_id;
        DELETE FROM rubric_departments_junction WHERE rubric_id = v_rubric_id;

        UPDATE rubric_standard_groups_junction
        SET active = false
        WHERE rubric_id = v_rubric_id
          AND active = true;

        UPDATE rubric_standards_junction
        SET active = false
        WHERE rubric_id = v_rubric_id
          AND active = true;

        UPDATE rubric_flags_junction
        SET flag_id = COALESCE(v_active_flag_id, rubric_flags_junction.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE rubric_id = v_rubric_id;
    END IF;

    -- Tool-call tracking: create one run only if at least one tool id is present
    IF (
        (names).create_tool_id IS NOT NULL OR (names).link_tool_id IS NOT NULL OR
        (descriptions).create_tool_id IS NOT NULL OR (descriptions).link_tool_id IS NOT NULL OR
        (flags).create_tool_id IS NOT NULL OR (flags).link_tool_id IS NOT NULL OR
        (departments).create_tool_id IS NOT NULL OR (departments).link_tool_id IS NOT NULL OR
        (points).create_tool_id IS NOT NULL OR (points).link_tool_id IS NOT NULL OR
        (pass_points).create_tool_id IS NOT NULL OR (pass_points).link_tool_id IS NOT NULL OR
        (standard_groups).create_tool_id IS NOT NULL OR (standard_groups).link_tool_id IS NOT NULL OR
        (standards).create_tool_id IS NOT NULL OR (standards).link_tool_id IS NOT NULL
    ) THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, v_group_id, NOW(), NOW());

        -- names
        IF v_name_id IS NOT NULL AND (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_create_names_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF v_name_id IS NOT NULL AND (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_link_names_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;

        -- descriptions
        IF v_description_id IS NOT NULL AND (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_create_descriptions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF v_description_id IS NOT NULL AND (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_link_descriptions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;

        -- flags
        IF v_active_flag_id IS NOT NULL AND (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_create_flags_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF v_active_flag_id IS NOT NULL AND (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_link_flags_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;

        -- departments
        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_create_departments_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) AS did;
        END IF;
        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_link_departments_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) AS did;
        END IF;

        -- points (total)
        IF v_total_points_id IS NOT NULL AND (points).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_create_points_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((points).create_tool_id, v_call_id);
            INSERT INTO points_calls_connection (points_id, call_id) VALUES (v_total_points_id, v_call_id);
        END IF;
        IF v_total_points_id IS NOT NULL AND (points).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_link_points_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((points).link_tool_id, v_call_id);
            INSERT INTO points_calls_connection (points_id, call_id) VALUES (v_total_points_id, v_call_id);
        END IF;

        -- pass points
        IF v_pass_points_id IS NOT NULL AND (pass_points).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_create_pass_points_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((pass_points).create_tool_id, v_call_id);
            INSERT INTO points_calls_connection (points_id, call_id) VALUES (v_pass_points_id, v_call_id);
        END IF;
        IF v_pass_points_id IS NOT NULL AND (pass_points).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_link_pass_points_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((pass_points).link_tool_id, v_call_id);
            INSERT INTO points_calls_connection (points_id, call_id) VALUES (v_pass_points_id, v_call_id);
        END IF;

        -- standard groups
        IF COALESCE(array_length(v_standard_group_ids, 1), 0) > 0 AND (standard_groups).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_create_standard_groups_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((standard_groups).create_tool_id, v_call_id);
            INSERT INTO standard_groups_calls_connection (standard_groups_id, call_id)
            SELECT sgid, v_call_id FROM UNNEST(v_standard_group_ids) AS sgid;
        END IF;
        IF COALESCE(array_length(v_standard_group_ids, 1), 0) > 0 AND (standard_groups).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_link_standard_groups_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((standard_groups).link_tool_id, v_call_id);
            INSERT INTO standard_groups_calls_connection (standard_groups_id, call_id)
            SELECT sgid, v_call_id FROM UNNEST(v_standard_group_ids) AS sgid;
        END IF;

        -- standards
        IF COALESCE(array_length(v_standard_ids, 1), 0) > 0 AND (standards).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_create_standards_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((standards).create_tool_id, v_call_id);
            INSERT INTO standards_calls_connection (standards_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_standard_ids) AS sid;
        END IF;
        IF COALESCE(array_length(v_standard_ids, 1), 0) > 0 AND (standards).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'rubric_save_link_standards_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((standards).link_tool_id, v_call_id);
            INSERT INTO standards_calls_connection (standards_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_standard_ids) AS sid;
        END IF;
    END IF;

    -- Link rubric to name
    INSERT INTO rubric_names_junction (rubric_id, name_id, created_at)
    VALUES (v_rubric_id, v_name_id, NOW())
    ON CONFLICT ON CONSTRAINT rubric_names_pkey DO NOTHING;

    -- Link rubric to description
    IF v_description_id IS NOT NULL THEN
        INSERT INTO rubric_descriptions_junction (rubric_id, description_id, created_at)
        VALUES (v_rubric_id, v_description_id, NOW())
        ON CONFLICT ON CONSTRAINT rubric_descriptions_pkey DO NOTHING;
    END IF;

    -- Insert or update rubric active flag
    INSERT INTO rubric_flags_junction (rubric_id, flag_id, value, created_at)
    SELECT
        v_rubric_id,
        COALESCE(v_active_flag_id, f.id),
        CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END,
        NOW()
    FROM flags_resource f
    WHERE f.name = 'rubric_active'
    ON CONFLICT ON CONSTRAINT rubric_flags_pkey DO UPDATE SET
        flag_id = COALESCE(EXCLUDED.flag_id, rubric_flags_junction.flag_id),
        value = EXCLUDED.value;

    -- Link total points
    IF v_total_points_id IS NOT NULL THEN
        INSERT INTO rubric_points_junction (rubric_id, point_id, type, created_at)
        VALUES (v_rubric_id, v_total_points_id, 'total'::point_type, NOW())
        ON CONFLICT (rubric_id, point_id, type) DO NOTHING;
    END IF;

    -- Link pass points
    IF v_pass_points_id IS NOT NULL THEN
        INSERT INTO rubric_points_junction (rubric_id, point_id, type, created_at)
        VALUES (v_rubric_id, v_pass_points_id, 'pass'::point_type, NOW())
        ON CONFLICT (rubric_id, point_id, type) DO NOTHING;
    END IF;

    -- Link departments
    INSERT INTO rubric_departments_junction (rubric_id, department_id, active, created_at)
    SELECT
        v_rubric_id,
        dept_id,
        true,
        NOW()
    FROM UNNEST(v_department_ids) AS dept_id
    ON CONFLICT ON CONSTRAINT rubric_departments_pkey DO UPDATE SET
        active = true;

    -- Link standard groups (preserve previous position where possible)
    WITH standard_groups_with_position AS (
        SELECT
            sg_id,
            COALESCE(
                (
                    SELECT rsg.position
                    FROM rubric_standard_groups_junction rsg
                    WHERE rsg.rubric_id = v_rubric_id
                      AND rsg.standard_group_id = sg_id
                      AND rsg.active = false
                    ORDER BY rsg.updated_at DESC
                    LIMIT 1
                ),
                (ROW_NUMBER() OVER (ORDER BY ordinality))::int
            ) AS position
        FROM UNNEST(v_standard_group_ids) WITH ORDINALITY AS t(sg_id, ordinality)
    )
    INSERT INTO rubric_standard_groups_junction (
        rubric_id,
        standard_group_id,
        position,
        active,
        created_at
    )
    SELECT
        v_rubric_id,
        sgwp.sg_id,
        sgwp.position,
        true,
        NOW()
    FROM standard_groups_with_position sgwp
    ON CONFLICT ON CONSTRAINT rubric_standard_groups_pkey DO UPDATE SET
        position = EXCLUDED.position,
        active = true;

    -- Link standards
    INSERT INTO rubric_standards_junction (rubric_id, standard_id, active, created_at)
    SELECT
        v_rubric_id,
        std_id,
        true,
        NOW()
    FROM UNNEST(v_standard_ids) AS std_id
    ON CONFLICT ON CONSTRAINT rubric_standards_pkey DO UPDATE SET
        active = true;

    -- Sync linked resources with name/description
    UPDATE rubrics_resource r
    SET name = n.name,
        description = d.description
    FROM rubric_rubrics_junction j
    LEFT JOIN names_resource n ON n.id = v_name_id
    LEFT JOIN descriptions_resource d ON d.id = v_description_id
    WHERE j.rubrics_id = r.id
      AND j.rubric_id = v_rubric_id;

    RETURN QUERY SELECT v_rubric_id;
END;
$$;

