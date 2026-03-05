-- Parameter ID Fetching (Query 2 of Two-Pass Architecture)
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
        WHERE proname = 'api_get_parameter_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_parameter_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop legacy composite type (no longer needed)
DROP TYPE IF EXISTS parameter_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_parameter_ids_v4(
    profile_id uuid,
    parameter_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or parameter junction)
    names_id uuid,
    descriptions_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    field_ids uuid[],
    flag_ids uuid[],

    -- Suggestion IDs (computed in resource search endpoints)
    name_suggestions uuid[],
    description_suggestions uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        parameter_id AS parameter_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Parameter junction multi-select resource IDs (canonical only).
parameter_departments_data AS (
    SELECT
        CASE
            WHEN (SELECT parameter_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at)
                 FROM parameter_departments_junction pd
                 WHERE pd.parameter_id = (SELECT parameter_id FROM params) AND pd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
parameter_fields_data AS (
    SELECT
        CASE
            WHEN (SELECT parameter_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pfr.id ORDER BY pfr.created_at)
                 FROM parameter_fields_resource pfr
                 WHERE pfr.parameter_id = (SELECT parameter_id FROM params) AND pfr.active = true),
                ARRAY[]::uuid[]
            )
        END as field_ids
    FROM params
    LIMIT 1
),
parameter_flags_data AS (
    SELECT
        CASE
            WHEN (SELECT parameter_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pf.flag_id ORDER BY pf.created_at)
                 FROM parameter_flags_junction pf
                 JOIN flags_resource f ON pf.flag_id = f.id
                 WHERE pf.parameter_id = (SELECT parameter_id FROM params)
                   AND pf.active = true
                   AND f.value = true
                   AND f.name LIKE 'parameter_%'),
                ARRAY[]::uuid[]
            )
        END as flag_ids
    FROM params
    LIMIT 1
),
-- Single-select resource IDs (canonical only).
name_resource_data AS (
    SELECT
        (SELECT pn.names_id FROM parameter_names_junction pn WHERE pn.parameter_id = (SELECT parameter_id FROM params) AND pn.active = true LIMIT 1) as names_id
    FROM params
),
description_resource_data AS (
    SELECT
        (SELECT pd.descriptions_id FROM parameter_descriptions_junction pd WHERE pd.parameter_id = (SELECT parameter_id FROM params) AND pd.active = true LIMIT 1) as descriptions_id
    FROM params
),
flag_resource_data AS (
    SELECT
        (SELECT pf.flag_id
         FROM parameter_flags_junction pf
         JOIN flags_resource f ON pf.flag_id = f.id
         WHERE pf.parameter_id = (SELECT parameter_id FROM params)
           AND pf.active = true
           AND f.name = 'parameter_active'
           AND f.value = TRUE
         LIMIT 1) as active_flag_id
    FROM params
)
SELECT
    -- Single-select resource IDs
    (SELECT names_id FROM name_resource_data) as names_id,
    (SELECT descriptions_id FROM description_resource_data) as descriptions_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM parameter_departments_data) as department_ids,
    (SELECT field_ids FROM parameter_fields_data) as field_ids,
    (SELECT flag_ids FROM parameter_flags_data) as flag_ids,

    -- Suggestion IDs (computed in resource search endpoints)
    ARRAY[]::uuid[] as name_suggestions,
    ARRAY[]::uuid[] as description_suggestions
FROM params x;
$$;
