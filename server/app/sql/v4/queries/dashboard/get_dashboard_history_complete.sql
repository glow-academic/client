-- Dashboard history query with pagination, search, filters, and sorting
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- EARLY PAGINATION: filters + search first, then LIMIT/OFFSET, then expensive aggregations only for page
--
-- Parameters: start_date, end_date, cohort_ids, department_ids, roles, simulation_filters, search,
--            profile_ids, simulation_ids, scenario_ids, infinite_mode, sort_by, sort_order, page_size, offset, profile_id
-- Returns: Paginated history data with options arrays
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_dashboard_history_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_dashboard_history_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_dashboard_history_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types

-- Attempt history row (independent from bundle endpoint)
CREATE TYPE types.q_get_dashboard_history_v4_attempt_history_row AS (
    attempt_id uuid,
    date timestamptz,
    profile_id uuid,
    profile_name text,
    simulation_name text,
    num_scenarios int,
    num_scenarios_completed int,
    infinite_mode boolean,
    time_limit int,
    persona_names_junction text[],
    persona_colors_junction text[],
    score int,
    score_status text,
    simulation_id uuid,
    scenario_ids text[],
    scenario_titles text[],
    is_archived boolean,
    show_view boolean,
    show_continue boolean,
    practice_simulation boolean,
    pass_pct int,
    department_ids text[],
    cohort_names_junction text[],
    practice_scenario_id uuid
);

-- Profile option (for facet filters)
CREATE TYPE types.q_get_dashboard_history_v4_profile_option AS (
    value text,
    label text,
    count int
);

-- Simulation option (for facet filters)
CREATE TYPE types.q_get_dashboard_history_v4_simulation_option AS (
    value text,
    label text,
    count int
);

-- Scenario option (for facet filters)
CREATE TYPE types.q_get_dashboard_history_v4_scenario_option AS (
    value text,
    label text,
    count int
);

