-- Field Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and field state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_field_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_field_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_field_access_v4(
    profile_id uuid,
    field_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    field_exists boolean,
    effective_draft_version int,
    group_id uuid,


    -- Field state for Python permission logic
    field_department_ids uuid[]
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        field_id AS field_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if field exists
field_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT field_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM field_artifact WHERE id = (SELECT field_id FROM params))::boolean
        END as field_exists
),
-- Create a new group if no draft_group_id provided (guarantees group_id is always returned)
ensure_group AS (
    INSERT INTO groups_entry (created_at)
    SELECT NOW()
    WHERE draft_group_id IS NULL
    RETURNING id
),
effective_group AS (
    SELECT COALESCE(draft_group_id, (SELECT id FROM ensure_group)) as group_id
),
-- Get field departments (for access check)
field_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(fd.departments_id ORDER BY fd.created_at) FILTER (WHERE fd.departments_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN field_departments_junction fd ON fd.field_id = x.field_id AND fd.active = true
    WHERE x.field_id IS NOT NULL
)
SELECT
    -- Basic metadata
    (SELECT field_exists FROM field_exists_check) as field_exists,
    draft_version as effective_draft_version,
    (SELECT group_id FROM effective_group) as group_id,

    -- User context for Python permission logic

    -- Field state for Python permission logic
    COALESCE((SELECT department_ids FROM field_departments_data), ARRAY[]::uuid[]) as field_department_ids
FROM params x;
$$;

