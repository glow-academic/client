-- Patch profile draft - accepts resource IDs and creates/updates draft
-- Creates draft if input_draft_id is NULL, updates if exists
-- Links resources via junction tables

-- Drop function if exists (handles signature variations)
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
    name_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    request_limit_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    email_ids uuid[] DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
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
    v_group_id uuid;
    v_role_id uuid;
    v_department_ids uuid[];
    v_cohort_ids uuid[];
BEGIN
    -- Validate resource IDs exist (error if missing and provided)
    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;

    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;

    IF request_limit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM request_limits_resource WHERE id = request_limit_id) THEN
        RAISE EXCEPTION 'Request limit resource not found: %', request_limit_id;
    END IF;

    IF department_ids IS NOT NULL THEN
        SELECT ARRAY_AGG(COALESCE(dr.id, dr_by_artifact.id) ORDER BY ord)
        INTO v_department_ids
        FROM unnest(department_ids) WITH ORDINALITY AS input_id(id, ord)
        LEFT JOIN departments_resource dr ON dr.id = input_id.id
        LEFT JOIN department_departments_junction ddj ON ddj.department_id = input_id.id
        LEFT JOIN departments_resource dr_by_artifact ON dr_by_artifact.id = ddj.departments_id;

        IF EXISTS (
            SELECT 1
            FROM unnest(department_ids) WITH ORDINALITY AS input_id(id, ord)
            LEFT JOIN departments_resource dr ON dr.id = input_id.id
            LEFT JOIN department_departments_junction ddj ON ddj.department_id = input_id.id
        LEFT JOIN departments_resource dr_by_artifact ON dr_by_artifact.id = ddj.departments_id
            WHERE dr.id IS NULL AND dr_by_artifact.id IS NULL
        ) THEN
            RAISE EXCEPTION 'Department resource not found';
        END IF;
    END IF;

    IF email_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(email_ids) AS email_id
        WHERE NOT EXISTS (SELECT 1 FROM emails_resource WHERE id = email_id)
    ) THEN
        RAISE EXCEPTION 'Email resource not found';
    END IF;

    IF cohort_ids IS NOT NULL THEN
        SELECT ARRAY_AGG(COALESCE(ca.id, cr.cohort_id) ORDER BY ord)
        INTO v_cohort_ids
        FROM unnest(cohort_ids) WITH ORDINALITY AS input_id(id, ord)
        LEFT JOIN cohort_artifact ca ON ca.id = input_id.id
        LEFT JOIN cohorts_resource cr ON cr.id = input_id.id;

        IF EXISTS (
            SELECT 1
            FROM unnest(cohort_ids) WITH ORDINALITY AS input_id(id, ord)
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

    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        -- Get existing draft's group_id
        SELECT group_id INTO v_group_id FROM drafts_entry WHERE id = input_draft_id;

        -- Create group if draft doesn't have one (safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (NOW(), NOW(), (SELECT id FROM sessions_entry WHERE sessions_entry.profile_id = v_profile_id AND sessions_entry.active = true ORDER BY created_at DESC LIMIT 1))
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE drafts_entry
        SET version = drafts_entry.version + 1,
            updated_at = now(),
            group_id = COALESCE(drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (SELECT 1 FROM profile_drafts_junction pdj WHERE pdj.draft_id = drafts_entry.id AND pdj.profile_id = v_profile_id)
          AND drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;

            -- Delete old resource links
            DELETE FROM names_draft WHERE names_draft.draft_id = v_draft_id;
            DELETE FROM flags_draft WHERE flags_draft.draft_id = v_draft_id;
            DELETE FROM request_limits_draft WHERE request_limits_draft.draft_id = v_draft_id;
            DELETE FROM departments_draft WHERE departments_draft.draft_id = v_draft_id;
            DELETE FROM emails_draft WHERE emails_draft.draft_id = v_draft_id;
            DELETE FROM cohorts_draft WHERE cohorts_draft.draft_id = v_draft_id;
            DELETE FROM roles_draft WHERE roles_draft.draft_id = v_draft_id;

            -- Insert new resource links
            IF name_id IS NOT NULL THEN
                INSERT INTO names_draft (draft_id, names_id, version)
                VALUES (v_draft_id, name_id, v_new_version)
                ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF active_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF request_limit_id IS NOT NULL THEN
                INSERT INTO request_limits_draft (draft_id, request_limits_id, version)
                VALUES (v_draft_id, request_limit_id, v_new_version)
                ON CONFLICT ON CONSTRAINT request_limits_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF v_department_ids IS NOT NULL THEN
                INSERT INTO departments_draft (draft_id, departments_id, version)
                SELECT v_draft_id, department_id, v_new_version
                FROM UNNEST(v_department_ids) as department_id
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF email_ids IS NOT NULL THEN
                INSERT INTO emails_draft (draft_id, emails_id, version)
                SELECT v_draft_id, email_id, v_new_version
                FROM UNNEST(email_ids) as email_id
                ON CONFLICT ON CONSTRAINT emails_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF v_cohort_ids IS NOT NULL THEN
                INSERT INTO cohorts_draft (draft_id, cohorts_id, version)
                SELECT v_draft_id, cohort_id, v_new_version
                FROM UNNEST(v_cohort_ids) as cohort_id
                ON CONFLICT ON CONSTRAINT cohorts_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF v_role_id IS NOT NULL THEN
                INSERT INTO roles_draft (draft_id, roles_id, version)
                VALUES (v_draft_id, v_role_id, v_new_version)
                ON CONFLICT ON CONSTRAINT roles_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;

    -- Create new draft with group
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    VALUES (NOW(), NOW(), (SELECT id FROM sessions_entry WHERE sessions_entry.profile_id = v_profile_id AND sessions_entry.active = true ORDER BY created_at DESC LIMIT 1))
    RETURNING id INTO v_group_id;

    INSERT INTO drafts_entry (artifact, group_id)
    VALUES ('profile'::artifact_type, v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;

    -- Link profile to draft
    INSERT INTO profile_drafts_junction (profile_id, draft_id) VALUES (v_profile_id, v_draft_id);

    -- Link resources to draft
    IF name_id IS NOT NULL THEN
        INSERT INTO names_draft (draft_id, names_id, version)
        VALUES (v_draft_id, name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF active_flag_id IS NOT NULL THEN
        INSERT INTO flags_draft (draft_id, flags_id, version)
        VALUES (v_draft_id, active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF request_limit_id IS NOT NULL THEN
        INSERT INTO request_limits_draft (draft_id, request_limits_id, version)
        VALUES (v_draft_id, request_limit_id, v_new_version)
        ON CONFLICT ON CONSTRAINT request_limits_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_department_ids IS NOT NULL THEN
        INSERT INTO departments_draft (draft_id, departments_id, version)
        SELECT v_draft_id, department_id, v_new_version
        FROM UNNEST(v_department_ids) as department_id
        ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF email_ids IS NOT NULL THEN
        INSERT INTO emails_draft (draft_id, emails_id, version)
        SELECT v_draft_id, email_id, v_new_version
        FROM UNNEST(email_ids) as email_id
        ON CONFLICT ON CONSTRAINT emails_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_cohort_ids IS NOT NULL THEN
        INSERT INTO cohorts_draft (draft_id, cohorts_id, version)
        SELECT v_draft_id, cohort_id, v_new_version
        FROM UNNEST(v_cohort_ids) as cohort_id
        ON CONFLICT ON CONSTRAINT cohorts_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_role_id IS NOT NULL THEN
        INSERT INTO roles_draft (draft_id, roles_id, version)
        VALUES (v_draft_id, v_role_id, v_new_version)
        ON CONFLICT ON CONSTRAINT roles_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