-- 4) Recreate function
-- Accept dates as text (ISO format strings) and cast to timestamptz internally
-- This allows Python to pass ISO strings from model_dump(mode="json"), and SQL handles conversion
CREATE OR REPLACE FUNCTION api_get_dashboard_history_v4(
    start_date text,
    end_date text,
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    roles profile_type[] DEFAULT ARRAY[]::profile_type[],
    simulation_filters text[] DEFAULT ARRAY[]::text[],
    search text DEFAULT NULL,
    profile_ids uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_ids uuid[] DEFAULT ARRAY[]::uuid[],
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[],
    infinite_mode boolean DEFAULT NULL,
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'desc',
    page_size int DEFAULT 20,
    "offset" int DEFAULT 0,
    profile_id uuid DEFAULT NULL
)
RETURNS TABLE (
    data types.q_get_dashboard_history_v4_attempt_history_row[],
    total_count bigint,
    archived_count bigint,
    unarchived_count bigint,
    profile_options types.q_get_dashboard_history_v4_profile_option[],
    simulation_options types.q_get_dashboard_history_v4_simulation_option[],
    scenario_options_junction types.q_get_dashboard_history_v4_scenario_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        start_date::timestamptz AS start_date,
        end_date::timestamptz AS end_date,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(NULLIF(roles, ARRAY[]::profile_type[]), ARRAY[]::profile_type[]) AS roles,
        COALESCE(NULLIF(simulation_filters, ARRAY[]::text[]), ARRAY['general']::text[])::text[] AS simulation_filters,
        COALESCE(NULLIF(search, ''), NULL) AS search,
        COALESCE(profile_ids, ARRAY[]::uuid[]) AS profile_ids,
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        COALESCE(scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
        infinite_mode AS infinite_mode,
        COALESCE(sort_by, 'date') AS sort_by,
        COALESCE(sort_order, 'desc') AS sort_order,
        COALESCE(page_size, 20) AS page_size,
        COALESCE("offset", 0) AS offset_val,
        COALESCE(profile_id, NULL::uuid) AS profile_id
),

-- ═══════════════════════════════════════════════════════════════
-- PHASE 1: Filter chain (unchanged)
-- ═══════════════════════════════════════════════════════════════

-- Expanded cohort list: union of provided cohortIds (dashboard never filters by profile)
expanded_history_cohort_ids AS (
    SELECT DISTINCT cohort_id
    FROM (
        SELECT unnest((SELECT cohort_ids FROM params)) as cohort_id
        WHERE cardinality((SELECT cohort_ids FROM params)) > 0
    ) combined
),
-- Filter attempts by date, cohorts, departments, and roles
history_attempts AS (
    SELECT DISTINCT
        sa.id AS attempt_id,
        saj.simulation_id,
        sa.created_at AS attempt_date,
        sa.archived AS is_archived,
        sa.infinite_mode,
        paj.profile_id,
        (SELECT n.name FROM simulation_names_junction simn JOIN names_resource n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1) AS simulation_name,
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE) as practice_simulation,
        COALESCE(sdd.department_ids, NULL) as department_ids
    FROM attempts_entry sa
    JOIN simulation_attempts_junction saj ON saj.attempt_id = sa.id
    JOIN simulation_artifact sim ON sim.id = saj.simulation_id
    JOIN profile_attempts_junction paj ON paj.attempt_id = sa.id
    JOIN profile_artifact p_attempt ON p_attempt.id = paj.profile_id
    LEFT JOIN (
        SELECT
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments_junction sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = sim.id
    WHERE sa.created_at >= (SELECT start_date FROM params)
      AND sa.created_at <= (SELECT end_date FROM params)
      -- Dashboard never filters by profile - always filter by roles
      AND (cardinality((SELECT roles FROM params)::profile_type[]) = 0 OR COALESCE(
            (SELECT r.role FROM profile_roles_junction pr_j
             JOIN roles_resource r ON pr_j.role_id = r.id
             WHERE pr_j.profile_id = p_attempt.id
             LIMIT 1),
            'member'::profile_type
          ) = ANY((SELECT roles FROM params)::profile_type[]))
      -- Simulation type filtering: general (practice_simulation = FALSE), practice (practice_simulation = TRUE), archived (archived = TRUE)
      -- If no filters provided (NULL or empty), default to general only (matching old behavior: sim.practice_simulation = FALSE)
      AND (
        (cardinality((SELECT simulation_filters FROM params)::text[]) = 0) AND NOT EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE)
        OR
        (cardinality((SELECT simulation_filters FROM params)::text[]) > 0 AND (
          ('general' = ANY((SELECT simulation_filters FROM params)::text[]) AND NOT EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE)) OR
          ('practice' = ANY((SELECT simulation_filters FROM params)::text[]) AND EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE)) OR
          ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) AND sa.archived = TRUE)
        ))
      )
      -- Exclude archived attempts unless 'archived' is explicitly in the filter list
      AND (
        cardinality((SELECT simulation_filters FROM params)::text[]) = 0 OR 'archived' = ANY((SELECT simulation_filters FROM params)::text[]) OR sa.archived = FALSE
      )
      AND (cardinality((SELECT department_ids FROM params)) = 0 OR sdd.department_ids IS NULL OR sdd.department_ids && (SELECT department_ids FROM params)::text[])
),
-- Get cohorts for each attempt's profile (includes inactive links for history)
history_attempt_cohorts AS (
    SELECT
        ha.attempt_id,
        COALESCE(ARRAY_AGG(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL AND cs.simulation_id = ha.simulation_id), ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(ARRAY_AGG(DISTINCT (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)) FILTER (WHERE c.id IS NOT NULL AND cs.simulation_id = ha.simulation_id), ARRAY[]::text[]) AS cohort_names_junction
    FROM history_attempts ha
    LEFT JOIN profile_cohorts_junction cp ON cp.profile_id = ha.profile_id
    LEFT JOIN cohort_artifact c ON c.id = cp.cohort_id AND EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'cohort_active' AND cf.value = TRUE)
    LEFT JOIN cohort_simulations_junction cs ON cs.cohort_id = c.id
    WHERE (
        -- If no cohort filter, include all attempts
        (SELECT COUNT(*) FROM expanded_history_cohort_ids) = 0
        -- Otherwise, only include cohorts in the expanded list
        OR c.id IN (SELECT cohort_id FROM expanded_history_cohort_ids)
    )
    GROUP BY ha.attempt_id
),
-- Filter attempts by cohort membership (uses expanded cohort list)
history_attempts_filtered AS (
    SELECT ha.*
    FROM history_attempts ha
    JOIN history_attempt_cohorts hac ON hac.attempt_id = ha.attempt_id
    WHERE (
        -- If no cohort filter, include all attempts
        (SELECT COUNT(*) FROM expanded_history_cohort_ids) = 0
        -- Otherwise, only include attempts with matching cohorts
        OR cardinality(hac.cohort_ids) > 0
    )
),
-- Get all unique profile options from filtered attempts (before history-specific filters)
profile_options_cte AS (
    SELECT
        haf.profile_id,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') AS profile_name,
        COUNT(DISTINCT haf.attempt_id) AS count
    FROM history_attempts_filtered haf
    JOIN profile_artifact p ON p.id = haf.profile_id
    GROUP BY haf.profile_id, (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), (SELECT n2.name FROM profile_names_junction pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id LIMIT 1)
    ORDER BY profile_name
),
-- Get all unique simulation options from filtered attempts (before history-specific filters)
simulation_options_cte AS (
    SELECT
        haf.simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) AS simulation_name,
        COUNT(DISTINCT haf.attempt_id) AS count
    FROM history_attempts_filtered haf
    JOIN simulation_artifact s ON s.id = haf.simulation_id
    GROUP BY haf.simulation_id, (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)
    ORDER BY simulation_name
),
-- Get all unique scenario options from filtered attempts (before history-specific filters)
scenario_options_cte AS (
    SELECT
        scj.scenario_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1) AS scenario_title,
        COUNT(DISTINCT haf.attempt_id) AS count
    FROM history_attempts_filtered haf
    JOIN chats_entry sc ON sc.attempt_id = haf.attempt_id
    JOIN scenario_chats_junction scj ON scj.chat_id = sc.id
    JOIN scenarios_resource s ON s.id = scj.scenario_id
    GROUP BY scj.scenario_id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1)
    ORDER BY scenario_title
),
-- Apply additional filters (profileIds, simulationIds, scenarioIds, infiniteMode)
history_attempts_with_filters AS (
    SELECT haf.*
    FROM history_attempts_filtered haf
    WHERE
        -- Profile filter
        (cardinality((SELECT profile_ids FROM params)::uuid[]) = 0 OR haf.profile_id = ANY((SELECT profile_ids FROM params)::uuid[]))
        -- Simulation filter
        AND (cardinality((SELECT simulation_ids FROM params)::uuid[]) = 0 OR haf.simulation_id = ANY((SELECT simulation_ids FROM params)::uuid[]))
        -- Infinite mode filter
        AND ((SELECT infinite_mode FROM params) IS NULL OR haf.infinite_mode = (SELECT infinite_mode FROM params))
),
-- Get scenario IDs for each attempt (for scenario filtering)
attempt_scenario_ids AS (
    SELECT DISTINCT
        sc.attempt_id,
        ARRAY_AGG(DISTINCT scj.scenario_id) FILTER (WHERE scj.scenario_id IS NOT NULL) AS scenario_ids
    FROM chats_entry sc
    JOIN scenario_chats_junction scj ON scj.chat_id = sc.id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_with_filters)
    GROUP BY sc.attempt_id
),
-- Apply scenario filter
history_attempts_final AS (
    SELECT haf.*
    FROM history_attempts_with_filters haf
    LEFT JOIN attempt_scenario_ids asi ON asi.attempt_id = haf.attempt_id
    WHERE
        -- Scenario filter (if any scenario matches, include the attempt)
        (cardinality((SELECT scenario_ids FROM params)) = 0 OR asi.scenario_ids IS NULL OR asi.scenario_ids && (SELECT scenario_ids FROM params))
),

