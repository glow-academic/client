-- Unified save profile function - draft-first create/update
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
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

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function (returns simple types)

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_save_profile_v4(
    draft_id uuid,
    actor_profile_id uuid DEFAULT NULL,
    input_profile_id uuid DEFAULT NULL
)
RETURNS TABLE (
    profile_id uuid,
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
    v_draft_profile_id uuid;
    v_group_id uuid;
    v_draft_id uuid;
    v_name text;
    v_emails text[];
    v_role text;
    v_active boolean;
    v_cohort_ids uuid[];
    v_department_ids uuid[];
    v_route_ids uuid[];
    v_requests_per_day integer;
    v_role_id uuid;
    v_active_flag_id uuid;
    v_request_limit_id uuid;
BEGIN
    v_draft_id := draft_id;
    v_actor_profile_id := actor_profile_id;
    is_create := (input_profile_id IS NULL);

    IF v_actor_profile_id IS NULL THEN
        RAISE EXCEPTION 'Profile ID is required';
    END IF;

    IF v_draft_id IS NULL THEN
        RAISE EXCEPTION 'Draft ID is required';
    END IF;

    SELECT pdj.profiles_id, d.group_id
    INTO v_draft_profile_id, v_group_id
    FROM view_drafts_entry d
    LEFT JOIN profiles_drafts_connection pdj ON pdj.draft_id = d.id
    WHERE d.id = v_draft_id;

    IF v_draft_profile_id IS NULL THEN
        RAISE EXCEPTION 'Draft not found: %', v_draft_id;
    END IF;

    IF v_draft_profile_id <> v_actor_profile_id THEN
        RAISE EXCEPTION 'Draft does not belong to profile';
    END IF;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Draft group_id not found: %', v_draft_id;
    END IF;

    -- Load draft resources
    SELECT n.name
    INTO v_name
    FROM names_drafts_connection dn
    JOIN names_resource n ON n.id = dn.names_id
    WHERE dn.draft_id = v_draft_id
    LIMIT 1;

    SELECT COALESCE(ARRAY_AGG(e.email ORDER BY de.created_at), ARRAY[]::text[])
    INTO v_emails
    FROM emails_drafts_connection de
    JOIN emails_resource e ON e.id = de.emails_id
    WHERE de.draft_id = v_draft_id
      AND de.active = true;

    SELECT r.id, r.role::text
    INTO v_role_id, v_role
    FROM roles_drafts_connection dr
    JOIN roles_resource r ON r.id = dr.roles_id
    WHERE dr.draft_id = v_draft_id
      AND dr.active = true
    LIMIT 1;

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

    SELECT df.flags_id
    INTO v_active_flag_id
    FROM flags_drafts_connection df
    WHERE df.draft_id = v_draft_id
    LIMIT 1;

    v_active := (v_active_flag_id IS NOT NULL);

    SELECT drl.request_limits_id
    INTO v_request_limit_id
    FROM request_limits_drafts_connection drl
    WHERE drl.draft_id = v_draft_id
    LIMIT 1;

    IF v_request_limit_id IS NOT NULL THEN
        SELECT rlr.requests_per_day
        INTO v_requests_per_day
        FROM request_limits_resource rlr
        WHERE rlr.id = v_request_limit_id
        LIMIT 1;
    END IF;

    SELECT COALESCE(ARRAY_AGG(dd.departments_id ORDER BY dd.created_at), ARRAY[]::uuid[])
    INTO v_department_ids
    FROM departments_drafts_connection dd
    WHERE dd.draft_id = v_draft_id
      AND dd.active = true;

    SELECT COALESCE(ARRAY_AGG(dc.cohorts_id ORDER BY dc.created_at), ARRAY[]::uuid[])
    INTO v_cohort_ids
    FROM cohorts_drafts_connection dc
    WHERE dc.draft_id = v_draft_id
      AND dc.active = true;

    SELECT COALESCE(ARRAY_AGG(dr.routes_id ORDER BY dr.created_at), ARRAY[]::uuid[])
    INTO v_route_ids
    FROM routes_drafts_connection dr
    WHERE dr.draft_id = v_draft_id
      AND dr.active = true;

    IF array_length(v_route_ids, 1) IS NULL THEN
        v_route_ids := NULL;
    END IF;

    IF v_emails IS NULL OR array_length(v_emails, 1) = 0 THEN
        RAISE EXCEPTION 'At least one email is required';
    END IF;

    v_primary_email_index := 0;

    IF array_length(v_emails, 1) IS NOT NULL THEN
        IF v_primary_email_index < 0 OR v_primary_email_index >= array_length(v_emails, 1) THEN
            RAISE EXCEPTION 'Invalid primary_email_index';
        END IF;
    END IF;

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
    
    -- Create or UPDATE profile_artifact first
    IF is_create THEN
        -- CREATE path: generate new profile_id
        INSERT INTO profile_artifact (id, created_at, updated_at)
        VALUES (gen_random_uuid(), NOW(), NOW())
        RETURNING id INTO v_profile_id;
        -- Check if primary email already exists (only for create)
        IF EXISTS (
            SELECT 1 FROM profile_emails_junction pe
            JOIN emails_resource e ON pe.email_id = e.id
            WHERE e.email = v_emails[v_primary_email_index + 1]
              AND pe.active = true
        ) THEN
            RAISE EXCEPTION 'Email already exists';
        END IF;
    ELSE
        -- UPDATE path: use provided profile_id
        v_profile_id := input_profile_id;
        
        -- Check if profile exists
        IF NOT EXISTS (SELECT 1 FROM profile_artifact WHERE id = v_profile_id) THEN
            RAISE EXCEPTION 'Profile not found: %', v_profile_id;
        END IF;
        
        -- Update profile_artifact
        UPDATE profile_artifact
        SET updated_at = NOW()
        WHERE id = v_profile_id;
    END IF;
    
    -- Continue with profile save using SQL
    RETURN QUERY
    WITH params AS (
        SELECT
            v_profile_id AS target_profile_id,
            v_name AS name,
            COALESCE(v_emails, ARRAY[]::text[]) AS emails,
            v_role AS role,
            v_role_id AS role_id,
            COALESCE(v_active, true) AS active,
            COALESCE(v_cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
            COALESCE(v_department_ids, ARRAY[]::uuid[]) AS department_ids,
            v_route_ids AS route_ids,
            v_primary_email_index AS primary_email_index,
            v_primary_department_index AS primary_department_index,
            is_create AS is_create,
            v_requests_per_day AS requests_per_day,
            v_actor_profile_id AS actor_profile_id
    ),
    resolved_route_ids AS (
        SELECT
            CASE
                WHEN p.route_ids IS NOT NULL THEN p.route_ids
                WHEN p.role IS NOT NULL THEN COALESCE(
                    (SELECT ARRAY_AGG(rr_route.id ORDER BY rr_route.route)
                     FROM artifact_roles_relation ar
                     JOIN artifact_routes_relation art ON art.artifact = ar.artifact
                     JOIN routes_resource rr_route ON rr_route.route = art.route
                     WHERE ar.role = p.role::profile_type),
                    ARRAY[]::uuid[]
                )
                ELSE ARRAY[]::uuid[]
            END as route_ids
        FROM params p
    ),
    placeholder_call_id AS (
        SELECT id FROM view_calls_entry LIMIT 1
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
    -- Look up role from roles_resource (use role_id if available, else first active match by profile_type)
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
        -- Delete old role link if updating
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
        FROM unnest((SELECT emails FROM params)) WITH ORDINALITY AS e(email, ord)
        WHERE array_length((SELECT emails FROM params), 1) > 0
    ),
    email_update AS (
        -- Deactivate all existing emails if updating
        UPDATE profile_emails_junction SET
            active = false,
            is_primary = false
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create)
          AND array_length((SELECT emails FROM params), 1) > 0
    ),
    email_resources AS (
        INSERT INTO emails_resource (email, created_at)
        SELECT DISTINCT
            aed.email,
            (SELECT id FROM placeholder_call_id),
            NOW()
        FROM all_emails_data aed
        WHERE array_length((SELECT emails FROM params), 1) > 0
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
        WHERE array_length(x.emails, 1) > 0
        ON CONFLICT (profile_id, email_id) DO UPDATE SET 
            email = EXCLUDED.email,
            is_primary = EXCLUDED.is_primary,
            active = true
    ),
    -- Handle cohorts if provided
    cohort_deactivate AS (
        UPDATE profile_cohorts_junction SET
            active = false
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create)
          AND array_length((SELECT cohort_ids FROM params), 1) >= 0
          AND (
              array_length((SELECT cohort_ids FROM params), 1) IS NULL
              OR cohort_id NOT IN (SELECT unnest((SELECT cohort_ids FROM params)))
          )
    ),
    cohort_insert AS (
        INSERT INTO profile_cohorts_junction (profile_id, cohort_id, active)
        SELECT 
            x.target_profile_id,
            cohort_id,
            true
        FROM params x
        CROSS JOIN unnest(x.cohort_ids) as cohort_id
        WHERE array_length(x.cohort_ids, 1) > 0
        ON CONFLICT (profile_id, cohort_id) DO UPDATE SET
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
    route_delete AS (
        DELETE FROM profile_routes_junction
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create AND route_ids IS NOT NULL)
    ),
    route_insert AS (
        INSERT INTO profile_routes_junction (profile_id, route_id, active, created_at, generated, mcp)
        SELECT 
            x.target_profile_id,
            route_id,
            true,
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN resolved_route_ids rri
        CROSS JOIN UNNEST(rri.route_ids) as route_id
        WHERE (x.is_create OR x.route_ids IS NOT NULL)
          AND COALESCE(array_length(rri.route_ids, 1), 0) > 0
        ON CONFLICT (profile_id, route_id) DO UPDATE SET
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
    -- Sync linked resources with name (profiles don't have description)
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
        x.target_profile_id AS profile_id,
        v_actor_name
    FROM params x
    LIMIT 1;
END;
$$;
