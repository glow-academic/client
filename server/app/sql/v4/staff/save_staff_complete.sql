-- Unified save staff function - handles both create (input_staff_id = NULL) and update (input_staff_id provided)
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_save_staff_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_staff_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_staff_v4(
    first_name_id uuid,
    last_name_id uuid,
    department_ids uuid[],
    cohort_ids uuid[],
    profile_id uuid,
    input_staff_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    request_limit_id uuid DEFAULT NULL,
    role text DEFAULT NULL,
    emails text[] DEFAULT NULL,
    primary_email_index integer DEFAULT NULL
)
RETURNS TABLE (
    staff_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_staff_id uuid;
    v_actor_name text;
    is_create boolean;
    v_group_id uuid;
BEGIN
    -- Determine if create or update
    is_create := (input_staff_id IS NULL);
    
    -- Create or UPDATE profile_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path - create a group first, then create profile
        -- Create a new group for this staff member
        INSERT INTO groups (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_group_id;
        
        -- Create profile with group_id
        INSERT INTO profile_artifact (created_at, updated_at, role, group_id)
        VALUES (NOW(), NOW(), COALESCE(role::profile_role, 'instructional'::profile_role), v_group_id)
        RETURNING id INTO v_staff_id;
    ELSE
        -- UPDATE path
        v_staff_id := input_staff_id;
        UPDATE profile_artifact
        SET updated_at = NOW(),
            role = COALESCE(role::profile_role, profile_artifact.role)
        WHERE id = v_staff_id;
    END IF;
    
    -- Validate required resource IDs exist (same for both)
    IF first_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = first_name_id) THEN
        RAISE EXCEPTION 'First name resource not found: %', first_name_id;
    END IF;
    
    IF last_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = last_name_id) THEN
        RAISE EXCEPTION 'Last name resource not found: %', last_name_id;
    END IF;
    
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;
    
    IF request_limit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM request_limits_resource WHERE id = request_limit_id) THEN
        RAISE EXCEPTION 'Request limit resource not found: %', request_limit_id;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM profile_names WHERE profile_id = v_staff_id AND type IN ('first'::type_profile_names, 'last'::type_profile_names);
        DELETE FROM profile_departments WHERE profile_id = v_staff_id;
        DELETE FROM cohort_profiles WHERE profile_id = v_staff_id;
        -- Update existing active flag if it exists
        UPDATE profile_flags SET
            flag_id = COALESCE(active_flag_id, profile_flags.flag_id),
            value = CASE WHEN active_flag_id IS NOT NULL THEN true ELSE false END,
            updated_at = NOW()
        WHERE profile_id = v_staff_id
          AND type = 'active'::type_profile_flags;
        -- Update request limit if it exists
        UPDATE profile_request_limits SET
            request_limit_id = COALESCE(request_limit_id, profile_request_limits.request_limit_id),
            active = CASE WHEN request_limit_id IS NOT NULL THEN true ELSE false END,
            updated_at = NOW()
        WHERE profile_id = v_staff_id;
    END IF;
    
    -- Continue with staff save using SQL (profile already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_staff_id AS staff_id,
            first_name_id,
            last_name_id,
            active_flag_id,
            request_limit_id,
            COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
            COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
            api_save_staff_v4.profile_id AS profile_id,
            COALESCE(emails, ARRAY[]::text[]) AS emails,
            COALESCE(primary_email_index, 0) AS primary_email_index
    ),
    user_profile AS (
        SELECT 
            (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
            COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
        FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments
        WHERE profile_departments.profile_id = (SELECT p.staff_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments
        WHERE profile_departments.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT 
            CASE 
                WHEN (SELECT p.staff_id FROM params p) IS NULL THEN
                    -- Validate create permissions
                    (SELECT validate_department_create_permissions(
                        up.role::text,
                        x.department_ids::text[]
                    ) FROM params x CROSS JOIN user_profile up)
                ELSE
                    -- Validate update permissions
                    (SELECT validate_department_update_permissions(
                        up.role::text,
                        ocd.department_ids,
                        ud.department_ids
                    ) FROM user_profile up
                    CROSS JOIN object_current_departments ocd
                    CROSS JOIN user_departments ud)
            END as validation_passed
    ),
    actor_profile AS (
        SELECT 
            x.profile_id AS actor_profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link profile to first name
    link_profile_first_name AS (
        INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
        SELECT 
            x.staff_id,
            x.first_name_id,
            'first'::type_profile_names,
            NOW(),
            NOW()
        FROM params x
        WHERE x.first_name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT profile_names_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link profile to last name
    link_profile_last_name AS (
        INSERT INTO profile_names (profile_id, name_id, type, created_at, updated_at)
        SELECT 
            x.staff_id,
            x.last_name_id,
            'last'::type_profile_names,
            NOW(),
            NOW()
        FROM params x
        WHERE x.last_name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT profile_names_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Insert or UPDATE profile_artifact active flag (UPDATE handled above for update case, INSERT here handles both via ON CONFLICT)
    insert_profile_active_flag AS (
        INSERT INTO profile_flags (profile_id, flag_id, type, value, created_at, updated_at)
        SELECT 
            x.staff_id,
            COALESCE(x.active_flag_id, f.id),
            'active'::type_profile_flags,
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'active'
        ON CONFLICT ON CONSTRAINT profile_flags_pkey DO UPDATE SET 
            flag_id = COALESCE(EXCLUDED.flag_id, profile_flags.flag_id),
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Link request limit
    link_request_limit AS (
        INSERT INTO profile_request_limits (profile_id, request_limit_id, active, created_at, updated_at)
        SELECT 
            x.staff_id,
            x.request_limit_id,
            true,
            NOW(),
            NOW()
        FROM params x
        WHERE x.request_limit_id IS NOT NULL
        ON CONFLICT (profile_id) DO UPDATE SET 
            request_limit_id = EXCLUDED.request_limit_id,
            active = true,
            updated_at = NOW()
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO profile_departments (profile_id, department_id, is_primary, active, created_at, updated_at)
        SELECT 
            x.staff_id,
            dept_id,
            (ROW_NUMBER() OVER (PARTITION BY x.staff_id ORDER BY dept_id) = 1) as is_primary,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT profile_departments_pkey DO UPDATE SET
            is_primary = EXCLUDED.is_primary,
            active = true,
            updated_at = NOW()
    ),
    -- Link cohorts (old ones already deleted above if update)
    link_cohorts AS (
        INSERT INTO cohort_profiles (cohort_id, profile_id, active)
        SELECT 
            cohort_id,
            x.staff_id,
            true
        FROM params x
        CROSS JOIN UNNEST(x.cohort_ids) as cohort_id
        WHERE COALESCE(array_length(x.cohort_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT cohort_profiles_pkey DO UPDATE SET
            active = true
    ),
    -- Handle emails (deactivate all existing, then insert new ones)
    deactivate_emails AS (
        UPDATE profile_emails SET
            active = false,
            is_primary = false,
            updated_at = NOW()
        WHERE profile_id = (SELECT staff_id FROM params LIMIT 1)
    ),
    all_emails_expanded AS (
        SELECT 
            email_val as email,
            CASE 
                WHEN (idx - 1) = (SELECT primary_email_index FROM params LIMIT 1) THEN true
                ELSE false
            END as is_primary,
            idx - 1 as email_index
        FROM params x
        CROSS JOIN LATERAL unnest(x.emails) WITH ORDINALITY AS t(email_val, idx)
        WHERE COALESCE(array_length(x.emails, 1), 0) > 0
    ),
    link_emails AS (
        INSERT INTO profile_emails (profile_id, email, is_primary, active, created_at, updated_at)
        SELECT 
            x.staff_id,
            aee.email,
            aee.is_primary,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN all_emails_expanded aee
        WHERE COALESCE(array_length(x.emails, 1), 0) > 0
        ON CONFLICT (profile_id, email) DO UPDATE SET
            is_primary = EXCLUDED.is_primary,
            active = true,
            updated_at = NOW()
    )
    SELECT 
        x.staff_id AS staff_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