-- ═══════════════════════════════════════════════════════════════
-- PHASE 2: Lightweight score for sort (only computed when sort_by = 'score')
-- ═══════════════════════════════════════════════════════════════

score_for_sort AS (
    SELECT
        sc.attempt_id,
        CASE
            WHEN haf.infinite_mode THEN
                CASE GREATEST(COUNT(DISTINCT scj.scenario_id), 0)
                    WHEN 0 THEN NULL
                    ELSE ROUND(
                        SUM(CASE WHEN hcg.score IS NOT NULL AND rp_total.value > 0
                            THEN TRUNC(hcg.score / rp_total.value::numeric * 100.0, 2)
                            ELSE 0 END)
                        / GREATEST(COUNT(DISTINCT scj.scenario_id), 1)
                    )::int
                END
            ELSE
                CASE (SELECT COUNT(*) FROM simulation_scenarios_junction ss WHERE ss.simulation_id = haf.simulation_id)
                    WHEN 0 THEN NULL
                    ELSE CASE
                        WHEN COUNT(*) FILTER (WHERE hcg.score IS NOT NULL) = 0 THEN NULL
                        ELSE ROUND(
                            SUM(CASE WHEN hcg.score IS NOT NULL AND rp_total.value > 0
                                THEN TRUNC(hcg.score / rp_total.value::numeric * 100.0, 2)
                                ELSE 0 END)
                            / NULLIF((SELECT COUNT(*) FROM simulation_scenarios_junction ss WHERE ss.simulation_id = haf.simulation_id), 0)
                        )::int
                    END
                END
        END AS score_percent
    FROM history_attempts_final haf
    JOIN chats_entry sc ON sc.attempt_id = haf.attempt_id
    JOIN scenario_chats_junction scj ON scj.chat_id = sc.id
    LEFT JOIN LATERAL (
        SELECT scg.score FROM grades_entry scg
        WHERE scg.chat_id = sc.id
        ORDER BY scg.created_at DESC LIMIT 1
    ) hcg ON TRUE
    LEFT JOIN scenario_rubrics_resource srr ON srr.scenario_id = scj.scenario_id
    LEFT JOIN rubric_points_junction rp ON rp.rubric_id = srr.rubric_id AND rp.type = 'total'::point_type
    LEFT JOIN points_resource rp_total ON rp_total.id = rp.point_id
    WHERE (SELECT sort_by FROM params) = 'score'
    GROUP BY sc.attempt_id, haf.infinite_mode, haf.simulation_id
),

