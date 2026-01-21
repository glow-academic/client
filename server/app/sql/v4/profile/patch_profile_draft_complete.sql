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
    route_ids uuid[] DEFAULT NULL,
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

    IF department_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(department_ids) AS department_id
        WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = department_id)
    ) THEN
        RAISE EXCEPTION 'Department resource not found';
    END IF;

    IF email_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(email_ids) AS email_id
        WHERE NOT EXISTS (SELECT 1 FROM emails_resource WHERE id = email_id)
    ) THEN
        RAISE EXCEPTION 'Email resource not found';
    END IF;

    IF cohort_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(cohort_ids) AS cohort_id
        WHERE NOT EXISTS (SELECT 1 FROM cohort_artifact WHERE id = cohort_id)
    ) THEN
        RAISE EXCEPTION 'Cohort not found';
    END IF;

    IF role IS NOT NULL THEN
        SELECT r.id INTO v_role_id
        FROM roles_resource r
        WHERE r.role = role::profile_role
        LIMIT 1;

        IF v_role_id IS NULL THEN
            RAISE EXCEPTION 'Role not found: %', role;
        END IF;
    END IF;

    IF route_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(route_ids) AS route_id
        WHERE NOT EXISTS (SELECT 1 FROM routes_resource WHERE id = route_id)
    ) THEN
        RAISE EXCEPTION 'Route resource not found';
    END IF;

    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        -- Get existing draft's group_id
        SELECT group_id INTO v_group_id FROM drafts WHERE id = input_draft_id;

        -- Create group if draft doesn't have one (safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups (created_at, updated_at)
            VALUES (NOW(), NOW())
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE drafts
        SET version = drafts.version + 1,
            updated_at = now(),
            group_id = COALESCE(group_id, v_group_id)
        WHERE id = input_draft_id
          AND drafts.profile_id = v_profile_id
          AND drafts.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;

            -- Delete old resource links
            DELETE FROM draft_names WHERE draft_names.draft_id = v_draft_id;
            DELETE FROM draft_flags WHERE draft_flags.draft_id = v_draft_id;
            DELETE FROM draft_request_limits WHERE draft_request_limits.draft_id = v_draft_id;
            DELETE FROM draft_departments WHERE draft_departments.draft_id = v_draft_id;
            DELETE FROM draft_emails WHERE draft_emails.draft_id = v_draft_id;
            DELETE FROM draft_cohorts WHERE draft_cohorts.draft_id = v_draft_id;
            DELETE FROM draft_roles WHERE draft_roles.draft_id = v_draft_id;
            DELETE FROM draft_routes WHERE draft_routes.draft_id = v_draft_id;

            -- Insert new resource links
            IF name_id IS NOT NULL THEN
                INSERT INTO draft_names (draft_id, names_id, version)
                VALUES (v_draft_id, name_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_names_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF active_flag_id IS NOT NULL THEN
                INSERT INTO draft_flags (draft_id, flags_id, version)
                VALUES (v_draft_id, active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF request_limit_id IS NOT NULL THEN
                INSERT INTO draft_request_limits (draft_id, request_limits_id, version)
                VALUES (v_draft_id, request_limit_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_request_limits_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF department_ids IS NOT NULL THEN
                INSERT INTO draft_departments (draft_id, departments_id, version)
                SELECT v_draft_id, department_id, v_new_version
                FROM UNNEST(department_ids) as department_id
                ON CONFLICT ON CONSTRAINT draft_departments_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF email_ids IS NOT NULL THEN
                INSERT INTO draft_emails (draft_id, emails_id, version)
                SELECT v_draft_id, email_id, v_new_version
                FROM UNNEST(email_ids) as email_id
                ON CONFLICT ON CONSTRAINT draft_emails_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF cohort_ids IS NOT NULL THEN
                INSERT INTO draft_cohorts (draft_id, cohorts_id, version)
                SELECT v_draft_id, cohort_id, v_new_version
                FROM UNNEST(cohort_ids) as cohort_id
                ON CONFLICT ON CONSTRAINT draft_cohorts_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF v_role_id IS NOT NULL THEN
                INSERT INTO draft_roles (draft_id, roles_id, version)
                VALUES (v_draft_id, v_role_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_roles_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF route_ids IS NOT NULL THEN
                INSERT INTO draft_routes (draft_id, routes_id, version)
                SELECT v_draft_id, route_id, v_new_version
                FROM UNNEST(route_ids) as route_id
                ON CONFLICT ON CONSTRAINT draft_routes_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;

    -- Create new draft with group
    INSERT INTO groups (created_at, updated_at)
    VALUES (NOW(), NOW())
    RETURNING id INTO v_group_id;

    INSERT INTO drafts (artifact, profile_id, group_id)
    VALUES ('profile'::artifacts, v_profile_id, v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;

    -- Link resources to draft
    IF name_id IS NOT NULL THEN
        INSERT INTO draft_names (draft_id, names_id, version)
        VALUES (v_draft_id, name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_names_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF active_flag_id IS NOT NULL THEN
        INSERT INTO draft_flags (draft_id, flags_id, version)
        VALUES (v_draft_id, active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF request_limit_id IS NOT NULL THEN
        INSERT INTO draft_request_limits (draft_id, request_limits_id, version)
        VALUES (v_draft_id, request_limit_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_request_limits_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF department_ids IS NOT NULL THEN
        INSERT INTO draft_departments (draft_id, departments_id, version)
        SELECT v_draft_id, department_id, v_new_version
        FROM UNNEST(department_ids) as department_id
        ON CONFLICT ON CONSTRAINT draft_departments_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF email_ids IS NOT NULL THEN
        INSERT INTO draft_emails (draft_id, emails_id, version)
        SELECT v_draft_id, email_id, v_new_version
        FROM UNNEST(email_ids) as email_id
        ON CONFLICT ON CONSTRAINT draft_emails_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF cohort_ids IS NOT NULL THEN
        INSERT INTO draft_cohorts (draft_id, cohorts_id, version)
        SELECT v_draft_id, cohort_id, v_new_version
        FROM UNNEST(cohort_ids) as cohort_id
        ON CONFLICT ON CONSTRAINT draft_cohorts_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF v_role_id IS NOT NULL THEN
        INSERT INTO draft_roles (draft_id, roles_id, version)
        VALUES (v_draft_id, v_role_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_roles_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF route_ids IS NOT NULL THEN
        INSERT INTO draft_routes (draft_id, routes_id, version)
        SELECT v_draft_id, route_id, v_new_version
        FROM UNNEST(route_ids) as route_id
        ON CONFLICT ON CONSTRAINT draft_routes_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
