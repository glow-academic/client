-- Profile ID Fetching (Query 2 of Two-Pass Architecture)
-- Returns all resource IDs for parallel resource fetching
-- Agent/tool resolution moved to settings layer in Python

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_profile_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profile_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop legacy composite type (no longer needed)
DROP TYPE IF EXISTS profile_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_profile_ids_v4(
    profile_id uuid,
    target_profile_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or profile junction)
    name_id uuid,
    request_limit_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    email_ids uuid[],
    department_ids uuid[],
    cohort_ids uuid[],

    -- Role (from draft or junction)
    role text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        target_profile_id AS target_profile_id,
        draft_id AS draft_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Single-select resource IDs
name_resource_data AS (
    SELECT
        COALESCE(
            (SELECT dn.names_id FROM profile_drafts_names_connection dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pn.name_id FROM profile_names_junction pn WHERE pn.profile_id = (SELECT target_profile_id FROM params) LIMIT 1),
            NULL::uuid
        ) as name_id
    FROM params
),
request_limit_resource_data AS (
    SELECT
        COALESCE(
            (SELECT drl.request_limits_id
             FROM profile_drafts_request_limits_connection drl
             WHERE drl.draft_id = (SELECT draft_id FROM params)
             LIMIT 1),
            (SELECT prl.request_limit_id
             FROM profile_request_limits_junction prl
             WHERE prl.profile_id = (SELECT target_profile_id FROM params)
               AND prl.active = true
             ORDER BY prl.created_at DESC
             LIMIT 1),
            NULL::uuid
        ) as request_limit_id
    FROM params
),
flag_resource_data AS (
    SELECT
        COALESCE(
            (SELECT df.flags_id
             FROM profile_drafts_flags_connection df
             WHERE df.draft_id = (SELECT draft_id FROM params)
             LIMIT 1),
            (SELECT pf.flag_id
             FROM profile_flags_junction pf
             JOIN flags_resource f ON pf.flag_id = f.id
             WHERE pf.profile_id = (SELECT target_profile_id FROM params)
               AND f.name = 'profile_active'
               AND pf.value = true
             LIMIT 1),
            NULL::uuid
        ) as active_flag_id
    FROM params
),
-- Multi-select resource IDs
email_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(de.emails_id ORDER BY de.created_at)
             FROM profile_drafts_emails_connection de
             WHERE de.draft_id = (SELECT draft_id FROM params)
               AND de.active = true),
            (SELECT ARRAY_AGG(pe.email_id ORDER BY pe.is_primary DESC, pe.created_at)
             FROM profile_emails_junction pe
             WHERE pe.profile_id = (SELECT target_profile_id FROM params)
               AND pe.active = true),
            ARRAY[]::uuid[]
        ) as email_ids
    FROM params
    LIMIT 1
),
department_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(dd.departments_id ORDER BY dd.created_at)
             FROM profile_drafts_departments_connection dd
             WHERE dd.draft_id = (SELECT draft_id FROM params)
               AND dd.active = true),
            (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at)
             FROM profile_departments_junction pd
             WHERE pd.profile_id = (SELECT target_profile_id FROM params)
               AND pd.active = true),
            ARRAY[]::uuid[]
        ) as department_ids
    FROM params
    LIMIT 1
),
cohort_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(dc.cohorts_id ORDER BY dc.created_at)
             FROM profile_drafts_cohorts_connection dc
             WHERE dc.draft_id = (SELECT draft_id FROM params)
               AND dc.active = true),
            (SELECT ARRAY_AGG(pc.cohort_id ORDER BY pc.created_at)
             FROM profile_cohorts_junction pc
             WHERE pc.profile_id = (SELECT target_profile_id FROM params)
               AND pc.active = true),
            ARRAY[]::uuid[]
        ) as cohort_ids
    FROM params
    LIMIT 1
),
-- Role (from draft or junction)
target_role_data AS (
    SELECT
        COALESCE(
            (
                SELECT r.role::text
                FROM profile_drafts_roles_connection dr
                JOIN roles_resource r ON dr.roles_id = r.id
                WHERE dr.draft_id = (SELECT draft_id FROM params)
                  AND dr.active = true
                LIMIT 1
            ),
            CASE
                WHEN (SELECT target_profile_id FROM params) IS NULL THEN NULL::text
                ELSE (
                    SELECT r.role::text
                    FROM profile_roles_junction pr
                    JOIN roles_resource r ON pr.role_id = r.id
                    WHERE pr.profile_id = (SELECT target_profile_id FROM params)
                      AND pr.active = true
                    LIMIT 1
                )
            END
        ) as role
    FROM params
    LIMIT 1
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT request_limit_id FROM request_limit_resource_data) as request_limit_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT email_ids FROM email_ids_data) as email_ids,
    (SELECT department_ids FROM department_ids_data) as department_ids,
    (SELECT cohort_ids FROM cohort_ids_data) as cohort_ids,

    -- Role
    (SELECT role FROM target_role_data) as role
FROM params x;
$$;
