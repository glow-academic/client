-- Persona Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and persona state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_persona_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_persona_access_v4(
    profile_id uuid,
    persona_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Basic metadata
    actor_name text,
    persona_exists boolean,
    draft_version int,
    group_id uuid,

    -- User context for Python permission logic
    user_role text,
    user_department_ids uuid[],

    -- Persona state for Python permission logic
    persona_department_ids uuid[],
    active_scenario_count int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        persona_id AS persona_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if persona exists
persona_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM persona_artifact WHERE id = (SELECT persona_id FROM params))::boolean
        END as persona_exists
),
-- Get user profile info
user_profile AS (
    SELECT role, actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Get user's departments
user_departments AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT pd.department_id), ARRAY[]::uuid[]) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Get group_id from draft
draft_group_data AS (
    SELECT
        COALESCE(
            d.group_id,
            (SELECT id FROM groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
),
-- Get draft version
draft_version_data AS (
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
),
-- Get persona departments (for access check)
persona_departments_data AS (
    SELECT COALESCE(ARRAY_AGG(pd.department_id ORDER BY pd.created_at), ARRAY[]::uuid[]) as department_ids
    FROM params x
    LEFT JOIN persona_departments_junction pd ON pd.persona_id = x.persona_id AND pd.active = true
    WHERE x.persona_id IS NOT NULL
),
-- Get persona edit state (for active_scenario_count)
persona_edit_state AS (
    SELECT * FROM view_persona_edit_state WHERE persona_id = (SELECT persona_id FROM params)
)
SELECT
    -- Basic metadata
    up.actor_name::text as actor_name,
    (SELECT persona_exists FROM persona_exists_check) as persona_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    dgd.group_id,

    -- User context for Python permission logic
    up.role::text as user_role,
    ud.department_ids as user_department_ids,

    -- Persona state for Python permission logic
    COALESCE((SELECT department_ids FROM persona_departments_data), ARRAY[]::uuid[]) as persona_department_ids,
    COALESCE((SELECT active_scenario_count FROM persona_edit_state), 0) as active_scenario_count
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud
CROSS JOIN draft_group_data dgd;
$$;