-- ═══════════════════════════════════════════════════════════════
-- PHASE 3: Search + lightweight sortable rows
-- ═══════════════════════════════════════════════════════════════

-- Profile name lookup (needed for search + display)
profile_name_lookup AS (
    SELECT DISTINCT ON (pn.profile_id) pn.profile_id, n.name
    FROM profile_names_junction pn
    JOIN names_resource n ON pn.name_id = n.id
    WHERE pn.profile_id IN (SELECT profile_id FROM history_attempts_final)
),
-- Combine filter results with sort key and searchable fields
searchable_rows AS (
    SELECT
        haf.attempt_id,
        haf.attempt_date,
        haf.simulation_name,
        haf.simulation_id,
        haf.profile_id,
        haf.is_archived,
        haf.infinite_mode,
        haf.practice_simulation,
        haf.department_ids,
        COALESCE(pnl.name, '') AS profile_name,
        sfs.score_percent
    FROM history_attempts_final haf
    LEFT JOIN profile_name_lookup pnl ON pnl.profile_id = haf.profile_id
    LEFT JOIN score_for_sort sfs ON sfs.attempt_id = haf.attempt_id
    WHERE
        (SELECT search FROM params) IS NULL
        OR (SELECT search FROM params) = ''
        OR LOWER(COALESCE(pnl.name, '')) LIKE '%' || LOWER((SELECT search FROM params)) || '%'
        OR LOWER(haf.simulation_name) LIKE '%' || LOWER((SELECT search FROM params)) || '%'
        -- Persona name search via EXISTS (no pre-materialization needed)
        OR EXISTS (
            SELECT 1
            FROM chats_entry sc
            JOIN scenario_chats_junction scj ON scj.chat_id = sc.id
            JOIN scenario_personas_junction sp ON sp.scenario_id = scj.scenario_id AND sp.active = TRUE
            JOIN persona_names_junction pn ON pn.persona_id = sp.persona_id
            JOIN names_resource n ON n.id = pn.name_id
            WHERE sc.attempt_id = haf.attempt_id
              AND LOWER(n.name) LIKE '%' || LOWER((SELECT search FROM params)) || '%'
        )
),

-- ═══════════════════════════════════════════════════════════════
-- PHASE 4: Count + Paginate on IDs
-- ═══════════════════════════════════════════════════════════════

total_count_cte AS (
    SELECT COUNT(*)::bigint AS total_count FROM searchable_rows
),
archive_counts_cte AS (
    SELECT
        COUNT(*) FILTER (WHERE is_archived = true)::bigint AS archived_count,
        COUNT(*) FILTER (WHERE is_archived = false)::bigint AS unarchived_count
    FROM searchable_rows
),
paginated_ids AS (
    SELECT attempt_id
    FROM searchable_rows
    ORDER BY
        CASE
            WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'desc' THEN attempt_date
        END DESC NULLS LAST,
        CASE
            WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'asc' THEN attempt_date
        END ASC NULLS LAST,
        CASE
            WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'desc' THEN simulation_name
        END DESC NULLS LAST,
        CASE
            WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'asc' THEN simulation_name
        END ASC NULLS LAST,
        CASE
            WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'desc' THEN COALESCE(score_percent, -1)
        END DESC,
        CASE
            WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'asc' THEN COALESCE(score_percent, 999999)
        END ASC,
        attempt_id DESC
    LIMIT (SELECT page_size FROM params)
    OFFSET (SELECT offset_val FROM params)
),

-- ═══════════════════════════════════════════════════════════════
-- PHASE 5: Expensive aggregations — ONLY for paginated set (~20 rows)
-- ═══════════════════════════════════════════════════════════════

