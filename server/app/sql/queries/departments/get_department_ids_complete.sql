-- Department ID Fetching (Query 2 of Two-Pass Architecture)
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
        WHERE proname = 'api_get_department_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_department_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop legacy composite type (no longer needed)
DROP TYPE IF EXISTS department_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_department_ids_v4(
    profile_id uuid,
    department_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or department junction)
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    settings_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        department_id AS department_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Single-select resource IDs (canonical only)
name_resource_data AS (
    SELECT
        (SELECT dn.name_id FROM department_names_junction dn WHERE dn.department_id = (SELECT department_id FROM params) LIMIT 1) as name_id
    FROM params
),
description_resource_data AS (
    SELECT
        (SELECT dd.description_id FROM department_descriptions_junction dd WHERE dd.department_id = (SELECT department_id FROM params) LIMIT 1) as description_id
    FROM params
),
flag_resource_data AS (
    SELECT
        (SELECT df.flag_id
         FROM department_flags_junction df
         JOIN flags_resource f ON df.flag_id = f.id
         WHERE df.department_id = (SELECT department_id FROM params)
           AND f.name = 'department_active'
           AND f.value = TRUE
         LIMIT 1) as active_flag_id
    FROM params
),
-- Multi-select resource IDs: settings
settings_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT department_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ds.settings_id ORDER BY ds.created_at)
                 FROM department_settings_junction ds
                 WHERE ds.department_id = (SELECT department_id FROM params) AND ds.active = true),
                ARRAY[]::uuid[]
            )
        END as settings_ids
    FROM params
    LIMIT 1
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT settings_ids FROM settings_ids_data) as settings_ids
FROM params x;
$$;
