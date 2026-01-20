-- Unified save profile function - handles both create (input_profile_id = NULL) and update (input_profile_id provided)
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
    actor_profile_id uuid,
    first_name text DEFAULT NULL,
    last_name text DEFAULT NULL,
    emails text[] DEFAULT NULL,
    role text DEFAULT NULL,
    active boolean DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    route_ids uuid[] DEFAULT NULL,
    primary_email_index integer DEFAULT NULL,
    primary_department_index integer DEFAULT NULL,
    input_profile_id uuid DEFAULT NULL,
    last_login timestamptz DEFAULT NULL,
    last_active timestamptz DEFAULT NULL,
    requests_per_day integer DEFAULT NULL
)
RETURNS TABLE (
    profile_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_profile_id uuid;
    v_actor_name text;
    is_create boolean;
    v_primary_email_index integer;
BEGIN
    -- Determine if create or update
    is_create := (input_profile_id IS NULL);
    
    -- Set primary email index (default to 0 for create, use provided for update)
    IF is_create THEN
        v_primary_email_index := COALESCE(primary_email_index, 0);
    ELSE
        v_primary_email_index := COALESCE(primary_email_index, 0);
    END IF;
    
    -- Validate emails array for create mode
    IF is_create THEN
        IF emails IS NULL OR array_length(emails, 1) = 0 THEN
            RAISE EXCEPTION 'At least one email is required';
        END IF;
        IF v_primary_email_index < 0 OR v_primary_email_index >= array_length(emails, 1) THEN
            RAISE EXCEPTION 'Invalid primary_email_index';
        END IF;
    END IF;
    
    -- Validate emails array for update mode (if provided)
    IF NOT is_create AND emails IS NOT NULL THEN
        IF array_length(emails, 1) = 0 THEN
            RAISE EXCEPTION 'At least one email is required';
        END IF;
        IF v_primary_email_index < 0 OR v_primary_email_index >= array_length(emails, 1) THEN
            RAISE EXCEPTION 'Invalid primary_email_index';
        END IF;
    END IF;
    
    -- Get actor name
    SELECT 
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' ||
            (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1),
            ''
        ) INTO v_actor_name
    FROM profile_artifact p
    WHERE p.id = api_save_profile_v4.actor_profile_id;
    
    -- Create or UPDATE profile_artifact first
    IF is_create THEN
        -- CREATE path: generate new profile_id
        INSERT INTO profile_artifact (id, created_at, updated_at)
        VALUES (gen_random_uuid(), NOW(), NOW())
        RETURNING id INTO v_profile_id;
        
        -- Check if primary email already exists (only for create)
        IF EXISTS (
            SELECT 1 FROM profile_emails pe
            JOIN emails_resource e ON pe.email_id = e.id
            WHERE e.email = emails[v_primary_email_index + 1]
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
            first_name,
            last_name,
            COALESCE(emails, ARRAY[]::text[]) AS emails,
            role,
            COALESCE(active, true) AS active,
            COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
            COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
            route_ids AS route_ids,
            v_primary_email_index AS primary_email_index,
            COALESCE(primary_department_index, 0) AS primary_department_index,
            is_create AS             is_create,
            last_login,
            last_active,
            requests_per_day,
            api_save_profile_v4.actor_profile_id AS actor_profile_id
    ),
    resolved_route_ids AS (
        SELECT
            CASE
                WHEN p.route_ids IS NOT NULL THEN p.route_ids
                WHEN p.role IS NOT NULL THEN COALESCE(
                    (SELECT ARRAY_AGG(rr_route.id ORDER BY rr_route.route)
                     FROM role_routes rr
                     JOIN routes_resource rr_route ON rr_route.route = rr.route
                     WHERE rr.role = p.role::profile_role
                       AND rr.active = true),
                    ARRAY[]::uuid[]
                )
                ELSE ARRAY[]::uuid[]
            END as route_ids
        FROM params p
    ),
    -- Insert/update first_name in names table if provided
    first_name_resource AS (
        INSERT INTO names_resource (name, created_at, updated_at)
        SELECT first_name, NOW(), NOW()
        FROM params
        WHERE first_name IS NOT NULL AND first_name != ''
        ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
        RETURNING id as first_name_id, name
    ),
    -- Insert/update last_name in names table if provided
    last_name_resource AS (
        INSERT INTO names_resource (name, created_at, updated_at)
        SELECT last_name, NOW(), NOW()
        FROM params
        WHERE last_name IS NOT NULL AND last_name != ''
        ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
        RETURNING id as last_name_id, name
    ),
    -- Delete old name links if updating
    delete_old_names AS (
        DELETE FROM profile_names
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create)
          AND (
              EXISTS (SELECT 1 FROM first_name_resource)
              OR EXISTS (SELECT 1 FROM last_name_resource)
          )
    ),
    -- Link profile to first_name
    link_profile_first_name AS (
        INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
        SELECT 
            x.target_profile_id,
            fnr.first_name_id,
            'first'::type_profile_names,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN first_name_resource fnr
        WHERE x.first_name IS NOT NULL AND x.first_name != ''
        ON CONFLICT (profile_id, name_id, type) DO UPDATE SET updated_at = NOW()
    ),
    -- Link profile to last_name
    link_profile_last_name AS (
        INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
        SELECT 
            x.target_profile_id,
            lnr.last_name_id,
            'last'::type_profile_names,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN last_name_resource lnr
        WHERE x.last_name IS NOT NULL AND x.last_name != ''
        ON CONFLICT (profile_id, name_id, type) DO UPDATE SET updated_at = NOW()
    ),
    -- Insert/update role via profile_roles junction if provided
    role_resource AS (
        INSERT INTO roles_resource (role, created_at, updated_at, active, generated, mcp, call_id)
        SELECT x.role::profile_role, NOW(), NOW(), true, false, false, NULL
        FROM params x
        WHERE x.role IS NOT NULL
        ON CONFLICT (role) DO UPDATE SET updated_at = NOW()
        RETURNING id as role_id
    ),
    profile_role_upsert AS (
        -- Delete old role link if updating
        DELETE FROM profile_roles 
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create)
          AND EXISTS (SELECT 1 FROM role_resource)
        RETURNING profile_id
    ),
    profile_role_insert AS (
        INSERT INTO profile_roles (profile_id, role_id, created_at, updated_at, generated, mcp)
        SELECT x.target_profile_id, rr.role_id, NOW(), NOW(), false, false
        FROM params x
        CROSS JOIN role_resource rr
        WHERE x.role IS NOT NULL
        ON CONFLICT (profile_id, role_id) DO UPDATE SET updated_at = NOW()
    ),
    -- Link/update profile active flag
    link_profile_active_flag AS (
        INSERT INTO profile_flags (profile_id, flag_id, value, created_at, updated_at) SELECT x.target_profile_id,
            f.id,
            'active'::type_profile_flags,
            x.active,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'active'
          AND x.active IS NOT NULL
        ON CONFLICT (profile_id, flag_id, type) DO UPDATE SET 
            value = x.active,
            updated_at = NOW()
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
        UPDATE profile_emails SET
            active = false,
            is_primary = false,
            updated_at = NOW()
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create)
          AND array_length((SELECT emails FROM params), 1) > 0
    ),
    placeholder_call_id AS (
        SELECT id FROM calls LIMIT 1
    ),
    email_resources AS (
        INSERT INTO emails_resource (email, call_id, created_at, updated_at)
        SELECT DISTINCT
            aed.email,
            (SELECT id FROM placeholder_call_id),
            NOW(),
            NOW()
        FROM all_emails_data aed
        WHERE array_length((SELECT emails FROM params), 1) > 0
        ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
        RETURNING id as email_id, email
    ),
    email_insert AS (
        INSERT INTO profile_emails (profile_id, email_id, is_primary, active)
        SELECT 
            x.target_profile_id,
            er.email_id,
            aed.is_primary,
            true
        FROM params x
        CROSS JOIN all_emails_data aed
        JOIN email_resources er ON er.email = aed.email
        WHERE array_length(x.emails, 1) > 0
        ON CONFLICT (profile_id, email_id) DO UPDATE SET 
            is_primary = EXCLUDED.is_primary,
            active = true,
            updated_at = NOW()
    ),
    -- Handle cohorts if provided
    cohort_deactivate AS (
        UPDATE profile_cohorts SET
            active = false,
            updated_at = NOW()
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create)
          AND array_length((SELECT cohort_ids FROM params), 1) >= 0
          AND (
              array_length((SELECT cohort_ids FROM params), 1) IS NULL
              OR cohort_id NOT IN (SELECT unnest((SELECT cohort_ids FROM params)))
          )
    ),
    cohort_insert AS (
        INSERT INTO profile_cohorts (profile_id, cohort_id, active)
        SELECT 
            x.target_profile_id,
            cohort_id,
            true
        FROM params x
        CROSS JOIN unnest(x.cohort_ids) as cohort_id
        WHERE array_length(x.cohort_ids, 1) > 0
        ON CONFLICT (profile_id, cohort_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    -- Handle departments if provided
    department_deactivate AS (
        UPDATE profile_departments SET
            active = false,
            is_primary = false,
            updated_at = NOW()
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create)
          AND array_length((SELECT department_ids FROM params), 1) >= 0
          AND (
              array_length((SELECT department_ids FROM params), 1) IS NULL
              OR department_id NOT IN (SELECT unnest((SELECT department_ids FROM params)))
          )
    ),
    department_insert AS (
        INSERT INTO profile_departments (profile_id, department_id, is_primary, active)
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
            active = true,
            updated_at = NOW()
    ),
    route_delete AS (
        DELETE FROM profile_routes
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create AND route_ids IS NOT NULL)
    ),
    route_insert AS (
        INSERT INTO profile_routes (profile_id, route_id, active, created_at, updated_at, generated, mcp)
        SELECT 
            x.target_profile_id,
            route_id,
            true,
            NOW(),
            NOW(),
            false,
            false
        FROM params x
        CROSS JOIN resolved_route_ids rri
        CROSS JOIN UNNEST(rri.route_ids) as route_id
        WHERE (x.is_create OR x.route_ids IS NOT NULL)
          AND COALESCE(array_length(rri.route_ids, 1), 0) > 0
        ON CONFLICT (profile_id, route_id) DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    -- Handle last_login if provided (update mode only)
    login_resource AS (
        INSERT INTO logins_resource (last_login, created_at, updated_at, active, generated, mcp, call_id)
        SELECT x.last_login, NOW(), NOW(), true, false, false, NULL
        FROM params x
        WHERE x.last_login IS NOT NULL
          AND NOT x.is_create
        ON CONFLICT (last_login) DO UPDATE SET updated_at = NOW()
        RETURNING id as login_id
    ),
    profile_login_upsert AS (
        DELETE FROM profile_logins 
        WHERE profile_id = (SELECT target_profile_id FROM params)
          AND EXISTS (SELECT 1 FROM params WHERE NOT is_create AND last_login IS NOT NULL)
    ),
    profile_login_insert AS (
        INSERT INTO profile_logins (profile_id, login_id, created_at, updated_at, generated, mcp)
        SELECT x.target_profile_id, lr.login_id, NOW(), NOW(), false, false
        FROM params x
        CROSS JOIN login_resource lr
        WHERE x.last_login IS NOT NULL
          AND NOT x.is_create
    ),
    -- Handle last_active if provided (update mode only)
    insert_activity AS (
        INSERT INTO profile_activity (profile_id, last_active)
        SELECT x.target_profile_id, x.last_active
        FROM params x
        WHERE x.last_active IS NOT NULL
          AND NOT x.is_create
    ),
    -- Handle requests_per_day if provided (update mode only)
    request_limit_resource AS (
        INSERT INTO request_limits_resource (requests_per_day, call_id, created_at, updated_at)
        SELECT 
            x.requests_per_day,
            (SELECT id FROM placeholder_call_id),
            NOW(),
            NOW()
        FROM params x
        WHERE x.requests_per_day IS NOT NULL
          AND NOT x.is_create
        RETURNING id as request_limit_id, requests_per_day
    ),
    request_limit_upsert AS (
        INSERT INTO profile_request_limits (profile_id, request_limit_id, active)
        SELECT 
            x.target_profile_id,
            rlr.request_limit_id,
            true
        FROM params x
        CROSS JOIN request_limit_resource rlr
        WHERE x.requests_per_day IS NOT NULL
          AND NOT x.is_create
        ON CONFLICT (profile_id)
        DO UPDATE SET 
            request_limit_id = EXCLUDED.request_limit_id,
            active = true,
            updated_at = NOW()
    )
    SELECT 
        x.target_profile_id AS profile_id,
        v_actor_name
    FROM params x
    LIMIT 1;
END;
$$;