-- Aggregate chats_entry per attempt
history_chat_rollup AS (
    SELECT
        sc.attempt_id,
        COUNT(*) FILTER (WHERE sc.completed) AS completed_chats,
        COUNT(*) FILTER (WHERE sc.completed = FALSE) AS incomplete_chats,
        MIN(sc.created_at) AS first_chat_at,
        MAX(sc.created_at) AS last_activity_at,
        array_agg(DISTINCT scj.scenario_id) FILTER (WHERE scj.scenario_id IS NOT NULL) AS scenario_ids_seen
    FROM chats_entry sc
    LEFT JOIN scenario_chats_junction scj ON scj.chat_id = sc.id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM paginated_ids)
    GROUP BY sc.attempt_id
),
-- Get latest grade per chat
history_chat_grades AS (
    SELECT DISTINCT ON (scg.chat_id)
        scg.chat_id AS chat_id,
        scg.score
    FROM grades_entry scg
    WHERE scg.chat_id IN (
        SELECT sc.id FROM chats_entry sc
        WHERE sc.attempt_id IN (SELECT attempt_id FROM paginated_ids)
    )
    ORDER BY scg.chat_id, scg.created_at DESC
),
-- Aggregate grades_entry per attempt
-- Score formula: grade.score / rubric total points * 100
history_grade_rollup AS (
    SELECT
        sc.attempt_id,
        COUNT(*) FILTER (WHERE hcg.score IS NOT NULL) AS completed_with_grade,
        SUM(CASE WHEN hcg.score IS NOT NULL AND (SELECT p.value FROM scenario_rubrics_resource srr JOIN rubric_points_junction rp ON rp.rubric_id = srr.rubric_id AND rp.type = 'total'::point_type JOIN points_resource p ON p.id = rp.point_id WHERE srr.scenario_id = scj.scenario_id LIMIT 1) > 0
            THEN TRUNC(hcg.score / (SELECT p.value FROM scenario_rubrics_resource srr JOIN rubric_points_junction rp ON rp.rubric_id = srr.rubric_id AND rp.type = 'total'::point_type JOIN points_resource p ON p.id = rp.point_id WHERE srr.scenario_id = scj.scenario_id LIMIT 1)::numeric * 100.0, 2)
            ELSE 0 END) AS sum_grade_percent
    FROM chats_entry sc
    JOIN scenario_chats_junction scj ON scj.chat_id = sc.id
    LEFT JOIN history_chat_grades hcg ON hcg.chat_id = sc.id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM paginated_ids)
    GROUP BY sc.attempt_id
),
-- Calculate elapsed time per attempt (for infinite mode time limit checks)
history_elapsed_time AS (
    SELECT
        sc.attempt_id,
        COALESCE(
            SUM(
                CASE
                    WHEN sc.completed AND hcg.chat_id IS NOT NULL THEN
                        (SELECT COALESCE(scg.time_taken, 0) FROM grades_entry scg
                         WHERE scg.chat_id = sc.id
                         ORDER BY scg.created_at DESC LIMIT 1)
                    WHEN sc.completed THEN
                        EXTRACT(EPOCH FROM (
                            (SELECT scg.created_at FROM grades_entry scg
                             WHERE scg.chat_id = sc.id
                             ORDER BY scg.created_at DESC LIMIT 1) - sc.created_at
                        ))::integer
                    ELSE
                        EXTRACT(EPOCH FROM (NOW() - sc.created_at))::integer
                END
            ),
            0
        ) AS elapsed_seconds
    FROM chats_entry sc
    LEFT JOIN history_chat_grades hcg ON hcg.chat_id = sc.id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM paginated_ids)
    GROUP BY sc.attempt_id
),
-- Get personas for each attempt
history_personas AS (
    SELECT
        sc.attempt_id,
        array_agg(DISTINCT sp.persona_id) FILTER (WHERE sp.persona_id IS NOT NULL) AS persona_ids
    FROM chats_entry sc
    JOIN scenario_chats_junction scj ON scj.chat_id = sc.id
    LEFT JOIN scenario_personas_junction sp ON sp.scenario_id = scj.scenario_id AND sp.active = TRUE
    WHERE sc.attempt_id IN (SELECT attempt_id FROM paginated_ids)
    GROUP BY sc.attempt_id
),
-- Count scenarios per simulation
history_sim_scenario_count AS (
    SELECT
        s.id AS simulation_id,
        COUNT(ss.scenario_id)::int AS scenario_count
    FROM simulation_artifact s
    LEFT JOIN simulation_scenarios_junction ss ON ss.simulation_id = s.id
    WHERE s.id IN (SELECT DISTINCT simulation_id FROM history_attempts_final WHERE attempt_id IN (SELECT attempt_id FROM paginated_ids))
    GROUP BY s.id
),
-- Get scenario info
history_scenario_ids AS (
    SELECT
        s.id AS simulation_id,
        ARRAY_AGG(ss.scenario_id ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1))::uuid[] AS scenario_ids_assigned
    FROM simulation_artifact s
    LEFT JOIN simulation_scenarios_junction ss ON ss.simulation_id = s.id
    WHERE s.id IN (SELECT DISTINCT simulation_id FROM history_attempts_final WHERE attempt_id IN (SELECT attempt_id FROM paginated_ids))
    GROUP BY s.id
),
-- Get first scenario_id from each attempt's first chat (for practice scenario retry)
history_first_scenario AS (
    SELECT DISTINCT ON (sc.attempt_id)
        sc.attempt_id,
        scj.scenario_id AS practice_scenario_id
    FROM chats_entry sc
    JOIN scenario_chats_junction scj ON scj.chat_id = sc.id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM paginated_ids)
    ORDER BY sc.attempt_id, sc.created_at ASC
),
-- Join all history data
attempt_rollup AS (
    SELECT
        haf.attempt_id,
        haf.simulation_id,
        haf.attempt_date,
        haf.is_archived,
        haf.infinite_mode,
        haf.profile_id,
        haf.simulation_name,
        haf.practice_simulation,
        haf.department_ids,
        COALESCE(hcr.first_chat_at, haf.attempt_date) AS first_chat_at,
        COALESCE(hcr.last_activity_at, haf.attempt_date) AS last_activity_at,
        COALESCE(hgr.completed_with_grade, 0) AS completed_with_grade,
        COALESCE(hssc.scenario_count, 0) AS sim_scenario_count,
        COALESCE(hgr.sum_grade_percent, 0) AS sum_grade_percent_zero_fill,
        COALESCE(hp.persona_ids, ARRAY[]::uuid[]) AS persona_ids_distinct,
        COALESCE(hcr.scenario_ids_seen, ARRAY[]::uuid[]) AS leaf_scenarios_seen,
        COALESCE(hcr.incomplete_chats, 0) AS incomplete_chats,
        COALESCE(het.elapsed_seconds, 0) AS elapsed_seconds,
        hfs.practice_scenario_id
    FROM history_attempts_final haf
    LEFT JOIN history_chat_rollup hcr ON hcr.attempt_id = haf.attempt_id
    LEFT JOIN history_grade_rollup hgr ON hgr.attempt_id = haf.attempt_id
    LEFT JOIN history_personas hp ON hp.attempt_id = haf.attempt_id
    LEFT JOIN history_sim_scenario_count hssc ON hssc.simulation_id = haf.simulation_id
    LEFT JOIN history_elapsed_time het ON het.attempt_id = haf.attempt_id
    LEFT JOIN history_first_scenario hfs ON hfs.attempt_id = haf.attempt_id
    WHERE haf.attempt_id IN (SELECT attempt_id FROM paginated_ids)
),
-- Get rubric data per simulation (one row per simulation)
simulation_rubrics AS (
    SELECT DISTINCT ON (ss.simulation_id)
        ss.simulation_id,
        srr.rubric_id,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = srr.rubric_id AND rp.type = 'total'::point_type LIMIT 1) AS rubric_points_junction,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = srr.rubric_id AND rp.type = 'pass'::point_type LIMIT 1) AS rubric_pass_points
    FROM simulation_scenarios_junction ss
    LEFT JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
    LEFT JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
    WHERE EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
      AND ss.simulation_id IN (SELECT DISTINCT simulation_id FROM attempt_rollup)
    ORDER BY ss.simulation_id, COALESCE((SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1), 999999)
),
attempt_joined AS (
    SELECT
        ar.*,
        hsi.scenario_ids_assigned,
        sr.rubric_id,
        sr.rubric_points_junction,
        sr.rubric_pass_points,
        CASE
            WHEN sr.rubric_points_junction IS NULL OR sr.rubric_points_junction = 0 THEN NULL
            ELSE ROUND((sr.rubric_pass_points::numeric / sr.rubric_points_junction::numeric) * 100.0)::int
        END AS pass_pct,
        (COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '')) AS profile_name,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
                         WHERE sstl.simulation_id = s.id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
            0
        ) as time_limit_seconds
    FROM attempt_rollup ar
    JOIN simulation_artifact s ON s.id = ar.simulation_id
    LEFT JOIN history_scenario_ids hsi ON hsi.simulation_id = ar.simulation_id
    LEFT JOIN simulation_rubrics sr ON sr.simulation_id = s.id
    JOIN profile_artifact p ON p.id = ar.profile_id
),
attempt_cohort_names AS (
    SELECT
        attempt_id,
        cohort_names_junction
    FROM history_attempt_cohorts
    WHERE attempt_id IN (SELECT attempt_id FROM paginated_ids)
),
final_rows AS (
    SELECT
        aj.attempt_id,
        aj.simulation_id,
        aj.profile_id,
        aj.profile_name,
        aj.simulation_name,
        aj.scenario_ids_assigned,
        aj.is_archived,
        aj.practice_simulation,
        aj.pass_pct,
        aj.infinite_mode,
        aj.attempt_date,
        aj.department_ids,
        aj.practice_scenario_id,
        CASE WHEN aj.infinite_mode THEN NULL ELSE COALESCE(aj.sim_scenario_count, 0) END AS num_scenarios,
        COALESCE(aj.completed_with_grade, 0) AS num_scenarios_completed,
        CASE
            WHEN aj.infinite_mode THEN
                CASE GREATEST(array_length(aj.leaf_scenarios_seen, 1), 0)
                    WHEN 0 THEN NULL
                    ELSE ROUND(aj.sum_grade_percent_zero_fill / GREATEST(array_length(aj.leaf_scenarios_seen, 1), 1))::int
                END
            ELSE
                CASE COALESCE(aj.sim_scenario_count, 0)
                    WHEN 0 THEN NULL
                    ELSE CASE
                            WHEN aj.completed_with_grade = 0 THEN NULL
                            ELSE ROUND(aj.sum_grade_percent_zero_fill / NULLIF(aj.sim_scenario_count, 0))::int
                        END
                END
        END AS score_percent,
        CASE
            WHEN aj.infinite_mode THEN
                CASE GREATEST(array_length(aj.leaf_scenarios_seen, 1), 0)
                    WHEN 0 THEN NULL
                    ELSE CASE
                        WHEN ROUND(aj.sum_grade_percent_zero_fill / GREATEST(array_length(aj.leaf_scenarios_seen, 1), 1))::int >= 80 THEN 'high'
                        WHEN ROUND(aj.sum_grade_percent_zero_fill / GREATEST(array_length(aj.leaf_scenarios_seen, 1), 1))::int >= 70 THEN 'medium'
                        ELSE 'low'
                    END
                END
            ELSE
                CASE COALESCE(aj.sim_scenario_count, 0)
                    WHEN 0 THEN NULL
                    ELSE CASE
                        WHEN aj.completed_with_grade = 0 THEN NULL
                        ELSE CASE
                            WHEN ROUND(aj.sum_grade_percent_zero_fill / NULLIF(aj.sim_scenario_count, 0))::int >= 80 THEN 'high'
                            WHEN ROUND(aj.sum_grade_percent_zero_fill / NULLIF(aj.sim_scenario_count, 0))::int >= 70 THEN 'medium'
                            ELSE 'low'
                        END
                    END
                END
        END AS score_status,
        (NOT aj.is_archived) AS show_view,
        (NOT aj.is_archived) AND (
            (aj.infinite_mode
                AND (
                    -- No time limit OR time limit not exceeded
                    (aj.time_limit_seconds IS NULL OR aj.elapsed_seconds < aj.time_limit_seconds)
                    -- AND there are incomplete chats_entry (pending work)
                    AND aj.incomplete_chats > 0
                ))
            OR
            (NOT aj.infinite_mode
                AND aj.sim_scenario_count IS NOT NULL
                AND COALESCE(aj.completed_with_grade, 0) < aj.sim_scenario_count)
        ) AS show_continue,
        aj.persona_ids_distinct
    FROM attempt_joined aj
),

