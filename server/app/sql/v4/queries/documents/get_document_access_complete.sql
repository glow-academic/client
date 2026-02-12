-- Document Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and document state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_document_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_document_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_document_access_v4(
    profile_id uuid,
    document_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    document_exists boolean,
    draft_version int,
    group_id uuid,


    -- Document state for Python permission logic
    document_department_ids uuid[],
    active_scenario_count int,
    total_scenario_links bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        document_id AS document_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if document exists
document_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT document_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM document_artifact WHERE id = (SELECT document_id FROM params))::boolean
        END as document_exists
),
-- Resolve canonical document group context (draft override handled in Python service layer)
document_group_data AS (
    SELECT
        (
            SELECT gr.id
            FROM groups_resource gr
            WHERE gr.active = true
            ORDER BY gr.created_at DESC
            LIMIT 1
        ) as group_id
    FROM params x
    WHERE TRUE
    LIMIT 1
),
-- Draft version is resolved in Python via internal draft fetch layer
draft_version_data AS (
    SELECT NULL::int as draft_version
),
-- Get document departments (for access check)
document_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(dd.department_id ORDER BY dd.created_at) FILTER (WHERE dd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN document_departments_junction dd ON dd.document_id = x.document_id AND dd.active = true
    WHERE x.document_id IS NOT NULL
),
-- Get document edit state (active scenario count + total scenario links)
document_edit_state AS (
    SELECT
        COALESCE(COUNT(sd.document_id) FILTER (WHERE sd.active = true), 0)::int as active_scenario_count,
        COALESCE(COUNT(sd.document_id), 0)::bigint as total_scenario_links
    FROM params x
    LEFT JOIN scenario_documents_junction sd ON sd.document_id = x.document_id
    WHERE x.document_id IS NOT NULL
)
SELECT
    -- Basic metadata
    (SELECT document_exists FROM document_exists_check) as document_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    dgd.group_id,

    -- User context for Python permission logic

    -- Document state for Python permission logic
    COALESCE((SELECT department_ids FROM document_departments_data), ARRAY[]::uuid[]) as document_department_ids,
    COALESCE((SELECT active_scenario_count FROM document_edit_state), 0) as active_scenario_count,
    COALESCE((SELECT total_scenario_links FROM document_edit_state), 0) as total_scenario_links
FROM params x
CROSS JOIN document_group_data dgd;
$$;

