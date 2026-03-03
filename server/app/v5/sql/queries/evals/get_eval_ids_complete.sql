-- Eval ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop function if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_eval_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_eval_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_eval_ids_v4(
    profile_id uuid,
    eval_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,
    dynamic_flag_id uuid,
    groups_flag_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    rubric_ids uuid[],
    model_ids uuid[],
    model_flag_ids uuid[],
    model_rubric_ids uuid[],
    model_position_ids uuid[],

    -- Suggestion IDs
    name_suggestions uuid[],
    description_suggestions uuid[],
    department_suggestions uuid[],
    rubric_suggestions uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        eval_id AS eval_id,
        profile_id AS profile_id,
        user_department_ids AS user_department_ids
),
-- Single-select: name (draft priority)
name_id_data AS (
    SELECT
        COALESCE(
            (SELECT dn.names_id FROM eval_drafts_names_connection dn WHERE dn.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x) LIMIT 1),
            (SELECT en.name_id FROM eval_names_junction en WHERE en.eval_id = (SELECT eval_id FROM params) LIMIT 1)
        ) as name_id
    FROM params
    LIMIT 1
),
-- Single-select: description (draft priority)
description_id_data AS (
    SELECT
        COALESCE(
            (SELECT dd.descriptions_id FROM eval_drafts_descriptions_connection dd WHERE dd.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x) LIMIT 1),
            (SELECT ed.description_id FROM eval_descriptions_junction ed WHERE ed.eval_id = (SELECT eval_id FROM params) LIMIT 1)
        ) as description_id
    FROM params
    LIMIT 1
),
-- Single-select: active flag (draft priority)
active_flag_id_data AS (
    SELECT
        COALESCE(
            (SELECT df.flags_id FROM eval_drafts_flags_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x) AND f.name = 'active' LIMIT 1),
            (SELECT ef.flag_id FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'eval_active' AND ef.value = TRUE LIMIT 1)
        ) as active_flag_id
    FROM params
    LIMIT 1
),
-- Single-select: dynamic flag (draft priority)
dynamic_flag_id_data AS (
    SELECT
        COALESCE(
            (SELECT df.flags_id FROM eval_drafts_flags_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x) AND f.name = 'dynamic' LIMIT 1),
            (SELECT ef.flag_id FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'dynamic' AND ef.value = TRUE LIMIT 1)
        ) as dynamic_flag_id
    FROM params
    LIMIT 1
),
-- Single-select: groups flag (draft priority)
groups_flag_id_data AS (
    SELECT
        COALESCE(
            (SELECT df.flags_id FROM eval_drafts_flags_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x) AND f.name = '' LIMIT 1),
            (SELECT ef.flag_id FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = '' AND ef.value = TRUE LIMIT 1)
        ) as groups_flag_id
    FROM params
    LIMIT 1
),
-- Multi-select: department IDs
eval_department_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ed.department_id ORDER BY ed.created_at)
                 FROM eval_departments_junction ed
                 WHERE ed.eval_id = (SELECT eval_id FROM params) AND ed.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
