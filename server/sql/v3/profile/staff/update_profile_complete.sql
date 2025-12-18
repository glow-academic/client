-- Update staff profile with lookup, update, department, cohorts, and request limit in single query (DHH style)
-- Parameters: $1=profile_id (uuid), $2=first_name, $3=last_name, $4=email, $5=role, $6=active, 
--             $7=cohort_ids (uuid[]), $8=department_ids (uuid[]), $9=primary_department_index (int, nullable),
--             $10=requests_per_day (int, nullable), $11=current_profile_id (uuid)
-- Note: $4=email is now the primary email to update (replaces existing primary email)
-- Returns: id, first_name, last_name, name (concatenated), actor_name

WITH actor_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $11::uuid
),
profile_check AS (
    -- Check if profile exists and get name
    SELECT 
        id,
        first_name,
        last_name,
        first_name || ' ' || last_name as name
    FROM profiles 
    WHERE id = $1::uuid
),
profile_update AS (
    -- Update profile (only if exists)
    UPDATE profiles SET
        first_name = $2,
        last_name = $3,
        role = $5,
        active = $6,
        updated_at = NOW()
    WHERE id = $1::uuid
        AND EXISTS (SELECT 1 FROM profile_check)
    RETURNING id, first_name, last_name
),
email_deactivate AS (
    -- Deactivate current primary email
    UPDATE profile_emails SET
        is_primary = false,
        active = false,
        updated_at = NOW()
    WHERE profile_id = $1::uuid
        AND is_primary = true
        AND EXISTS (SELECT 1 FROM profile_update)
        AND $4::text IS NOT NULL
),
email_update AS (
    -- Insert or activate new primary email
    INSERT INTO profile_emails (profile_id, email, is_primary, active)
    SELECT 
        pu.id, $4::text, true, true
    FROM profile_update pu
    WHERE $4::text IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM profile_emails WHERE email = $4::text AND active = true)
    ON CONFLICT (email) DO UPDATE SET
        profile_id = EXCLUDED.profile_id,
        is_primary = true,
        active = true,
        updated_at = NOW()
),
cohort_deactivate AS (
    -- Deactivate existing cohort relationships not in the new list (or all if empty array)
    UPDATE cohort_profiles SET
        active = false,
        updated_at = NOW()
    WHERE profile_id = $1::uuid
        AND EXISTS (SELECT 1 FROM profile_update)
        AND (
            COALESCE(array_length($7::uuid[], 1), 0) = 0
            OR cohort_id NOT IN (
                SELECT unnest($7::uuid[])
            )
        )
),
cohort_insert AS (
    -- Insert or activate cohort relationships
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        cohort_id,
        pu.id,
        true
    FROM profile_update pu
    CROSS JOIN unnest($7::uuid[]) as cohort_id
    WHERE COALESCE(array_length($7::uuid[], 1), 0) > 0
        AND EXISTS (SELECT 1 FROM profile_update)
    ON CONFLICT (cohort_id, profile_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
department_deactivate_all AS (
    -- Deactivate all existing department relationships (or all if empty array)
    UPDATE profile_departments SET
        active = false,
        is_primary = false,
        updated_at = NOW()
    WHERE profile_id = $1::uuid
        AND EXISTS (SELECT 1 FROM profile_update)
        AND (
            COALESCE(array_length($8::uuid[], 1), 0) = 0
            OR department_id NOT IN (
                SELECT unnest($8::uuid[])
            )
        )
),
department_insert AS (
    -- Insert or update department relationships (set primary based on index)
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active)
    SELECT 
        pu.id,
        dept.dept_id,
        (dept.ord - 1 = COALESCE($9::int, 0)) as is_primary,
        true
    FROM profile_update pu
    CROSS JOIN unnest($8::uuid[]) WITH ORDINALITY AS dept(dept_id, ord)
    WHERE COALESCE(array_length($8::uuid[], 1), 0) > 0
        AND EXISTS (SELECT 1 FROM profile_update)
    ON CONFLICT (profile_id, department_id) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        active = true,
        updated_at = NOW()
),
request_limit_upsert AS (
    -- Upsert request limit if provided
    INSERT INTO profile_request_limits (profile_id, requests_per_day, active)
    SELECT 
        pu.id, $10::int, true
    FROM profile_update pu
    WHERE $10::int IS NOT NULL
        AND EXISTS (SELECT 1 FROM profile_update)
    ON CONFLICT (profile_id)
    DO UPDATE SET 
        requests_per_day = EXCLUDED.requests_per_day,
        active = true,
        updated_at = NOW()
)
-- Return profile info (always returns a row if profile exists)
SELECT 
    pc.id,
    pc.first_name,
    pc.last_name,
    pc.name,
    ap.actor_name
FROM profile_check pc
CROSS JOIN actor_profile ap
LIMIT 1

