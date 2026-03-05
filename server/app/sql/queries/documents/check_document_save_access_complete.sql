-- Document Save Access Check
-- Returns user role, user departments, and document state for Python to compute save permissions
-- For update mode: returns user_role, user_department_ids, document_department_ids, active_scenario_count
-- For create mode: returns user_role, user_department_ids (document fields NULL)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_document_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_document_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_document_save_access_v4(
    profile_id uuid,
    document_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Document state for Python permission logic (NULL for create mode)
    document_department_ids text[],
    active_scenario_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        document_id AS document_id
),
-- Get document edit state (for update mode)
document_edit_state AS (
    SELECT
        COALESCE(
            ARRAY_AGG(dd.departments_id::text) FILTER (WHERE dd.departments_id IS NOT NULL),
            ARRAY[]::text[]
        ) as department_ids,
        (SELECT COUNT(sd.documents_id)::bigint
         FROM scenario_documents_junction sd
         WHERE sd.documents_id = (SELECT document_id FROM params) AND sd.active = true
        ) as active_scenario_count
    FROM params x
    LEFT JOIN document_departments_junction dd ON dd.document_id = x.document_id AND dd.active = true
    WHERE x.document_id IS NOT NULL
)
SELECT
    (SELECT department_ids FROM document_edit_state) as document_department_ids,
    COALESCE((SELECT active_scenario_count FROM document_edit_state), 0)::bigint as active_scenario_count
FROM params x
$$;

