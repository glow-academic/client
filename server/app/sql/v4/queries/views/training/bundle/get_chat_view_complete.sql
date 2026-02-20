-- ============================================================================
-- Query: get_training_view
-- Purpose: Thin MV filter for training bundle customization/start flows
-- Section: VIEWS/TRAINING/BUNDLE
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_training_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_training_view_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_training_view_v4(
    profile_id_filter uuid,
    training_entry_id_filter uuid
)
RETURNS TABLE (
    profile_has_access boolean,
    training_entry_id uuid,
    parent_id uuid,
    -- Single scenario (from connection)
    scenario_id uuid,
    -- Bundle-level resource ID arrays
    department_ids uuid[],
    persona_ids uuid[],
    document_ids uuid[],
    parameter_field_ids uuid[],
    parameter_ids uuid[],
    question_ids uuid[],
    option_ids uuid[],
    video_ids uuid[],
    image_ids uuid[],
    problem_statement_ids uuid[],
    objective_ids uuid[],
    flag_ids uuid[],
    name_ids uuid[],
    description_ids uuid[],
    -- 5 scenario flags
    video_enabled boolean,
    problem_statement_enabled boolean,
    objectives_enabled boolean,
    images_enabled boolean,
    questions_enabled boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id_filter AS profile_id,
        training_entry_id_filter AS training_entry_id
),
bundle AS (
    SELECT mtb.*
    FROM training_mv mtb
    WHERE mtb.training_entry_id = (SELECT training_entry_id FROM params)
    LIMIT 1
),
parent_cohorts AS (
    SELECT COALESCE(mh.cohort_ids, mp.cohort_ids, ARRAY[]::uuid[]) AS cohort_ids
    FROM bundle b
    LEFT JOIN home_mv mh ON mh.home_id = b.parent_id
    LEFT JOIN practice_mv mp ON mp.practice_id = b.parent_id
    LIMIT 1
),
access_check AS (
    SELECT EXISTS (
        SELECT 1
        FROM params p
        JOIN parent_cohorts pc ON TRUE
        JOIN profile_cohorts_junction pcj
          ON pcj.profile_id = p.profile_id
         AND pcj.active = true
        JOIN cohort_cohorts_junction ccj
          ON ccj.cohorts_id = pcj.cohort_id
         AND ccj.active = true
        WHERE ccj.cohorts_id = ANY(pc.cohort_ids)
    ) AS profile_has_access
)
SELECT
    COALESCE(ac.profile_has_access, false) AS profile_has_access,
    b.training_entry_id,
    b.parent_id,
    b.scenario_id,
    b.department_ids,
    b.persona_ids,
    b.document_ids,
    b.parameter_field_ids,
    b.parameter_ids,
    b.question_ids,
    b.option_ids,
    b.video_ids,
    b.image_ids,
    b.problem_statement_ids,
    b.objective_ids,
    b.flag_ids,
    b.name_ids,
    b.description_ids,
    b.video_enabled,
    b.problem_statement_enabled,
    b.objectives_enabled,
    b.images_enabled,
    b.questions_enabled
FROM bundle b
LEFT JOIN access_check ac ON TRUE;
$$;
