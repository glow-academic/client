-- Get reports bundle with aggregated view_metrics_entry per profile
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
--
-- Parameters: start_date, end_date, profile_id, cohort_ids, department_ids, roles, simulation_filters,
--             profile_ids, simulation_ids, scenario_ids, search, sort_by, sort_order, page, page_size
-- Returns: Complete reports bundle with profile data, view_metrics_entry, filter options, and entity mappings (as arrays)
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

-- Profile view_metrics_entry (all 10 view_metrics_entry)
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
    name text,
    emails text[],
    primary_email text,
    role text,
    simulation_ids text[],
    scenario_ids text[],
    profile_metrics types.q_reports_bundle_v4_profile_metrics
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
    rubric_points_junction int,
    rubric_pass_points int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_reports_bundle_v4(
    start_date text,
    end_date text,
    profile_id uuid,
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    roles profile_type[] DEFAULT ARRAY[]::profile_type[],
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
    scenario_options_junction types.q_reports_bundle_v4_filter_option[],
    scenarios types.q_reports_bundle_v4_scenario[],
    simulations types.q_reports_bundle_v4_simulation[]
)
LANGUAGE sql
STABLE
AS $$
-- Unified chats (general + practice)
WITH all_chats AS (
    SELECT id, attempt_id, created_at, updated_at, title, completed, generated, mcp, active
    FROM view_simulation_chats_entry
),
-- Unified chat→scenario connections
all_chat_scenarios AS (
    SELECT chat_id, scenarios_id FROM simulation_chats_scenarios_connection
),
params AS (
    SELECT 
        (start_date::timestamptz) AS start_date,
        (end_date::timestamptz) AS end_date,
        profile_id AS profile_id,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(roles, ARRAY[]::profile_type[]) AS roles,
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
-- Get actor name FROM profile_artifact
user_profile AS (
    SELECT COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Get thresholds from active settings
settings_thresholds AS (
    SELECT 
        COALESCE((SELECT t.value FROM setting_thresholds_junction st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'success'::threshold_type LIMIT 1), 85) AS success_threshold,
        COALESCE((SELECT t.value FROM setting_thresholds_junction st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'warning'::threshold_type LIMIT 1), 80) AS warning_threshold,
        COALESCE((SELECT t.value FROM setting_thresholds_junction st JOIN thresholds_resource t ON st.threshold_id = t.id WHERE st.setting_id = s.id AND st.type = 'danger'::threshold_type LIMIT 1), 70) AS danger_threshold
    FROM setting_artifact s
    WHERE EXISTS (
        SELECT 1 FROM setting_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.setting_id = s.id
          AND f.name = 'setting_active'
          AND sf.value = TRUE
    )
    LIMIT 1
),
-- Map cohort resource IDs to artifact IDs for junction table lookups
cohort_artifact_mapping AS (
    SELECT
        ccj.cohorts_id AS resource_id,
        ccj.cohort_id AS artifact_id
    FROM cohort_cohorts_junction ccj
    CROSS JOIN params p
    WHERE ccj.cohorts_id = ANY(p.cohort_ids)
      AND ccj.active = true
),
-- Start FROM profile_artifact to include all matching profiles, even without attempts
filtered_profiles AS (
    SELECT 
        p.id, 
        (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1) AS name, 
        ARRAY_AGG(e.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT e2.email FROM profile_emails_junction pe2 JOIN emails_resource e2 ON pe2.email_id = e2.id WHERE pe2.profile_id = p.id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        COALESCE(
            (SELECT r.role FROM profile_roles_junction pr_j 
             JOIN roles_resource r ON pr_j.role_id = r.id 
             WHERE pr_j.profile_id = p.id 
             LIMIT 1),
            'member'::profile_type
        ) as role,
        p.created_at
    FROM profile_artifact p
    LEFT JOIN profile_emails_junction pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN emails_resource e ON pe.email_id = e.id
    WHERE 
        (cardinality((SELECT roles FROM params)::profile_type[]) = 0 OR COALESCE(
            (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1),
            'member'::profile_type
        ) = ANY((SELECT roles FROM params)::profile_type[]))
        -- Filter by cohort using artifact mapping (cohort_ids are now resource IDs)
        AND (cardinality((SELECT cohort_ids FROM params)::uuid[]) = 0 OR EXISTS (
            SELECT 1 FROM profile_cohorts_junction cp
            JOIN cohort_artifact_mapping cam ON cam.artifact_id = cp.cohort_id
            WHERE cp.profile_id = p.id
              AND cp.active = true
        ))
        AND (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR EXISTS (
            SELECT 1 FROM profile_departments_junction pd 
            WHERE pd.profile_id = p.id 
              AND pd.department_id = ANY((SELECT department_ids FROM params)::uuid[]) 
              AND pd.active = true
        ))
        AND (cardinality((SELECT profile_ids FROM params)::uuid[]) = 0 OR p.id = ANY((SELECT profile_ids FROM params)::uuid[]))
        AND ((SELECT search FROM params) IS NULL OR 
             EXISTS (
                SELECT 1 FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id 
                WHERE pn.profile_id = p.id 
                  AND n.name ILIKE '%' || (SELECT search FROM params) || '%'
             ))
    GROUP BY p.id, (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1), p.created_at
),
-- Use mv_dashboard_facts with backward compatibility columns
filt AS (
    SELECT
        f.chat_id,
        f.attempt_id,
        f.profile_id,
        f.simulation_id,
        f.scenario_id,
        f.persona_id,
        f.rubric_id,
        f.department_id,
        f.cohort_id,
        f.role_id,
        f.attempt_created_at,
        f.chat_created_at,
        f.grade_created_at,
        f.is_archived,
        f.infinite_mode,
        f.completed,
        f.score,
        f.passed,
        f.time_taken AS time_taken_seconds,
        f.rubric_total_points AS rubric_points_junction,
        f.rubric_pass_points,
        f.grade_percent,
        f.num_messages_total,
        f.num_query_messages,
        f.num_response_messages,
        f.message_time_taken_seconds,
        f.attempt_type,
        (f.attempt_type = 'general' AND NOT f.is_archived) AS is_general,
        (f.attempt_type = 'practice') AS is_practice
    FROM mv_dashboard_facts f
    WHERE f.attempt_created_at >= (SELECT start_date FROM params)
      AND f.attempt_created_at < (SELECT end_date FROM params)
      AND f.profile_id IN (SELECT id FROM filtered_profiles)
      -- Filter by cohort_id directly (cohort_ids are now resource IDs matching mv_dashboard_facts.cohort_id)
      AND (cardinality((SELECT cohort_ids FROM params)::uuid[]) = 0 OR f.cohort_id = ANY((SELECT cohort_ids FROM params)::uuid[]))
      AND (cardinality((SELECT profile_ids FROM params)::uuid[]) = 0 OR f.profile_id = ANY((SELECT profile_ids FROM params)::uuid[]))
      AND (cardinality((SELECT simulation_ids FROM params)::uuid[]) = 0 OR f.simulation_id = ANY((SELECT simulation_ids FROM params)::uuid[]))
      AND (cardinality((SELECT scenario_ids FROM params)::uuid[]) = 0 OR f.scenario_id = ANY((SELECT scenario_ids FROM params)::uuid[]))
      AND (
          ('general' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.attempt_type = 'general' AND NOT f.is_archived) OR
          ('practice' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.attempt_type = 'practice') OR
          ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.is_archived = TRUE)
      )
      AND ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) OR f.is_archived = FALSE)
),
-- ============================================================
-- Phase 2: Lightweight sort metrics for ALL profiles
-- ============================================================
profile_metrics AS (
    SELECT
        fp.id AS profile_id,
        fp.name,
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
    GROUP BY fp.id, fp.name, fp.emails, fp.primary_email, fp.role
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
        f.profile_id,
        (100.0 * AVG((f.completed)::int))::float AS completion_pct
    FROM filt f
    GROUP BY f.profile_id
),
earliest_attempts_all_time AS (
    SELECT DISTINCT ON (f.profile_id, f.simulation_id)
        f.profile_id,
        f.simulation_id,
        f.attempt_created_at,
        f.grade_percent,
        f.rubric_pass_points,
        f.rubric_total_points AS rubric_points_junction
    FROM mv_dashboard_facts f
    WHERE f.profile_id IN (SELECT id FROM filtered_profiles)
    ORDER BY f.profile_id, f.simulation_id, f.attempt_created_at
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
        ea.simulation_id,
        ea.attempt_created_at,
        ea.grade_percent >= (ea.rubric_pass_points * 100.0 / NULLIF(ea.rubric_points_junction, 0)) AS passed
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
        TRUNC((100.0 * COUNT(*) FILTER (WHERE passed) / NULLIF(COUNT(*), 0))::numeric, 2)::float AS pass_rate
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
grade_stream_per_profile AS (
    SELECT
        pc.profile_id,
        sg.id,
        c_bundle.id AS simulation_chat_id,
        sg.created_at,
        TRUNC((sg.score::numeric / NULLIF((SELECT p.value FROM scenario_rubrics_resource srr JOIN rubric_points_junction rp ON rp.rubric_id = srr.rubric_id AND rp.type = 'total'::point_type JOIN points_resource p ON p.id = rp.point_id WHERE srr.scenario_id = acs_bundle.scenarios_id LIMIT 1), 0)) * 100.0, 2) AS norm
    FROM view_grades_entry sg
    JOIN all_chats c_bundle ON c_bundle.id = sg.chat_id
    JOIN all_chat_scenarios acs_bundle ON acs_bundle.chat_id = c_bundle.id
    JOIN profile_chats pc ON pc.chat_id = c_bundle.id
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
-- ============================================================
-- Phase 3: Sort + Paginate on profile IDs
-- ============================================================
sort_metrics AS (
    SELECT
        pm.profile_id,
        pm.name,
        pm.emails,
        pm.primary_email,
        pm.role,
        pm.avg_score,
        pm.highest_score,
        pm.total_attempts,
        pm.avg_messages,
        COALESCE(tt.total_time_minutes, 0)::numeric AS total_time_minutes,
        COALESCE(cp.completion_pct, 0)::numeric AS completion_pct,
        COALESCE(fa.pass_rate, 0)::numeric AS first_attempt_pass_rate,
        COALESCE(pp.avg_response_time, 0)::numeric AS persona_response_time,
        COALESCE(ep.efficiency, 0)::numeric AS session_efficiency,
        COALESCE(sp.stagnation_rate, 0)::numeric AS stagnation_rate
    FROM profile_metrics pm
    LEFT JOIN total_time_per_profile tt ON pm.profile_id = tt.profile_id
    LEFT JOIN completion_per_profile cp ON pm.profile_id = cp.profile_id
    LEFT JOIN first_attempt_per_profile fa ON pm.profile_id = fa.profile_id
    LEFT JOIN persona_per_profile pp ON pm.profile_id = pp.profile_id
    LEFT JOIN efficiency_per_profile ep ON pm.profile_id = ep.profile_id
    LEFT JOIN stagnation_per_profile sp ON pm.profile_id = sp.profile_id
),
total_count_before_pagination AS (
    SELECT COUNT(*)::bigint AS total_count
    FROM sort_metrics
),
paginated_profile_ids AS (
    SELECT sm.profile_id
    FROM sort_metrics sm
    ORDER BY
        CASE
            WHEN (SELECT sort_by FROM params) = 'averageScore' AND (SELECT sort_order FROM params) = 'DESC' THEN sm.avg_score::numeric
            WHEN (SELECT sort_by FROM params) = 'highestScore' AND (SELECT sort_order FROM params) = 'DESC' THEN sm.highest_score::numeric
            WHEN (SELECT sort_by FROM params) = 'completionPercentage' AND (SELECT sort_order FROM params) = 'DESC' THEN sm.completion_pct
            WHEN (SELECT sort_by FROM params) = 'firstAttemptPassRate' AND (SELECT sort_order FROM params) = 'DESC' THEN sm.first_attempt_pass_rate
            WHEN (SELECT sort_by FROM params) = 'messagesPerSession' AND (SELECT sort_order FROM params) = 'DESC' THEN sm.avg_messages::numeric
            WHEN (SELECT sort_by FROM params) = 'personaResponseTimes' AND (SELECT sort_order FROM params) = 'DESC' THEN sm.persona_response_time
            WHEN (SELECT sort_by FROM params) = 'sessionEfficiency' AND (SELECT sort_order FROM params) = 'DESC' THEN sm.session_efficiency
            WHEN (SELECT sort_by FROM params) = 'stagnationRate' AND (SELECT sort_order FROM params) = 'DESC' THEN sm.stagnation_rate
            WHEN (SELECT sort_by FROM params) = 'timeSpent' AND (SELECT sort_order FROM params) = 'DESC' THEN sm.total_time_minutes
            WHEN (SELECT sort_by FROM params) = 'totalAttempts' AND (SELECT sort_order FROM params) = 'DESC' THEN sm.total_attempts::numeric
        END DESC NULLS LAST,
        CASE
            WHEN (SELECT sort_by FROM params) = 'averageScore' AND (SELECT sort_order FROM params) = 'ASC' THEN sm.avg_score::numeric
            WHEN (SELECT sort_by FROM params) = 'highestScore' AND (SELECT sort_order FROM params) = 'ASC' THEN sm.highest_score::numeric
            WHEN (SELECT sort_by FROM params) = 'completionPercentage' AND (SELECT sort_order FROM params) = 'ASC' THEN sm.completion_pct
            WHEN (SELECT sort_by FROM params) = 'firstAttemptPassRate' AND (SELECT sort_order FROM params) = 'ASC' THEN sm.first_attempt_pass_rate
            WHEN (SELECT sort_by FROM params) = 'messagesPerSession' AND (SELECT sort_order FROM params) = 'ASC' THEN sm.avg_messages::numeric
            WHEN (SELECT sort_by FROM params) = 'personaResponseTimes' AND (SELECT sort_order FROM params) = 'ASC' THEN sm.persona_response_time
            WHEN (SELECT sort_by FROM params) = 'sessionEfficiency' AND (SELECT sort_order FROM params) = 'ASC' THEN sm.session_efficiency
            WHEN (SELECT sort_by FROM params) = 'stagnationRate' AND (SELECT sort_order FROM params) = 'ASC' THEN sm.stagnation_rate
            WHEN (SELECT sort_by FROM params) = 'timeSpent' AND (SELECT sort_order FROM params) = 'ASC' THEN sm.total_time_minutes
            WHEN (SELECT sort_by FROM params) = 'totalAttempts' AND (SELECT sort_order FROM params) = 'ASC' THEN sm.total_attempts::numeric
        END ASC NULLS LAST,
        CASE
            WHEN (SELECT sort_by FROM params) = 'profileName' AND (SELECT sort_order FROM params) = 'DESC' THEN LOWER(COALESCE(sm.name, ''))
        END DESC NULLS LAST,
        CASE
            WHEN (SELECT sort_by FROM params) = 'profileName' AND (SELECT sort_order FROM params) = 'ASC' THEN LOWER(COALESCE(sm.name, ''))
        END ASC NULLS LAST,
        sm.profile_id
    LIMIT (SELECT page_size FROM params)
    OFFSET (SELECT page * page_size FROM params)
),
-- ============================================================
-- Phase 4: Expensive data_points ONLY for paginated profiles
-- ============================================================
filt_page AS (
    SELECT f.* FROM filt f
    WHERE f.profile_id IN (SELECT profile_id FROM paginated_profile_ids)
),
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
    FROM filt_page f
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
    FROM filt_page f
    GROUP BY f.profile_id
),
first_attempt_data_points AS (
    SELECT
        fa.profile_id,
        COALESCE(
            ARRAY_AGG(
                (fa.profile_id::text,
                 to_char(fa.attempt_created_at, 'YYYY-MM-DD'),
                 (fa.passed)::int::numeric,
                 fa.simulation_id::text,
                 NULL::text,
                 NULL::text
                )::types.q_reports_bundle_v4_data_point
                ORDER BY fa.attempt_created_at
            ),
            ARRAY[]::types.q_reports_bundle_v4_data_point[]
        ) AS data_points
    FROM first_attempts fa
    WHERE fa.profile_id IN (SELECT profile_id FROM paginated_profile_ids)
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
    FROM filt_page f
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
    FROM filt_page f
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
    WHERE pt.profile_id IN (SELECT profile_id FROM paginated_profile_ids)
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
    FROM filt_page f
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
        FROM filt_page
    ) sub
    GROUP BY profile_id
),
efficiency_data_points AS (
    SELECT
        emp.profile_id,
        COALESCE(
            ARRAY_AGG(
                (emp.profile_id::text,
                 NULL::text,
                 ROUND(GREATEST(0, LEAST(100,
                     emp.avg_score * (1.0 - LEAST(1.0, (emp.total_minutes / NULLIF(emp.total_sessions, 0)) / 120.0))
                 )))::numeric,
                 NULL::text,
                 NULL::text,
                 NULL::text
                )::types.q_reports_bundle_v4_data_point
            ),
            ARRAY[]::types.q_reports_bundle_v4_data_point[]
        ) AS data_points
    FROM efficiency_metrics_per_profile emp
    WHERE emp.profile_id IN (SELECT profile_id FROM paginated_profile_ids)
    GROUP BY emp.profile_id
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
    WHERE sf.profile_id IN (SELECT profile_id FROM paginated_profile_ids)
    GROUP BY sf.profile_id
),
profile_simulation_ids AS (
    SELECT
        f.profile_id,
        ARRAY_AGG(DISTINCT f.simulation_id::text) FILTER (WHERE f.simulation_id IS NOT NULL) AS simulation_ids
    FROM filt_page f
    GROUP BY f.profile_id
),
-- scenario_id in analytics is already the root scenario, no recursive mapping needed
profile_scenario_ids AS (
    SELECT
        f.profile_id,
        ARRAY_AGG(DISTINCT f.scenario_id::text) FILTER (WHERE f.scenario_id IS NOT NULL) AS scenario_ids
    FROM filt_page f
    GROUP BY f.profile_id
),
-- ============================================================
-- Phase 5: Build paginated metrics with data_points
-- ============================================================
all_metrics AS (
    SELECT
        sm.profile_id,
        sm.name,
        sm.emails,
        sm.primary_email,
        sm.role,
        sm.avg_score,
        sm.highest_score,
        sm.total_attempts,
        sm.avg_messages,
        sm.total_time_minutes::float AS total_time_minutes,
        sm.completion_pct::float AS completion_pct,
        sm.first_attempt_pass_rate::float AS first_attempt_pass_rate,
        sm.persona_response_time::float AS persona_response_time,
        sm.session_efficiency::float AS session_efficiency,
        sm.stagnation_rate::float AS stagnation_rate,
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
    FROM sort_metrics sm
    JOIN paginated_profile_ids ppi ON sm.profile_id = ppi.profile_id
    LEFT JOIN avg_score_data_points asdp ON sm.profile_id = asdp.profile_id
    LEFT JOIN completion_data_points cdp ON sm.profile_id = cdp.profile_id
    LEFT JOIN first_attempt_data_points fadp ON sm.profile_id = fadp.profile_id
    LEFT JOIN highest_score_data_points hsdp ON sm.profile_id = hsdp.profile_id
    LEFT JOIN messages_data_points mdp ON sm.profile_id = mdp.profile_id
    LEFT JOIN persona_time_data_points ptdp ON sm.profile_id = ptdp.profile_id
    LEFT JOIN time_spent_data_points tsdp ON sm.profile_id = tsdp.profile_id
    LEFT JOIN total_attempts_data_points tadp ON sm.profile_id = tadp.profile_id
    LEFT JOIN efficiency_data_points edp ON sm.profile_id = edp.profile_id
    LEFT JOIN stagnation_data_points sdp ON sm.profile_id = sdp.profile_id
    LEFT JOIN profile_simulation_ids psi ON sm.profile_id = psi.profile_id
    LEFT JOIN profile_scenario_ids psc ON sm.profile_id = psc.profile_id
),
-- ============================================================
-- Phase 6: Options (from filt, not all_metrics - avoids data_point materialization)
-- ============================================================
profile_options_cte AS (
    SELECT
        sm.profile_id,
        COALESCE(sm.name, 'Unknown') AS profile_name,
        1::bigint AS count
    FROM sort_metrics sm
    ORDER BY COALESCE(sm.name, 'Unknown')
),
simulation_options_cte AS (
    SELECT
        f.simulation_id,
        (SELECT n.name FROM simulation_names_junction simn JOIN names_resource n ON simn.name_id = n.id WHERE simn.simulation_id = f.simulation_id LIMIT 1) AS simulation_name,
        COUNT(DISTINCT f.profile_id) AS count
    FROM filt f
    WHERE f.simulation_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM simulation_flags_junction simf JOIN flags_resource f2 ON simf.flag_id = f2.id WHERE simf.simulation_id = f.simulation_id AND f2.name = 'simulation_active' AND simf.value = true)
    GROUP BY f.simulation_id
    ORDER BY (SELECT n.name FROM simulation_names_junction simn JOIN names_resource n ON simn.name_id = n.id WHERE simn.simulation_id = f.simulation_id LIMIT 1)
),
scenario_options_cte AS (
    SELECT
        f.scenario_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = f.scenario_id LIMIT 1) AS scenario_title,
        COUNT(DISTINCT f.profile_id) AS count
    FROM filt f
    WHERE f.scenario_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f2 ON sf.flag_id = f2.id WHERE sf.scenario_id = f.scenario_id AND f2.name = 'scenario_active' AND sf.value = true)
    GROUP BY f.scenario_id
    ORDER BY (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = f.scenario_id LIMIT 1)
),
paginated_metrics AS (
    SELECT
        am.*,
        (SELECT total_count FROM total_count_before_pagination) AS total_count
    FROM all_metrics am
),
-- Build view_metrics_entry with composite types
profiles_with_metrics AS (
    SELECT
        pm.profile_id,
        pm.name,
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
-- Build profile view_metrics_entry composite type
profiles_with_profile_metrics AS (
    SELECT
        pwm.profile_id,
        pwm.name,
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
        )::types.q_reports_bundle_v4_profile_metrics AS profile_metrics
    FROM profiles_with_metrics pwm
),
-- Build final profile array
profiles_final AS (
    SELECT
        ARRAY_AGG(
            (pwm.profile_id,
             pwm.name,
             pwm.emails,
             pwm.primary_email,
             pwm.role,
             pwm.simulation_ids,
             pwm.scenario_ids,
             pwm.profile_metrics
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
-- Build scenario and simulation reference data
scenarios_final AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (s.id,
                 (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
                 COALESCE(
                     (SELECT ps.problem_statement 
                      FROM scenario_problem_statements_junction sps
                      JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
                      WHERE sps.scenario_id = s.id AND sps.active = true
                      ORDER BY sps.created_at DESC
                      LIMIT 1), 
                     ''
                 )
                )::types.q_reports_bundle_v4_scenario
                ORDER BY (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)
            ),
            ARRAY[]::types.q_reports_bundle_v4_scenario[]
        ) AS scenarios_array
    FROM scenario_artifact s
    JOIN scenario_tree_junction st_root ON st_root.parent_id = s.id AND st_root.child_id = s.id
    WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true)
      AND EXISTS (
          SELECT 1 FROM filt f
          WHERE f.scenario_id IS NOT NULL
            AND (
                EXISTS (
                    SELECT 1 FROM scenario_tree_junction st
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
                 (SELECT n.name FROM simulation_names_junction simn JOIN names_resource n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1),
                 COALESCE((SELECT d.description FROM simulation_descriptions_junction simd JOIN descriptions_resource d ON simd.description_id = d.id WHERE simd.simulation_id = sim.id LIMIT 1), ''),
                 (SELECT srr.rubric_id FROM simulation_scenarios_junction ss 
                  JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
                  JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
                  WHERE ss.simulation_id = sim.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
                  ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1) 
                  LIMIT 1),
                 (SELECT p.value FROM simulation_scenarios_junction ss 
                  JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
                  JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
                  JOIN rubrics_resource r ON r.id = srr.rubric_id
                  JOIN rubric_points_junction rp ON rp.rubric_id = r.id AND rp.type = 'total'
                  JOIN points_resource p ON p.id = rp.point_id
                  WHERE ss.simulation_id = sim.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
                  ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1)
                  LIMIT 1),
                 (SELECT p.value FROM simulation_scenarios_junction ss 
                  JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
                  JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
                  JOIN rubrics_resource r ON r.id = srr.rubric_id
                  JOIN rubric_points_junction rp ON rp.rubric_id = r.id AND rp.type = 'pass'
                  JOIN points_resource p ON p.id = rp.point_id
                  WHERE ss.simulation_id = sim.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
                  ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1) 
                  LIMIT 1)
                )::types.q_reports_bundle_v4_simulation
                ORDER BY (SELECT n.name FROM simulation_names_junction simn JOIN names_resource n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1)
            ),
            ARRAY[]::types.q_reports_bundle_v4_simulation[]
        ) AS simulations_array
    FROM simulation_artifact sim
    WHERE EXISTS (SELECT 1 FROM simulation_flags_junction simf JOIN flags_resource f ON simf.flag_id = f.id WHERE simf.simulation_id = sim.id AND f.name = 'simulation_active' AND simf.value = true)
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
    COALESCE((SELECT scenario_options_array FROM scenario_options_final), ARRAY[]::types.q_reports_bundle_v4_filter_option[]) as scenario_options_junction,
    COALESCE((SELECT scenarios_array FROM scenarios_final), ARRAY[]::types.q_reports_bundle_v4_scenario[]) as scenarios,
    COALESCE((SELECT simulations_array FROM simulations_final), ARRAY[]::types.q_reports_bundle_v4_simulation[]) as simulations
$$;
