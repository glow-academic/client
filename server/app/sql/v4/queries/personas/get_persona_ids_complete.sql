-- Persona ID Fetching (Query 2 of Two-Pass Architecture)
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
        WHERE proname = 'api_get_persona_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop legacy composite type (no longer needed)
DROP TYPE IF EXISTS persona_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_persona_ids_v4(
    profile_id uuid,
    persona_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or persona junction)
    name_id uuid,
    description_id uuid,
    color_id uuid,
    icon_id uuid,
    instructions_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    parameter_field_ids uuid[],
    example_ids uuid[],
    parameter_ids uuid[],

    -- Suggestion IDs (computed in resource search endpoints)
    name_suggestions uuid[],
    description_suggestions uuid[],
    color_suggestions uuid[],
    icon_suggestions uuid[],
    instructions_suggestions uuid[],
    department_suggestions uuid[],
    parameter_field_suggestions uuid[],
    example_suggestions uuid[],
    parameter_suggestions uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        persona_id AS persona_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Persona junction multi-select resource IDs (canonical only).
persona_departments_data AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at)
                 FROM persona_departments_junction pd
                 WHERE pd.persona_id = (SELECT persona_id FROM params) AND pd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
persona_parameter_fields_data AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ppfj.parameter_field_id ORDER BY ppfj.created_at)
                 FROM persona_parameter_fields_junction ppfj
                 WHERE ppfj.persona_id = (SELECT persona_id FROM params) AND ppfj.active = true),
                ARRAY[]::uuid[]
            )
        END as parameter_field_ids
    FROM params
    LIMIT 1
),
persona_examples_data AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(e.id ORDER BY pe.idx)
                 FROM persona_examples_junction pe
                 JOIN examples_resource e ON e.id = pe.example_id
                 WHERE pe.persona_id = (SELECT persona_id FROM params) AND pe.active = true),
                ARRAY[]::uuid[]
            )
        END as example_ids
    FROM params
    LIMIT 1
),
persona_parameters_data AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pp.parameter_id ORDER BY pp.created_at)
                 FROM persona_parameters_junction pp
                 JOIN parameters_resource pr ON pr.id = pp.parameter_id
                 WHERE pp.persona_id = (SELECT persona_id FROM params)
                   AND pp.active = true
                   AND pr.persona_parameter = true),
                ARRAY[]::uuid[]
            )
        END as parameter_ids
    FROM params
    LIMIT 1
),
-- Single-select resource IDs (canonical only).
name_resource_data AS (
    SELECT
        (SELECT pn.name_id FROM persona_names_junction pn WHERE pn.persona_id = (SELECT persona_id FROM params) AND pn.active = true LIMIT 1) as name_id
    FROM params
),
description_resource_data AS (
    SELECT
        (SELECT pd.description_id FROM persona_descriptions_junction pd WHERE pd.persona_id = (SELECT persona_id FROM params) AND pd.active = true LIMIT 1) as description_id
    FROM params
),
color_resource_data AS (
    SELECT
        (SELECT pc.color_id FROM persona_colors_junction pc WHERE pc.persona_id = (SELECT persona_id FROM params) AND pc.active = true LIMIT 1) as color_id
    FROM params
),
icon_resource_data AS (
    SELECT
        (SELECT pi.icon_id FROM persona_icons_junction pi WHERE pi.persona_id = (SELECT persona_id FROM params) AND pi.active = true LIMIT 1) as icon_id
    FROM params
),
instructions_resource_data AS (
    SELECT
        (SELECT pinst.instruction_id FROM persona_instructions_junction pinst WHERE pinst.persona_id = (SELECT persona_id FROM params) AND pinst.active = true LIMIT 1) as instructions_id
    FROM params
),
flag_resource_data AS (
    SELECT
        (SELECT pf.flag_id
         FROM persona_flags_junction pf
         JOIN flags_resource f ON pf.flag_id = f.id
         WHERE pf.persona_id = (SELECT persona_id FROM params)
           AND pf.active = true
           AND f.name = 'persona_active'
           AND pf.value = TRUE
         LIMIT 1) as active_flag_id
    FROM params
),
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT color_id FROM color_resource_data) as color_id,
    (SELECT icon_id FROM icon_resource_data) as icon_id,
    (SELECT instructions_id FROM instructions_resource_data) as instructions_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM persona_departments_data) as department_ids,
    (SELECT parameter_field_ids FROM persona_parameter_fields_data) as parameter_field_ids,
    (SELECT example_ids FROM persona_examples_data) as example_ids,
    (SELECT parameter_ids FROM persona_parameters_data) as parameter_ids,

    -- Suggestion IDs (computed in resource search endpoints)
    ARRAY[]::uuid[] as name_suggestions,
    ARRAY[]::uuid[] as description_suggestions,
    ARRAY[]::uuid[] as color_suggestions,
    ARRAY[]::uuid[] as icon_suggestions,
    ARRAY[]::uuid[] as instructions_suggestions,
    ARRAY[]::uuid[] as department_suggestions,
    ARRAY[]::uuid[] as parameter_field_suggestions,
    ARRAY[]::uuid[] as example_suggestions,
    ARRAY[]::uuid[] as parameter_suggestions
FROM params x;
$$;
