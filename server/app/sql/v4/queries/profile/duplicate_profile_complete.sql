-- Duplicate profile (without cloning login email bindings)
-- Copies role/flags/departments/request-limits and creates a new name with " Copy".
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_duplicate_profile_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_profile_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_duplicate_profile_v4(
    target_profile_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    new_profile_id uuid,
    original_name text
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        target_profile_id AS target_profile_id,
        profile_id AS profile_id
),
source_profile AS (
    SELECT
        p.id,
        COALESCE(
            (
                SELECT n.name
                FROM profile_names_junction pn
                JOIN names_resource n ON n.id = pn.name_id
                WHERE pn.profile_id = p.id
                ORDER BY pn.created_at DESC
                LIMIT 1
            ),
            'Profile'
        ) AS original_name
    FROM profile_artifact p
    WHERE p.id = (SELECT target_profile_id FROM params)
),
new_profile AS (
    INSERT INTO profile_artifact (id, created_at, updated_at)
    SELECT gen_random_uuid(), NOW(), NOW()
    FROM source_profile
    RETURNING id
),
new_name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT sp.original_name || ' Copy', NOW()
    FROM source_profile sp
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id
),
copy_name AS (
    INSERT INTO profile_names_junction (profile_id, name_id, created_at)
    SELECT
        np.id,
        nnr.id,
        NOW()
    FROM new_profile np
    CROSS JOIN new_name_resource nnr
),
copy_role AS (
    INSERT INTO profile_roles_junction (profile_id, role_id, created_at, generated, mcp, active)
    SELECT
        np.id,
        pr.role_id,
        NOW(),
        COALESCE(pr.generated, false),
        COALESCE(pr.mcp, false),
        COALESCE(pr.active, true)
    FROM new_profile np
    JOIN profile_roles_junction pr ON pr.profile_id = (SELECT id FROM source_profile)
    ON CONFLICT (profile_id, role_id) DO UPDATE SET active = EXCLUDED.active
),
copy_flags AS (
    INSERT INTO profile_flags_junction (profile_id, flag_id, value, created_at)
    SELECT
        np.id,
        pf.flag_id,
        false,
        NOW()
    FROM new_profile np
    JOIN profile_flags_junction pf ON pf.profile_id = (SELECT id FROM source_profile)
    ON CONFLICT ON CONSTRAINT profile_flags_pkey DO UPDATE SET value = EXCLUDED.value
),
copy_departments AS (
    INSERT INTO profile_departments_junction (profile_id, department_id, is_primary, active)
    SELECT
        np.id,
        pd.department_id,
        pd.is_primary,
        pd.active
    FROM new_profile np
    JOIN profile_departments_junction pd ON pd.profile_id = (SELECT id FROM source_profile)
    ON CONFLICT (profile_id, department_id) DO UPDATE
    SET is_primary = EXCLUDED.is_primary, active = EXCLUDED.active
),
copy_request_limits AS (
    INSERT INTO profile_request_limits_junction (
        profile_id,
        request_limit_id,
        requests_per_day,
        active,
        created_at
    )
    SELECT
        np.id,
        prl.request_limit_id,
        prl.requests_per_day,
        prl.active,
        NOW()
    FROM new_profile np
    JOIN profile_request_limits_junction prl ON prl.profile_id = (SELECT id FROM source_profile)
)
SELECT
    (SELECT id FROM new_profile LIMIT 1) AS new_profile_id,
    (SELECT original_name FROM source_profile LIMIT 1) AS original_name
$$;

