-- Rubric ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_rubric_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubric_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

DROP TYPE IF EXISTS rubric_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_rubric_ids_v4(
    profile_id uuid,
    rubric_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or rubric junction)
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,
    total_points_id uuid,
    pass_points_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    standard_group_ids uuid[],
    standard_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        rubric_id AS rubric_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Rubric junction multi-select resource IDs (canonical only).
rubric_departments_data AS (
    SELECT
        CASE
            WHEN (SELECT rubric_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(rd.department_id ORDER BY rd.created_at)
                 FROM rubric_departments_junction rd
                 WHERE rd.rubric_id = (SELECT rubric_id FROM params) AND rd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
rubric_standard_groups_data AS (
    SELECT
        CASE
            WHEN (SELECT rubric_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(rsg.standard_group_id ORDER BY rsg.created_at)
                 FROM rubric_standard_groups_junction rsg
                 WHERE rsg.rubric_id = (SELECT rubric_id FROM params) AND rsg.active = true),
                ARRAY[]::uuid[]
            )
        END as standard_group_ids
    FROM params
    LIMIT 1
),
rubric_standards_data AS (
    SELECT
        CASE
            WHEN (SELECT rubric_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(rs.standard_id ORDER BY rs.created_at)
                 FROM rubric_standards_junction rs
                 WHERE rs.rubric_id = (SELECT rubric_id FROM params) AND rs.active = true),
                ARRAY[]::uuid[]
            )
        END as standard_ids
    FROM params
    LIMIT 1
),
-- Single-select resource IDs (canonical only).
name_resource_data AS (
    SELECT
        (SELECT rn.name_id FROM rubric_names_junction rn WHERE rn.rubric_id = (SELECT rubric_id FROM params) LIMIT 1) as name_id
    FROM params
),
description_resource_data AS (
    SELECT
        (SELECT rd.description_id FROM rubric_descriptions_junction rd WHERE rd.rubric_id = (SELECT rubric_id FROM params) LIMIT 1) as description_id
    FROM params
),
flag_resource_data AS (
    SELECT
        (SELECT rf.flag_id
         FROM rubric_flags_junction rf
         JOIN flags_resource f ON rf.flag_id = f.id
         WHERE rf.rubric_id = (SELECT rubric_id FROM params)
           AND f.name = 'rubric_active'
           AND f.value = TRUE
         LIMIT 1) as active_flag_id
    FROM params
),
total_points_resource_data AS (
    SELECT
        (SELECT rp.point_id
         FROM rubric_points_junction rp
         WHERE rp.rubric_id = (SELECT rubric_id FROM params)
           AND rp.type = 'total'::point_type
         LIMIT 1) as total_points_id
    FROM params
),
pass_points_resource_data AS (
    SELECT
        (SELECT rp.point_id
         FROM rubric_points_junction rp
         WHERE rp.rubric_id = (SELECT rubric_id FROM params)
           AND rp.type = 'pass'::point_type
         LIMIT 1) as pass_points_id
    FROM params
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (SELECT total_points_id FROM total_points_resource_data) as total_points_id,
    (SELECT pass_points_id FROM pass_points_resource_data) as pass_points_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM rubric_departments_data) as department_ids,
    (SELECT standard_group_ids FROM rubric_standard_groups_data) as standard_group_ids,
    (SELECT standard_ids FROM rubric_standards_data) as standard_ids;
$$;
