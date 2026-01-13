-- Get reports bundle with aggregated metrics per profile
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
--
-- Parameters: start_date, end_date, profile_id, cohort_ids, department_ids, roles, simulation_filters,
--             profile_ids, simulation_ids, scenario_ids, search, sort_by, sort_order, page, page_size
-- Returns: Complete reports bundle with profile data, metrics, filter options, and entity mappings (as arrays)
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_reports_bundle_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_reports_bundle_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop in reverse dependency order: profile -> profile_metrics -> metric -> data_point/hover -> others
DO $$
DECLARE
    r RECORD;
    type_names text[] := ARRAY[
        'q_reports_bundle_v4_profile',  -- Depends on profile_metrics
        'q_reports_bundle_v4_profile_metrics',  -- Depends on metric
        'q_reports_bundle_v4_metric',  -- Depends on data_point and hover
        'q_reports_bundle_v4_data_point',  -- No dependencies
        'q_reports_bundle_v4_hover',  -- No dependencies
        'q_reports_bundle_v4_filter_option',  -- No dependencies
        'q_reports_bundle_v4_scenario',  -- No dependencies
        'q_reports_bundle_v4_simulation'  -- No dependencies
    ];
    type_name text;
BEGIN
    -- Drop in reverse dependency order (parents before children)
    FOREACH type_name IN ARRAY type_names
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', type_name);
    END LOOP;
    
    -- Drop any remaining types matching the pattern (safety net)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_reports_bundle_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
          AND typname != ALL(type_names)
    LOOP
        BEGIN
            EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
        EXCEPTION WHEN OTHERS THEN
            -- Type might have dependencies, skip it
            NULL;
        END;
    END LOOP;
END $$;

-- 3) Recreate types
-- Data point for trend data
CREATE TYPE types.q_reports_bundle_v4_data_point AS (
    profile_id text,
    date text,
    value numeric,
    simulation_id text,
    scenario_id text,
    attempt_id text
);

-- Hover data (varies by metric type) - all fields required, provide 0/empty defaults when constructing
CREATE TYPE types.q_reports_bundle_v4_hover AS (
    mean int,
    median int,
    mode int,
    count int,
    completed int,
    total int,
    percent int,
    top int[],
    mean_seconds int,
    median_seconds int,
    samples int,
    avg_score_percent int,
    avg_minutes int,
    efficiency int,
    tracked int,
    stagnant int,
    rate_percent int,
    total_minutes int,
    total_hours numeric,
    attempts int,
    unique_simulations int,
    per_simulation_mean int
);

-- Metric response
CREATE TYPE types.q_reports_bundle_v4_metric AS (
    has_data boolean,
    method text,
    current_value int,
    data_points types.q_reports_bundle_v4_data_point[],
    hover types.q_reports_bundle_v4_hover,
    status text
);

-- Profile metrics (all 10 metrics)
CREATE TYPE types.q_reports_bundle_v4_profile_metrics AS (
    average_score types.q_reports_bundle_v4_metric,
    completion_percentage types.q_reports_bundle_v4_metric,
    first_attempt_pass_rate types.q_reports_bundle_v4_metric,
    highest_score types.q_reports_bundle_v4_metric,
    messages_per_session types.q_reports_bundle_v4_metric,
    persona_response_times types.q_reports_bundle_v4_metric,
    session_efficiency types.q_reports_bundle_v4_metric,
    stagnation_rate types.q_reports_bundle_v4_metric,
    time_spent types.q_reports_bundle_v4_metric,
    total_attempts types.q_reports_bundle_v4_metric
);

-- Profile data
CREATE TYPE types.q_reports_bundle_v4_profile AS (
    profile_id uuid,
    first_name text,
    last_name text,
    emails text[],
    primary_email text,
    role text,
    simulation_ids text[],
    scenario_ids text[],
    metrics types.q_reports_bundle_v4_profile_metrics
);

-- Filter option
CREATE TYPE types.q_reports_bundle_v4_filter_option AS (
    value text,
    label text,
    count int
);

-- Scenario mapping item
CREATE TYPE types.q_reports_bundle_v4_scenario AS (
    scenario_id uuid,
    name text,
    description text
);

