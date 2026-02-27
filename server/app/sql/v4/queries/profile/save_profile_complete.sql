-- Unified save profile function - handles both create (input_profile_id = NULL) and update (input_profile_id provided)
-- Accepts composite resource action params directly (no draft intermediate step)
-- Follows persona/agent save pattern

-- 0) Drop and recreate composite types for resource actions
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

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_profile_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_profile_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function with composite resource action parameters
CREATE OR REPLACE FUNCTION api_save_profile_v4(
    profile_id uuid,
    input_profile_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    role text DEFAULT NULL,
    names types.profile_resource_action DEFAULT NULL,
    flags types.profile_resource_action DEFAULT NULL,
    request_limits types.profile_resource_action DEFAULT NULL,
    emails types.profile_multi_resource_action DEFAULT NULL,
    departments types.profile_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    out_profile_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_profile_id uuid;
    v_actor_profile_id uuid;
    v_actor_name text;
    is_create boolean;
    v_primary_email_index integer;
    v_primary_department_index integer;
    -- Resource IDs extracted from composites
    v_name_id uuid;
    v_active_flag_id uuid;
    v_request_limit_id uuid;
    v_email_ids uuid[];
    v_department_ids uuid[];
    -- Derived values
    v_name text;
    v_email_texts text[];
    v_role text;
    v_role_id uuid;
    v_active boolean;
    v_requests_per_day integer;
    -- Call tracking variables
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Assign parameters to local variables (extract from composites)
    v_actor_profile_id := profile_id;
    v_name_id := (names).resource_id;
    v_active_flag_id := (flags).resource_id;
    v_request_limit_id := (request_limits).resource_id;
    v_email_ids := COALESCE((emails).resource_ids, ARRAY[]::uuid[]);
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_role := role;

    is_create := (input_profile_id IS NULL);

    IF v_actor_profile_id IS NULL THEN
        RAISE EXCEPTION 'Profile ID is required';
    END IF;

    -- === VALIDATE RESOURCE IDS ===
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    IF v_request_limit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM request_limits_resource WHERE id = v_request_limit_id) THEN
        RAISE EXCEPTION 'Request limit resource not found: %', v_request_limit_id;
    END IF;

    -- Resolve department IDs (accept both departments_resource IDs and department_artifact IDs)
    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
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

    IF COALESCE(array_length(v_email_ids, 1), 0) > 0 AND EXISTS (
        SELECT 1
        FROM unnest(v_email_ids) AS email_id
        WHERE NOT EXISTS (SELECT 1 FROM emails_resource WHERE id = email_id)
    ) THEN
        RAISE EXCEPTION 'Email resource not found';
    END IF;

    -- === RESOLVE DERIVED VALUES ===

    -- Get name text from names_resource
    IF v_name_id IS NOT NULL THEN
        SELECT n.name INTO v_name FROM names_resource n WHERE n.id = v_name_id;
    END IF;

    -- Get email texts from emails_resource
    IF COALESCE(array_length(v_email_ids, 1), 0) > 0 THEN
        SELECT COALESCE(ARRAY_AGG(e.email ORDER BY ord), ARRAY[]::text[])
        INTO v_email_texts
        FROM unnest(v_email_ids) WITH ORDINALITY AS input_id(id, ord)
        JOIN emails_resource e ON e.id = input_id.id;
    ELSE
        v_email_texts := ARRAY[]::text[];
    END IF;

    -- Resolve role
    IF v_role IS NOT NULL THEN
        SELECT r.id INTO v_role_id
        FROM roles_resource r
        WHERE r.role = v_role::profile_type
        LIMIT 1;

        IF v_role_id IS NULL THEN
            RAISE EXCEPTION 'Role not found: %', v_role;
        END IF;
    END IF;

    -- If no role provided for update, keep existing role
    IF v_role IS NULL AND input_profile_id IS NOT NULL THEN
        SELECT r.id, r.role::text
        INTO v_role_id, v_role
        FROM profile_roles_junction pr
        JOIN roles_resource r ON pr.role_id = r.id
        WHERE pr.profile_id = input_profile_id
          AND pr.active = true
        LIMIT 1;
    END IF;

    IF v_role IS NULL THEN
        v_role := 'instructional';
    END IF;

    -- Resolve active flag
    v_active := (v_active_flag_id IS NOT NULL);

    -- Resolve request limit
    IF v_request_limit_id IS NOT NULL THEN
        SELECT rlr.requests_per_day
        INTO v_requests_per_day
        FROM request_limits_resource rlr
        WHERE rlr.id = v_request_limit_id
        LIMIT 1;
    END IF;

    -- Validate emails required
    IF v_email_texts IS NULL OR array_length(v_email_texts, 1) = 0 THEN
        RAISE EXCEPTION 'At least one email is required';
    END IF;

    v_primary_email_index := 0;

    IF array_length(v_department_ids, 1) IS NULL THEN
        v_primary_department_index := NULL;
    ELSE
        v_primary_department_index := 0;
    END IF;

    -- Get actor name
    SELECT
        COALESCE(
            (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1),
            ''
        ) INTO v_actor_name
    FROM profile_artifact p
    WHERE p.id = v_actor_profile_id;

    -- === CREATE OR UPDATE PROFILE ARTIFACT ===
    IF is_create THEN
        INSERT INTO profile_artifact (id, created_at, updated_at)
        VALUES (gen_random_uuid(), NOW(), NOW())
        RETURNING id INTO v_profile_id;

        -- Check if primary email already exists (only for create)
        IF EXISTS (
            SELECT 1 FROM profile_emails_junction pe
            JOIN emails_resource e ON pe.email_id = e.id
            WHERE e.email = v_email_texts[v_primary_email_index + 1]
              AND pe.active = true
        ) THEN
            RAISE EXCEPTION 'Email already exists';
        END IF;
    ELSE
        v_profile_id := input_profile_id;

        IF NOT EXISTS (SELECT 1 FROM profile_artifact WHERE id = v_profile_id) THEN
            RAISE EXCEPTION 'Profile not found: %', v_profile_id;
        END IF;

        UPDATE profile_artifact
        SET updated_at = NOW()
        WHERE id = v_profile_id;
    END IF;

    -- === TOOL CALL TRACKING ===
    IF group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, group_id, NOW(), NOW());
    END IF;

    -- names
    IF v_run_id IS NOT NULL AND v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    -- flags
    IF v_run_id IS NOT NULL AND v_active_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
    END IF;

    -- request_limits
    IF v_run_id IS NOT NULL AND v_request_limit_id IS NOT NULL THEN
        IF (request_limits).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_create_request_limits_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((request_limits).create_tool_id, v_call_id);
            INSERT INTO request_limits_calls_connection (request_limits_id, call_id) VALUES (v_request_limit_id, v_call_id);
        END IF;
        IF (request_limits).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_link_request_limits_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((request_limits).link_tool_id, v_call_id);
            INSERT INTO request_limits_calls_connection (request_limits_id, call_id) VALUES (v_request_limit_id, v_call_id);
        END IF;
    END IF;

    -- departments (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
        END IF;
        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
        END IF;
    END IF;

    -- emails (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_email_ids, 1), 0) > 0 THEN
        IF (emails).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_create_emails_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((emails).create_tool_id, v_call_id);
            INSERT INTO emails_calls_connection (emails_id, call_id)
            SELECT eid, v_call_id FROM UNNEST(v_email_ids) AS eid;
        END IF;
        IF (emails).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'profile_link_emails_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((emails).link_tool_id, v_call_id);
            INSERT INTO emails_calls_connection (emails_id, call_id)
            SELECT eid, v_call_id FROM UNNEST(v_email_ids) AS eid;
        END IF;
    END IF;

    -- === JUNCTION LINKING ===
    RETURN QUERY
    WITH params AS (
        SELECT
            v_profile_id AS target_profile_id,
            v_name AS name,
            v_name_id AS name_id,
            COALESCE(v_email_texts, ARRAY[]::text[]) AS email_texts,
            v_email_ids AS email_ids,
            v_role AS role,
            v_role_id AS role_id,
            COALESCE(v_active, true) AS active,
            COALESCE(v_department_ids, ARRAY[]::uuid[]) AS department_ids,
            v_primary_email_index AS primary_email_index,
            v_primary_department_index AS primary_department_index,
            is_create AS is_create,
            v_requests_per_day AS requests_per_day,
            v_active_flag_id AS active_flag_id,
            v_request_limit_id AS request_limit_id,
            v_actor_profile_id AS actor_profile_id
    ),
    -- Insert/update name in names table if provided
    name_resource AS (
        INSERT INTO names_resource (name, created_at)
        SELECT name, NOW()
        FROM params
        WHERE name IS NOT NULL AND name != ''
        ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
        RETURNING id as name_id, name
    ),
    -- Delete old name links if updating
    delete_old_names AS (
        DELETE FROM profile_names_junction
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create)
          AND EXISTS (SELECT 1 FROM name_resource)
    ),
    -- Link profile to name
    link_profile_name AS (
        INSERT INTO profile_names_junction (profile_id, name_id, created_at)
        SELECT
            x.target_profile_id,
            nr.name_id,
            NOW()
        FROM params x
        CROSS JOIN name_resource nr
        WHERE x.name IS NOT NULL AND x.name != ''
        ON CONFLICT (profile_id) DO UPDATE SET
            name_id = EXCLUDED.name_id
    ),
    -- Look up role from roles_resource
    role_resource AS (
        SELECT id as role_id
        FROM roles_resource
        WHERE id = COALESCE(
            (SELECT role_id FROM params),
            (SELECT id FROM roles_resource WHERE role = (SELECT role FROM params)::profile_type AND active = true ORDER BY created_at LIMIT 1)
        )
        LIMIT 1
    ),
    profile_type_upsert AS (
        DELETE FROM profile_roles_junction
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create)
          AND EXISTS (SELECT 1 FROM role_resource)
        RETURNING profile_id
    ),
    profile_type_insert AS (
        INSERT INTO profile_roles_junction (profile_id, role_id, created_at, generated, mcp)
        SELECT x.target_profile_id, rr.role_id, NOW(), false, false
        FROM params x
        CROSS JOIN role_resource rr
        WHERE x.role IS NOT NULL
        ON CONFLICT (profile_id, role_id) DO NOTHING
    ),
    -- Link/update profile active flag
    link_profile_active_flag AS (
        INSERT INTO profile_flags_junction (profile_id, flag_id, value, created_at)
        SELECT x.target_profile_id,
            f.id,
            x.active,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'profile_active'
          AND x.active IS NOT NULL
        ON CONFLICT ON CONSTRAINT profile_flags_pkey DO UPDATE SET
            value = EXCLUDED.value
    ),
    -- Handle emails if provided
    all_emails_data AS (
        SELECT
            email,
            CASE WHEN ord = (SELECT primary_email_index + 1 FROM params) THEN true ELSE false END as is_primary
        FROM unnest((SELECT email_texts FROM params)) WITH ORDINALITY AS e(email, ord)
        WHERE array_length((SELECT email_texts FROM params), 1) > 0
    ),
    email_update AS (
        UPDATE profile_emails_junction SET
            active = false,
            is_primary = false
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create)
          AND array_length((SELECT email_texts FROM params), 1) > 0
    ),
    placeholder_call_id AS (
        SELECT id FROM calls_entry LIMIT 1
    ),
    email_resources AS (
        INSERT INTO emails_resource (email, created_at)
        SELECT DISTINCT
            aed.email,
            (SELECT id FROM placeholder_call_id),
            NOW()
        FROM all_emails_data aed
        WHERE array_length((SELECT email_texts FROM params), 1) > 0
        ON CONFLICT (email) DO UPDATE SET created_at = EXCLUDED.created_at
        RETURNING id as email_id, email
    ),
    email_insert AS (
        INSERT INTO profile_emails_junction (profile_id, email, email_id, is_primary, active)
        SELECT
            x.target_profile_id,
            er.email,
            er.email_id,
            aed.is_primary,
            true
        FROM params x
        CROSS JOIN all_emails_data aed
        JOIN email_resources er ON er.email = aed.email
        WHERE array_length(x.email_texts, 1) > 0
        ON CONFLICT (profile_id, email_id) DO UPDATE SET
            email = EXCLUDED.email,
            is_primary = EXCLUDED.is_primary,
            active = true
    ),
    -- Handle departments if provided
    department_deactivate AS (
        UPDATE profile_departments_junction SET
            active = false,
            is_primary = false
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create)
          AND array_length((SELECT department_ids FROM params), 1) >= 0
          AND (
              array_length((SELECT department_ids FROM params), 1) IS NULL
              OR department_id NOT IN (SELECT unnest((SELECT department_ids FROM params)))
          )
    ),
    department_insert AS (
        INSERT INTO profile_departments_junction (profile_id, department_id, is_primary, active)
        SELECT
            x.target_profile_id,
            dept.dept_id,
            (dept.ord - 1 = (SELECT primary_department_index FROM params)) as is_primary,
            true
        FROM params x
        CROSS JOIN unnest(x.department_ids) WITH ORDINALITY AS dept(dept_id, ord)
        WHERE array_length(x.department_ids, 1) > 0
        ON CONFLICT (profile_id, department_id) DO UPDATE SET
            is_primary = EXCLUDED.is_primary,
            active = true
    ),
    -- Handle requests_per_day if provided
    request_limit_resource AS (
        INSERT INTO request_limits_resource (requests_per_day, created_at)
        SELECT
            x.requests_per_day,
            (SELECT id FROM placeholder_call_id),
            NOW()
        FROM params x
        WHERE x.requests_per_day IS NOT NULL
        RETURNING id as request_limit_id, requests_per_day
    ),
    request_limit_delete AS (
        DELETE FROM profile_request_limits_junction
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create)
          AND EXISTS (SELECT 1 FROM request_limit_resource)
    ),
    request_limit_insert AS (
        INSERT INTO profile_request_limits_junction (
            profile_id,
            request_limit_id,
            requests_per_day,
            active,
            created_at
        )
        SELECT
            x.target_profile_id,
            rlr.request_limit_id,
            rlr.requests_per_day,
            true,
            NOW()
        FROM params x
        CROSS JOIN request_limit_resource rlr
        WHERE x.requests_per_day IS NOT NULL
    ),
    -- Sync linked resources with name
    sync_artifact_resources AS (
        UPDATE profiles_resource r
        SET name = nr.name
        FROM profile_profiles_junction j
        CROSS JOIN params p
        LEFT JOIN name_resource nr ON true
        WHERE j.profiles_id = r.id
          AND j.profile_id = p.target_profile_id
        RETURNING r.id
    )
    SELECT
        x.target_profile_id AS out_profile_id,
        v_actor_name
    FROM params x
    LIMIT 1;
END;
$$;
