-- Patch rubric draft - accepts resource actions and creates/updates draft.
-- Persona-parity signature: composite resource actions + tool call tracking.

-- 0) Ensure composite types exist
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

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_patch_rubric_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_rubric_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_rubric_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.rubric_resource_action DEFAULT NULL,
    descriptions types.rubric_resource_action DEFAULT NULL,
    flags types.rubric_resource_action DEFAULT NULL,
    departments types.rubric_multi_resource_action DEFAULT NULL,
    points types.rubric_resource_action DEFAULT NULL,
    pass_points types.rubric_resource_action DEFAULT NULL,
    standard_groups types.rubric_multi_resource_action DEFAULT NULL,
    standards types.rubric_multi_resource_action DEFAULT NULL,
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
    v_active_flag_id uuid;
    v_total_points_id uuid;
    v_pass_points_id uuid;
    v_department_ids uuid[];
    v_standard_group_ids uuid[];
    v_standard_ids uuid[];

    -- Call tracking
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Extract IDs from composites
    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_active_flag_id := (flags).resource_id;
    v_total_points_id := (points).resource_id;
    v_pass_points_id := (pass_points).resource_id;
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_standard_group_ids := COALESCE((standard_groups).resource_ids, ARRAY[]::uuid[]);
    v_standard_ids := COALESCE((standards).resource_ids, ARRAY[]::uuid[]);

    -- Resolve profile_artifact.id to profiles_resource.id for rubric_drafts_profiles_connection FK
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = v_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', v_profile_id;
    END IF;

    -- Validate resources if provided
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

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_department_ids) AS did
        WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = did)
    ) THEN
        RAISE EXCEPTION 'One or more department resource IDs not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_standard_group_ids) AS sgid
        WHERE NOT EXISTS (SELECT 1 FROM standard_groups_resource WHERE id = sgid)
    ) THEN
        RAISE EXCEPTION 'One or more standard_group resource IDs not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_standard_ids) AS sid
        WHERE NOT EXISTS (SELECT 1 FROM standards_resource WHERE id = sid)
    ) THEN
        RAISE EXCEPTION 'One or more standard resource IDs not found';
    END IF;

    -- Try update path first
    IF input_draft_id IS NOT NULL THEN
        -- Resolve/ensure group_id for draft
        SELECT vde.group_id INTO v_group_id
        FROM rubric_drafts_entry vde
        WHERE vde.id = input_draft_id;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (
                    SELECT id
                    FROM sessions_entry
                    WHERE sessions_entry.profile_id = v_profile_id
                      AND sessions_entry.active = true
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE rubric_drafts_entry
        SET version = rubric_drafts_entry.version + 1,
            updated_at = NOW(),
            group_id = COALESCE(rubric_drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (
              SELECT 1
              FROM rubric_drafts_profiles_connection pdj
              WHERE pdj.draft_id = rubric_drafts_entry.id
                AND pdj.profiles_id = v_profiles_resource_id
          )
          AND rubric_drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;

            -- Replace draft resource links
            DELETE FROM rubric_drafts_names_connection WHERE draft_id = v_draft_id;
            DELETE FROM rubric_drafts_descriptions_connection WHERE draft_id = v_draft_id;
            DELETE FROM rubric_drafts_flags_connection WHERE draft_id = v_draft_id;
            DELETE FROM rubric_drafts_departments_connection WHERE draft_id = v_draft_id;
            DELETE FROM rubric_drafts_points_connection WHERE draft_id = v_draft_id;
            DELETE FROM rubric_drafts_standard_groups_connection WHERE draft_id = v_draft_id;
            DELETE FROM rubric_drafts_standards_connection WHERE draft_id = v_draft_id;

            IF v_name_id IS NOT NULL THEN
                INSERT INTO rubric_drafts_names_connection (draft_id, names_id, version)
                VALUES (v_draft_id, v_name_id, v_new_version)
                ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF v_description_id IS NOT NULL THEN
                INSERT INTO rubric_drafts_descriptions_connection (draft_id, descriptions_id, version)
                VALUES (v_draft_id, v_description_id, v_new_version)
                ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF v_active_flag_id IS NOT NULL THEN
                INSERT INTO rubric_drafts_flags_connection (draft_id, flags_id, version)
                VALUES (v_draft_id, v_active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
                INSERT INTO rubric_drafts_departments_connection (draft_id, departments_id, version)
                SELECT v_draft_id, did, v_new_version
                FROM UNNEST(v_department_ids) AS did
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF v_total_points_id IS NOT NULL THEN
                INSERT INTO rubric_drafts_points_connection (draft_id, points_id, version)
                VALUES (v_draft_id, v_total_points_id, v_new_version)
                ON CONFLICT ON CONSTRAINT points_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF v_pass_points_id IS NOT NULL THEN
                INSERT INTO rubric_drafts_points_connection (draft_id, points_id, version)
                VALUES (v_draft_id, v_pass_points_id, v_new_version)
                ON CONFLICT ON CONSTRAINT points_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF COALESCE(array_length(v_standard_group_ids, 1), 0) > 0 THEN
                INSERT INTO rubric_drafts_standard_groups_connection (draft_id, standard_groups_id, version)
                SELECT v_draft_id, sgid, v_new_version
                FROM UNNEST(v_standard_group_ids) AS sgid
                ON CONFLICT ON CONSTRAINT standard_groups_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF COALESCE(array_length(v_standard_ids, 1), 0) > 0 THEN
                INSERT INTO rubric_drafts_standards_connection (draft_id, standards_id, version)
                SELECT v_draft_id, sid, v_new_version
                FROM UNNEST(v_standard_ids) AS sid
                ON CONFLICT ON CONSTRAINT standards_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            -- Tool-call tracking for update path
            IF v_group_id IS NOT NULL AND (
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

                -- Helper pattern repeated for all resources
                IF v_name_id IS NOT NULL AND (names).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
                    INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
                END IF;
                IF v_name_id IS NOT NULL AND (names).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
                    INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
                END IF;

                IF v_description_id IS NOT NULL AND (descriptions).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
                    INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
                END IF;
                IF v_description_id IS NOT NULL AND (descriptions).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
                    INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
                END IF;

                IF v_active_flag_id IS NOT NULL AND (flags).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
                    INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
                END IF;
                IF v_active_flag_id IS NOT NULL AND (flags).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
                    INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
                END IF;

                IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
                    INSERT INTO departments_calls_connection (departments_id, call_id)
                    SELECT did, v_call_id FROM UNNEST(v_department_ids) AS did;
                END IF;
                IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
                    INSERT INTO departments_calls_connection (departments_id, call_id)
                    SELECT did, v_call_id FROM UNNEST(v_department_ids) AS did;
                END IF;

                IF v_total_points_id IS NOT NULL AND (points).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_create_points_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((points).create_tool_id, v_call_id);
                    INSERT INTO points_calls_connection (points_id, call_id) VALUES (v_total_points_id, v_call_id);
                END IF;
                IF v_total_points_id IS NOT NULL AND (points).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_link_points_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((points).link_tool_id, v_call_id);
                    INSERT INTO points_calls_connection (points_id, call_id) VALUES (v_total_points_id, v_call_id);
                END IF;

                IF v_pass_points_id IS NOT NULL AND (pass_points).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_create_pass_points_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((pass_points).create_tool_id, v_call_id);
                    INSERT INTO points_calls_connection (points_id, call_id) VALUES (v_pass_points_id, v_call_id);
                END IF;
                IF v_pass_points_id IS NOT NULL AND (pass_points).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_link_pass_points_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((pass_points).link_tool_id, v_call_id);
                    INSERT INTO points_calls_connection (points_id, call_id) VALUES (v_pass_points_id, v_call_id);
                END IF;

                IF COALESCE(array_length(v_standard_group_ids, 1), 0) > 0 AND (standard_groups).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_create_standard_groups_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((standard_groups).create_tool_id, v_call_id);
                    INSERT INTO standard_groups_calls_connection (standard_groups_id, call_id)
                    SELECT sgid, v_call_id FROM UNNEST(v_standard_group_ids) AS sgid;
                END IF;
                IF COALESCE(array_length(v_standard_group_ids, 1), 0) > 0 AND (standard_groups).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_link_standard_groups_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((standard_groups).link_tool_id, v_call_id);
                    INSERT INTO standard_groups_calls_connection (standard_groups_id, call_id)
                    SELECT sgid, v_call_id FROM UNNEST(v_standard_group_ids) AS sgid;
                END IF;

                IF COALESCE(array_length(v_standard_ids, 1), 0) > 0 AND (standards).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_create_standards_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((standards).create_tool_id, v_call_id);
                    INSERT INTO standards_calls_connection (standards_id, call_id)
                    SELECT sid, v_call_id FROM UNNEST(v_standard_ids) AS sid;
                END IF;
                IF COALESCE(array_length(v_standard_ids, 1), 0) > 0 AND (standards).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'rubric_draft_link_standards_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((standards).link_tool_id, v_call_id);
                    INSERT INTO standards_calls_connection (standards_id, call_id)
                    SELECT sid, v_call_id FROM UNNEST(v_standard_ids) AS sid;
                END IF;
            END IF;

            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;

    -- Create path
    IF v_group_id IS NULL THEN
        INSERT INTO groups_entry (created_at, updated_at, session_id)
        VALUES (
            NOW(),
            NOW(),
            (
                SELECT id
                FROM sessions_entry
                WHERE sessions_entry.profile_id = v_profile_id
                  AND sessions_entry.active = true
                ORDER BY created_at DESC
                LIMIT 1
            )
        )
        RETURNING id INTO v_group_id;
    END IF;

    INSERT INTO rubric_drafts_entry (group_id)
    VALUES (v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;

    INSERT INTO rubric_drafts_profiles_connection (draft_id, profiles_id, version)
    VALUES (v_draft_id, v_profiles_resource_id, v_new_version);

    IF v_name_id IS NOT NULL THEN
        INSERT INTO rubric_drafts_names_connection (draft_id, names_id, version)
        VALUES (v_draft_id, v_name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO rubric_drafts_descriptions_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, v_description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO rubric_drafts_flags_connection (draft_id, flags_id, version)
        VALUES (v_draft_id, v_active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        INSERT INTO rubric_drafts_departments_connection (draft_id, departments_id, version)
        SELECT v_draft_id, did, v_new_version
        FROM UNNEST(v_department_ids) AS did
        ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_total_points_id IS NOT NULL THEN
        INSERT INTO rubric_drafts_points_connection (draft_id, points_id, version)
        VALUES (v_draft_id, v_total_points_id, v_new_version)
        ON CONFLICT ON CONSTRAINT points_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_pass_points_id IS NOT NULL THEN
        INSERT INTO rubric_drafts_points_connection (draft_id, points_id, version)
        VALUES (v_draft_id, v_pass_points_id, v_new_version)
        ON CONFLICT ON CONSTRAINT points_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_standard_group_ids, 1), 0) > 0 THEN
        INSERT INTO rubric_drafts_standard_groups_connection (draft_id, standard_groups_id, version)
        SELECT v_draft_id, sgid, v_new_version
        FROM UNNEST(v_standard_group_ids) AS sgid
        ON CONFLICT ON CONSTRAINT standard_groups_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_standard_ids, 1), 0) > 0 THEN
        INSERT INTO rubric_drafts_standards_connection (draft_id, standards_id, version)
        SELECT v_draft_id, sid, v_new_version
        FROM UNNEST(v_standard_ids) AS sid
        ON CONFLICT ON CONSTRAINT standards_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    -- Tool-call tracking for create path
    IF v_group_id IS NOT NULL AND (
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

        IF v_name_id IS NOT NULL AND (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF v_name_id IS NOT NULL AND (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;

        IF v_description_id IS NOT NULL AND (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF v_description_id IS NOT NULL AND (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;

        IF v_active_flag_id IS NOT NULL AND (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF v_active_flag_id IS NOT NULL AND (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) AS did;
        END IF;
        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) AS did;
        END IF;

        IF v_total_points_id IS NOT NULL AND (points).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_create_points_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((points).create_tool_id, v_call_id);
            INSERT INTO points_calls_connection (points_id, call_id) VALUES (v_total_points_id, v_call_id);
        END IF;
        IF v_total_points_id IS NOT NULL AND (points).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_link_points_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((points).link_tool_id, v_call_id);
            INSERT INTO points_calls_connection (points_id, call_id) VALUES (v_total_points_id, v_call_id);
        END IF;

        IF v_pass_points_id IS NOT NULL AND (pass_points).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_create_pass_points_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((pass_points).create_tool_id, v_call_id);
            INSERT INTO points_calls_connection (points_id, call_id) VALUES (v_pass_points_id, v_call_id);
        END IF;
        IF v_pass_points_id IS NOT NULL AND (pass_points).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_link_pass_points_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((pass_points).link_tool_id, v_call_id);
            INSERT INTO points_calls_connection (points_id, call_id) VALUES (v_pass_points_id, v_call_id);
        END IF;

        IF COALESCE(array_length(v_standard_group_ids, 1), 0) > 0 AND (standard_groups).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_create_standard_groups_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((standard_groups).create_tool_id, v_call_id);
            INSERT INTO standard_groups_calls_connection (standard_groups_id, call_id)
            SELECT sgid, v_call_id FROM UNNEST(v_standard_group_ids) AS sgid;
        END IF;
        IF COALESCE(array_length(v_standard_group_ids, 1), 0) > 0 AND (standard_groups).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_link_standard_groups_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((standard_groups).link_tool_id, v_call_id);
            INSERT INTO standard_groups_calls_connection (standard_groups_id, call_id)
            SELECT sgid, v_call_id FROM UNNEST(v_standard_group_ids) AS sgid;
        END IF;

        IF COALESCE(array_length(v_standard_ids, 1), 0) > 0 AND (standards).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_create_standards_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((standards).create_tool_id, v_call_id);
            INSERT INTO standards_calls_connection (standards_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_standard_ids) AS sid;
        END IF;
        IF COALESCE(array_length(v_standard_ids, 1), 0) > 0 AND (standards).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'rubric_draft_link_standards_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((standards).link_tool_id, v_call_id);
            INSERT INTO standards_calls_connection (standards_id, call_id)
            SELECT sid, v_call_id FROM UNNEST(v_standard_ids) AS sid;
        END IF;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