-- Simulation mapping item
CREATE TYPE types.q_reports_bundle_v4_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    rubric_id uuid,
    rubric_points int,
    rubric_pass_points int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_reports_bundle_v4(
    start_date text,
    end_date text,
    profile_id uuid,
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    roles profile_role[] DEFAULT ARRAY[]::profile_role[],
    simulation_filters text[] DEFAULT NULL,
    profile_ids uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_ids uuid[] DEFAULT ARRAY[]::uuid[],
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[],
    search text DEFAULT NULL,
    sort_by text DEFAULT 'averageScore',
    sort_order text DEFAULT 'desc',
    page int DEFAULT 0,
    page_size int DEFAULT 100
)
RETURNS TABLE (
    actor_name text,
    data types.q_reports_bundle_v4_profile[],
    total_count bigint,
    page int,
    page_size int,
    total_pages bigint,
    profile_options types.q_reports_bundle_v4_filter_option[],
    simulation_options types.q_reports_bundle_v4_filter_option[],
    scenario_options types.q_reports_bundle_v4_filter_option[],
    scenarios types.q_reports_bundle_v4_scenario[],
    simulations types.q_reports_bundle_v4_simulation[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        (start_date::timestamptz) AS start_date,
        (end_date::timestamptz) AS end_date,
        profile_id AS profile_id,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(roles, ARRAY[]::profile_role[]) AS roles,
        CASE 
            WHEN simulation_filters IS NULL OR cardinality(simulation_filters) = 0 
            THEN ARRAY['general']::text[]
            ELSE simulation_filters
        END AS simulation_filters,
        COALESCE(profile_ids, ARRAY[]::uuid[]) AS profile_ids,
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        COALESCE(scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
        COALESCE(NULLIF(search, ''), NULL) AS search,
        COALESCE(NULLIF(sort_by, ''), 'averageScore') AS sort_by,
        COALESCE(NULLIF(UPPER(sort_order), ''), 'DESC') AS sort_order,
        GREATEST(0, COALESCE(page, 0)) AS page,
        GREATEST(1, COALESCE(page_size, 100)) AS page_size
),
-- Get actor name from profile
user_profile AS (
    SELECT 
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = (SELECT profile_id FROM params) AND pn.type = 'full'::type_profile_names LIMIT 1),
            (SELECT n1.name || ' ' || n2.name FROM profile_names pn1 JOIN names n1 ON pn1.name_id = n1.id JOIN profile_names pn2 ON pn2.profile_id = pn1.profile_id JOIN names n2 ON pn2.name_id = n2.id WHERE pn1.profile_id = (SELECT profile_id FROM params) AND pn1.type = 'first'::type_profile_names AND pn2.type = 'last'::type_profile_names LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
),
-- Get thresholds from active settings
settings_thresholds AS (
    SELECT 
        COALESCE((SELECT t.value FROM setting_thresholds st JOIN thresholds t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'success'::type_setting_thresholds LIMIT 1), 85) AS success_threshold,
        COALESCE((SELECT t.value FROM setting_thresholds st JOIN thresholds t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'warning'::type_setting_thresholds LIMIT 1), 80) AS warning_threshold,
        COALESCE((SELECT t.value FROM setting_thresholds st JOIN thresholds t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'danger'::type_setting_thresholds LIMIT 1), 70) AS danger_threshold
    FROM setting s
    WHERE EXISTS (
        SELECT 1 FROM setting_flags sf
        JOIN flags f ON sf.flag_id = f.id
        WHERE sf.setting_id = s.id
          AND (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1) = 'active'
          AND sf.type = 'active'::type_setting_flags
          AND sf.value = TRUE
    )
    LIMIT 1
),
-- Start FROM profile to include all matching profiles, even without attempts
filtered_profiles AS (
    SELECT 
        p.id, 
        (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first'::type_profile_names LIMIT 1) AS first_name, 
        (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'last'::type_profile_names LIMIT 1) AS last_name, 
        ARRAY_AGG(e.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT e2.email FROM profile_emails pe2 JOIN emails e2 ON pe2.email_id = e2.id WHERE pe2.profile_id = p.id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        p.role,
        p.created_at
    FROM profile p
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN emails e ON pe.email_id = e.id
    WHERE 
        (cardinality((SELECT roles FROM params)::profile_role[]) = 0 OR p.role = ANY((SELECT roles FROM params)::profile_role[]))
        AND (cardinality((SELECT cohort_ids FROM params)::uuid[]) = 0 OR EXISTS (
            SELECT 1 FROM cohort_profiles cp 
            WHERE cp.profile_id = p.id 
              AND cp.cohort_id = ANY((SELECT cohort_ids FROM params)::uuid[]) 
              AND cp.active = true
        ))
        AND (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR EXISTS (
            SELECT 1 FROM profile_departments pd 
            WHERE pd.profile_id = p.id 
              AND pd.department_id = ANY((SELECT department_ids FROM params)::uuid[]) 
              AND pd.active = true
        ))
        AND (cardinality((SELECT profile_ids FROM params)::uuid[]) = 0 OR p.id = ANY((SELECT profile_ids FROM params)::uuid[]))
        AND ((SELECT search FROM params) IS NULL OR 
             EXISTS (
                SELECT 1 FROM profile_names pn JOIN names n ON pn.name_id = n.id 
                WHERE pn.profile_id = p.id 
                  AND n.name ILIKE '%' || (SELECT search FROM params) || '%'
             ))
    GROUP BY p.id, p.role, p.created_at
),
filt AS (
    SELECT a.* FROM analytics a
    WHERE a.attempt_created_at >= (SELECT start_date FROM params)
      AND a.attempt_created_at < (SELECT end_date FROM params)
      AND a.profile_id IN (SELECT id FROM filtered_profiles)
      AND (
          cardinality((SELECT cohort_ids FROM params)::uuid[]) = 0 OR
          a.simulation_id IN (
              SELECT DISTINCT s.id
              FROM simulation s
              WHERE EXISTS (SELECT 1 FROM simulation_flags sf WHERE sf.simulation_id = s.id AND sf.type = 'active'::type_simulation_flags AND sf.value = TRUE)
                AND (
                    EXISTS (
                        SELECT 1 
                        FROM cohort_simulations cs 
                        WHERE cs.simulation_id = s.id 
                          AND cs.cohort_id = ANY((SELECT cohort_ids FROM params)::uuid[])
                          AND cs.active = TRUE
                    )
                    OR
                    (EXISTS (SELECT 1 FROM simulation_flags sf WHERE sf.simulation_id = s.id AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE)
                     AND NOT EXISTS (
                         SELECT 1 
                         FROM cohort_simulations cs2 
                         WHERE cs2.simulation_id = s.id 
                           AND cs2.active = TRUE
                     ))
                )
          )
      )
      AND (cardinality((SELECT profile_ids FROM params)::uuid[]) = 0 OR a.profile_id = ANY((SELECT profile_ids FROM params)::uuid[]))
      AND (cardinality((SELECT simulation_ids FROM params)::uuid[]) = 0 OR a.simulation_id = ANY((SELECT simulation_ids FROM params)::uuid[]))
      AND (cardinality((SELECT scenario_ids FROM params)::uuid[]) = 0 OR a.scenario_id = ANY((SELECT scenario_ids FROM params)::uuid[]))
      AND (
          ('general' = ANY((SELECT simulation_filters FROM params)::text[]) AND a.is_general = TRUE) OR
          ('practice' = ANY((SELECT simulation_filters FROM params)::text[]) AND a.is_practice = TRUE) OR
          ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) AND a.is_archived = TRUE)
      )
      AND ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) OR a.is_archived = FALSE)
),
profile_metrics AS (
    SELECT
        fp.id AS profile_id,
        fp.first_name,
        fp.last_name,
        fp.emails,
        fp.primary_email,
        fp.role,
        AVG(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS avg_score,
        MAX(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS highest_score,
        COUNT(DISTINCT f.attempt_id)::int AS total_attempts,
        AVG(f.num_messages_total) FILTER (WHERE f.num_messages_total IS NOT NULL) AS avg_messages,
        AVG(f.time_taken_seconds / 60.0) FILTER (WHERE f.time_taken_seconds IS NOT NULL) AS avg_time_minutes
    FROM filtered_profiles fp
    LEFT JOIN filt f ON f.profile_id = fp.id
    GROUP BY fp.id, fp.first_name, fp.last_name, fp.emails, fp.primary_email, fp.role
),
total_time_per_profile AS (
    SELECT
        f.profile_id,
        SUM(LEAST(f.time_taken_seconds / 60.0, 30.0))::float AS total_time_minutes
    FROM filt f
    WHERE f.time_taken_seconds IS NOT NULL
    GROUP BY f.profile_id
),
completion_per_profile AS (
    SELECT
        fp.id AS profile_id,
        (100.0 * AVG((f.completed)::int))::float AS completion_pct
    FROM filtered_profiles fp
    LEFT JOIN filt f ON f.profile_id = fp.id
    GROUP BY fp.id
    HAVING COUNT(f.attempt_id) > 0
),
earliest_attempts_all_time AS (
    SELECT DISTINCT ON (a.profile_id, a.simulation_id)
        a.profile_id,
        a.simulation_id,
        a.attempt_created_at,
        a.grade_percent,
        a.rubric_pass_points,
        a.rubric_points
    FROM analytics a
    WHERE a.profile_id IN (SELECT id FROM filtered_profiles)
    ORDER BY a.profile_id, a.simulation_id, a.attempt_created_at
),
filt_date_range AS (
    SELECT 
        MIN(attempt_created_at) AS min_date,
        MAX(attempt_created_at) AS max_date
    FROM filt
    WHERE attempt_created_at IS NOT NULL
),
first_attempts AS (
    SELECT
        ea.profile_id,
        ea.grade_percent >= (ea.rubric_pass_points * 100.0 / NULLIF(ea.rubric_points, 0)) AS passed
    FROM earliest_attempts_all_time ea
    CROSS JOIN filt_date_range fdr
    WHERE EXISTS (SELECT 1 FROM filt f WHERE f.profile_id = ea.profile_id)
      AND fdr.min_date IS NOT NULL
      AND ea.attempt_created_at >= fdr.min_date
      AND ea.attempt_created_at <= fdr.max_date
),
first_attempt_per_profile AS (
    SELECT
        profile_id,
        (100.0 * COUNT(*) FILTER (WHERE passed) / NULLIF(COUNT(*), 0))::float AS pass_rate
    FROM first_attempts
    GROUP BY profile_id
),
persona_times AS (
    SELECT
        f.profile_id,
        UNNEST(f.message_time_taken_seconds) AS delta_sec
    FROM filt f
    WHERE cardinality(f.message_time_taken_seconds) > 0
),
persona_per_profile AS (
    SELECT
        profile_id,
        AVG(delta_sec)::float AS avg_response_time
    FROM persona_times
    GROUP BY profile_id
),
efficiency_metrics_per_profile AS (
    SELECT
        f.profile_id,
        AVG(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS avg_score,
        SUM(f.time_taken_seconds / 60.0) FILTER (WHERE f.time_taken_seconds IS NOT NULL) AS total_minutes,
        COUNT(DISTINCT f.chat_id) AS total_sessions
    FROM filt f
    GROUP BY f.profile_id
),
efficiency_per_profile AS (
    SELECT
        profile_id,
        GREATEST(0, LEAST(100, 
            avg_score * (1.0 - LEAST(1.0, (total_minutes / NULLIF(total_sessions, 0)) / 120.0))
        ))::float AS efficiency
    FROM efficiency_metrics_per_profile
    WHERE total_sessions > 0
),
profile_chats AS (
    SELECT DISTINCT profile_id, chat_id 
    FROM filt 
    WHERE chat_id IS NOT NULL
),
-- Get chat scenario and simulation info for bundle fallback
chat_scenario_info_bundle AS (
    SELECT DISTINCT
        c.id AS chat_id,
        c.scenario_id,
        sa.simulation_id
    FROM chat c
    JOIN attempt_chats ac ON ac.chat_id = c.id
    JOIN simulation_attempts sa ON sa.id = ac.attempt_id
    WHERE c.id IN (SELECT chat_id FROM profile_chats)
),
-- Get first scenario's rubric per simulation for bundle (fallback)
sim_first_scenario_rubric_bundle AS (
    SELECT DISTINCT ON (ss.simulation_id)
        ss.simulation_id,
        rga.rubric_id,
        (SELECT p.value FROM rubric_points rp JOIN points p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'total' LIMIT 1) as points
    FROM simulation_scenarios ss
    LEFT JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga ON sssrga.simulation_id = ss.simulation_id AND sssrga.scenario_id = ss.scenario_id
    LEFT JOIN scenario_rubric_grade_agents srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
    LEFT JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
    LEFT JOIN rubrics r ON r.id = rga.rubric_id
    WHERE EXISTS (SELECT 1 FROM simulation_scenario_flags ssf WHERE ssf.simulation_id = ss.simulation_id AND ssf.scenario_id = ss.scenario_id AND ssf.type = 'active'::type_simulation_scenario_flags AND ssf.value = true)
      AND ss.simulation_id IN (SELECT DISTINCT simulation_id FROM chat_scenario_info_bundle)
    ORDER BY ss.simulation_id, (SELECT sp.value FROM scenario_positions sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1)
),
grade_stream_per_profile AS (
    SELECT
        pc.profile_id,
        sg.id,
        c_bundle.id AS simulation_chat_id,
        sg.created_at,
        (sg.score::numeric / NULLIF(COALESCE((SELECT p.value FROM rubric_points rp JOIN points p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'total' LIMIT 1), (SELECT p.value FROM rubric_points rp JOIN points p ON rp.point_id = p.id WHERE rp.rubric_id = r_fallback_scenario.id AND rp.type = 'total' LIMIT 1), (SELECT p.value FROM rubric_points rp JOIN points p ON rp.point_id = p.id WHERE rp.rubric_id = r_fallback_first.id AND rp.type = 'total' LIMIT 1), 0), 0)) * 100.0 AS norm
    FROM grade sg
    LEFT JOIN rubric_grade_agents rga ON rga.id = sg.rubric_grade_agent_id
    JOIN run r_bundle ON r_bundle.id = sg.run_id
    JOIN group_runs gr_bundle ON gr_bundle.run_id = r_bundle.id
    JOIN grade_groups gg_bundle ON gg_bundle.group_id = gr_bundle.group_id
    JOIN chat c_bundle ON c_bundle.id = gg_bundle.chat_id
    JOIN profile_chats pc ON pc.chat_id = c_bundle.id
    LEFT JOIN chat_scenario_info_bundle csi ON csi.chat_id = c_bundle.id
    LEFT JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga_fallback ON sssrga_fallback.simulation_id = csi.simulation_id
      AND sssrga_fallback.scenario_id = csi.scenario_id
      AND rga.rubric_id IS NULL
    LEFT JOIN scenario_rubric_grade_agents srga_fallback ON srga_fallback.id = sssrga_fallback.scenario_rubric_grade_agent_id
    LEFT JOIN rubric_grade_agents rga_fallback_scenario ON rga_fallback_scenario.id = srga_fallback.grade_agent_id
    LEFT JOIN rubrics r ON r.id = rga.rubric_id
    LEFT JOIN rubrics r_fallback_scenario ON r_fallback_scenario.id = rga_fallback_scenario.rubric_id
    LEFT JOIN sim_first_scenario_rubric_bundle sfsr ON sfsr.simulation_id = csi.simulation_id
      AND rga.rubric_id IS NULL
      AND (SELECT p.value FROM rubric_points rp JOIN points p ON rp.point_id = p.id WHERE rp.rubric_id = r_fallback_scenario.id AND rp.type = 'total' LIMIT 1) IS NULL
    LEFT JOIN rubrics r_fallback_first ON r_fallback_first.id = sfsr.rubric_id
    WHERE EXISTS (
        SELECT 1 FROM run r_check
        JOIN group_runs gr_check ON gr_check.run_id = r_check.id
        JOIN grade_groups gg_check ON gg_check.group_id = gr_check.group_id
        JOIN chat c_check ON c_check.id = gg_check.chat_id
        WHERE r_check.id = sg.run_id
    )
      AND COALESCE((SELECT p.value FROM rubric_points rp JOIN points p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'total' LIMIT 1), (SELECT p.value FROM rubric_points rp JOIN points p ON rp.point_id = p.id WHERE rp.rubric_id = r_fallback_scenario.id AND rp.type = 'total' LIMIT 1), (SELECT p.value FROM rubric_points rp JOIN points p ON rp.point_id = p.id WHERE rp.rubric_id = r_fallback_first.id AND rp.type = 'total' LIMIT 1), 0) > 0
),
ordered_grades_per_profile AS (
    SELECT *,
           LAG(norm) OVER (PARTITION BY profile_id ORDER BY created_at) AS prev_norm
    FROM grade_stream_per_profile
),
stagnation_flags_per_profile AS (
    SELECT
        profile_id,
        CASE WHEN prev_norm IS NULL THEN NULL
             WHEN norm <= prev_norm + 0.1 THEN 1 
             ELSE 0 
        END AS stagnated
    FROM ordered_grades_per_profile
    WHERE prev_norm IS NOT NULL
),
stagnation_per_profile AS (
    SELECT
        profile_id,
        (100.0 * AVG(stagnated))::float AS stagnation_rate
    FROM stagnation_flags_per_profile
    GROUP BY profile_id
),
-- Convert data points from JSONB to composite types
avg_score_data_points AS (
    SELECT
        f.profile_id,
        COALESCE(
            ARRAY_AGG(
                (f.profile_id::text, 
                 to_char(f.attempt_created_at, 'YYYY-MM-DD'),
                 f.grade_percent,
                 f.simulation_id::text,
                 f.scenario_id::text,
                 NULL::text
                )::types.q_reports_bundle_v4_data_point
                ORDER BY f.attempt_created_at
            ),
            ARRAY[]::types.q_reports_bundle_v4_data_point[]
        ) AS data_points
    FROM filt f
    WHERE f.grade_percent IS NOT NULL
    GROUP BY f.profile_id
),
completion_data_points AS (
    SELECT
        f.profile_id,
        COALESCE(
            ARRAY_AGG(
                (f.profile_id::text,
                 to_char(f.chat_created_at, 'YYYY-MM-DD'),
                 (f.completed)::int::numeric,
                 f.simulation_id::text,
                 f.scenario_id::text,
                 NULL::text
                )::types.q_reports_bundle_v4_data_point
                ORDER BY f.chat_created_at
            ),
            ARRAY[]::types.q_reports_bundle_v4_data_point[]
        ) AS data_points
    FROM filt f
    GROUP BY f.profile_id
),
first_attempt_data_points AS (
    SELECT
        fa.profile_id,
        COALESCE(
            ARRAY_AGG(
                (fa.profile_id::text,
                 to_char(ea.attempt_created_at, 'YYYY-MM-DD'),
                 (fa.passed)::int::numeric,
                 ea.simulation_id::text,
                 NULL::text,
                 NULL::text
                )::types.q_reports_bundle_v4_data_point
                ORDER BY ea.attempt_created_at
            ),
            ARRAY[]::types.q_reports_bundle_v4_data_point[]
        ) AS data_points
    FROM first_attempts fa
    JOIN earliest_attempts_all_time ea ON ea.profile_id = fa.profile_id
    GROUP BY fa.profile_id
),
highest_score_data_points AS (
    SELECT
        f.profile_id,
        COALESCE(
            ARRAY_AGG(
                (f.profile_id::text,
                 to_char(f.attempt_created_at, 'YYYY-MM-DD'),
                 f.grade_percent,
                 f.simulation_id::text,
                 f.scenario_id::text,
                 NULL::text
                )::types.q_reports_bundle_v4_data_point
                ORDER BY f.attempt_created_at
            ),
            ARRAY[]::types.q_reports_bundle_v4_data_point[]
        ) AS data_points
    FROM filt f
    WHERE f.grade_percent IS NOT NULL
    GROUP BY f.profile_id
),
messages_data_points AS (
    SELECT
        f.profile_id,
        COALESCE(
            ARRAY_AGG(
                (f.profile_id::text,
                 to_char(f.attempt_created_at, 'YYYY-MM-DD'),
                 f.num_messages_total::numeric,
                 f.simulation_id::text,
                 f.scenario_id::text,
                 NULL::text
                )::types.q_reports_bundle_v4_data_point
                ORDER BY f.attempt_created_at
            ),
            ARRAY[]::types.q_reports_bundle_v4_data_point[]
        ) AS data_points
    FROM filt f
    WHERE f.num_messages_total IS NOT NULL
    GROUP BY f.profile_id
),
persona_time_data_points AS (
    SELECT
        pt.profile_id,
        COALESCE(
            ARRAY_AGG(
                (pt.profile_id::text,
                 NULL::text,
                 pt.delta_sec,
                 NULL::text,
                 NULL::text,
                 NULL::text
                )::types.q_reports_bundle_v4_data_point
            ),
            ARRAY[]::types.q_reports_bundle_v4_data_point[]
        ) AS data_points
    FROM persona_times pt
    GROUP BY pt.profile_id
),
time_spent_data_points AS (
    SELECT
        f.profile_id,
        COALESCE(
            ARRAY_AGG(
                (f.profile_id::text,
                 to_char(f.chat_created_at, 'YYYY-MM-DD'),
                 LEAST(f.time_taken_seconds / 60.0, 30.0),
                 f.simulation_id::text,
                 f.scenario_id::text,
                 f.attempt_id::text
                )::types.q_reports_bundle_v4_data_point
                ORDER BY f.chat_created_at
            ),
            ARRAY[]::types.q_reports_bundle_v4_data_point[]
        ) AS data_points
    FROM filt f
    WHERE f.time_taken_seconds IS NOT NULL
    GROUP BY f.profile_id
),
total_attempts_data_points AS (
    SELECT
        profile_id,
        COALESCE(
            ARRAY_AGG(
                (profile_id::text,
                 NULL::text,
                 NULL::numeric,
                 simulation_id::text,
                 NULL::text,
                 attempt_id::text
                )::types.q_reports_bundle_v4_data_point
            ),
            ARRAY[]::types.q_reports_bundle_v4_data_point[]
        ) AS data_points
    FROM (
        SELECT DISTINCT profile_id, attempt_id, simulation_id
        FROM filt
    ) sub
    GROUP BY profile_id
),
efficiency_data_points AS (
    SELECT
        profile_id,
        COALESCE(
            ARRAY_AGG(
                (profile_id::text,
                 NULL::text,
                 ROUND(GREATEST(0, LEAST(100, 
                     avg_score * (1.0 - LEAST(1.0, (total_minutes / NULLIF(total_sessions, 0)) / 120.0))
                 )))::numeric,
                 NULL::text,
                 NULL::text,
                 NULL::text
                )::types.q_reports_bundle_v4_data_point
            ),
            ARRAY[]::types.q_reports_bundle_v4_data_point[]
        ) AS data_points
    FROM efficiency_metrics_per_profile
    GROUP BY profile_id
),
stagnation_data_points AS (
    SELECT
        sf.profile_id,
        COALESCE(
            ARRAY_AGG(
                (sf.profile_id::text,
                 NULL::text,
                 sf.stagnated::numeric,
                 NULL::text,
                 NULL::text,
                 NULL::text
                )::types.q_reports_bundle_v4_data_point
            ),
            ARRAY[]::types.q_reports_bundle_v4_data_point[]
        ) AS data_points
    FROM stagnation_flags_per_profile sf
    GROUP BY sf.profile_id
),
profile_simulation_ids AS (
    SELECT
        f.profile_id,
        ARRAY_AGG(DISTINCT f.simulation_id::text) FILTER (WHERE f.simulation_id IS NOT NULL) AS simulation_ids
    FROM filt f
    GROUP BY f.profile_id
),
scenario_root_mapping AS (
    WITH RECURSIVE scenario_ancestors AS (
        SELECT DISTINCT
            f.scenario_id as child_scenario_id,
            f.scenario_id as ancestor_id,
            0 as depth
        FROM filt f
        WHERE f.scenario_id IS NOT NULL
        
        UNION ALL
        
        SELECT 
            sa.child_scenario_id,
            COALESCE(
                (SELECT st.parent_id 
                 FROM scenario_tree st 
                 WHERE st.child_id = sa.ancestor_id 
                   AND st.parent_id != st.child_id 
                 LIMIT 1),
                sa.ancestor_id
            ) as ancestor_id,
            sa.depth + 1 as depth
        FROM scenario_ancestors sa
        WHERE sa.depth < 100
          AND EXISTS (
              SELECT 1 FROM scenario_tree st 
              WHERE st.child_id = sa.ancestor_id 
                AND st.parent_id != st.child_id
          )
    )
    SELECT DISTINCT
        child_scenario_id,
        ancestor_id as root_scenario_id
    FROM scenario_ancestors
    WHERE depth = (
        SELECT MAX(depth) 
        FROM scenario_ancestors sa2 
        WHERE sa2.child_scenario_id = scenario_ancestors.child_scenario_id
    )
),
profile_scenario_ids AS (
    SELECT
        f.profile_id,
        ARRAY_AGG(DISTINCT COALESCE(
            (SELECT srm.root_scenario_id::text 
             FROM scenario_root_mapping srm 
             WHERE srm.child_scenario_id = f.scenario_id),
            f.scenario_id::text
        )) FILTER (WHERE f.scenario_id IS NOT NULL) AS scenario_ids
    FROM filt f
    GROUP BY f.profile_id
),
all_metrics AS (
    SELECT
        pm.*,
        COALESCE(tt.total_time_minutes, 0) AS total_time_minutes,
        COALESCE(cp.completion_pct, 0) AS completion_pct,
        COALESCE(fa.pass_rate, 0) AS first_attempt_pass_rate,
        COALESCE(pp.avg_response_time, 0) AS persona_response_time,
        COALESCE(ep.efficiency, 0) AS session_efficiency,
        COALESCE(sp.stagnation_rate, 0) AS stagnation_rate,
        COALESCE(asdp.data_points, ARRAY[]::types.q_reports_bundle_v4_data_point[]) AS avg_score_points,
        COALESCE(cdp.data_points, ARRAY[]::types.q_reports_bundle_v4_data_point[]) AS completion_points,
        COALESCE(fadp.data_points, ARRAY[]::types.q_reports_bundle_v4_data_point[]) AS first_attempt_points,
        COALESCE(hsdp.data_points, ARRAY[]::types.q_reports_bundle_v4_data_point[]) AS highest_score_points,
        COALESCE(mdp.data_points, ARRAY[]::types.q_reports_bundle_v4_data_point[]) AS messages_points,
        COALESCE(ptdp.data_points, ARRAY[]::types.q_reports_bundle_v4_data_point[]) AS persona_time_points,
        COALESCE(tsdp.data_points, ARRAY[]::types.q_reports_bundle_v4_data_point[]) AS time_spent_points,
        COALESCE(tadp.data_points, ARRAY[]::types.q_reports_bundle_v4_data_point[]) AS total_attempts_points,
        COALESCE(edp.data_points, ARRAY[]::types.q_reports_bundle_v4_data_point[]) AS efficiency_points,
        COALESCE(sdp.data_points, ARRAY[]::types.q_reports_bundle_v4_data_point[]) AS stagnation_points,
        COALESCE(psi.simulation_ids, ARRAY[]::text[]) AS simulation_ids,
        COALESCE(psc.scenario_ids, ARRAY[]::text[]) AS scenario_ids
    FROM profile_metrics pm
    LEFT JOIN total_time_per_profile tt ON pm.profile_id = tt.profile_id
    LEFT JOIN completion_per_profile cp ON pm.profile_id = cp.profile_id
    LEFT JOIN first_attempt_per_profile fa ON pm.profile_id = fa.profile_id
    LEFT JOIN persona_per_profile pp ON pm.profile_id = pp.profile_id
    LEFT JOIN efficiency_per_profile ep ON pm.profile_id = ep.profile_id
    LEFT JOIN stagnation_per_profile sp ON pm.profile_id = sp.profile_id
    LEFT JOIN avg_score_data_points asdp ON pm.profile_id = asdp.profile_id
    LEFT JOIN completion_data_points cdp ON pm.profile_id = cdp.profile_id
    LEFT JOIN first_attempt_data_points fadp ON pm.profile_id = fadp.profile_id
    LEFT JOIN highest_score_data_points hsdp ON pm.profile_id = hsdp.profile_id
    LEFT JOIN messages_data_points mdp ON pm.profile_id = mdp.profile_id
    LEFT JOIN persona_time_data_points ptdp ON pm.profile_id = ptdp.profile_id
    LEFT JOIN time_spent_data_points tsdp ON pm.profile_id = tsdp.profile_id
    LEFT JOIN total_attempts_data_points tadp ON pm.profile_id = tadp.profile_id
    LEFT JOIN efficiency_data_points edp ON pm.profile_id = edp.profile_id
    LEFT JOIN stagnation_data_points sdp ON pm.profile_id = sdp.profile_id
    LEFT JOIN profile_simulation_ids psi ON pm.profile_id = psi.profile_id
    LEFT JOIN profile_scenario_ids psc ON pm.profile_id = psc.profile_id
),
profile_options_cte AS (
    SELECT 
        am.profile_id,
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = am.profile_id AND pn.type = 'full'::type_profile_names LIMIT 1),
            am.first_name || ' ' || am.last_name,
            'Unknown'
        ) AS profile_name,
        COUNT(*) AS count
    FROM all_metrics am
    GROUP BY am.profile_id, am.first_name, am.last_name
    ORDER BY profile_name
),
simulation_options_cte AS (
    SELECT 
        sim.id AS simulation_id,
        (SELECT n.name FROM simulation_names simn JOIN names n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1) AS simulation_name,
        COUNT(DISTINCT am.profile_id) AS count
    FROM all_metrics am
    CROSS JOIN LATERAL UNNEST(am.simulation_ids) AS sim_id
    JOIN simulation sim ON sim.id::text = sim_id
    WHERE EXISTS (SELECT 1 FROM simulation_flags simf WHERE simf.simulation_id = sim.id AND simf.type = 'active'::type_simulation_flags AND simf.value = true)
    GROUP BY sim.id, (SELECT n.name FROM simulation_names simn JOIN names n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1)
    ORDER BY simulation_name
),
scenario_options_cte AS (
    SELECT 
        s.id AS scenario_id,
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) AS scenario_title,
        COUNT(DISTINCT am.profile_id) AS count
    FROM all_metrics am
    CROSS JOIN LATERAL UNNEST(am.scenario_ids) AS scen_id
    JOIN scenarios s ON s.id::text = scen_id
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf WHERE sf.scenario_id = s.id AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
    GROUP BY s.id, (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)
    ORDER BY scenario_title
),
-- Calculate total count before pagination
total_count_before_pagination AS (
    SELECT COUNT(*)::bigint AS total_count
    FROM all_metrics
),
paginated_metrics AS (
    SELECT
        am.*,
        (SELECT total_count FROM total_count_before_pagination) AS total_count
    FROM all_metrics am
    ORDER BY 
        -- Numeric sorting (DESC)
        CASE 
            WHEN (SELECT sort_by FROM params) = 'averageScore' AND (SELECT sort_order FROM params) = 'DESC' THEN am.avg_score::numeric
            WHEN (SELECT sort_by FROM params) = 'highestScore' AND (SELECT sort_order FROM params) = 'DESC' THEN am.highest_score::numeric
            WHEN (SELECT sort_by FROM params) = 'completionPercentage' AND (SELECT sort_order FROM params) = 'DESC' THEN am.completion_pct::numeric
            WHEN (SELECT sort_by FROM params) = 'firstAttemptPassRate' AND (SELECT sort_order FROM params) = 'DESC' THEN am.first_attempt_pass_rate::numeric
            WHEN (SELECT sort_by FROM params) = 'messagesPerSession' AND (SELECT sort_order FROM params) = 'DESC' THEN am.avg_messages::numeric
            WHEN (SELECT sort_by FROM params) = 'personaResponseTimes' AND (SELECT sort_order FROM params) = 'DESC' THEN am.persona_response_time::numeric
            WHEN (SELECT sort_by FROM params) = 'sessionEfficiency' AND (SELECT sort_order FROM params) = 'DESC' THEN am.session_efficiency::numeric
            WHEN (SELECT sort_by FROM params) = 'stagnationRate' AND (SELECT sort_order FROM params) = 'DESC' THEN am.stagnation_rate::numeric
            WHEN (SELECT sort_by FROM params) = 'timeSpent' AND (SELECT sort_order FROM params) = 'DESC' THEN am.total_time_minutes::numeric
            WHEN (SELECT sort_by FROM params) = 'totalAttempts' AND (SELECT sort_order FROM params) = 'DESC' THEN am.total_attempts::numeric
        END DESC NULLS LAST,
        -- Numeric sorting (ASC)
        CASE 
            WHEN (SELECT sort_by FROM params) = 'averageScore' AND (SELECT sort_order FROM params) = 'ASC' THEN am.avg_score::numeric
            WHEN (SELECT sort_by FROM params) = 'highestScore' AND (SELECT sort_order FROM params) = 'ASC' THEN am.highest_score::numeric
            WHEN (SELECT sort_by FROM params) = 'completionPercentage' AND (SELECT sort_order FROM params) = 'ASC' THEN am.completion_pct::numeric
            WHEN (SELECT sort_by FROM params) = 'firstAttemptPassRate' AND (SELECT sort_order FROM params) = 'ASC' THEN am.first_attempt_pass_rate::numeric
            WHEN (SELECT sort_by FROM params) = 'messagesPerSession' AND (SELECT sort_order FROM params) = 'ASC' THEN am.avg_messages::numeric
            WHEN (SELECT sort_by FROM params) = 'personaResponseTimes' AND (SELECT sort_order FROM params) = 'ASC' THEN am.persona_response_time::numeric
            WHEN (SELECT sort_by FROM params) = 'sessionEfficiency' AND (SELECT sort_order FROM params) = 'ASC' THEN am.session_efficiency::numeric
            WHEN (SELECT sort_by FROM params) = 'stagnationRate' AND (SELECT sort_order FROM params) = 'ASC' THEN am.stagnation_rate::numeric
            WHEN (SELECT sort_by FROM params) = 'timeSpent' AND (SELECT sort_order FROM params) = 'ASC' THEN am.total_time_minutes::numeric
            WHEN (SELECT sort_by FROM params) = 'totalAttempts' AND (SELECT sort_order FROM params) = 'ASC' THEN am.total_attempts::numeric
        END ASC NULLS LAST,
        -- Text sorting (profileName)
        CASE 
            WHEN (SELECT sort_by FROM params) = 'profileName' AND (SELECT sort_order FROM params) = 'DESC' THEN LOWER(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = am.profile_id AND pn.type = 'full'::type_profile_names LIMIT 1), am.first_name || ' ' || am.last_name, ''))
        END DESC NULLS LAST,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'profileName' AND (SELECT sort_order FROM params) = 'ASC' THEN LOWER(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = am.profile_id AND pn.type = 'full'::type_profile_names LIMIT 1), am.first_name || ' ' || am.last_name, ''))
        END ASC NULLS LAST,
        am.profile_id
    LIMIT (SELECT page_size FROM params)
    OFFSET (SELECT page * page_size FROM params)
),
-- Build metrics with composite types
profiles_with_metrics AS (
    SELECT
        pm.profile_id,
        pm.first_name,
        pm.last_name,
        pm.emails,
        pm.primary_email,
        pm.role,
        pm.simulation_ids,
        pm.scenario_ids,
        -- Build average_score metric
        (
            (pm.avg_score IS NOT NULL AND pm.avg_score > 0),
            'avg',
            ROUND(COALESCE(pm.avg_score, 0))::int,
            pm.avg_score_points,
            (
                ROUND(COALESCE(pm.avg_score, 0))::int,  -- mean
                ROUND(COALESCE(pm.avg_score, 0))::int,  -- median
                ROUND(COALESCE(pm.avg_score, 0))::int,  -- mode
                0,  -- count
                0,  -- completed
                0,  -- total
                0,  -- percent
                ARRAY[]::int[],  -- top
                0,  -- mean_seconds
                0,  -- median_seconds
                0,  -- samples
                0,  -- avg_score_percent
                0,  -- avg_minutes
                0,  -- efficiency
                0,  -- tracked
                0,  -- stagnant
                0,  -- rate_percent
                0,  -- total_minutes
                0::numeric,  -- total_hours
                0,  -- attempts
                0,  -- unique_simulations
                0   -- per_simulation_mean
            )::types.q_reports_bundle_v4_hover,
            CASE
                WHEN pm.avg_score IS NULL OR pm.avg_score = 0 THEN 'neutral'
                WHEN ROUND(pm.avg_score) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                WHEN ROUND(pm.avg_score) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                ELSE 'danger'
            END
        )::types.q_reports_bundle_v4_metric AS average_score,
        -- Build completion_percentage metric
        (
            (pm.completion_pct IS NOT NULL AND pm.completion_pct > 0),
            'rate',
            ROUND(COALESCE(pm.completion_pct, 0))::int,
            pm.completion_points,
            (
                0,  -- mean
                0,  -- median
                0,  -- mode
                0,  -- count
                ROUND(COALESCE(pm.completion_pct, 0))::int,  -- completed
                0,  -- total
                ROUND(COALESCE(pm.completion_pct, 0))::int,  -- percent
                ARRAY[]::int[],  -- top
                0,  -- mean_seconds
                0,  -- median_seconds
                0,  -- samples
                0,  -- avg_score_percent
                0,  -- avg_minutes
                0,  -- efficiency
                0,  -- tracked
                0,  -- stagnant
                0,  -- rate_percent
                0,  -- total_minutes
                0::numeric,  -- total_hours
                0,  -- attempts
                0,  -- unique_simulations
                0   -- per_simulation_mean
            )::types.q_reports_bundle_v4_hover,
            CASE
                WHEN pm.completion_pct IS NULL OR pm.completion_pct = 0 THEN 'neutral'
                WHEN ROUND(pm.completion_pct) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                WHEN ROUND(pm.completion_pct) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                ELSE 'danger'
            END
        )::types.q_reports_bundle_v4_metric AS completion_percentage,
        -- Build first_attempt_pass_rate metric
        (
            (pm.first_attempt_pass_rate IS NOT NULL AND pm.first_attempt_pass_rate > 0),
            'rate',
            ROUND(COALESCE(pm.first_attempt_pass_rate, 0))::int,
            pm.first_attempt_points,
            (
                0,  -- mean
                0,  -- median
                0,  -- mode
                0,  -- count
                0,  -- completed
                0,  -- total
                ROUND(COALESCE(pm.first_attempt_pass_rate, 0))::int,  -- percent
                ARRAY[]::int[],  -- top
                0,  -- mean_seconds
                0,  -- median_seconds
                0,  -- samples
                0,  -- avg_score_percent
                0,  -- avg_minutes
                0,  -- efficiency
                0,  -- tracked
                0,  -- stagnant
                0,  -- rate_percent
                0,  -- total_minutes
                0::numeric,  -- total_hours
                0,  -- attempts
                0,  -- unique_simulations
                0   -- per_simulation_mean
            )::types.q_reports_bundle_v4_hover,
            CASE
                WHEN pm.first_attempt_pass_rate IS NULL OR pm.first_attempt_pass_rate = 0 THEN 'neutral'
                WHEN ROUND(pm.first_attempt_pass_rate) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                WHEN ROUND(pm.first_attempt_pass_rate) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                ELSE 'danger'
            END
        )::types.q_reports_bundle_v4_metric AS first_attempt_pass_rate,
        -- Build highest_score metric
        (
            (pm.highest_score IS NOT NULL AND pm.highest_score > 0),
            'max',
            ROUND(COALESCE(pm.highest_score, 0))::int,
            pm.highest_score_points,
            (
                0,  -- mean
                0,  -- median
                0,  -- mode
                0,  -- count
                0,  -- completed
                0,  -- total
                0,  -- percent
                ARRAY[ROUND(COALESCE(pm.highest_score, 0))::int],  -- top
                0,  -- mean_seconds
                0,  -- median_seconds
                0,  -- samples
                0,  -- avg_score_percent
                0,  -- avg_minutes
                0,  -- efficiency
                0,  -- tracked
                0,  -- stagnant
                0,  -- rate_percent
                0,  -- total_minutes
                0::numeric,  -- total_hours
                0,  -- attempts
                0,  -- unique_simulations
                0   -- per_simulation_mean
            )::types.q_reports_bundle_v4_hover,
            CASE
                WHEN pm.highest_score IS NULL OR pm.highest_score = 0 THEN 'neutral'
                WHEN ROUND(pm.highest_score) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                WHEN ROUND(pm.highest_score) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                ELSE 'danger'
            END
        )::types.q_reports_bundle_v4_metric AS highest_score,
        -- Build messages_per_session metric
        (
            (pm.avg_messages IS NOT NULL AND pm.avg_messages > 0),
            'avg',
            ROUND(COALESCE(pm.avg_messages, 0))::int,
            pm.messages_points,
            (
                ROUND(COALESCE(pm.avg_messages, 0))::int,  -- mean
                ROUND(COALESCE(pm.avg_messages, 0))::int,  -- median
                0,  -- mode
                pm.total_attempts,  -- count
                0,  -- completed
                0,  -- total
                0,  -- percent
                ARRAY[]::int[],  -- top
                0,  -- mean_seconds
                0,  -- median_seconds
                0,  -- samples
                0,  -- avg_score_percent
                0,  -- avg_minutes
                0,  -- efficiency
                0,  -- tracked
                0,  -- stagnant
                0,  -- rate_percent
                0,  -- total_minutes
                0::numeric,  -- total_hours
                0,  -- attempts
                0,  -- unique_simulations
                0   -- per_simulation_mean
            )::types.q_reports_bundle_v4_hover,
            CASE
                WHEN pm.avg_messages IS NULL OR pm.avg_messages = 0 THEN 'neutral'
                WHEN ROUND(pm.avg_messages) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                WHEN ROUND(pm.avg_messages) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                ELSE 'danger'
            END
        )::types.q_reports_bundle_v4_metric AS messages_per_session,
        -- Build persona_response_times metric
        (
            (pm.persona_response_time IS NOT NULL AND pm.persona_response_time > 0),
            'avg',
            ROUND(COALESCE(pm.persona_response_time, 0))::int,
            pm.persona_time_points,
            (
                0,  -- mean
                0,  -- median
                0,  -- mode
                0,  -- count
                0,  -- completed
                0,  -- total
                0,  -- percent
                ARRAY[]::int[],  -- top
                ROUND(COALESCE(pm.persona_response_time, 0))::int,  -- mean_seconds
                ROUND(COALESCE(pm.persona_response_time, 0))::int,  -- median_seconds
                0,  -- samples
                0,  -- avg_score_percent
                0,  -- avg_minutes
                0,  -- efficiency
                0,  -- tracked
                0,  -- stagnant
                0,  -- rate_percent
                0,  -- total_minutes
                0::numeric,  -- total_hours
                0,  -- attempts
                0,  -- unique_simulations
                0   -- per_simulation_mean
            )::types.q_reports_bundle_v4_hover,
            CASE
                WHEN pm.persona_response_time IS NULL OR pm.persona_response_time = 0 THEN 'neutral'
                WHEN ROUND(pm.persona_response_time) > (SELECT danger_threshold FROM settings_thresholds LIMIT 1) THEN 'danger'
                WHEN ROUND(pm.persona_response_time) > (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                ELSE 'success'
            END
        )::types.q_reports_bundle_v4_metric AS persona_response_times,
        -- Build session_efficiency metric
        (
            (pm.session_efficiency > 0),
            'avg',
            ROUND(COALESCE(pm.session_efficiency, 0))::int,
            pm.efficiency_points,
            (
                0,  -- mean
                0,  -- median
                0,  -- mode
                0,  -- count
                0,  -- completed
                0,  -- total
                0,  -- percent
                ARRAY[]::int[],  -- top
                0,  -- mean_seconds
                0,  -- median_seconds
                0,  -- samples
                0,  -- avg_score_percent
                0,  -- avg_minutes
                ROUND(COALESCE(pm.session_efficiency, 0))::int,  -- efficiency
                0,  -- tracked
                0,  -- stagnant
                0,  -- rate_percent
                0,  -- total_minutes
                0::numeric,  -- total_hours
                0,  -- attempts
                0,  -- unique_simulations
                0   -- per_simulation_mean
            )::types.q_reports_bundle_v4_hover,
            CASE
                WHEN pm.session_efficiency IS NULL OR pm.session_efficiency = 0 THEN 'neutral'
                WHEN ROUND(pm.session_efficiency) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                WHEN ROUND(pm.session_efficiency) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                ELSE 'danger'
            END
        )::types.q_reports_bundle_v4_metric AS session_efficiency,
        -- Build stagnation_rate metric
        (
            (pm.stagnation_rate > 0),
            'rate',
            ROUND(COALESCE(pm.stagnation_rate, 0))::int,
            pm.stagnation_points,
            (
                0,  -- mean
                0,  -- median
                0,  -- mode
                0,  -- count
                0,  -- completed
                0,  -- total
                0,  -- percent
                ARRAY[]::int[],  -- top
                0,  -- mean_seconds
                0,  -- median_seconds
                0,  -- samples
                0,  -- avg_score_percent
                0,  -- avg_minutes
                0,  -- efficiency
                0,  -- tracked
                0,  -- stagnant
                ROUND(COALESCE(pm.stagnation_rate, 0))::int,  -- rate_percent
                0,  -- total_minutes
                0::numeric,  -- total_hours
                0,  -- attempts
                0,  -- unique_simulations
                0   -- per_simulation_mean
            )::types.q_reports_bundle_v4_hover,
            CASE
                WHEN pm.stagnation_rate IS NULL OR pm.stagnation_rate = 0 THEN 'neutral'
                WHEN ROUND(pm.stagnation_rate) > (SELECT danger_threshold FROM settings_thresholds LIMIT 1) THEN 'danger'
                WHEN ROUND(pm.stagnation_rate) > (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                ELSE 'success'
            END
        )::types.q_reports_bundle_v4_metric AS stagnation_rate,
        -- Build time_spent metric
        (
            (pm.total_time_minutes IS NOT NULL AND pm.total_time_minutes > 0),
            'sum',
            ROUND(COALESCE(pm.total_time_minutes, 0))::int,
            pm.time_spent_points,
            (
                0,  -- mean
                0,  -- median
                0,  -- mode
                0,  -- count
                0,  -- completed
                0,  -- total
                0,  -- percent
                ARRAY[]::int[],  -- top
                0,  -- mean_seconds
                0,  -- median_seconds
                0,  -- samples
                0,  -- avg_score_percent
                0,  -- avg_minutes
                0,  -- efficiency
                0,  -- tracked
                0,  -- stagnant
                0,  -- rate_percent
                ROUND(COALESCE(pm.total_time_minutes, 0))::int,  -- total_minutes
                ROUND(COALESCE(pm.total_time_minutes, 0)::numeric / 60.0, 1),  -- total_hours
                0,  -- attempts
                0,  -- unique_simulations
                0   -- per_simulation_mean
            )::types.q_reports_bundle_v4_hover,
            CASE
                WHEN pm.total_time_minutes IS NULL OR pm.total_time_minutes = 0 THEN 'neutral'
                WHEN ROUND(pm.total_time_minutes) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                WHEN ROUND(pm.total_time_minutes) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                ELSE 'danger'
            END
        )::types.q_reports_bundle_v4_metric AS time_spent,
        -- Build total_attempts metric
        (
            true,
            'countDistinct',
            COALESCE(pm.total_attempts, 0),
            pm.total_attempts_points,
            (
                0,  -- mean
                0,  -- median
                0,  -- mode
                0,  -- count
                0,  -- completed
                0,  -- total
                0,  -- percent
                ARRAY[]::int[],  -- top
                0,  -- mean_seconds
                0,  -- median_seconds
                0,  -- samples
                0,  -- avg_score_percent
                0,  -- avg_minutes
                0,  -- efficiency
                0,  -- tracked
                0,  -- stagnant
                0,  -- rate_percent
                0,  -- total_minutes
                0::numeric,  -- total_hours
                COALESCE(pm.total_attempts, 0),  -- attempts
                0,  -- unique_simulations
                0   -- per_simulation_mean
            )::types.q_reports_bundle_v4_hover,
            CASE
                WHEN pm.total_attempts IS NULL OR pm.total_attempts = 0 THEN 'neutral'
                WHEN pm.total_attempts >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                WHEN pm.total_attempts >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                ELSE 'danger'
            END
        )::types.q_reports_bundle_v4_metric AS total_attempts
    FROM paginated_metrics pm
),
-- Build profile metrics composite type
profiles_with_profile_metrics AS (
    SELECT
        pwm.profile_id,
        pwm.first_name,
        pwm.last_name,
        pwm.emails,
        pwm.primary_email,
        pwm.role,
        pwm.simulation_ids,
        pwm.scenario_ids,
        (
            pwm.average_score,
            pwm.completion_percentage,
            pwm.first_attempt_pass_rate,
            pwm.highest_score,
            pwm.messages_per_session,
            pwm.persona_response_times,
            pwm.session_efficiency,
            pwm.stagnation_rate,
            pwm.time_spent,
            pwm.total_attempts
        )::types.q_reports_bundle_v4_profile_metrics AS metrics
    FROM profiles_with_metrics pwm
),
-- Build final profile array
profiles_final AS (
    SELECT
        ARRAY_AGG(
            (pwm.profile_id,
             pwm.first_name,
             pwm.last_name,
             pwm.emails,
             pwm.primary_email,
             pwm.role,
             pwm.simulation_ids,
             pwm.scenario_ids,
             pwm.metrics
            )::types.q_reports_bundle_v4_profile
            ORDER BY pwm.profile_id
        ) AS profiles_array
    FROM profiles_with_profile_metrics pwm
),
-- Build filter options (separate CTEs to avoid cartesian product)
profile_options_final AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (poc.profile_id::text,
                 poc.profile_name,
                 poc.count
                )::types.q_reports_bundle_v4_filter_option
                ORDER BY poc.profile_name
            ),
            ARRAY[]::types.q_reports_bundle_v4_filter_option[]
        ) AS profile_options_array
    FROM profile_options_cte poc
),
simulation_options_final AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (soc.simulation_id::text,
                 soc.simulation_name,
                 soc.count
                )::types.q_reports_bundle_v4_filter_option
                ORDER BY soc.simulation_name
            ),
            ARRAY[]::types.q_reports_bundle_v4_filter_option[]
        ) AS simulation_options_array
    FROM simulation_options_cte soc
),
scenario_options_final AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (scoc.scenario_id::text,
                 scoc.scenario_title,
                 scoc.count
                )::types.q_reports_bundle_v4_filter_option
                ORDER BY scoc.scenario_title
            ),
            ARRAY[]::types.q_reports_bundle_v4_filter_option[]
        ) AS scenario_options_array
    FROM scenario_options_cte scoc
),
-- Build scenario and simulation arrays (not mappings)
scenarios_final AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (s.id,
                 (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
                 COALESCE(
                     (SELECT ps.problem_statement 
                      FROM scenario_problem_statements sps
                      JOIN problem_statements ps ON ps.id = sps.problem_statement_id
                      WHERE sps.scenario_id = s.id AND sps.active = true
                      ORDER BY sps.created_at DESC, sps.updated_at DESC
                      LIMIT 1), 
                     ''
                 )
                )::types.q_reports_bundle_v4_scenario
                ORDER BY (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)
            ),
            ARRAY[]::types.q_reports_bundle_v4_scenario[]
        ) AS scenarios_array
    FROM scenario s
    JOIN scenario_tree st_root ON st_root.parent_id = s.id AND st_root.child_id = s.id
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf WHERE sf.scenario_id = s.id AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
      AND EXISTS (
          SELECT 1 FROM filt f
          WHERE f.scenario_id IS NOT NULL
            AND (
                EXISTS (
                    SELECT 1 FROM scenario_tree st
                    WHERE st.child_id = f.scenario_id
                      AND st.parent_id = s.id
                )
                OR f.scenario_id = s.id
            )
      )
),
simulations_final AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (sim.id,
                 (SELECT n.name FROM simulation_names simn JOIN names n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1),
                 COALESCE((SELECT d.description FROM simulation_descriptions simd JOIN descriptions d ON simd.description_id = d.id WHERE simd.simulation_id = sim.id LIMIT 1), ''),
                 (SELECT rga.rubric_id FROM simulation_scenarios ss 
                  JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga ON sssrga.simulation_id = ss.simulation_id AND sssrga.scenario_id = ss.scenario_id
                  JOIN scenario_rubric_grade_agents srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
                  JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
                  WHERE ss.simulation_id = sim.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf WHERE ssf.simulation_id = ss.simulation_id AND ssf.scenario_id = ss.scenario_id AND ssf.type = 'active'::type_simulation_scenario_flags AND ssf.value = true)
                  ORDER BY (SELECT sp.value FROM scenario_positions sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1) 
                  LIMIT 1),
                 (SELECT p.value FROM simulation_scenarios ss 
                  JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga ON sssrga.simulation_id = ss.simulation_id AND sssrga.scenario_id = ss.scenario_id
                  JOIN scenario_rubric_grade_agents srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
                  JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
                  JOIN rubrics r ON r.id = rga.rubric_id
                  JOIN rubric_points rp ON rp.rubric_id = r.id AND rp.type = 'total'
                  JOIN points p ON p.id = rp.point_id
                  WHERE ss.simulation_id = sim.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf WHERE ssf.simulation_id = ss.simulation_id AND ssf.scenario_id = ss.scenario_id AND ssf.type = 'active'::type_simulation_scenario_flags AND ssf.value = true)
                  ORDER BY (SELECT sp.value FROM scenario_positions sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1)
                  LIMIT 1),
                 (SELECT p.value FROM simulation_scenarios ss 
                  JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga ON sssrga.simulation_id = ss.simulation_id AND sssrga.scenario_id = ss.scenario_id
                  JOIN scenario_rubric_grade_agents srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
                  JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
                  JOIN rubrics r ON r.id = rga.rubric_id
                  JOIN rubric_points rp ON rp.rubric_id = r.id AND rp.type = 'pass'
                  JOIN points p ON p.id = rp.point_id
                  WHERE ss.simulation_id = sim.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf WHERE ssf.simulation_id = ss.simulation_id AND ssf.scenario_id = ss.scenario_id AND ssf.type = 'active'::type_simulation_scenario_flags AND ssf.value = true)
                  ORDER BY (SELECT sp.value FROM scenario_positions sp WHERE sp.simulation_id = ss.simulation_id AND sp.scenario_id = ss.scenario_id LIMIT 1) 
                  LIMIT 1)
                )::types.q_reports_bundle_v4_simulation
                ORDER BY (SELECT n.name FROM simulation_names simn JOIN names n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1)
            ),
            ARRAY[]::types.q_reports_bundle_v4_simulation[]
        ) AS simulations_array
    FROM simulation sim
    WHERE EXISTS (SELECT 1 FROM simulation_flags simf WHERE simf.simulation_id = sim.id AND simf.type = 'active'::type_simulation_flags AND simf.value = true)
      AND sim.id IN (SELECT DISTINCT simulation_id FROM filt WHERE simulation_id IS NOT NULL)
),
total_count_cte AS (
    SELECT total_count FROM total_count_before_pagination
)
SELECT
    (SELECT actor_name FROM user_profile)::text as actor_name,
    COALESCE((SELECT profiles_array FROM profiles_final), ARRAY[]::types.q_reports_bundle_v4_profile[]) as data,
    COALESCE((SELECT total_count FROM total_count_cte), 0)::bigint as total_count,
    (SELECT page FROM params)::int as page,
    (SELECT page_size FROM params)::int as page_size,
    CASE 
        WHEN (SELECT page_size FROM params) > 0 
        THEN ((COALESCE((SELECT total_count FROM total_count_cte), 0) + (SELECT page_size FROM params) - 1) / (SELECT page_size FROM params))::bigint
        ELSE 0::bigint
    END as total_pages,
    COALESCE((SELECT profile_options_array FROM profile_options_final), ARRAY[]::types.q_reports_bundle_v4_filter_option[]) as profile_options,
    COALESCE((SELECT simulation_options_array FROM simulation_options_final), ARRAY[]::types.q_reports_bundle_v4_filter_option[]) as simulation_options,
    COALESCE((SELECT scenario_options_array FROM scenario_options_final), ARRAY[]::types.q_reports_bundle_v4_filter_option[]) as scenario_options,
    COALESCE((SELECT scenarios_array FROM scenarios_final), ARRAY[]::types.q_reports_bundle_v4_scenario[]) as scenarios,
    COALESCE((SELECT simulations_array FROM simulations_final), ARRAY[]::types.q_reports_bundle_v4_simulation[]) as simulations
$$;