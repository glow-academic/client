-- ============================================================================
-- Query: get_rubric_scores
-- Purpose: Fetch rubric scores per (chat, standard_group)
-- Section: VIEWS/CHAT/RUBRIC_SCORES
--
-- Replaces mv_rubric_facts. Same join chain but runtime-filtered by
-- the standard analytics filters (profile, cohort, dept, sim, rubric, date, type, archived).
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_rubric_scores_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubric_scores_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_rubric_scores_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_rubric_scores_v4_item AS (
    chat_id uuid,
    standard_group_id uuid,
    rubric_id uuid,
    score_percent float8,
    simulation_id uuid,
    profile_id uuid,
    cohort_id uuid,
    department_id uuid,
    attempt_date date,
    attempt_type text,
    is_archived boolean
);

CREATE TYPE types.q_get_rubric_scores_v4_option AS (
    value text,
    label text,
    count int
);

CREATE OR REPLACE FUNCTION api_get_rubric_scores_v4(
    profile_id_filter uuid DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    rubric_ids uuid[] DEFAULT NULL,
    attempt_type_filter text DEFAULT NULL,
    is_archived_filter boolean DEFAULT FALSE,
    date_from date DEFAULT NULL,
    date_to date DEFAULT NULL,
    page_limit int DEFAULT 50000,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_rubric_scores_v4_item[],
    total_count int,
    rubric_options types.q_get_rubric_scores_v4_option[],
    department_options types.q_get_rubric_scores_v4_option[],
    simulation_options types.q_get_rubric_scores_v4_option[],
    standard_group_options types.q_get_rubric_scores_v4_option[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    latest_grade AS (
        SELECT DISTINCT ON (g.chat_id)
            g.id AS grade_id,
            g.chat_id
        FROM attempt_grade_entry g
        WHERE g.active = TRUE
        ORDER BY g.chat_id, g.created_at DESC
    ),
    chat_rubric AS (
        SELECT DISTINCT ON (acrc.attempt_chat_id)
            acrc.attempt_chat_id,
            acrc.rubrics_id AS rubric_id
        FROM attempt_chat_rubrics_connection acrc
        WHERE acrc.active = TRUE
        ORDER BY acrc.attempt_chat_id, acrc.created_at DESC
    ),
    -- Join attempt_chat_mv with grade/rubric/feedback chain to compute scores per standard_group
    scored AS (
        SELECT
            ch.chat_id,
            sg.id AS standard_group_id,
            gr.rubric_id,
            CASE WHEN sg.points > 0
                 THEN TRUNC((100.0 * SUM(fe.total)::numeric / sg.points::numeric), 2)::float8
                 ELSE NULL
            END AS score_percent,
            ch.simulation_id,
            ch.profile_id,
            ch.cohort_id,
            ch.department_id,
            ch.attempt_date,
            ch.attempt_type,
            ch.is_archived
        FROM attempt_chat_mv ch
        JOIN latest_grade lg ON lg.chat_id = ch.chat_id
        JOIN attempt_chat_entry ace ON ace.id = lg.chat_id AND ace.active = TRUE
        JOIN chat_rubric gr ON gr.attempt_chat_id = ace.id
        JOIN attempt_feedback_entry fe ON fe.grade_id = lg.grade_id AND fe.active = TRUE
        JOIN feedbacks_standards_connection fsc ON fsc.feedbacks_id = fe.id
        JOIN standards_resource s ON s.id = fsc.standard_id
        JOIN rubric_rubrics_junction rrj
            ON rrj.rubrics_id = gr.rubric_id AND rrj.active = TRUE
        JOIN rubric_standard_groups_junction rsg
            ON rsg.rubric_id = rrj.rubric_id AND rsg.active = TRUE
        JOIN standard_groups_resource sg
            ON sg.id = rsg.standard_group_id AND sg.id = s.standard_group_id
        WHERE
            (profile_id_filter IS NULL OR ch.profile_id = profile_id_filter)
            AND (cohort_ids IS NULL OR cardinality(cohort_ids) = 0 OR ch.cohort_id = ANY(cohort_ids))
            AND (department_ids IS NULL OR cardinality(department_ids) = 0 OR ch.department_id = ANY(department_ids))
            AND (simulation_ids IS NULL OR cardinality(simulation_ids) = 0 OR ch.simulation_id = ANY(simulation_ids))
            AND (rubric_ids IS NULL OR cardinality(rubric_ids) = 0 OR gr.rubric_id = ANY(rubric_ids))
            AND (attempt_type_filter IS NULL OR ch.attempt_type = attempt_type_filter)
            AND ch.is_archived = COALESCE(is_archived_filter, FALSE)
            AND (date_from IS NULL OR ch.attempt_date >= date_from)
            AND (date_to IS NULL OR ch.attempt_date <= date_to)
        GROUP BY
            ch.chat_id, sg.id, gr.rubric_id, sg.points,
            ch.simulation_id, ch.profile_id, ch.cohort_id, ch.department_id,
            ch.attempt_date, ch.attempt_type, ch.is_archived
    ),
    counted AS (
        SELECT COUNT(*)::int AS total FROM scored
    ),
    sorted AS (
        SELECT * FROM scored
        ORDER BY attempt_date DESC NULLS LAST, chat_id DESC
        LIMIT page_limit OFFSET page_offset
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (chat_id, standard_group_id, rubric_id, score_percent,
                 simulation_id, profile_id, cohort_id, department_id,
                 attempt_date, attempt_type, is_archived
                )::types.q_get_rubric_scores_v4_item
            ),
            ARRAY[]::types.q_get_rubric_scores_v4_item[]
        ) AS items
        FROM sorted
    ),
    rubric_options_cte AS (
        SELECT rubric_id::text AS value, rubric_id::text AS label,
               COUNT(DISTINCT chat_id)::int AS count
        FROM scored WHERE rubric_id IS NOT NULL
        GROUP BY rubric_id ORDER BY count DESC, value
    ),
    rubric_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG((value, label, count)::types.q_get_rubric_scores_v4_option),
            ARRAY[]::types.q_get_rubric_scores_v4_option[]
        ) AS options FROM rubric_options_cte
    ),
    department_options_cte AS (
        SELECT department_id::text AS value, department_id::text AS label,
               COUNT(DISTINCT chat_id)::int AS count
        FROM scored WHERE department_id IS NOT NULL
        GROUP BY department_id ORDER BY count DESC, value
    ),
    department_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG((value, label, count)::types.q_get_rubric_scores_v4_option),
            ARRAY[]::types.q_get_rubric_scores_v4_option[]
        ) AS options FROM department_options_cte
    ),
    simulation_options_cte AS (
        SELECT simulation_id::text AS value, simulation_id::text AS label,
               COUNT(DISTINCT chat_id)::int AS count
        FROM scored WHERE simulation_id IS NOT NULL
        GROUP BY simulation_id ORDER BY count DESC, value
    ),
    simulation_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG((value, label, count)::types.q_get_rubric_scores_v4_option),
            ARRAY[]::types.q_get_rubric_scores_v4_option[]
        ) AS options FROM simulation_options_cte
    ),
    standard_group_options_cte AS (
        SELECT standard_group_id::text AS value, standard_group_id::text AS label,
               COUNT(DISTINCT chat_id)::int AS count
        FROM scored WHERE standard_group_id IS NOT NULL
        GROUP BY standard_group_id ORDER BY count DESC, value
    ),
    standard_group_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG((value, label, count)::types.q_get_rubric_scores_v4_option),
            ARRAY[]::types.q_get_rubric_scores_v4_option[]
        ) AS options FROM standard_group_options_cte
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted),
        (SELECT options FROM rubric_options_agg),
        (SELECT options FROM department_options_agg),
        (SELECT options FROM simulation_options_agg),
        (SELECT options FROM standard_group_options_agg);
$$;
