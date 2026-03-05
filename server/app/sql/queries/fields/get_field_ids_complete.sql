-- Field ID Fetching (Query 2 of Two-Pass Architecture)
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
        WHERE proname = 'api_get_field_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_field_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop legacy composite type (no longer needed)
DROP TYPE IF EXISTS field_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_field_ids_v4(
    profile_id uuid,
    field_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or field junction)
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    conditional_parameter_ids uuid[],

    -- Suggestion IDs (computed in resource search endpoints)
    name_suggestions uuid[],
    description_suggestions uuid[],
    department_suggestions uuid[],
    conditional_parameter_suggestions uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        field_id AS field_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Field junction multi-select resource IDs (canonical only).
field_departments_data AS (
    SELECT
        CASE
            WHEN (SELECT field_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(fd.department_id ORDER BY fd.created_at)
                 FROM field_departments_junction fd
                 WHERE fd.field_id = (SELECT field_id FROM params) AND fd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
field_parameters_data AS (
    SELECT
        CASE
            WHEN (SELECT field_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(cpr.parameter_id ORDER BY fcpj.created_at)
                 FROM field_conditional_parameters_junction fcpj
                 JOIN conditional_parameters_resource cpr ON cpr.id = fcpj.conditional_parameter_id
                 WHERE fcpj.field_id = (SELECT field_id FROM params) AND fcpj.active = true),
                ARRAY[]::uuid[]
            )
        END as conditional_parameter_ids
    FROM params
    LIMIT 1
),
-- Single-select resource IDs (canonical only).
name_resource_data AS (
    SELECT
        (SELECT fn.name_id FROM field_names_junction fn WHERE fn.field_id = (SELECT field_id FROM params) AND fn.active = true LIMIT 1) as name_id
    FROM params
),
description_resource_data AS (
    SELECT
        (SELECT fd.description_id FROM field_descriptions_junction fd WHERE fd.field_id = (SELECT field_id FROM params) AND fd.active = true LIMIT 1) as description_id
    FROM params
),
flag_resource_data AS (
    SELECT
        (SELECT ff.flag_id
         FROM field_flags_junction ff
         JOIN flags_resource f ON ff.flag_id = f.id
         WHERE ff.field_id = (SELECT field_id FROM params)
           AND ff.active = true
           AND f.name = 'field_active'
           AND f.value = TRUE
         LIMIT 1) as active_flag_id
    FROM params
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM field_departments_data) as department_ids,
    (SELECT conditional_parameter_ids FROM field_parameters_data) as conditional_parameter_ids,

    -- Suggestion IDs (computed in resource search endpoints)
    ARRAY[]::uuid[] as name_suggestions,
    ARRAY[]::uuid[] as description_suggestions,
    ARRAY[]::uuid[] as department_suggestions,
    ARRAY[]::uuid[] as conditional_parameter_suggestions
FROM params x;
$$;
