-- Dashboard history query with pagination, search, filters, and sorting
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
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
    persona_names text[],
    persona_colors text[],
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
    cohort_names text[],
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
    roles profile_role[] DEFAULT ARRAY[]::profile_role[],
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
    scenario_options types.q_get_dashboard_history_v4_scenario_option[]
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
        COALESCE(NULLIF(roles, ARRAY[]::profile_role[]), ARRAY[]::profile_role[]) AS roles,
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
        sa.simulation_id,
        sa.created_at AS attempt_date,
        sa.archived AS is_archived,
        sa.infinite_mode,
        sa.profile_id,
        (SELECT n.name FROM simulation_names simn JOIN names_resource n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1) AS simulation_name,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE) as practice_simulation,
        COALESCE(sdd.department_ids, NULL) as department_ids
    FROM attempts_entry sa
    JOIN simulation_artifact sim ON sim.id = sa.simulation_id
    JOIN profile_artifact p_attempt ON p_attempt.id = sa.profile_id
    LEFT JOIN (
        SELECT 
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = sim.id
    WHERE sa.created_at >= (SELECT start_date FROM params)
      AND sa.created_at <= (SELECT end_date FROM params)
      -- Dashboard never filters by profile - always filter by roles
      AND (cardinality((SELECT roles FROM params)::profile_role[]) = 0 OR COALESCE(
            (SELECT r.role FROM profile_roles pr_j
             JOIN roles_resource r ON pr_j.role_id = r.id
             WHERE pr_j.profile_id = p_attempt.id
             LIMIT 1),
            'member'::profile_role
          ) = ANY((SELECT roles FROM params)::profile_role[]))
      -- Simulation type filtering: general (practice_simulation = FALSE), practice (practice_simulation = TRUE), archived (archived = TRUE)
      -- If no filters provided (NULL or empty), default to general only (matching old behavior: sim.practice_simulation = FALSE)
      AND (
        (cardinality((SELECT simulation_filters FROM params)::text[]) = 0) AND NOT EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE)
        OR
        (cardinality((SELECT simulation_filters FROM params)::text[]) > 0 AND (
          ('general' = ANY((SELECT simulation_filters FROM params)::text[]) AND NOT EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE)) OR
          ('practice' = ANY((SELECT simulation_filters FROM params)::text[]) AND EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE)) OR
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
        COALESCE(ARRAY_AGG(DISTINCT (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)) FILTER (WHERE c.id IS NOT NULL AND cs.simulation_id = ha.simulation_id), ARRAY[]::text[]) AS cohort_names
    FROM history_attempts ha
    LEFT JOIN profile_cohorts cp ON cp.profile_id = ha.profile_id
    LEFT JOIN cohort_artifact c ON c.id = cp.cohort_id AND EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'cohort_active' AND cf.value = TRUE)
    LEFT JOIN cohort_simulations cs ON cs.cohort_id = c.id
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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') AS profile_name,
        COUNT(DISTINCT haf.attempt_id) AS count
    FROM history_attempts_filtered haf
    JOIN profile_artifact p ON p.id = haf.profile_id
    GROUP BY haf.profile_id, (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id LIMIT 1)
    ORDER BY profile_name
),
-- Get all unique simulation options from filtered attempts (before history-specific filters)
simulation_options_cte AS (
    SELECT 
        haf.simulation_id,
        (SELECT n.name FROM simulation_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) AS simulation_name,
        COUNT(DISTINCT haf.attempt_id) AS count
    FROM history_attempts_filtered haf
    JOIN simulation_artifact s ON s.id = haf.simulation_id
    GROUP BY haf.simulation_id, (SELECT n.name FROM simulation_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)
    ORDER BY simulation_name
),
-- Get all unique scenario options from filtered attempts (before history-specific filters)
scenario_options_cte AS (
    SELECT
        sc.scenario_id,
        (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1) AS scenario_title,
        COUNT(DISTINCT haf.attempt_id) AS count
    FROM history_attempts_filtered haf
    JOIN chats sc ON sc.attempt_id = haf.attempt_id
    JOIN scenarios_resource s ON s.id = sc.scenario_id
    WHERE sc.scenario_id IS NOT NULL
    GROUP BY sc.scenario_id, (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1)
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
        ARRAY_AGG(DISTINCT sc.scenario_id) FILTER (WHERE sc.scenario_id IS NOT NULL) AS scenario_ids
    FROM chats sc
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
-- Aggregate chats per attempt
history_chat_rollup AS (
    SELECT
        sc.attempt_id,
        COUNT(*) FILTER (WHERE sc.completed) AS completed_chats,
        COUNT(*) FILTER (WHERE sc.completed = FALSE) AS incomplete_chats,
        MIN(sc.created_at) AS first_chat_at,
        MAX(sc.created_at) AS last_activity_at,
        array_agg(DISTINCT sc.scenario_id) FILTER (WHERE sc.scenario_id IS NOT NULL) AS scenario_ids_seen
    FROM chats sc
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY sc.attempt_id
),
-- Get latest grade per chat
history_chat_grades AS (
    SELECT DISTINCT ON (c.id)
        c.id AS chat_id,
        scg.score,
        COALESCE(srr.rubric_id, srr_fallback.rubric_id) as rubric_id
    FROM grades scg
    JOIN chats c ON c.group_id = scg.group_id
    LEFT JOIN scenario_rubrics_resource srr ON srr.scenario_id = c.scenario_id
    LEFT JOIN attempts_entry sa_fallback ON sa_fallback.id = c.attempt_id
    LEFT JOIN simulation_scenario_rubrics ssr_fallback ON ssr_fallback.simulation_id = sa_fallback.simulation_id
    LEFT JOIN scenario_rubrics_resource srr_fallback ON srr_fallback.id = ssr_fallback.scenario_rubric_id AND srr_fallback.scenario_id = c.scenario_id AND srr.rubric_id IS NULL
    WHERE c.id IN (
        SELECT sc.id FROM chats sc
        WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
      )
    ORDER BY c.id, scg.created_at DESC
),
-- Get first scenario's rubric per simulation (fallback when chat scenario doesn't match)
sim_first_scenario_rubric AS (
    SELECT DISTINCT ON (ss.simulation_id)
        ss.simulation_id,
        srr.rubric_id,
        p_total.value AS points
    FROM simulation_scenarios ss
    LEFT JOIN simulation_scenario_rubrics ssr ON ssr.simulation_id = ss.simulation_id
    LEFT JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
    LEFT JOIN rubrics_resource r ON r.id = srr.rubric_id
    LEFT JOIN rubric_points rp_total ON rp_total.rubric_id = r.id AND rp_total.type = 'total'::type_rubric_points
    LEFT JOIN points_resource p_total ON p_total.id = rp_total.point_id
    WHERE EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
      AND ss.simulation_id IN (SELECT DISTINCT simulation_id FROM history_attempts_final)
         ORDER BY ss.simulation_id, (SELECT spr.value FROM simulation_scenario_positions ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1)
),
-- Aggregate grades per attempt
history_grade_rollup AS (
    SELECT
        sc.attempt_id,
        COUNT(*) FILTER (WHERE hcg.score IS NOT NULL) AS completed_with_grade,
        SUM(CASE WHEN hcg.score IS NOT NULL AND COALESCE(p_r.value, p_fallback_scenario.value, p_fallback_first.value, 0) > 0
            THEN (hcg.score / COALESCE(p_r.value, p_fallback_scenario.value, p_fallback_first.value, 1)::numeric * 100.0)
            ELSE 0 END) AS sum_grade_percent
    FROM chats sc
    JOIN attempts_entry sa ON sa.id = sc.attempt_id
    LEFT JOIN history_chat_grades hcg ON hcg.chat_id = sc.id
    LEFT JOIN simulation_scenario_rubrics ssr_fallback_scenario ON ssr_fallback_scenario.simulation_id = sa.simulation_id
    LEFT JOIN scenario_rubrics_resource srr_fallback_scenario ON srr_fallback_scenario.id = ssr_fallback_scenario.scenario_rubric_id AND srr_fallback_scenario.scenario_id = sc.scenario_id
      AND hcg.chat_id IS NOT NULL
      AND hcg.rubric_id IS NULL
    LEFT JOIN rubrics_resource r ON r.id = hcg.rubric_id
    LEFT JOIN rubric_points rp_r ON rp_r.rubric_id = r.id AND rp_r.type = 'total'::type_rubric_points
    LEFT JOIN points_resource p_r ON p_r.id = rp_r.point_id
    LEFT JOIN rubrics_resource r_fallback_scenario ON r_fallback_scenario.id = srr_fallback_scenario.rubric_id
    LEFT JOIN rubric_points rp_fallback_scenario ON rp_fallback_scenario.rubric_id = r_fallback_scenario.id AND rp_fallback_scenario.type = 'total'::type_rubric_points
    LEFT JOIN points_resource p_fallback_scenario ON p_fallback_scenario.id = rp_fallback_scenario.point_id
    LEFT JOIN sim_first_scenario_rubric sfsr ON sfsr.simulation_id = sa.simulation_id
      AND hcg.chat_id IS NOT NULL
      AND hcg.rubric_id IS NULL
      AND p_fallback_scenario.value IS NULL
    LEFT JOIN rubrics_resource r_fallback_first ON r_fallback_first.id = sfsr.rubric_id
    LEFT JOIN rubric_points rp_fallback_first ON rp_fallback_first.rubric_id = r_fallback_first.id AND rp_fallback_first.type = 'total'::type_rubric_points
    LEFT JOIN points_resource p_fallback_first ON p_fallback_first.id = rp_fallback_first.point_id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
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
                        (SELECT COALESCE(scg.time_taken, 0) FROM grades scg
                         JOIN chats c ON c.group_id = scg.group_id
                         WHERE c.id = sc.id
                         ORDER BY scg.created_at DESC LIMIT 1)
                    WHEN sc.completed THEN
                        EXTRACT(EPOCH FROM (
                            (SELECT scg.created_at FROM grades scg
                             JOIN chats c ON c.group_id = scg.group_id
                             WHERE c.id = sc.id
                             ORDER BY scg.created_at DESC LIMIT 1) - sc.created_at
                        ))::integer
                    ELSE
                        EXTRACT(EPOCH FROM (NOW() - sc.created_at))::integer
                END
            ),
            0
        ) AS elapsed_seconds
    FROM chats sc
    LEFT JOIN history_chat_grades hcg ON hcg.chat_id = sc.id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY sc.attempt_id
),
-- Get personas for each attempt
history_personas AS (
    SELECT
        sc.attempt_id,
        array_agg(DISTINCT sp.persona_id) FILTER (WHERE sp.persona_id IS NOT NULL) AS persona_ids
    FROM chats sc
    JOIN scenarios_resource scn ON scn.id = sc.scenario_id
    LEFT JOIN scenario_personas sp ON sp.scenario_id = scn.id AND sp.active = TRUE
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY sc.attempt_id
),
-- Count scenarios per simulation
history_sim_scenario_count AS (
    SELECT
        s.id AS simulation_id,
        COUNT(ss.scenario_id)::int AS scenario_count
    FROM simulation_artifact s
    LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
    WHERE s.id IN (SELECT simulation_id FROM history_attempts_final)
    GROUP BY s.id
),
-- Get scenario info
history_scenario_ids AS (
    SELECT
        s.id AS simulation_id,
        ARRAY_AGG(ss.scenario_id ORDER BY (SELECT spr.value FROM simulation_scenario_positions ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1))::uuid[] AS scenario_ids_assigned
    FROM simulation_artifact s
    LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
    WHERE s.id IN (SELECT simulation_id FROM history_attempts_final)
    GROUP BY s.id
),
-- Get first scenario_id from each attempt's first chat (for practice scenario retry)
history_first_scenario AS (
    SELECT DISTINCT ON (sc.attempt_id)
        sc.attempt_id,
        sc.scenario_id AS practice_scenario_id
    FROM chats sc
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
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
),
attempt_cohort_ids AS (
    SELECT
        attempt_id,
        cohort_ids AS profile_cohort_ids
    FROM history_attempt_cohorts
    WHERE attempt_id IN (SELECT attempt_id FROM history_attempts_final)
),
-- Get rubric data per simulation (one row per simulation)
simulation_rubrics AS (
    SELECT DISTINCT ON (ss.simulation_id)
        ss.simulation_id,
        r.id AS rubric_id,
        p_total.value AS rubric_points,
        p_pass.value AS rubric_pass_points
    FROM simulation_scenarios ss
    LEFT JOIN simulation_scenario_rubrics ssr ON ssr.simulation_id = ss.simulation_id
    LEFT JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
    LEFT JOIN rubrics_resource r ON r.id = srr.rubric_id
    LEFT JOIN rubric_points rp_total ON rp_total.rubric_id = r.id AND rp_total.type = 'total'::type_rubric_points
    LEFT JOIN points_resource p_total ON p_total.id = rp_total.point_id
    LEFT JOIN rubric_points rp_pass ON rp_pass.rubric_id = r.id AND rp_pass.type = 'pass'::type_rubric_points
    LEFT JOIN points_resource p_pass ON p_pass.id = rp_pass.point_id
    WHERE EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
      AND ss.simulation_id IN (SELECT DISTINCT simulation_id FROM attempt_rollup)
    ORDER BY ss.simulation_id, COALESCE((SELECT spr.value FROM simulation_scenario_positions ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1), 999999)
),
attempt_joined AS (
    SELECT
        ar.*,
        hsi.scenario_ids_assigned,
        sr.rubric_id,
        sr.rubric_points,
        sr.rubric_pass_points,
        CASE
            WHEN sr.rubric_points IS NULL OR sr.rubric_points = 0 THEN NULL
            ELSE ROUND((sr.rubric_pass_points::numeric / sr.rubric_points::numeric) * 100.0)::int
        END AS pass_pct,
        (COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '')) AS profile_name,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
                         WHERE sstl.simulation_id = s.id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
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
        cohort_names
    FROM history_attempt_cohorts
    WHERE attempt_id IN (SELECT attempt_id FROM history_attempts_final)
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
                    -- AND there are incomplete chats (pending work)
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
-- Apply search filter (searches profile name, simulation name, persona names)
final_rows_with_search AS (
    SELECT fr.*
    FROM final_rows fr
    WHERE 
        -- Search filter: if search term provided, search in profile name, simulation name, or persona names
        ((SELECT search FROM params) IS NULL OR (SELECT search FROM params) = '' OR
         LOWER(fr.profile_name) LIKE '%' || LOWER((SELECT search FROM params)) || '%' OR
         LOWER(fr.simulation_name) LIKE '%' || LOWER((SELECT search FROM params)) || '%' OR
         EXISTS (
             SELECT 1
             FROM unnest(fr.persona_ids_distinct) AS pid
             JOIN personas_resource per ON per.id = pid
             JOIN persona_names pn ON pn.persona_id = per.id
             JOIN names_resource n ON n.id = pn.name_id
             WHERE LOWER(n.name) LIKE '%' || LOWER((SELECT search FROM params)) || '%'
         ))
),
persona_labels AS (
    SELECT
        fr.attempt_id,
        COALESCE(ARRAY_AGG(per.name ORDER BY per.name) FILTER (WHERE per.name IS NOT NULL), ARRAY[]::text[]) AS persona_names,
        COALESCE(ARRAY_AGG(per.color ORDER BY per.name) FILTER (WHERE per.color IS NOT NULL), ARRAY[]::text[]) AS persona_colors
    FROM final_rows_with_search fr
    LEFT JOIN LATERAL (
        SELECT DISTINCT n.name AS name, c.hex_code AS color
        FROM unnest(fr.persona_ids_distinct) AS pid
        JOIN personas_resource per ON per.id = pid
        LEFT JOIN persona_names pn ON pn.persona_id = per.id
        LEFT JOIN names_resource n ON n.id = pn.name_id
        LEFT JOIN persona_colors pc ON pc.persona_id = per.id
        LEFT JOIN colors_resource c ON c.id = pc.color_id
    ) per ON TRUE
    GROUP BY fr.attempt_id
),
scenario_names AS (
    SELECT
        fr.attempt_id,
        COALESCE(sn.names, ARRAY[]::text[]) AS names
    FROM final_rows_with_search fr
    LEFT JOIN LATERAL (
        SELECT ARRAY_AGG((SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1) ORDER BY (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.scenario_id LIMIT 1)) AS names
        FROM unnest(fr.scenario_ids_assigned) sid
        JOIN scenarios_resource s ON s.id = sid
    ) sn ON TRUE
),
-- Get total count before pagination
total_count_cte AS (
    SELECT COUNT(*)::bigint AS total_count
    FROM final_rows_with_search
),
-- Get archived and unarchived counts for filtered set
archive_counts_cte AS (
    SELECT 
        COUNT(*) FILTER (WHERE is_archived = true)::bigint AS archived_count,
        COUNT(*) FILTER (WHERE is_archived = false)::bigint AS unarchived_count
    FROM final_rows_with_search
),
-- Paginated and sorted results
paginated_rows AS (
    SELECT
        fr.attempt_id,
        fr.attempt_date,
        fr.profile_id,
        fr.profile_name,
        fr.simulation_name,
        fr.num_scenarios,
        fr.num_scenarios_completed,
        fr.infinite_mode,
        fr.score_percent,
        fr.score_status,
        fr.simulation_id,
        fr.scenario_ids_assigned,
        fr.is_archived,
        fr.show_view,
        fr.show_continue,
        fr.practice_simulation,
        fr.pass_pct,
        fr.department_ids,
        fr.practice_scenario_id,
        fr.persona_ids_distinct
    FROM final_rows_with_search fr
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
    LIMIT (SELECT page_size FROM params)
    OFFSET (SELECT offset_val FROM params)
),
-- Convert paginated rows to composite types
data_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (
                pr.attempt_id,
                pr.attempt_date,
                pr.profile_id,
                pr.profile_name,
                pr.simulation_name,
                pr.num_scenarios,
                pr.num_scenarios_completed,
                pr.infinite_mode,
                COALESCE(
                    (SELECT SUM(stlr.time_limit_seconds)
                     FROM simulation_scenario_time_limits sstl
                     JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
                     JOIN simulation_scenarios ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
                     WHERE sstl.simulation_id = pr.simulation_id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
                    0
                ),
                COALESCE(pl.persona_names, ARRAY[]::text[]),
                COALESCE(pl.persona_colors, ARRAY[]::text[]),
                pr.score_percent,
                pr.score_status,
                pr.simulation_id,
                COALESCE(pr.scenario_ids_assigned, ARRAY[]::uuid[])::text[],
                COALESCE(sn.names, ARRAY[]::text[]),
                pr.is_archived,
                pr.show_view,
                pr.show_continue,
                COALESCE(pr.practice_simulation, false),
                pr.pass_pct,
                pr.department_ids,
                COALESCE(acn.cohort_names, ARRAY[]::text[]),
                pr.practice_scenario_id
            )::types.q_get_dashboard_history_v4_attempt_history_row
            ORDER BY 
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'desc' THEN pr.attempt_date
                END DESC NULLS LAST,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'asc' THEN pr.attempt_date
                END ASC NULLS LAST,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'desc' THEN pr.simulation_name
                END DESC NULLS LAST,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'asc' THEN pr.simulation_name
                END ASC NULLS LAST,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'desc' THEN COALESCE(pr.score_percent, -1)
                END DESC,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'asc' THEN COALESCE(pr.score_percent, 999999)
                END ASC,
                pr.attempt_id DESC
        ),
        '{}'::types.q_get_dashboard_history_v4_attempt_history_row[]
    ) AS data
    FROM paginated_rows pr
    LEFT JOIN persona_labels pl ON pl.attempt_id = pr.attempt_id
    LEFT JOIN scenario_names sn ON sn.attempt_id = pr.attempt_id
    LEFT JOIN attempt_cohort_names acn ON acn.attempt_id = pr.attempt_id
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
    ) AS scenario_options
    FROM scenario_options_cte
)
SELECT
    (SELECT data FROM data_agg LIMIT 1) AS data,
    (SELECT total_count FROM total_count_cte LIMIT 1) AS total_count,
    (SELECT archived_count FROM archive_counts_cte LIMIT 1) AS archived_count,
    (SELECT unarchived_count FROM archive_counts_cte LIMIT 1) AS unarchived_count,
    (SELECT profile_options FROM profile_options_agg LIMIT 1) AS profile_options,
    (SELECT simulation_options FROM simulation_options_agg LIMIT 1) AS simulation_options,
    (SELECT scenario_options FROM scenario_options_agg LIMIT 1) AS scenario_options
$$;