-- Multi-select: rubric IDs (now direct via eval_rubrics_junction)
eval_rubric_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN
                COALESCE(
                    (SELECT ARRAY_AGG(dr.rubrics_id ORDER BY dr.created_at)
                     FROM eval_drafts_rubrics_connection dr
                     WHERE dr.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x)),
                    ARRAY[]::uuid[]
                )
            ELSE COALESCE(
                (SELECT ARRAY_AGG(er.rubric_id ORDER BY er.created_at)
                 FROM eval_rubrics_junction er
                 WHERE er.eval_id = (SELECT eval_id FROM params) AND er.active = true),
                ARRAY[]::uuid[]
            )
        END as rubric_ids
    FROM params
    LIMIT 1
),
-- Multi-select: model IDs (judge models, now direct via eval_models_junction)
eval_model_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN
                COALESCE(
                    (SELECT ARRAY_AGG(dm.models_id ORDER BY dm.created_at)
                     FROM eval_drafts_models_connection dm
                     WHERE dm.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x)),
                    ARRAY[]::uuid[]
                )
            ELSE COALESCE(
                (SELECT ARRAY_AGG(em.model_id ORDER BY em.created_at)
                 FROM eval_models_junction em
                 WHERE em.eval_id = (SELECT eval_id FROM params) AND em.active = true),
                ARRAY[]::uuid[]
            )
        END as model_ids
    FROM params
    LIMIT 1
),
-- Multi-select: model_flag IDs
eval_model_flag_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(emf.model_flag_id ORDER BY emf.created_at)
                 FROM eval_model_flags_junction emf
                 WHERE emf.eval_id = (SELECT eval_id FROM params) AND emf.active = true),
                ARRAY[]::uuid[]
            )
        END as model_flag_ids
    FROM params
    LIMIT 1
),
-- Multi-select: model_rubric IDs
eval_model_rubric_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(emr.model_rubric_id ORDER BY emr.created_at)
                 FROM eval_model_rubrics_junction emr
                 WHERE emr.eval_id = (SELECT eval_id FROM params) AND emr.active = true),
                ARRAY[]::uuid[]
            )
        END as model_rubric_ids
    FROM params
    LIMIT 1
),
-- Multi-select: model_position IDs
eval_model_position_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(emp.model_position_id ORDER BY emp.created_at)
                 FROM eval_model_positions_junction emp
                 WHERE emp.eval_id = (SELECT eval_id FROM params) AND emp.active = true),
                ARRAY[]::uuid[]
            )
        END as model_position_ids
    FROM params
    LIMIT 1
),
-- Name suggestions
name_suggestions_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(en.name_id ORDER BY en.created_at DESC)
             FROM (
                 SELECT DISTINCT en.name_id, MAX(en.created_at) as created_at
                 FROM eval_names_junction en
                 JOIN names_resource n ON n.id = en.name_id
                 WHERE en.name_id IS NOT NULL AND n.name IS NOT NULL AND n.name != ''
                 GROUP BY en.name_id
                 ORDER BY MAX(en.created_at) DESC
                 LIMIT 20
             ) en),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    LIMIT 1
),
-- Description suggestions
description_suggestions_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(ed.description_id ORDER BY ed.created_at DESC)
             FROM (
                 SELECT DISTINCT ed.description_id, MAX(ed.created_at) as created_at
                 FROM eval_descriptions_junction ed
                 JOIN descriptions_resource d ON d.id = ed.description_id
                 WHERE ed.description_id IS NOT NULL AND d.description IS NOT NULL AND d.description != ''
                 GROUP BY ed.description_id
                 ORDER BY MAX(ed.created_at) DESC
                 LIMIT 20
             ) ed),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    LIMIT 1
),
-- Department suggestions
department_suggestions_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(ed.department_id ORDER BY ed.created_at DESC)
             FROM (
                 SELECT DISTINCT ed.department_id, MAX(ed.created_at) as created_at
                 FROM eval_departments_junction ed
                 JOIN departments_resource d ON d.id = ed.department_id
                 WHERE ed.department_id IS NOT NULL AND ed.active = true
                 GROUP BY ed.department_id
                 ORDER BY MAX(ed.created_at) DESC
                 LIMIT 20
             ) ed),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    LIMIT 1
),
-- Rubric suggestions (all valid rubrics)
rubric_suggestions_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(r.id)
             FROM rubrics_resource r
             WHERE EXISTS (
                 SELECT 1 FROM rubric_flags_junction rf JOIN flags_resource f ON rf.flag_id = f.id
                 WHERE rf.rubric_id = r.id AND f.name = 'rubric_active' AND rf.value = true
             )
             AND (
                 EXISTS (
                     SELECT 1 FROM rubric_departments_junction rd
                     WHERE rd.rubric_id = r.id AND rd.active = true
                     AND rd.department_id = ANY(api_get_eval_ids_v4.user_department_ids)
                 )
                 OR NOT EXISTS (
                     SELECT 1 FROM rubric_departments_junction rd2
                     WHERE rd2.rubric_id = r.id AND rd2.active = true
                 )
             )),
            ARRAY[]::uuid[]
        ) as rubric_suggestions
    FROM params
    LIMIT 1
)
SELECT
    -- Single-select IDs
    (SELECT name_id FROM name_id_data) as name_id,
    (SELECT description_id FROM description_id_data) as description_id,
    (SELECT active_flag_id FROM active_flag_id_data) as active_flag_id,
    (SELECT dynamic_flag_id FROM dynamic_flag_id_data) as dynamic_flag_id,
    (SELECT groups_flag_id FROM groups_flag_id_data) as groups_flag_id,

    -- Multi-select IDs
    COALESCE((SELECT department_ids FROM eval_department_ids_data), ARRAY[]::uuid[]) as department_ids,
    COALESCE((SELECT rubric_ids FROM eval_rubric_ids_data), ARRAY[]::uuid[]) as rubric_ids,
    COALESCE((SELECT model_ids FROM eval_model_ids_data), ARRAY[]::uuid[]) as model_ids,
    COALESCE((SELECT model_flag_ids FROM eval_model_flag_ids_data), ARRAY[]::uuid[]) as model_flag_ids,
    COALESCE((SELECT model_rubric_ids FROM eval_model_rubric_ids_data), ARRAY[]::uuid[]) as model_rubric_ids,
    COALESCE((SELECT model_position_ids FROM eval_model_position_ids_data), ARRAY[]::uuid[]) as model_position_ids,

    -- Suggestion IDs
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    COALESCE((SELECT rubric_suggestions FROM rubric_suggestions_data), ARRAY[]::uuid[]) as rubric_suggestions;
$$;