-- ═══════════════════════════════════════════════════════════════
-- PHASE 6: Build response (persona/scenario labels only for page)
-- ═══════════════════════════════════════════════════════════════

persona_labels AS (
    SELECT
        fr.attempt_id,
        COALESCE(ARRAY_AGG(per.name ORDER BY per.name) FILTER (WHERE per.name IS NOT NULL), ARRAY[]::text[]) AS persona_names_junction,
        COALESCE(ARRAY_AGG(per.color ORDER BY per.name) FILTER (WHERE per.color IS NOT NULL), ARRAY[]::text[]) AS persona_colors_junction
    FROM final_rows fr
    LEFT JOIN LATERAL (
        SELECT DISTINCT n.name AS name, c.hex_code AS color
        FROM unnest(fr.persona_ids_distinct) AS pid
        JOIN personas_resource per ON per.id = pid
        LEFT JOIN persona_names_junction pn ON pn.persona_id = per.id
        LEFT JOIN names_resource n ON n.id = pn.name_id
        LEFT JOIN persona_colors_junction pc ON pc.persona_id = per.id
        LEFT JOIN colors_resource c ON c.id = pc.color_id
    ) per ON TRUE
    GROUP BY fr.attempt_id
),
scenario_names_junction AS (
    SELECT
        fr.attempt_id,
        COALESCE(sn.names, ARRAY[]::text[]) AS names
    FROM final_rows fr
    LEFT JOIN LATERAL (
        SELECT ARRAY_AGG((SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1) ORDER BY (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1)) AS names
        FROM unnest(fr.scenario_ids_assigned) sid
        JOIN scenarios_resource s ON s.id = sid
    ) sn ON TRUE
),
-- Convert paginated rows to composite types
data_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (
                fr.attempt_id,
                fr.attempt_date,
                fr.profile_id,
                fr.profile_name,
                fr.simulation_name,
                fr.num_scenarios,
                fr.num_scenarios_completed,
                fr.infinite_mode,
                COALESCE(
                    (SELECT SUM(stlr.time_limit_seconds)
                     FROM simulation_scenario_time_limits_junction sstl
                     JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
                     JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
                     WHERE sstl.simulation_id = fr.simulation_id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
                    0
                ),
                COALESCE(pl.persona_names_junction, ARRAY[]::text[]),
                COALESCE(pl.persona_colors_junction, ARRAY[]::text[]),
                fr.score_percent,
                fr.score_status,
                fr.simulation_id,
                COALESCE(fr.scenario_ids_assigned, ARRAY[]::uuid[])::text[],
                COALESCE(sn.names, ARRAY[]::text[]),
                fr.is_archived,
                fr.show_view,
                fr.show_continue,
                COALESCE(fr.practice_simulation, false),
                fr.pass_pct,
                fr.department_ids,
                COALESCE(acn.cohort_names_junction, ARRAY[]::text[]),
                fr.practice_scenario_id
            )::types.q_get_dashboard_history_v4_attempt_history_row
            ORDER BY
                CASE
                    WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'desc' THEN fr.attempt_date
                END DESC NULLS LAST,
                CASE
                    WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'asc' THEN fr.attempt_date
                END ASC NULLS LAST,
                CASE
                    WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'desc' THEN fr.simulation_name
                END DESC NULLS LAST,
                CASE
                    WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'asc' THEN fr.simulation_name
                END ASC NULLS LAST,
                CASE
                    WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'desc' THEN COALESCE(fr.score_percent, -1)
                END DESC,
                CASE
                    WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'asc' THEN COALESCE(fr.score_percent, 999999)
                END ASC,
                fr.attempt_id DESC
        ),
        '{}'::types.q_get_dashboard_history_v4_attempt_history_row[]
    ) AS data
    FROM final_rows fr
    LEFT JOIN persona_labels pl ON pl.attempt_id = fr.attempt_id
    LEFT JOIN scenario_names_junction sn ON sn.attempt_id = fr.attempt_id
    LEFT JOIN attempt_cohort_names acn ON acn.attempt_id = fr.attempt_id
),
-- Convert options to composite types
profile_options_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (profile_id::text, profile_name, count)::types.q_get_dashboard_history_v4_profile_option
            ORDER BY profile_name
        ),
        '{}'::types.q_get_dashboard_history_v4_profile_option[]
    ) AS profile_options
    FROM profile_options_cte
),
simulation_options_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (simulation_id::text, simulation_name, count)::types.q_get_dashboard_history_v4_simulation_option
            ORDER BY simulation_name
        ),
        '{}'::types.q_get_dashboard_history_v4_simulation_option[]
    ) AS simulation_options
    FROM simulation_options_cte
),
scenario_options_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (scenario_id::text, scenario_title, count)::types.q_get_dashboard_history_v4_scenario_option
            ORDER BY scenario_title
        ),
        '{}'::types.q_get_dashboard_history_v4_scenario_option[]
    ) AS scenario_options_junction
    FROM scenario_options_cte
)
SELECT
    (SELECT data FROM data_agg LIMIT 1) AS data,
    (SELECT total_count FROM total_count_cte LIMIT 1) AS total_count,
    (SELECT archived_count FROM archive_counts_cte LIMIT 1) AS archived_count,
    (SELECT unarchived_count FROM archive_counts_cte LIMIT 1) AS unarchived_count,
    (SELECT profile_options FROM profile_options_agg LIMIT 1) AS profile_options,
    (SELECT simulation_options FROM simulation_options_agg LIMIT 1) AS simulation_options,
    (SELECT scenario_options_junction FROM scenario_options_agg LIMIT 1) AS scenario_options_junction
$$;
