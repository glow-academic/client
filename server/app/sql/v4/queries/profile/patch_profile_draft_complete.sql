-- Patch profile draft - nested resource actions with tool-call tracking.

DO $$
BEGIN
    DROP TYPE IF EXISTS types.profile_resource_action CASCADE;
    CREATE TYPE types.profile_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.profile_multi_resource_action CASCADE;
    CREATE TYPE types.profile_multi_resource_action AS (
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
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_patch_profile_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_profile_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_profile_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.profile_resource_action DEFAULT NULL,
    flags types.profile_resource_action DEFAULT NULL,
    request_limits types.profile_resource_action DEFAULT NULL,
    departments types.profile_multi_resource_action DEFAULT NULL,
    emails types.profile_multi_resource_action DEFAULT NULL,
    cohorts types.profile_multi_resource_action DEFAULT NULL,
    role text DEFAULT NULL,
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
    v_group_id uuid := group_id;
    v_role_id uuid;

    v_name_id uuid := (names).resource_id;
    v_active_flag_id uuid := (flags).resource_id;
    v_request_limit_id uuid := (request_limits).resource_id;
    v_department_ids uuid[] := (departments).resource_ids;
    v_email_ids uuid[] := (emails).resource_ids;
    v_cohort_ids uuid[] := (cohorts).resource_ids;

    v_run_id uuid;
    v_call_id uuid;
BEGIN
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    IF v_request_limit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM request_limits_resource WHERE id = v_request_limit_id) THEN
        RAISE EXCEPTION 'Request limit resource not found: %', v_request_limit_id;
    END IF;

    IF v_department_ids IS NOT NULL THEN
        SELECT ARRAY_AGG(COALESCE(dr.id, dr_by_artifact.id) ORDER BY ord)
        INTO v_department_ids
        FROM unnest(v_department_ids) WITH ORDINALITY AS input_id(id, ord)
        LEFT JOIN departments_resource dr ON dr.id = input_id.id
        LEFT JOIN department_departments_junction ddj ON ddj.department_id = input_id.id
        LEFT JOIN departments_resource dr_by_artifact ON dr_by_artifact.id = ddj.departments_id;

        IF EXISTS (
            SELECT 1
            FROM unnest(v_department_ids) WITH ORDINALITY AS input_id(id, ord)
            LEFT JOIN departments_resource dr ON dr.id = input_id.id
            LEFT JOIN department_departments_junction ddj ON ddj.department_id = input_id.id
            LEFT JOIN departments_resource dr_by_artifact ON dr_by_artifact.id = ddj.departments_id
            WHERE dr.id IS NULL AND dr_by_artifact.id IS NULL
        ) THEN
            RAISE EXCEPTION 'Department resource not found';
        END IF;
    END IF;

    IF v_email_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(v_email_ids) AS email_id
        WHERE NOT EXISTS (SELECT 1 FROM emails_resource WHERE id = email_id)
    ) THEN
        RAISE EXCEPTION 'Email resource not found';
    END IF;

    IF v_cohort_ids IS NOT NULL THEN
        SELECT ARRAY_AGG(COALESCE(ca.id, cr.cohort_id) ORDER BY ord)
        INTO v_cohort_ids
        FROM unnest(v_cohort_ids) WITH ORDINALITY AS input_id(id, ord)
        LEFT JOIN cohort_artifact ca ON ca.id = input_id.id
        LEFT JOIN cohorts_resource cr ON cr.id = input_id.id;

        IF EXISTS (
            SELECT 1
            FROM unnest(v_cohort_ids) WITH ORDINALITY AS input_id(id, ord)
            LEFT JOIN cohort_artifact ca ON ca.id = input_id.id
            LEFT JOIN cohorts_resource cr ON cr.id = input_id.id
            WHERE ca.id IS NULL AND cr.id IS NULL
        ) THEN
            RAISE EXCEPTION 'Cohort not found';
        END IF;
    END IF;

    IF role IS NOT NULL THEN
        SELECT r.id INTO v_role_id
        FROM roles_resource r
        WHERE r.role = api_patch_profile_draft_v4.role::profile_type
        LIMIT 1;

        IF v_role_id IS NULL THEN
            RAISE EXCEPTION 'Role not found: %', role;
        END IF;
    END IF;

    IF input_draft_id IS NOT NULL THEN
        SELECT profile_drafts_entry.group_id INTO v_group_id
        FROM profile_drafts_entry
        WHERE profile_drafts_entry.id = input_draft_id;

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

        UPDATE profile_drafts_entry
        SET version = profile_drafts_entry.version + 1,
            updated_at = NOW(),
            group_id = COALESCE(profile_drafts_entry.group_id, v_group_id)
        WHERE profile_drafts_entry.id = input_draft_id
          AND EXISTS (
              SELECT 1
              FROM profile_drafts_profiles_connection pdc
              WHERE pdc.draft_id = profile_drafts_entry.id
                AND pdc.profiles_id = v_profile_id
          )
          AND profile_drafts_entry.version = expected_version
        RETURNING profile_drafts_entry.id, profile_drafts_entry.version
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
                    WHERE sessions_entry.profile_id = v_profile_id
                      AND sessions_entry.active = true
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            RETURNING id INTO v_group_id;
        END IF;

        INSERT INTO profile_drafts_entry (group_id)
        VALUES (v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO profile_drafts_profiles_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profile_id, v_new_version);
    END IF;

    DELETE FROM profile_drafts_names_connection WHERE draft_id = v_draft_id;
    DELETE FROM profile_drafts_flags_connection WHERE draft_id = v_draft_id;
    DELETE FROM profile_drafts_request_limits_connection WHERE draft_id = v_draft_id;
    DELETE FROM profile_drafts_departments_connection WHERE draft_id = v_draft_id;
    DELETE FROM profile_drafts_emails_connection WHERE draft_id = v_draft_id;
    DELETE FROM profile_drafts_cohorts_connection WHERE draft_id = v_draft_id;
    DELETE FROM profile_drafts_roles_connection WHERE draft_id = v_draft_id;

    IF v_name_id IS NOT NULL THEN
        INSERT INTO profile_drafts_names_connection (draft_id, names_id, version)
        VALUES (v_draft_id, v_name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO profile_drafts_flags_connection (draft_id, flags_id, version)
        VALUES (v_draft_id, v_active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_request_limit_id IS NOT NULL THEN
        INSERT INTO profile_drafts_request_limits_connection (draft_id, request_limits_id, version)
        VALUES (v_draft_id, v_request_limit_id, v_new_version)
        ON CONFLICT ON CONSTRAINT request_limits_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_department_ids IS NOT NULL THEN
        INSERT INTO profile_drafts_departments_connection (draft_id, departments_id, version)
        SELECT v_draft_id, department_id, v_new_version
        FROM UNNEST(v_department_ids) AS department_id
        ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_email_ids IS NOT NULL THEN
        INSERT INTO profile_drafts_emails_connection (draft_id, emails_id, version)
        SELECT v_draft_id, email_id, v_new_version
        FROM UNNEST(v_email_ids) AS email_id
        ON CONFLICT ON CONSTRAINT emails_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_cohort_ids IS NOT NULL THEN
        INSERT INTO profile_drafts_cohorts_connection (draft_id, cohorts_id, version)
        SELECT v_draft_id, cohort_id, v_new_version
        FROM UNNEST(v_cohort_ids) AS cohort_id
        ON CONFLICT ON CONSTRAINT cohorts_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_role_id IS NOT NULL THEN
        INSERT INTO profile_drafts_roles_connection (draft_id, roles_id, version)
        VALUES (v_draft_id, v_role_id, v_new_version)
        ON CONFLICT ON CONSTRAINT roles_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF (
        (names).create_tool_id IS NOT NULL OR (names).link_tool_id IS NOT NULL OR
        (flags).create_tool_id IS NOT NULL OR (flags).link_tool_id IS NOT NULL OR
        (request_limits).create_tool_id IS NOT NULL OR (request_limits).link_tool_id IS NOT NULL OR
        (departments).create_tool_id IS NOT NULL OR (departments).link_tool_id IS NOT NULL OR
        (emails).create_tool_id IS NOT NULL OR (emails).link_tool_id IS NOT NULL OR
        (cohorts).create_tool_id IS NOT NULL OR (cohorts).link_tool_id IS NOT NULL
    ) THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, v_group_id, NOW(), NOW());

        IF v_name_id IS NOT NULL AND (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_draft_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;

        IF v_name_id IS NOT NULL AND (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_draft_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;

        IF v_active_flag_id IS NOT NULL AND (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_draft_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;

        IF v_active_flag_id IS NOT NULL AND (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_draft_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;

        IF v_request_limit_id IS NOT NULL AND (request_limits).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_draft_create_request_limits_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((request_limits).create_tool_id, v_call_id);
            INSERT INTO request_limits_calls_connection (request_limits_id, call_id) VALUES (v_request_limit_id, v_call_id);
        END IF;

        IF v_request_limit_id IS NOT NULL AND (request_limits).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_draft_link_request_limits_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((request_limits).link_tool_id, v_call_id);
            INSERT INTO request_limits_calls_connection (request_limits_id, call_id) VALUES (v_request_limit_id, v_call_id);
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_draft_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 AND (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_draft_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;

        IF COALESCE(array_length(v_email_ids, 1), 0) > 0 AND (emails).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_draft_create_emails_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((emails).create_tool_id, v_call_id);
            INSERT INTO emails_calls_connection (emails_id, call_id)
            SELECT eid, v_call_id FROM UNNEST(v_email_ids) eid;
        END IF;

        IF COALESCE(array_length(v_email_ids, 1), 0) > 0 AND (emails).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_draft_link_emails_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((emails).link_tool_id, v_call_id);
            INSERT INTO emails_calls_connection (emails_id, call_id)
            SELECT eid, v_call_id FROM UNNEST(v_email_ids) eid;
        END IF;

        IF COALESCE(array_length(v_cohort_ids, 1), 0) > 0 AND (cohorts).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_draft_create_cohorts_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((cohorts).create_tool_id, v_call_id);
            INSERT INTO cohorts_calls_connection (cohorts_id, call_id)
            SELECT COALESCE(cr.id, ca.cohort_id), v_call_id
            FROM UNNEST(v_cohort_ids) cid
            LEFT JOIN cohorts_resource cr ON cr.id = cid
            LEFT JOIN cohort_artifact ca ON ca.id = cid
            WHERE COALESCE(cr.id, ca.cohort_id) IS NOT NULL;
        END IF;

        IF COALESCE(array_length(v_cohort_ids, 1), 0) > 0 AND (cohorts).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_draft_link_cohorts_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((cohorts).link_tool_id, v_call_id);
            INSERT INTO cohorts_calls_connection (cohorts_id, call_id)
            SELECT COALESCE(cr.id, ca.cohort_id), v_call_id
            FROM UNNEST(v_cohort_ids) cid
            LEFT JOIN cohorts_resource cr ON cr.id = cid
            LEFT JOIN cohort_artifact ca ON ca.id = cid
            WHERE COALESCE(cr.id, ca.cohort_id) IS NOT NULL;
        END IF;
    END IF;

    RETURN QUERY
    SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
