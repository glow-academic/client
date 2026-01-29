-- Dashboard bundle query - all view_metrics_entry in one query
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
--
-- Parameters: start_date, end_date, cohort_ids, roles, simulation_filters, department_ids, profile_id
-- Returns: Complete dashboard bundle with header view_metrics_entry, primary view_metrics_entry, secondary view_metrics_entry, 
--          footer view_metrics_entry, history, insights, thresholds, and entity mappings (as arrays)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_dashboard_bundle_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_dashboard_bundle_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- Use recursive approach: keep trying until all types are dropped (handles dependencies)
DO $$
DECLARE
    r RECORD;
    dropped_count int;
    max_iterations int := 10;
    iteration int := 0;
BEGIN
    LOOP
        iteration := iteration + 1;
        dropped_count := 0;
        
        FOR r IN 
            SELECT typname 
            FROM pg_type 
            WHERE typname LIKE 'q_get_dashboard_bundle_v4_%'
              AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
        LOOP
            BEGIN
                EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
                dropped_count := dropped_count + 1;
            EXCEPTION WHEN OTHERS THEN
                -- Type has dependencies, skip for now
                NULL;
            END;
        END LOOP;
        
        -- If no types were dropped or no types remain, we're done
        EXIT WHEN dropped_count = 0 OR iteration >= max_iterations;
    END LOOP;
END $$;

-- 3) Recreate types
-- Note: Using native PostgreSQL types (uuid, timestamptz) instead of text where appropriate
-- Arrays of IDs use text[] for frontend compatibility

-- Trend data point (used in header view_metrics_entry)
CREATE TYPE types.q_get_dashboard_bundle_v4_trend_data AS (
    date text,
    value float,
    count int
);

-- Data point (used in header view_metrics_entry)
CREATE TYPE types.q_get_dashboard_bundle_v4_data_point AS (
    profile_id text,
    date text,
    value float,
    attempt_id text,
    simulation_id text,
    scenario_id text,
    count int
);

-- Metric response (for header view_metrics_entry)
CREATE TYPE types.q_get_dashboard_bundle_v4_metric_response AS (
    has_data boolean,
    method text,
    current_value int,
    status text,
    trend_analysis text,
    value_field text,
    key_field text,
    trend_data types.q_get_dashboard_bundle_v4_trend_data[],
    data_points types.q_get_dashboard_bundle_v4_data_point[]
);

-- Header view_metrics_entry (10 view_metrics_entry)
CREATE TYPE types.q_get_dashboard_bundle_v4_header_metrics AS (
    average_score types.q_get_dashboard_bundle_v4_metric_response,
    completion_percentage types.q_get_dashboard_bundle_v4_metric_response,
    first_attempt_pass_rate types.q_get_dashboard_bundle_v4_metric_response,
    highest_score types.q_get_dashboard_bundle_v4_metric_response,
    messages_per_session types.q_get_dashboard_bundle_v4_metric_response,
    persona_response_times types.q_get_dashboard_bundle_v4_metric_response,
    session_efficiency types.q_get_dashboard_bundle_v4_metric_response,
    stagnation_rate types.q_get_dashboard_bundle_v4_metric_response,
    time_spent types.q_get_dashboard_bundle_v4_metric_response,
    total_attempts types.q_get_dashboard_bundle_v4_metric_response
);

-- Growth data point
CREATE TYPE types.q_get_dashboard_bundle_v4_growth_data_point AS (
    date text,
    average_score float,
    completion_rate float,
    first_attempt_pass_rate float,
    session_efficiency float,
    stagnation_rate float
);

-- Growth metric
CREATE TYPE types.q_get_dashboard_bundle_v4_growth_metric AS (
    id text,
    name text,
    color text,
    unit text,
    description text,
    formatter_id text
);

-- Growth window average
CREATE TYPE types.q_get_dashboard_bundle_v4_growth_window_average AS (
    n int,
    last float,
    prev float
);

-- Growth window averages
CREATE TYPE types.q_get_dashboard_bundle_v4_growth_window_averages AS (
    average_score types.q_get_dashboard_bundle_v4_growth_window_average
);

-- Growth data response
CREATE TYPE types.q_get_dashboard_bundle_v4_growth_data_response AS (
    chart_data types.q_get_dashboard_bundle_v4_growth_data_point[],
    available_metrics types.q_get_dashboard_bundle_v4_growth_metric[],
    window_averages types.q_get_dashboard_bundle_v4_growth_window_averages,
    status text
);

-- Persona trend data
CREATE TYPE types.q_get_dashboard_bundle_v4_persona_trend_data AS (
    date text,
    score float,
    timestamp bigint,
    simulation_id text
);

-- Persona performance data
CREATE TYPE types.q_get_dashboard_bundle_v4_persona_performance_data AS (
    name text,
    score float,
    sessions int,
    color text,
    simulation_ids text[],
    trend_data types.q_get_dashboard_bundle_v4_persona_trend_data[],
    status text
);

-- Persona color mapping item
CREATE TYPE types.q_get_dashboard_bundle_v4_persona_color AS (
    persona_name text,
    color text
);

-- Persona performance response
CREATE TYPE types.q_get_dashboard_bundle_v4_persona_performance_response AS (
    chart_data types.q_get_dashboard_bundle_v4_persona_performance_data[],
    valid_simulation_ids text[],
    persona_colors_junction types.q_get_dashboard_bundle_v4_persona_color[]
);

-- Rubric heatmap cell
CREATE TYPE types.q_get_dashboard_bundle_v4_rubric_heatmap_cell AS (
    rubric_id text,
    correlation float,
    p_value float,
    color text,
    strength text,
    data_points int
);

-- Rubric heatmap row (nested composite type for matrix rows)
CREATE TYPE types.q_get_dashboard_bundle_v4_rubric_heatmap_row AS (
    cells types.q_get_dashboard_bundle_v4_rubric_heatmap_cell[]
);

-- Standard group
CREATE TYPE types.q_get_dashboard_bundle_v4_standard_group AS (
    id text,
    name text,
    short_name text,
    rubric_id text
);

-- Rubric matrix package
CREATE TYPE types.q_get_dashboard_bundle_v4_rubric_matrix_package AS (
    rubric_id text,
    standard_groups types.q_get_dashboard_bundle_v4_standard_group[],
    matrix types.q_get_dashboard_bundle_v4_rubric_heatmap_row[],
    insights text,
    has_data boolean
);

-- Rubric heatmap response
CREATE TYPE types.q_get_dashboard_bundle_v4_rubric_heatmap_response AS (
    matrices types.q_get_dashboard_bundle_v4_rubric_matrix_package[],
    valid_rubric_ids text[],
    status text
);

-- Primary view_metrics_entry
CREATE TYPE types.q_get_dashboard_bundle_v4_primary_metrics AS (
    growth_data types.q_get_dashboard_bundle_v4_growth_data_response,
    persona_performance types.q_get_dashboard_bundle_v4_persona_performance_response,
    rubric_heatmap types.q_get_dashboard_bundle_v4_rubric_heatmap_response
);

-- Attempt improvement data
CREATE TYPE types.q_get_dashboard_bundle_v4_attempt_improvement_data AS (
    attempt text,
    average_score float,
    average_time float,
    pass_rate float
);

-- Attempt improvement fact
CREATE TYPE types.q_get_dashboard_bundle_v4_attempt_improvement_fact AS (
    simulation_id text,
    attempt_no int,
    avg_grade float,
    avg_minutes float,
    pass_rate float
);

-- Attempt improvement response
CREATE TYPE types.q_get_dashboard_bundle_v4_attempt_improvement_response AS (
    chart_data types.q_get_dashboard_bundle_v4_attempt_improvement_data[],
    facts types.q_get_dashboard_bundle_v4_attempt_improvement_fact[],
    valid_simulation_ids text[],
    status text
);

-- Cohort data
CREATE TYPE types.q_get_dashboard_bundle_v4_cohort_data AS (
    id text,
    name text,
    pass_rate float,
    avg_percentage_score float,
    total_students int,
    passed_students int,
    total_attempts int,
    passed_attempts int,
    simulation_count int,
    required_simulations int,
    status text
);

-- Daily data
CREATE TYPE types.q_get_dashboard_bundle_v4_daily_data AS (
    date text,
    avg_score float,
    cohort_id text
);

-- Cohort fact
CREATE TYPE types.q_get_dashboard_bundle_v4_cohort_fact AS (
    cohort_id text,
    simulation_id text,
    pass_rate float,
    avg_score float,
    attempts int
);

-- Cohort daily fact
CREATE TYPE types.q_get_dashboard_bundle_v4_cohort_daily_fact AS (
    date text,
    simulation_id text,
    avg_score float
);

-- Cohort performance response
CREATE TYPE types.q_get_dashboard_bundle_v4_cohort_performance_response AS (
    cohort_data types.q_get_dashboard_bundle_v4_cohort_data[],
    daily_data types.q_get_dashboard_bundle_v4_daily_data[],
    cohort_facts types.q_get_dashboard_bundle_v4_cohort_fact[],
    daily_facts types.q_get_dashboard_bundle_v4_cohort_daily_fact[],
    valid_simulation_ids text[],
    status text
);

-- Skill radar data
CREATE TYPE types.q_get_dashboard_bundle_v4_skill_radar_data AS (
    metric text,
    description text,
    value float,
    full_mark float
);

-- Skill standard fact
CREATE TYPE types.q_get_dashboard_bundle_v4_skill_standard_fact AS (
    group_id text,
    group_name text,
    group_description text,
    simulation_id text,
    score float,
    points float,
    avg_pct float
);

-- Skill package
CREATE TYPE types.q_get_dashboard_bundle_v4_skill_package AS (
    rubric_id text,
    radar_data types.q_get_dashboard_bundle_v4_skill_radar_data[],
    group_facts types.q_get_dashboard_bundle_v4_skill_standard_fact[]
);

-- Skill performance response
CREATE TYPE types.q_get_dashboard_bundle_v4_skill_performance_response AS (
    packages types.q_get_dashboard_bundle_v4_skill_package[],
    valid_rubric_ids text[],
    status text
);

-- Secondary view_metrics_entry
CREATE TYPE types.q_get_dashboard_bundle_v4_secondary_metrics AS (
    attempt_improvement types.q_get_dashboard_bundle_v4_attempt_improvement_response,
    cohort_performance types.q_get_dashboard_bundle_v4_cohort_performance_response,
    skill_performance types.q_get_dashboard_bundle_v4_skill_performance_response
);

-- Scenario attribute attempt fact
CREATE TYPE types.q_get_dashboard_bundle_v4_scenario_attribute_attempt_fact AS (
    parameter_id text,
    parameter_item_id text,
    date text,
    timestamp bigint,
    avg_score float,
    attempts int,
    passed_attempts int
);

-- Scenario attribute scenario fact
CREATE TYPE types.q_get_dashboard_bundle_v4_scenario_attribute_scenario_fact AS (
    parameter_id text,
    parameter_item_id text,
    scenario_id text
);

-- Scenario performance response
CREATE TYPE types.q_get_dashboard_bundle_v4_scenario_performance_response AS (
    valid_parameter_ids text[],
    attribute_attempt_facts types.q_get_dashboard_bundle_v4_scenario_attribute_attempt_fact[],
    attribute_scenario_facts types.q_get_dashboard_bundle_v4_scenario_attribute_scenario_fact[],
    status text
);

-- Numeric attempt fact
CREATE TYPE types.q_get_dashboard_bundle_v4_numeric_attempt_fact AS (
    parameter_id text,
    level_label text,
    level_value float,
    score float,
    attempts int
);

-- Numeric scenario fact
CREATE TYPE types.q_get_dashboard_bundle_v4_numeric_scenario_fact AS (
    parameter_id text,
    scenario_id text,
    level_label text,
    level_value float
);

-- Scenario stats response
CREATE TYPE types.q_get_dashboard_bundle_v4_scenario_stats_response AS (
    valid_numeric_parameter_ids text[],
    numeric_attempt_facts types.q_get_dashboard_bundle_v4_numeric_attempt_fact[],
    numeric_scenario_facts types.q_get_dashboard_bundle_v4_numeric_scenario_fact[],
    status text
);

-- Simulation fact
CREATE TYPE types.q_get_dashboard_bundle_v4_simulation_fact AS (
    simulation_id text,
    title text,
    avg_score float,
    completion_rate float,
    total_attempts int,
    scenario_count int
);

-- Simulation parameter fact categorical
CREATE TYPE types.q_get_dashboard_bundle_v4_simulation_parameter_fact_categorical AS (
    simulation_id text,
    parameter_id text,
    parameter_item_id text,
    scenario_count int
);

-- Simulation parameter fact numeric
CREATE TYPE types.q_get_dashboard_bundle_v4_simulation_parameter_fact_numeric AS (
    simulation_id text,
    parameter_id text,
    avg_level float,
    level_label text,
    scenario_count int
);

-- Simulation composition response
CREATE TYPE types.q_get_dashboard_bundle_v4_simulation_composition_response AS (
    valid_simulation_ids text[],
    simulation_facts types.q_get_dashboard_bundle_v4_simulation_fact[],
    simulation_parameter_facts_categorical types.q_get_dashboard_bundle_v4_simulation_parameter_fact_categorical[],
    simulation_parameter_facts_numeric types.q_get_dashboard_bundle_v4_simulation_parameter_fact_numeric[],
    has_data boolean,
    status text
);

-- Scenario fact
CREATE TYPE types.q_get_dashboard_bundle_v4_scenario_fact AS (
    simulation_id text,
    scenario_id text,
    scenario_name text,
    avg_score float,
    success_rate float,
    total_attempts int,
    completed_attempts int
);

-- Simulation performance response
CREATE TYPE types.q_get_dashboard_bundle_v4_simulation_performance_response AS (
    valid_simulation_ids text[],
    scenario_facts types.q_get_dashboard_bundle_v4_scenario_fact[],
    status text
);

-- Footer view_metrics_entry
CREATE TYPE types.q_get_dashboard_bundle_v4_footer_metrics AS (
    scenario_performance types.q_get_dashboard_bundle_v4_scenario_performance_response,
    scenario_stats types.q_get_dashboard_bundle_v4_scenario_stats_response,
    simulation_performance types.q_get_dashboard_bundle_v4_simulation_performance_response,
    simulation_composition types.q_get_dashboard_bundle_v4_simulation_composition_response
);

-- Attempt history row (bundle returns empty array, but type needed for RETURNS TABLE)
CREATE TYPE types.q_get_dashboard_bundle_v4_attempt_history_row AS (
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

-- Persona insight item
CREATE TYPE types.q_get_dashboard_bundle_v4_persona_insight AS (
    persona_name text,
    insight text
);

-- Cohort insight item
CREATE TYPE types.q_get_dashboard_bundle_v4_cohort_insight AS (
    cohort_id text,
    insight text
);

-- Dashboard insights
CREATE TYPE types.q_get_dashboard_bundle_v4_insights AS (
    growth text,
    persona types.q_get_dashboard_bundle_v4_persona_insight[],
    rubric_heatmap text,
    attempt_improvement text,
    cohort types.q_get_dashboard_bundle_v4_cohort_insight[],
    skill_performance text,
    scenario_performance text,
    scenario_stats text,
    simulation_performance text,
    simulation_composition text
);

-- Thresholds
CREATE TYPE types.q_get_dashboard_bundle_v4_thresholds AS (
    success int,
    warning int,
    danger int
);

-- Simulation
CREATE TYPE types.q_get_dashboard_bundle_v4_simulation AS (
    simulation_id text,
    name text,
    description text,
    time_limit int,
    department_ids text[]
);

-- Rubric
CREATE TYPE types.q_get_dashboard_bundle_v4_rubric AS (
    rubric_id text,
    name text,
    description text
);

-- Parameter
CREATE TYPE types.q_get_dashboard_bundle_v4_parameter AS (
    parameter_id text,
    name text,
    description text,
    numerical boolean,
    document_parameter boolean,
    persona_parameter boolean
);

-- Field
CREATE TYPE types.q_get_dashboard_bundle_v4_field AS (
    field_id text,
    name text,
    description text,
    parameter_id text,
    parameter_name text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_dashboard_bundle_v4(
    start_date text,
    end_date text,
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    roles profile_type[] DEFAULT ARRAY[]::profile_type[],
    simulation_filters text[] DEFAULT ARRAY[]::text[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    profile_id uuid DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    header_metrics types.q_get_dashboard_bundle_v4_header_metrics,
    primary_metrics types.q_get_dashboard_bundle_v4_primary_metrics,
    secondary_metrics types.q_get_dashboard_bundle_v4_secondary_metrics,
    footer_metrics types.q_get_dashboard_bundle_v4_footer_metrics,
    history types.q_get_dashboard_bundle_v4_attempt_history_row[],
    insights types.q_get_dashboard_bundle_v4_insights,
    thresholds types.q_get_dashboard_bundle_v4_thresholds,
    simulations types.q_get_dashboard_bundle_v4_simulation[],
    rubrics types.q_get_dashboard_bundle_v4_rubric[],
    parameters types.q_get_dashboard_bundle_v4_parameter[],
    fields types.q_get_dashboard_bundle_v4_field[]
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
-- Unified attempts (general + practice)
all_attempts AS (
    SELECT id, created_at, updated_at, infinite_mode, archived, generated, mcp, active
    FROM view_simulation_attempts_entry
),
-- Unified attempt→simulation connections
all_attempt_simulations AS (
    SELECT attempt_id, simulations_id FROM simulation_attempts_simulations_connection
),
params AS (
    SELECT 
        start_date::timestamptz AS start_date,
        end_date::timestamptz AS end_date,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(NULLIF(roles, ARRAY[]::profile_type[]), ARRAY[]::profile_type[]) AS roles,
        COALESCE(NULLIF(simulation_filters, ARRAY[]::text[]), ARRAY['general']::text[]) AS simulation_filters,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(profile_id, NULL::uuid) AS profile_id
),
-- Get actor name FROM profile_artifact
user_profile AS (
    SELECT COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Get thresholds from active settings (defaults if no settings found)
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
-- Filter simulations by cohorts (new filtering order: cohorts → simulations)
-- Gets simulations linked to cohorts + practice simulations without cohorts
filtered_simulation_ids AS (
    SELECT DISTINCT s.id AS simulation_id
    FROM simulation_artifact s
    WHERE EXISTS (
        SELECT 1 FROM simulation_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = s.id
          AND f.name = 'simulation_active'
          AND sf.value = TRUE
    )
      AND (
          -- If cohort_ids provided, get simulations linked to those cohorts
                      (cardinality((SELECT cohort_ids FROM params)::uuid[]) > 0 AND EXISTS (
              SELECT 1 
              FROM cohort_simulations_junction cs 
              WHERE cs.simulation_id = s.id 
                            AND cs.cohort_id = ANY((SELECT cohort_ids FROM params)::uuid[])
                AND cs.active = TRUE
          ))
          OR
          -- Always include practice simulations without cohorts
          (EXISTS (
            SELECT 1 FROM simulation_flags_junction sf
            JOIN flags_resource f ON sf.flag_id = f.id
            WHERE sf.simulation_id = s.id
              AND f.name = 'practice'
              AND sf.value = TRUE
          )
           AND NOT EXISTS (
               SELECT 1 
               FROM cohort_simulations_junction cs2 
               WHERE cs2.simulation_id = s.id 
                 AND cs2.active = TRUE
           ))
          OR
          -- If no cohort_ids provided, include all simulations
                      (cardinality((SELECT cohort_ids FROM params)::uuid[]) = 0)
      )
),
-- Use mv_dashboard_facts with additional computed columns for backward compatibility
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
        -- Computed columns for backward compatibility
        (f.attempt_type = 'general' AND NOT f.is_archived) AS is_general,
        (f.attempt_type = 'practice') AS is_practice,
        COALESCE(
            (SELECT r.role FROM roles_resource r WHERE r.id = f.role_id LIMIT 1),
            'member'::profile_type
        ) AS profile_type,
        -- Get simulation scenario count
        COALESCE(
            (SELECT COUNT(*)::int FROM simulation_scenarios_junction ss
             JOIN simulation_simulations_junction ssj ON ssj.simulation_id = ss.simulation_id
             WHERE ssj.simulations_id = f.simulation_id),
            0
        ) AS sim_scenario_count
    FROM mv_dashboard_facts f
    WHERE f.attempt_created_at >= (SELECT start_date FROM params)
        AND f.attempt_created_at < (SELECT end_date FROM params)
        AND (cardinality((SELECT simulation_filters FROM params)::text[]) = 0 OR cardinality((SELECT simulation_filters FROM params)::text[]) > 0)
        AND (
            (SELECT simulation_filters FROM params)::text[] IS NULL OR (
                ('general' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.attempt_type = 'general' AND NOT f.is_archived) OR
                ('practice' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.attempt_type = 'practice') OR
                ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.is_archived = TRUE)
            )
        )
        -- Exclude archived attempts unless 'archived' is explicitly in the filter list
        AND (
            'archived' = ANY((SELECT simulation_filters FROM params)::text[]) OR f.is_archived = FALSE
        )
        -- Dashboard never filters by profile - always filter by roles
        AND (cardinality((SELECT roles FROM params)::profile_type[]) = 0 OR
             COALESCE((SELECT r.role FROM roles_resource r WHERE r.id = f.role_id LIMIT 1), 'member'::profile_type) = ANY((SELECT roles FROM params)::profile_type[]))
        -- Filter by simulation_ids FROM cohort_artifact (new filtering order)
        AND (cardinality((SELECT cohort_ids FROM params)::uuid[]) = 0 OR f.simulation_id IN (SELECT simulation_id FROM filtered_simulation_ids))
        -- Filter by department_ids (empty array = all departments)
        AND (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR f.department_id = ANY((SELECT department_ids FROM params)::uuid[]))
),
            
            -- =====================================================
            -- HEADER METRICS (10 view_metrics_entry)
            -- =====================================================
            
            -- Attempt normalization for average_score
            per_attempt AS (
                SELECT
                    attempt_id,
                    MIN(attempt_created_at) AS attempt_created_at,
                    (array_agg(profile_id))[1] AS profile_id,
                    COALESCE(MAX(sim_scenario_count), 0) AS expected_from_sim,
                    COUNT(*) FILTER (WHERE completed) AS completed_chats,
                    COUNT(*) FILTER (WHERE completed AND grade_percent IS NOT NULL) AS graded_chats,
                    COUNT(*) AS chats_in_attempt,
                    SUM(grade_percent) FILTER (WHERE grade_percent IS NOT NULL) AS sum_grade_percent
                FROM filt
                GROUP BY attempt_id
            ),
            attempt_norm AS (
                SELECT
                    attempt_id,
                    attempt_created_at,
                    profile_id,
                    GREATEST(expected_from_sim, chats_in_attempt) AS expected,
                    completed_chats,
                    graded_chats,
                    CASE
                        WHEN GREATEST(expected_from_sim, chats_in_attempt) > 0 
                             AND completed_chats > 0 
                             AND completed_chats = graded_chats
                        THEN (sum_grade_percent / GREATEST(expected_from_sim, chats_in_attempt))
                        ELSE NULL
                    END AS norm
                FROM per_attempt
            ),
            
            -- Average Score
            header_avg_score AS (
                SELECT ROUND(AVG(norm))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM attempt_norm WHERE norm IS NOT NULL
            ),
            
            -- Completion Percentage (chat-level aggregation from old stored procedure)
            header_completion AS (
                SELECT ROUND(100.0 * AVG((completed)::int))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt
            ),
            
            -- First Attempt Pass Rate (earliest attempt all-time, then filter to window)
            earliest_attempt_all_time AS (
                SELECT DISTINCT ON (f.profile_id, f.simulation_id)
                       f.attempt_id, f.profile_id, f.simulation_id, f.attempt_created_at,
                       f.grade_percent, f.rubric_pass_points, f.rubric_total_points AS rubric_points_junction
                FROM mv_dashboard_facts f
                WHERE (
                    -- Match simulation type filters
                    ('general' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.attempt_type = 'general' AND NOT f.is_archived) OR
                    ('practice' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.attempt_type = 'practice') OR
                    ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.is_archived = TRUE)
                )
                -- Exclude archived attempts unless 'archived' is explicitly in the filter list
                AND (
                    'archived' = ANY((SELECT simulation_filters FROM params)::text[]) OR f.is_archived = FALSE
                )
                -- Dashboard never filters by profile - always filter by roles
                AND (cardinality((SELECT roles FROM params)::profile_type[]) = 0 OR
                     COALESCE((SELECT r.role FROM roles_resource r WHERE r.id = f.role_id LIMIT 1), 'member'::profile_type) = ANY((SELECT roles FROM params)::profile_type[]))
                -- Filter by simulation_ids FROM cohort_artifact (new filtering order)
                AND (cardinality((SELECT cohort_ids FROM params)::uuid[]) = 0 OR f.simulation_id IN (SELECT simulation_id FROM filtered_simulation_ids))
                -- Filter by department_ids (empty array = all departments)
                AND (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR f.department_id = ANY((SELECT department_ids FROM params)::uuid[]))
                ORDER BY f.profile_id, f.simulation_id, f.attempt_created_at
            ),
            first_attempts AS (
                SELECT * FROM earliest_attempt_all_time
                WHERE attempt_created_at >= (SELECT start_date FROM params) AND attempt_created_at < (SELECT end_date FROM params)
            ),
            header_first_pass AS (
                SELECT
                    ROUND(100.0 * COUNT(*) FILTER (WHERE grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points_junction, 0))) / GREATEST(COUNT(*), 1))::int AS current_value,
                    COUNT(*) > 0 AS has_data
                FROM first_attempts
            ),
            
            -- Highest Score
            header_highest AS (
                SELECT ROUND(MAX(grade_percent))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt WHERE grade_percent IS NOT NULL
            ),
            
            -- Messages Per Session
            header_messages AS (
                SELECT ROUND(AVG(num_messages_total))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt WHERE num_messages_total IS NOT NULL
            ),
            
            -- Persona Response Times
            persona_times AS (
                SELECT UNNEST(message_time_taken_seconds) AS delta_sec
                FROM filt 
                WHERE cardinality(message_time_taken_seconds) > 0
            ),
            header_persona_times AS (
                SELECT ROUND(AVG(delta_sec))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM persona_times
            ),
            
            -- Session Efficiency (old formula: avgScore * (1 - min(1, avgMinutes/120)))
            user_metrics_for_efficiency AS (
                SELECT
                    AVG(grade_percent) FILTER (WHERE grade_percent IS NOT NULL) AS avg_score,
                    SUM(time_taken_seconds / 60.0) FILTER (WHERE time_taken_seconds IS NOT NULL) AS total_minutes,
                    COUNT(DISTINCT chat_id) AS total_sessions
                FROM filt
            ),
            header_efficiency AS (
                SELECT 
                    GREATEST(0, LEAST(100, ROUND(
                        avg_score * (1.0 - LEAST(1.0, (total_minutes / NULLIF(total_sessions, 0)) / 120.0))
                    )))::int AS current_value,
                    total_sessions > 0 AS has_data
                FROM user_metrics_for_efficiency
            ),
            
            -- Stagnation Rate (grade-stream approach from old stored procedure)
            filtered_chats_for_stagnation AS (
                SELECT DISTINCT chat_id FROM filt WHERE chat_id IS NOT NULL
            ),
            -- Score normalization: each grade has 5 feedbacks scored 1-5, max = 25
            grade_stream AS (
                SELECT
                    sg.id,
                    c_stag.id AS simulation_chat_id,
                    sg.created_at,
                    TRUNC((sg.score::numeric / NULLIF((SELECT p.value FROM scenario_rubrics_resource srr JOIN rubric_points_junction rp ON rp.rubric_id = srr.rubric_id AND rp.type = 'total'::point_type JOIN points_resource p ON p.id = rp.point_id WHERE srr.scenario_id = acs_stag.scenarios_id LIMIT 1), 0)) * 100.0, 2) AS norm
                FROM view_grades_entry sg
                JOIN all_chats c_stag ON c_stag.id = sg.chat_id
                JOIN all_chat_scenarios acs_stag ON acs_stag.chat_id = c_stag.id
                JOIN filtered_chats_for_stagnation fc ON fc.chat_id = c_stag.id
            ),
            ordered_grades AS (
                SELECT *,
                       LAG(norm) OVER (ORDER BY created_at) AS prev_norm
                FROM grade_stream
            ),
            stagnation_flags AS (
                SELECT *,
                       CASE WHEN prev_norm IS NULL THEN NULL
                            WHEN norm <= prev_norm + 0.1 THEN 1 
                            ELSE 0 
                       END AS stagnated
                FROM ordered_grades
                WHERE prev_norm IS NOT NULL
            ),
            header_stagnation AS (
                SELECT ROUND(100.0 * AVG(stagnated))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM stagnation_flags
            ),
            
            -- Time Spent (SUM with 30-minute cap per chat, in minutes)
            header_time AS (
                SELECT ROUND(SUM(LEAST(time_taken_seconds / 60.0, 30.0)))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt 
                WHERE time_taken_seconds IS NOT NULL
            ),
            
            -- Total Attempts
            header_attempts AS (
                SELECT COUNT(DISTINCT attempt_id)::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt
            ),
            
            -- =====================================================
            -- HEADER METRICS TREND DATA (for trend charts)
            -- =====================================================
            
            -- Average Score Trend (using attempt normalization)
            header_avg_score_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(AVG(norm))::float AS value,
                    COUNT(*)::int AS count
                FROM attempt_norm
                WHERE norm IS NOT NULL
                GROUP BY date
                ORDER BY date
            ),
            
            -- Completion Percentage Trend
            header_completion_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(100.0 * AVG((completed)::int))::float AS value,
                    COUNT(*)::int AS count
                FROM filt
                GROUP BY date
                ORDER BY date
            ),
            
            -- First Attempt Pass Rate Trend
            header_first_pass_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points_junction, 0))) / GREATEST(COUNT(*), 1))::float AS value,
                    COUNT(*)::int AS count
                FROM first_attempts
                GROUP BY date
                ORDER BY date
            ),
            
            -- Highest Score Trend
            header_highest_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(MAX(grade_percent))::float AS value,
                    COUNT(*)::int AS count
                FROM filt
                WHERE grade_percent IS NOT NULL
                GROUP BY date
                ORDER BY date
            ),
            
            -- Messages Per Session Trend
            header_messages_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(AVG(num_messages_total))::float AS value,
                    COUNT(*)::int AS count
                FROM filt
                WHERE num_messages_total IS NOT NULL
                GROUP BY date
                ORDER BY date
            ),
            
            -- Persona Response Times Trend
            header_persona_times_trend AS (
                SELECT 
                    to_char(pt.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(AVG(pt.delta_sec))::float AS value,
                    COUNT(*)::int AS count
                FROM (
                    SELECT attempt_created_at, UNNEST(message_time_taken_seconds) AS delta_sec
                    FROM filt
                    WHERE cardinality(message_time_taken_seconds) > 0
                ) pt
                GROUP BY date
                ORDER BY date
            ),
            
            -- Session Efficiency Trend (user-level aggregation by date)
            user_metrics_for_efficiency_by_date AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    profile_id,
                    AVG(grade_percent) FILTER (WHERE grade_percent IS NOT NULL) AS avg_score,
                    SUM(time_taken_seconds / 60.0) FILTER (WHERE time_taken_seconds IS NOT NULL) AS total_minutes,
                    COUNT(DISTINCT chat_id) AS total_sessions
                FROM filt
                GROUP BY date, profile_id
            ),
            header_efficiency_trend AS (
                SELECT 
                    date,
                    ROUND(GREATEST(0, LEAST(100, AVG(
                        avg_score * (1.0 - LEAST(1.0, (total_minutes / NULLIF(total_sessions, 0)) / 120.0))
                    ))))::float AS value,
                    COUNT(*)::int AS count
                FROM user_metrics_for_efficiency_by_date
                WHERE total_sessions > 0
                GROUP BY date
                ORDER BY date
            ),
            
            -- Stagnation Rate Trend
            header_stagnation_trend AS (
                SELECT 
                    to_char(created_at, 'YYYY-MM-DD') AS date,
                    ROUND(100.0 * AVG(stagnated))::float AS value,
                    COUNT(*)::int AS count
                FROM stagnation_flags
                GROUP BY date
                ORDER BY date
            ),
            
            -- Time Spent Trend (with 30-minute cap per chat)
            header_time_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(AVG(LEAST(30.0, time_taken_seconds / 60.0)))::float AS value,
                    COUNT(*)::int AS count
                FROM filt
                WHERE time_taken_seconds IS NOT NULL
                GROUP BY date
                ORDER BY date
            ),
            
            -- Total Attempts Trend
            header_attempts_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    COUNT(DISTINCT attempt_id)::float AS value,
                    COUNT(*)::int AS count
                FROM filt
                GROUP BY date
                ORDER BY date
            ),
            
            -- =====================================================
            -- HEADER METRICS DATA POINTS (for hover tooltips)
            -- =====================================================
            
            -- Average Score Data Points
            header_avg_score_points AS (
                SELECT 
                    COALESCE(an.profile_id::text, '') AS profile_id,
                    to_char(an.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(an.norm)::int AS value,
                    COALESCE(an.attempt_id::text, '') AS attempt_id,
                    ''::text AS simulation_id,
                    ''::text AS scenario_id
                FROM attempt_norm an
                WHERE an.norm IS NOT NULL
                ORDER BY an.profile_id, an.attempt_created_at
            ),
            
            -- Completion Percentage Data Points
            header_completion_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    (f.completed::int * 100)::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- First Attempt Pass Rate Data Points
            header_first_pass_points AS (
                SELECT 
                    fa.profile_id::text AS profile_id,
                    to_char(fa.attempt_created_at, 'YYYY-MM-DD') AS date,
                    CASE 
                        WHEN fa.grade_percent >= (fa.rubric_pass_points * 100.0 / NULLIF(fa.rubric_points_junction, 0)) THEN 100
                        ELSE 0
                    END::int AS value,
                    fa.attempt_id::text AS attempt_id,
                    fa.simulation_id::text AS simulation_id,
                    NULL::text AS scenario_id
                FROM first_attempts fa
                ORDER BY fa.profile_id, fa.attempt_created_at
            ),
            
            -- Highest Score Data Points
            header_highest_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(f.grade_percent)::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                WHERE f.grade_percent IS NOT NULL
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- Messages Per Session Data Points
            header_messages_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    f.num_messages_total::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                WHERE f.num_messages_total IS NOT NULL
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- Persona Response Times Data Points
            header_persona_times_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(pt.delta_sec)::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                CROSS JOIN LATERAL UNNEST(f.message_time_taken_seconds) AS pt(delta_sec)
                WHERE cardinality(f.message_time_taken_seconds) > 0
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- Session Efficiency Data Points
            header_efficiency_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(GREATEST(0, LEAST(100, 
                        f.grade_percent * (1.0 - LEAST(1.0, (f.time_taken_seconds / 60.0) / 120.0))
                    )))::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                WHERE f.grade_percent IS NOT NULL AND f.time_taken_seconds IS NOT NULL
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- Stagnation Rate Data Points
            header_stagnation_points AS (
                SELECT 
                    ''::text AS profile_id,
                    to_char(gs.created_at, 'YYYY-MM-DD') AS date,
                    (sf.stagnated * 100)::int AS value,
                    ''::text AS attempt_id,
                    ''::text AS simulation_id,
                    ''::text AS scenario_id
                FROM stagnation_flags sf
                JOIN grade_stream gs ON gs.id = sf.id
                ORDER BY gs.created_at
            ),
            
            -- Time Spent Data Points
            header_time_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(LEAST(30.0, f.time_taken_seconds / 60.0))::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                WHERE f.time_taken_seconds IS NOT NULL
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- Total Attempts Data Points
            header_attempts_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    1::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                WHERE f.attempt_id IS NOT NULL
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- =====================================================
            -- PRIMARY METRICS
            -- =====================================================
            
            -- Growth Data
            spine AS (
                SELECT generate_series(
                    date_trunc('day', (SELECT start_date FROM params)::timestamptz)::date,
                    (date_trunc('day', (SELECT end_date FROM params)::timestamptz) - interval '1 second')::date,
                    interval '1 day'
                )::date AS d
            ),
            growth_avg_score AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       TRUNC(AVG(grade_percent)::numeric, 2)::float AS value
                FROM filt WHERE grade_percent IS NOT NULL
                GROUP BY date
            ),
            growth_pass_rate AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       TRUNC((100.0 * COUNT(*) FILTER (WHERE grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points_junction, 0)))
                        / NULLIF(COUNT(*), 0))::numeric, 2)::float AS value
                FROM first_attempts
                GROUP BY date
            ),
            growth_completion_rate AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       TRUNC(AVG(CASE WHEN expected > 0 THEN (100.0 * completed_chats / expected) ELSE 0 END)::numeric, 2)::float AS value
                FROM attempt_norm
                GROUP BY date
            ),
            growth_first_attempt_pass_rate AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       TRUNC((100.0 * COUNT(*) FILTER (WHERE grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points_junction, 0)))
                        / NULLIF(COUNT(*), 0))::numeric, 2)::float AS value
                FROM first_attempts
                GROUP BY date
            ),
            growth_messages AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       AVG(num_messages_total)::float AS value
                FROM filt WHERE num_messages_total IS NOT NULL
                GROUP BY date
            ),
            growth_persona_times_daily AS (
                SELECT to_char(pt.attempt_created_at, 'YYYY-MM-DD') AS date,
                       AVG(pt.delta_sec)::float AS value
                FROM (
                    SELECT attempt_created_at, UNNEST(message_time_taken_seconds) AS delta_sec
                    FROM filt WHERE cardinality(message_time_taken_seconds) > 0
                ) pt
                GROUP BY date
            ),
            growth_efficiency AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    GREATEST(0, LEAST(100, ROUND(
                        AVG(grade_percent) FILTER (WHERE grade_percent IS NOT NULL) * 
                        (1.0 - LEAST(1.0, (SUM(time_taken_seconds / 60.0) FILTER (WHERE time_taken_seconds IS NOT NULL) / 
                         NULLIF(COUNT(DISTINCT chat_id), 0)) / 120.0))
                    )))::float AS value
                FROM filt 
                WHERE time_taken_seconds > 0 AND grade_percent IS NOT NULL
                GROUP BY date
            ),
            growth_stagnation AS (
                SELECT to_char(created_at, 'YYYY-MM-DD') AS date,
                       TRUNC((100.0 * AVG(stagnated))::numeric, 2)::float AS value
                FROM stagnation_flags
                GROUP BY date
            ),
            growth_time_spent AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       AVG(time_taken_seconds)::float AS value
                FROM filt WHERE time_taken_seconds IS NOT NULL
                GROUP BY date
            ),
            growth_total_attempts AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       COUNT(DISTINCT attempt_id)::float AS value
                FROM filt
                GROUP BY date
            ),
            growth_chart_dates AS (
                SELECT s.d AS date_val,
                       to_char(s.d, 'YYYY-MM-DD') AS date,
                       ROUND(COALESCE(gas.value, 0))::int AS average_score,
                       ROUND(COALESCE(gcr.value, 0))::int AS completion_rate,
                       ROUND(COALESCE(gfapr.value, 0))::int AS first_attempt_pass_rate,
                       ROUND(COALESCE(ge.value, 0))::int AS session_efficiency,
                       ROUND(COALESCE(gst.value, 0))::int AS stagnation_rate
                FROM spine s
                LEFT JOIN growth_avg_score gas ON gas.date = to_char(s.d, 'YYYY-MM-DD')
                LEFT JOIN growth_completion_rate gcr ON gcr.date = to_char(s.d, 'YYYY-MM-DD')
                LEFT JOIN growth_first_attempt_pass_rate gfapr ON gfapr.date = to_char(s.d, 'YYYY-MM-DD')
                LEFT JOIN growth_efficiency ge ON ge.date = to_char(s.d, 'YYYY-MM-DD')
                LEFT JOIN growth_stagnation gst ON gst.date = to_char(s.d, 'YYYY-MM-DD')
                WHERE gas.value IS NOT NULL 
                   OR gcr.value IS NOT NULL 
                   OR gfapr.value IS NOT NULL 
                   OR ge.value IS NOT NULL 
                   OR gst.value IS NOT NULL
            ),
            growth_window AS (
                SELECT AVG(average_score) FILTER (WHERE date_val >= (SELECT MAX(date_val) FROM growth_chart_dates) - interval '7 days') AS last_avg,
                       AVG(average_score) FILTER (WHERE date_val >= (SELECT MAX(date_val) FROM growth_chart_dates) - interval '14 days' 
                                                        AND date_val < (SELECT MAX(date_val) FROM growth_chart_dates) - interval '7 days') AS prev_avg
                FROM growth_chart_dates
            ),
            
            -- Persona Performance
            persona_agg AS (
                SELECT f.persona_id,
                       (SELECT n.name FROM personas_resource pr JOIN persona_personas_junction ppj ON ppj.personas_id = pr.id JOIN persona_names_junction pn ON pn.persona_id = ppj.persona_id JOIN names_resource n ON pn.name_id = n.id WHERE pr.id = f.persona_id LIMIT 1) AS name,
                       COALESCE((SELECT c.hex_code FROM personas_resource pr JOIN persona_personas_junction ppj ON ppj.personas_id = pr.id JOIN persona_colors_junction pc ON pc.persona_id = ppj.persona_id JOIN colors_resource c ON pc.color_id = c.id WHERE pr.id = f.persona_id LIMIT 1), '#3b82f6') AS color,
                       TRUNC(AVG(f.grade_percent)::numeric, 2)::float AS avg_score,
                       COUNT(DISTINCT f.chat_id)::int AS sessions,
                       ARRAY_AGG(DISTINCT f.simulation_id::text) AS simulation_ids,
                       CASE
                           WHEN AVG(f.grade_percent)::float >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                           WHEN AVG(f.grade_percent)::float >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                           ELSE 'danger'
                       END AS status
                FROM filt f
                WHERE f.grade_percent IS NOT NULL AND f.persona_id IS NOT NULL
                GROUP BY f.persona_id
            ),
            trend_data_raw AS (
                SELECT
                    f.persona_id,
                    date_trunc('day', f.chat_created_at) AS day,
                    to_char(date_trunc('day', f.chat_created_at), 'YYYY-MM-DD') AS date,
                    EXTRACT(epoch FROM date_trunc('day', f.chat_created_at))::bigint AS timestamp,
                    f.simulation_id,
                    TRUNC(AVG(f.grade_percent)::numeric, 2)::float AS avg_score
                FROM filt f
                WHERE f.persona_id IS NOT NULL AND f.grade_percent IS NOT NULL
                GROUP BY f.persona_id, date_trunc('day', f.chat_created_at), f.simulation_id
            ),
            persona_trends_agg_converted AS (
                SELECT 
                    persona_id,
                    COALESCE(
                        ARRAY_AGG(
                            (date, COALESCE(avg_score, 0)::float, timestamp, simulation_id::text)::types.q_get_dashboard_bundle_v4_persona_trend_data
                            ORDER BY day
                        ),
                        '{}'::types.q_get_dashboard_bundle_v4_persona_trend_data[]
                    ) AS trends
                FROM trend_data_raw
                GROUP BY persona_id
            ),
            persona_colors_agg_converted AS (
                SELECT ARRAY_AGG(
                    ((SELECT n.name FROM personas_resource pr JOIN persona_personas_junction ppj ON ppj.personas_id = pr.id JOIN persona_names_junction pn ON pn.persona_id = ppj.persona_id JOIN names_resource n ON pn.name_id = n.id WHERE pr.id = pa.persona_id LIMIT 1), COALESCE((SELECT c.hex_code FROM personas_resource pr JOIN persona_personas_junction ppj ON ppj.personas_id = pr.id JOIN persona_colors_junction pc ON pc.persona_id = ppj.persona_id JOIN colors_resource c ON pc.color_id = c.id WHERE pr.id = pa.persona_id LIMIT 1), '#3b82f6'))::types.q_get_dashboard_bundle_v4_persona_color
                    ORDER BY (SELECT n.name FROM personas_resource pr JOIN persona_personas_junction ppj ON ppj.personas_id = pr.id JOIN persona_names_junction pn ON pn.persona_id = ppj.persona_id JOIN names_resource n ON pn.name_id = n.id WHERE pr.id = pa.persona_id LIMIT 1)
                ) AS colors
                FROM (SELECT DISTINCT persona_id FROM persona_agg) pa
            ),
            
            -- Rubric Heatmap (FULL IMPLEMENTATION with correlation matrices)
            -- Get all chats that have view_grades_entry in the date range (not filtered by analytics attempt_created_at)
            filtered_chats AS (
                SELECT DISTINCT c.id AS chat_id
                FROM view_grades_entry scg
                JOIN all_chats c ON c.id = scg.chat_id
                JOIN all_attempts sa ON sa.id = c.attempt_id
                WHERE scg.created_at >= (SELECT start_date FROM params)
                  AND scg.created_at < (SELECT end_date FROM params)
                  -- Apply same filters as filt but on attempt level
                  AND EXISTS (
                      SELECT 1 FROM mv_dashboard_facts f
                      WHERE f.chat_id = c.id
                        AND (cardinality((SELECT roles FROM params)::profile_type[]) = 0 OR
                             COALESCE((SELECT r.role FROM roles_resource r WHERE r.id = f.role_id LIMIT 1), 'member'::profile_type) = ANY((SELECT roles FROM params)::profile_type[]))
                        AND (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR f.department_id = ANY((SELECT department_ids FROM params)::uuid[]))
                        AND (cardinality((SELECT cohort_ids FROM params)::uuid[]) = 0 OR f.simulation_id IN (SELECT simulation_id FROM filtered_simulation_ids))
                        AND (cardinality((SELECT simulation_filters FROM params)::text[]) = 0 OR cardinality((SELECT simulation_filters FROM params)::text[]) > 0)
                        AND (
                            (SELECT simulation_filters FROM params)::text[] IS NULL OR (
                                ('general' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.attempt_type = 'general' AND NOT f.is_archived) OR
                                ('practice' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.attempt_type = 'practice') OR
                                ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.is_archived)
                            )
                        )
                        AND (
                            'archived' = ANY((SELECT simulation_filters FROM params)::text[]) OR f.is_archived = FALSE
                        )
                  )
            ),
            -- Per-grade group scores using shared view (rubric heatmap)
            per_grade_group AS (
                SELECT
                    vg.chat_id,
                    vg.rubric_id,
                    vg.standard_group_id AS group_id,
                    vg.group_name,
                    vg.score_percent AS pct
                FROM view_grade_per_standard_group vg
                WHERE vg.chat_id IN (SELECT chat_id FROM filtered_chats)
            ),
            corrs_upper AS (
                SELECT
                    a.rubric_id,
                    a.group_id AS g1,
                    b.group_id AS g2,
                    COUNT(*) FILTER (WHERE a.pct IS NOT NULL AND b.pct IS NOT NULL) AS n,
                    corr(a.pct, b.pct) AS r
                FROM per_grade_group a
                JOIN per_grade_group b
                    ON b.rubric_id = a.rubric_id
                    AND b.chat_id = a.chat_id
                    AND b.group_id >= a.group_id
                GROUP BY a.rubric_id, a.group_id, b.group_id
            ),
            corrs_full AS (
                SELECT rubric_id, g1, g2, n, r FROM corrs_upper
                UNION ALL
                SELECT rubric_id, g2 AS g1, g1 AS g2, n, r
                FROM corrs_upper
                WHERE g1 != g2
            ),
            rubric_groups AS (
                SELECT DISTINCT pgg.rubric_id, sg.id, sg.name, sg.short_name
                FROM per_grade_group pgg
                JOIN rubric_standard_groups_junction rsg ON rsg.rubric_id = pgg.rubric_id AND rsg.standard_group_id = pgg.group_id AND rsg.active = true
                JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
            ),
            valid_rubric_ids_list AS (
                SELECT DISTINCT rubric_id FROM rubric_groups
            ),
            enriched_corrs AS (
                SELECT
                    c.rubric_id, c.g1, c.g2, c.n,
                    CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END AS r,
                    NULL AS p_value,
                    CASE
                        WHEN c.n IS NULL OR c.n < 3 THEN 'No Data'
                        WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.7 THEN 'Strong'
                        WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.4 THEN 'Moderate'
                        WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) > 0.0 THEN 'Weak'
                        ELSE 'No Data'
                    END AS strength,
                    CASE
                        WHEN c.n IS NULL OR c.n < 3 THEN '#e5e7eb'
                        WHEN (CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.0 THEN
                            CASE
                                WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.7 THEN '#10b981'
                                WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.4 THEN '#34d399'
                                ELSE '#a7f3d0'
                            END
                        ELSE
                            CASE
                                WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.7 THEN '#ef4444'
                                WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.4 THEN '#f87171'
                                ELSE '#fecaca'
                            END
                    END AS color
                FROM corrs_full c
            ),
            rubric_insights AS (
                SELECT
                    e.rubric_id,
                    CASE
                        WHEN COALESCE(SUM(CASE WHEN e.n >= 3 THEN 1 ELSE 0 END), 0) = 0 THEN NULL
                        ELSE (
                            SELECT 'Top pair: "' || g1.name || '" vs "' || g2.name ||
                                   '" r=' || TO_CHAR(e2.r, 'FM0.00') ||
                                   ' (n=' || e2.n || ')'
                            FROM enriched_corrs e2
                            JOIN rubric_groups g1 ON g1.id = e2.g1 AND g1.rubric_id = e2.rubric_id
                            JOIN rubric_groups g2 ON g2.id = e2.g2 AND g2.rubric_id = e2.rubric_id
                            WHERE e2.rubric_id = e.rubric_id AND e2.n >= 3
                            ORDER BY ABS(e2.r) DESC, e2.n DESC
                            LIMIT 1
                        )
                    END AS txt
                FROM enriched_corrs e
                GROUP BY e.rubric_id
            ),
            rubric_has_data AS (
                SELECT rubric_id,
                    (SUM(CASE WHEN n >= 3 THEN 1 ELSE 0 END) > 0) AS has_data
                FROM enriched_corrs
                GROUP BY rubric_id
            ),
            rubric_avg_correlation AS (
                SELECT 
                    rubric_id,
                    AVG(ABS(r)) AS avg_correlation_strength
                FROM enriched_corrs
                WHERE g1 != g2 AND n >= 3
                GROUP BY rubric_id
            ),
            -- Convert rubric_correlations: convert matrix and standard_groups to composite types
            per_rubric_matrix_converted AS (
                SELECT
                    g1.rubric_id,
                    ROW_NUMBER() OVER (PARTITION BY g1.rubric_id ORDER BY g1.name) - 1 AS row_idx,
                    ARRAY_AGG(
                        (g1.rubric_id::text, COALESCE(e.r, 0.0), e.p_value, COALESCE(e.color, '#e5e7eb'), COALESCE(e.strength, 'No Data'), COALESCE(e.n, 0))::types.q_get_dashboard_bundle_v4_rubric_heatmap_cell
                        ORDER BY g2.name
                    ) AS row_array
                FROM rubric_groups g1
                JOIN rubric_groups g2 ON g2.rubric_id = g1.rubric_id
                LEFT JOIN enriched_corrs e
                    ON e.rubric_id = g1.rubric_id AND e.g1 = g1.id AND e.g2 = g2.id
                GROUP BY g1.rubric_id, g1.id, g1.name
            ),
            matrix_converted AS (
                SELECT 
                    rubric_id,
                    COALESCE(
                        ARRAY_AGG(
                            ROW(row_array)::types.q_get_dashboard_bundle_v4_rubric_heatmap_row
                            ORDER BY row_idx
                        ),
                        ARRAY[]::types.q_get_dashboard_bundle_v4_rubric_heatmap_row[]
                    ) AS matrix
                FROM per_rubric_matrix_converted
                GROUP BY rubric_id
            ),
            sg_converted AS (
                SELECT rubric_id,
                    ARRAY_AGG((id::text, name, short_name, rubric_id::text)::types.q_get_dashboard_bundle_v4_standard_group ORDER BY name) AS standard_groups
                FROM rubric_groups
                GROUP BY rubric_id
            ),
            per_rubric_heatmap_converted AS (
                SELECT
                    r.rubric_id,
                    COALESCE(m.matrix, ARRAY[]::types.q_get_dashboard_bundle_v4_rubric_heatmap_row[]) AS matrix,
                    COALESCE(sg.standard_groups, ARRAY[]::types.q_get_dashboard_bundle_v4_standard_group[]) AS standard_groups,
                    (SELECT txt FROM rubric_insights i WHERE i.rubric_id = r.rubric_id LIMIT 1) AS insights,
                    COALESCE((SELECT h.has_data FROM rubric_has_data h WHERE h.rubric_id = r.rubric_id LIMIT 1), FALSE) AS has_data
                FROM valid_rubric_ids_list r
                LEFT JOIN matrix_converted m ON m.rubric_id = r.rubric_id
                LEFT JOIN sg_converted sg ON sg.rubric_id = r.rubric_id
            ),
            rubric_correlations_converted AS (
                SELECT
                    COALESCE(
                        ARRAY_AGG(
                            (pr.rubric_id::text, pr.standard_groups, pr.matrix, pr.insights, pr.has_data)::types.q_get_dashboard_bundle_v4_rubric_matrix_package
                            ORDER BY pr.rubric_id::text
                        ),
                        '{}'::types.q_get_dashboard_bundle_v4_rubric_matrix_package[]
                    ) AS matrices,
                    COALESCE(
                        ARRAY_AGG(rubric_id::text ORDER BY rubric_id::text),
                        ARRAY[]::text[]
                    ) AS valid_rubric_ids,
                    CASE
                        WHEN (SELECT COUNT(*) FROM rubric_avg_correlation) = 0 THEN 'neutral'::text
                        WHEN (SELECT AVG(avg_correlation_strength * 100) FROM rubric_avg_correlation) >= 
                             (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                        WHEN (SELECT AVG(avg_correlation_strength * 100) FROM rubric_avg_correlation) >= 
                             (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                        ELSE 'danger'::text
                    END AS status
                FROM per_rubric_heatmap_converted pr
            ),
            -- Entity Mappings - converted to arrays of composite types
            simulation_ids AS (
                SELECT DISTINCT simulation_id FROM filt WHERE simulation_id IS NOT NULL
            ),
            simulation_with_depts AS (
                SELECT 
                    s.id,
                    (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) AS title,
                    (SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1) AS description,
                    COALESCE(
                        (SELECT SUM(stlr.time_limit_seconds)
                         FROM simulation_scenario_time_limits_junction sstl
                         JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
                         JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
                         WHERE sstl.simulation_id = s.id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
                        0
                    ) AS time_limit,
                    COALESCE(
                        ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) FILTER (WHERE sd.department_id IS NOT NULL),
                        ARRAY[]::text[]
                    ) AS dept_ids
                FROM simulation_artifact s
                LEFT JOIN simulation_departments_junction sd ON sd.simulation_id = s.id AND sd.active = true
                WHERE s.id IN (SELECT simulation_id FROM simulation_ids)
                  AND EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'simulation_active' AND sf.value = true)
                  AND (
                      cardinality((SELECT department_ids FROM params)::uuid[]) = 0 
                      OR sd.department_id = ANY((SELECT department_ids FROM params)::uuid[])
                      OR NOT EXISTS (SELECT 1 FROM simulation_departments_junction sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
                  )
                GROUP BY s.id, (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1), (SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1)
            ),
            simulations_converted AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (id::text, title, COALESCE(description, ''), time_limit, dept_ids)::types.q_get_dashboard_bundle_v4_simulation
                        ORDER BY title
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_simulation[]
                ) AS simulations_array
                FROM simulation_with_depts
            ),
            rubric_ids AS (
                SELECT DISTINCT rubric_id FROM filt WHERE rubric_id IS NOT NULL
            ),
            rubrics_converted AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (r.id::text, (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1), COALESCE((SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1), ''))::types.q_get_dashboard_bundle_v4_rubric
                        ORDER BY (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1)
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_rubric[]
                ) AS rubrics_array
                FROM rubric_artifact r
                WHERE r.id IN (SELECT rubric_id FROM rubric_ids)
                  AND EXISTS (SELECT 1 FROM rubric_flags_junction rf JOIN flags_resource f ON rf.flag_id = f.id WHERE rf.rubric_id = r.id AND f.name = 'rubric_active' AND rf.value = true)
            ),
            parameters_converted AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (p.id::text, 
                         (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1), 
                         COALESCE((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), ''), 
                         false, 
                         EXISTS (
                             SELECT 1 FROM parameter_flags_junction pf
                             JOIN flags_resource f ON pf.flag_id = f.id
                             WHERE pf.parameter_id = p.id
                               AND f.name = 'document_parameter'
                               AND pf.value = TRUE
                         ),
                         EXISTS (
                             SELECT 1 FROM parameter_flags_junction pf
                             JOIN flags_resource f ON pf.flag_id = f.id
                             WHERE pf.parameter_id = p.id
                               AND f.name = 'persona_parameter'
                               AND pf.value = TRUE
                         )
                        )::types.q_get_dashboard_bundle_v4_parameter
                        ORDER BY (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1)
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_parameter[]
                ) AS parameters_array
                FROM parameter_artifact p
                WHERE EXISTS (
                    SELECT 1 FROM parameter_flags_junction pf
                    JOIN flags_resource f ON pf.flag_id = f.id
                    WHERE pf.parameter_id = p.id
                      AND f.name = 'parameter_active'
                      AND pf.value = TRUE
                )
                  AND (
                      cardinality((SELECT department_ids FROM params)) = 0 
                      OR EXISTS (
                          SELECT 1 
                          FROM field_artifact f
                          JOIN parameter_fields_junction pf ON pf.parameter_id = p.id AND pf.field_id = f.id
                          JOIN field_departments_junction fd ON fd.field_id = f.id AND fd.active = true
                          WHERE fd.department_id = ANY((SELECT department_ids FROM params)::uuid[])
                      )
                      OR NOT EXISTS (
                          SELECT 1 
                          FROM field_artifact f
                          JOIN parameter_fields_junction pf ON pf.parameter_id = p.id AND pf.field_id = f.id
                          JOIN field_departments_junction fd2 ON fd2.field_id = f.id AND fd2.active = true
                      )
                  )
            ),
            fields_converted AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (f.id::text, 
                         (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), 
                         COALESCE((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), ''), 
                         (SELECT pf.parameter_id::text FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1),
                         (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) LIMIT 1)
                        )::types.q_get_dashboard_bundle_v4_field
                        ORDER BY (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1)
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_field[]
                ) AS fields_array
                FROM field_artifact f
                JOIN parameter_fields_junction pf_link ON pf_link.field_id = f.id
                LEFT JOIN field_departments_junction fd ON fd.field_id = f.id AND fd.active = true
                WHERE EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.parameter_id = pf_link.parameter_id AND fl.name = 'parameter_active'
                      AND pf.value = TRUE
                )
                  AND (
                      cardinality((SELECT department_ids FROM params)::uuid[]) = 0 
                      OR fd.department_id = ANY((SELECT department_ids FROM params)::uuid[])
                      OR NOT EXISTS (SELECT 1 FROM field_departments_junction fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
                  )
            ),
            -- Helper CTEs for header view_metrics_entry - convert to composite types
            header_avg_score_trend_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((date, value, count)::types.q_get_dashboard_bundle_v4_trend_data ORDER BY date),
                    '{}'::types.q_get_dashboard_bundle_v4_trend_data[]
                ) as trend_data
                FROM header_avg_score_trend
            ),
            header_avg_score_points_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((COALESCE(profile_id, ''), date, value::float, attempt_id, simulation_id, scenario_id, 0)::types.q_get_dashboard_bundle_v4_data_point),
                    '{}'::types.q_get_dashboard_bundle_v4_data_point[]
                ) as data_points
                FROM header_avg_score_points
            ),
            header_avg_score_metric AS (
                SELECT 
                    COALESCE((SELECT has_data FROM header_avg_score), false)::boolean as has_data,
                    'avg'::text as method,
                    COALESCE((SELECT current_value FROM header_avg_score), 0)::int as current_value,
                    CASE
                        WHEN NOT COALESCE((SELECT has_data FROM header_avg_score), false) THEN 'neutral'::text
                        WHEN COALESCE((SELECT current_value FROM header_avg_score), 0) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                        WHEN COALESCE((SELECT current_value FROM header_avg_score), 0) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                        ELSE 'danger'::text
                    END as status,
                    NULL::text as trend_analysis,
                    NULL::text as value_field,
                    NULL::text as key_field,
                    (SELECT trend_data FROM header_avg_score_trend_agg LIMIT 1) as trend_data,
                    (SELECT data_points FROM header_avg_score_points_agg LIMIT 1) as data_points
            ),
            header_completion_trend_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((date, value, count)::types.q_get_dashboard_bundle_v4_trend_data ORDER BY date),
                    '{}'::types.q_get_dashboard_bundle_v4_trend_data[]
                ) as trend_data
                FROM header_completion_trend
            ),
            header_completion_points_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((profile_id, date, value::float, attempt_id, simulation_id, scenario_id, 0)::types.q_get_dashboard_bundle_v4_data_point),
                    '{}'::types.q_get_dashboard_bundle_v4_data_point[]
                ) as data_points
                FROM header_completion_points
            ),
            header_completion_metric AS (
                SELECT 
                    COALESCE((SELECT has_data FROM header_completion), false)::boolean as has_data,
                    'avg'::text as method,
                    COALESCE((SELECT current_value FROM header_completion), 0)::int as current_value,
                    CASE
                        WHEN NOT COALESCE((SELECT has_data FROM header_completion), false) THEN 'neutral'::text
                        WHEN COALESCE((SELECT current_value FROM header_completion), 0) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                        WHEN COALESCE((SELECT current_value FROM header_completion), 0) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                        ELSE 'danger'::text
                    END as status,
                    NULL::text as trend_analysis,
                    NULL::text as value_field,
                    NULL::text as key_field,
                    (SELECT trend_data FROM header_completion_trend_agg LIMIT 1) as trend_data,
                    (SELECT data_points FROM header_completion_points_agg LIMIT 1) as data_points
            ),
            header_first_pass_trend_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((date, value, count)::types.q_get_dashboard_bundle_v4_trend_data ORDER BY date),
                    '{}'::types.q_get_dashboard_bundle_v4_trend_data[]
                ) as trend_data
                FROM header_first_pass_trend
            ),
            header_first_pass_points_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((profile_id, date, value::float, attempt_id, simulation_id, COALESCE(scenario_id, ''), 0)::types.q_get_dashboard_bundle_v4_data_point),
                    '{}'::types.q_get_dashboard_bundle_v4_data_point[]
                ) as data_points
                FROM header_first_pass_points
            ),
            header_first_pass_metric AS (
                SELECT 
                    COALESCE((SELECT has_data FROM header_first_pass), false)::boolean as has_data,
                    'rate'::text as method,
                    COALESCE((SELECT current_value FROM header_first_pass), 0)::int as current_value,
                    CASE
                        WHEN NOT COALESCE((SELECT has_data FROM header_first_pass), false) THEN 'neutral'::text
                        WHEN COALESCE((SELECT current_value FROM header_first_pass), 0) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                        WHEN COALESCE((SELECT current_value FROM header_first_pass), 0) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                        ELSE 'danger'::text
                    END as status,
                    NULL::text as trend_analysis,
                    NULL::text as value_field,
                    NULL::text as key_field,
                    (SELECT trend_data FROM header_first_pass_trend_agg LIMIT 1) as trend_data,
                    (SELECT data_points FROM header_first_pass_points_agg LIMIT 1) as data_points
            ),
            header_highest_trend_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((date, value, count)::types.q_get_dashboard_bundle_v4_trend_data ORDER BY date),
                    '{}'::types.q_get_dashboard_bundle_v4_trend_data[]
                ) as trend_data
                FROM header_highest_trend
            ),
            header_highest_points_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((profile_id, date, value::float, attempt_id, simulation_id, scenario_id, 0)::types.q_get_dashboard_bundle_v4_data_point),
                    '{}'::types.q_get_dashboard_bundle_v4_data_point[]
                ) as data_points
                FROM header_highest_points
            ),
            header_highest_metric AS (
                SELECT 
                    COALESCE((SELECT has_data FROM header_highest), false)::boolean as has_data,
                    'max'::text as method,
                    COALESCE((SELECT current_value FROM header_highest), 0)::int as current_value,
                    CASE
                        WHEN NOT COALESCE((SELECT has_data FROM header_highest), false) THEN 'neutral'::text
                        WHEN COALESCE((SELECT current_value FROM header_highest), 0) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                        WHEN COALESCE((SELECT current_value FROM header_highest), 0) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                        ELSE 'danger'::text
                    END as status,
                    NULL::text as trend_analysis,
                    NULL::text as value_field,
                    NULL::text as key_field,
                    (SELECT trend_data FROM header_highest_trend_agg LIMIT 1) as trend_data,
                    (SELECT data_points FROM header_highest_points_agg LIMIT 1) as data_points
            ),
            header_messages_trend_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((date, value, count)::types.q_get_dashboard_bundle_v4_trend_data ORDER BY date),
                    '{}'::types.q_get_dashboard_bundle_v4_trend_data[]
                ) as trend_data
                FROM header_messages_trend
            ),
            header_messages_points_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((profile_id, date, value::float, attempt_id, simulation_id, scenario_id, 0)::types.q_get_dashboard_bundle_v4_data_point),
                    '{}'::types.q_get_dashboard_bundle_v4_data_point[]
                ) as data_points
                FROM header_messages_points
            ),
            header_messages_metric AS (
                SELECT 
                    COALESCE((SELECT has_data FROM header_messages), false)::boolean as has_data,
                    'avg'::text as method,
                    COALESCE((SELECT current_value FROM header_messages), 0)::int as current_value,
                    CASE
                        WHEN NOT COALESCE((SELECT has_data FROM header_messages), false) THEN 'neutral'::text
                        WHEN COALESCE((SELECT current_value FROM header_messages), 0) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                        WHEN COALESCE((SELECT current_value FROM header_messages), 0) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                        ELSE 'danger'::text
                    END as status,
                    NULL::text as trend_analysis,
                    NULL::text as value_field,
                    NULL::text as key_field,
                    (SELECT trend_data FROM header_messages_trend_agg LIMIT 1) as trend_data,
                    (SELECT data_points FROM header_messages_points_agg LIMIT 1) as data_points
            ),
            header_persona_times_trend_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((date, value, count)::types.q_get_dashboard_bundle_v4_trend_data ORDER BY date),
                    '{}'::types.q_get_dashboard_bundle_v4_trend_data[]
                ) as trend_data
                FROM header_persona_times_trend
            ),
            header_persona_times_points_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((profile_id, date, value::float, attempt_id, simulation_id, scenario_id, 0)::types.q_get_dashboard_bundle_v4_data_point),
                    '{}'::types.q_get_dashboard_bundle_v4_data_point[]
                ) as data_points
                FROM header_persona_times_points
            ),
            header_persona_times_metric AS (
                SELECT 
                    COALESCE((SELECT has_data FROM header_persona_times), false)::boolean as has_data,
                    'avg'::text as method,
                    COALESCE((SELECT current_value FROM header_persona_times), 0)::int as current_value,
                    CASE
                        WHEN NOT COALESCE((SELECT has_data FROM header_persona_times), false) THEN 'neutral'::text
                        WHEN COALESCE((SELECT current_value FROM header_persona_times), 0) > (SELECT danger_threshold FROM settings_thresholds LIMIT 1) THEN 'danger'::text
                        WHEN COALESCE((SELECT current_value FROM header_persona_times), 0) > (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                        ELSE 'success'::text
                    END as status,
                    NULL::text as trend_analysis,
                    NULL::text as value_field,
                    NULL::text as key_field,
                    (SELECT trend_data FROM header_persona_times_trend_agg LIMIT 1) as trend_data,
                    (SELECT data_points FROM header_persona_times_points_agg LIMIT 1) as data_points
            ),
            header_efficiency_trend_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((date, value, count)::types.q_get_dashboard_bundle_v4_trend_data ORDER BY date),
                    '{}'::types.q_get_dashboard_bundle_v4_trend_data[]
                ) as trend_data
                FROM header_efficiency_trend
            ),
            header_efficiency_points_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((profile_id, date, value::float, attempt_id, simulation_id, scenario_id, 0)::types.q_get_dashboard_bundle_v4_data_point),
                    '{}'::types.q_get_dashboard_bundle_v4_data_point[]
                ) as data_points
                FROM header_efficiency_points
            ),
            header_efficiency_metric AS (
                SELECT 
                    COALESCE((SELECT has_data FROM header_efficiency), false)::boolean as has_data,
                    'avg'::text as method,
                    COALESCE((SELECT current_value FROM header_efficiency), 0)::int as current_value,
                    CASE
                        WHEN NOT COALESCE((SELECT has_data FROM header_efficiency), false) THEN 'neutral'::text
                        WHEN COALESCE((SELECT current_value FROM header_efficiency), 0) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                        WHEN COALESCE((SELECT current_value FROM header_efficiency), 0) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                        ELSE 'danger'::text
                    END as status,
                    NULL::text as trend_analysis,
                    NULL::text as value_field,
                    NULL::text as key_field,
                    (SELECT trend_data FROM header_efficiency_trend_agg LIMIT 1) as trend_data,
                    (SELECT data_points FROM header_efficiency_points_agg LIMIT 1) as data_points
            ),
            header_stagnation_trend_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((date, value, count)::types.q_get_dashboard_bundle_v4_trend_data ORDER BY date),
                    '{}'::types.q_get_dashboard_bundle_v4_trend_data[]
                ) as trend_data
                FROM header_stagnation_trend
            ),
            header_stagnation_points_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((COALESCE(profile_id, ''), date, value::float, COALESCE(attempt_id, ''), COALESCE(simulation_id, ''), COALESCE(scenario_id, ''), 0)::types.q_get_dashboard_bundle_v4_data_point),
                    '{}'::types.q_get_dashboard_bundle_v4_data_point[]
                ) as data_points
                FROM header_stagnation_points
            ),
            header_stagnation_metric AS (
                SELECT 
                    COALESCE((SELECT has_data FROM header_stagnation), false)::boolean as has_data,
                    'rate'::text as method,
                    COALESCE((SELECT current_value FROM header_stagnation), 0)::int as current_value,
                    CASE
                        WHEN NOT COALESCE((SELECT has_data FROM header_stagnation), false) THEN 'neutral'::text
                        WHEN COALESCE((SELECT current_value FROM header_stagnation), 0) > (SELECT danger_threshold FROM settings_thresholds LIMIT 1) THEN 'danger'::text
                        WHEN COALESCE((SELECT current_value FROM header_stagnation), 0) > (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                        ELSE 'success'::text
                    END as status,
                    NULL::text as trend_analysis,
                    NULL::text as value_field,
                    NULL::text as key_field,
                    (SELECT trend_data FROM header_stagnation_trend_agg LIMIT 1) as trend_data,
                    (SELECT data_points FROM header_stagnation_points_agg LIMIT 1) as data_points
            ),
            header_time_trend_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((date, value, count)::types.q_get_dashboard_bundle_v4_trend_data ORDER BY date),
                    '{}'::types.q_get_dashboard_bundle_v4_trend_data[]
                ) as trend_data
                FROM header_time_trend
            ),
            header_time_points_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((profile_id, date, value::float, attempt_id, simulation_id, scenario_id, 0)::types.q_get_dashboard_bundle_v4_data_point),
                    '{}'::types.q_get_dashboard_bundle_v4_data_point[]
                ) as data_points
                FROM header_time_points
            ),
            header_time_metric AS (
                SELECT 
                    COALESCE((SELECT has_data FROM header_time), false)::boolean as has_data,
                    'avg'::text as method,
                    COALESCE((SELECT current_value FROM header_time), 0)::int as current_value,
                    CASE
                        WHEN NOT COALESCE((SELECT has_data FROM header_time), false) THEN 'neutral'::text
                        WHEN COALESCE((SELECT current_value FROM header_time), 0) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                        WHEN COALESCE((SELECT current_value FROM header_time), 0) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                        ELSE 'danger'::text
                    END as status,
                    NULL::text as trend_analysis,
                    NULL::text as value_field,
                    NULL::text as key_field,
                    (SELECT trend_data FROM header_time_trend_agg LIMIT 1) as trend_data,
                    (SELECT data_points FROM header_time_points_agg LIMIT 1) as data_points
            ),
            header_attempts_trend_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((date, value, count)::types.q_get_dashboard_bundle_v4_trend_data ORDER BY date),
                    '{}'::types.q_get_dashboard_bundle_v4_trend_data[]
                ) as trend_data
                FROM header_attempts_trend
            ),
            header_attempts_points_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG((profile_id, date, value::float, attempt_id, simulation_id, scenario_id, 0)::types.q_get_dashboard_bundle_v4_data_point),
                    '{}'::types.q_get_dashboard_bundle_v4_data_point[]
                ) as data_points
                FROM header_attempts_points
            ),
            header_attempts_metric AS (
                SELECT 
                    COALESCE((SELECT has_data FROM header_attempts), false)::boolean as has_data,
                    'countDistinct'::text as method,
                    COALESCE((SELECT current_value FROM header_attempts), 0)::int as current_value,
                    CASE
                        WHEN NOT COALESCE((SELECT has_data FROM header_attempts), false) THEN 'neutral'::text
                        WHEN COALESCE((SELECT current_value FROM header_attempts), 0) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                        WHEN COALESCE((SELECT current_value FROM header_attempts), 0) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                        ELSE 'danger'::text
                    END as status,
                    NULL::text as trend_analysis,
                    NULL::text as value_field,
                    NULL::text as key_field,
                    (SELECT trend_data FROM header_attempts_trend_agg LIMIT 1) as trend_data,
                    (SELECT data_points FROM header_attempts_points_agg LIMIT 1) as data_points
            ),
            header_metrics_combined AS (
                SELECT (
                    (SELECT (has_data, method, current_value, status, trend_analysis, value_field, key_field, trend_data, data_points)::types.q_get_dashboard_bundle_v4_metric_response FROM header_avg_score_metric LIMIT 1),
                    (SELECT (has_data, method, current_value, status, trend_analysis, value_field, key_field, trend_data, data_points)::types.q_get_dashboard_bundle_v4_metric_response FROM header_completion_metric LIMIT 1),
                    (SELECT (has_data, method, current_value, status, trend_analysis, value_field, key_field, trend_data, data_points)::types.q_get_dashboard_bundle_v4_metric_response FROM header_first_pass_metric LIMIT 1),
                    (SELECT (has_data, method, current_value, status, trend_analysis, value_field, key_field, trend_data, data_points)::types.q_get_dashboard_bundle_v4_metric_response FROM header_highest_metric LIMIT 1),
                    (SELECT (has_data, method, current_value, status, trend_analysis, value_field, key_field, trend_data, data_points)::types.q_get_dashboard_bundle_v4_metric_response FROM header_messages_metric LIMIT 1),
                    (SELECT (has_data, method, current_value, status, trend_analysis, value_field, key_field, trend_data, data_points)::types.q_get_dashboard_bundle_v4_metric_response FROM header_persona_times_metric LIMIT 1),
                    (SELECT (has_data, method, current_value, status, trend_analysis, value_field, key_field, trend_data, data_points)::types.q_get_dashboard_bundle_v4_metric_response FROM header_efficiency_metric LIMIT 1),
                    (SELECT (has_data, method, current_value, status, trend_analysis, value_field, key_field, trend_data, data_points)::types.q_get_dashboard_bundle_v4_metric_response FROM header_stagnation_metric LIMIT 1),
                    (SELECT (has_data, method, current_value, status, trend_analysis, value_field, key_field, trend_data, data_points)::types.q_get_dashboard_bundle_v4_metric_response FROM header_time_metric LIMIT 1),
                    (SELECT (has_data, method, current_value, status, trend_analysis, value_field, key_field, trend_data, data_points)::types.q_get_dashboard_bundle_v4_metric_response FROM header_attempts_metric LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_header_metrics as header_metrics
            ),
            -- Primary view_metrics_entry helper CTEs
            growth_chart_data_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (date, average_score::float, completion_rate::float, first_attempt_pass_rate::float, session_efficiency::float, stagnation_rate::float)::types.q_get_dashboard_bundle_v4_growth_data_point
                        ORDER BY date_val
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_growth_data_point[]
                ) as chart_data
                FROM growth_chart_dates
            ),
            growth_available_metrics AS (
                SELECT ARRAY[
                    ('averageScore', 'Average Score', '#3b82f6', '%', 'Average score across all attempts', 'percent')::types.q_get_dashboard_bundle_v4_growth_metric,
                    ('completionRate', 'Completion Rate', '#8b5cf6', '%', 'Percentage of scenarios completed', 'percent')::types.q_get_dashboard_bundle_v4_growth_metric,
                    ('firstAttemptPassRate', 'First Attempt Pass Rate', '#06b6d4', '%', 'Pass rate on first attempts', 'percent')::types.q_get_dashboard_bundle_v4_growth_metric,
                    ('sessionEfficiency', 'Session Efficiency', '#84cc16', '%', 'Efficiency index based on score and time (0-100)', 'percent')::types.q_get_dashboard_bundle_v4_growth_metric,
                    ('stagnationRate', 'Stagnation Rate', '#ec4899', '%', 'Percentage of attempts with no improvement', 'percent')::types.q_get_dashboard_bundle_v4_growth_metric
                ] as available_metrics
            ),
            growth_window_averages_combined AS (
                SELECT (
                    ROW((7, (SELECT ROUND(last_avg) FROM growth_window), (SELECT ROUND(prev_avg) FROM growth_window))::types.q_get_dashboard_bundle_v4_growth_window_average)
                )::types.q_get_dashboard_bundle_v4_growth_window_averages as window_averages
            ),
            growth_data_combined AS (
                SELECT (
                    (SELECT chart_data FROM growth_chart_data_agg LIMIT 1),
                    (SELECT available_metrics FROM growth_available_metrics LIMIT 1),
                    (SELECT window_averages FROM growth_window_averages_combined LIMIT 1),
                    CASE
                        WHEN (SELECT last_avg FROM growth_window) IS NULL OR (SELECT prev_avg FROM growth_window) IS NULL THEN 'neutral'::text
                        WHEN (SELECT ROUND(last_avg - prev_avg) FROM growth_window) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                        WHEN (SELECT ROUND(last_avg - prev_avg) FROM growth_window) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                        ELSE 'danger'::text
                    END
                )::types.q_get_dashboard_bundle_v4_growth_data_response as growth_data
            ),
            persona_performance_top5 AS (
                SELECT pa.name, pa.avg_score, pa.sessions, pa.color, pa.simulation_ids, 
                       COALESCE(ptc.trends, ARRAY[]::types.q_get_dashboard_bundle_v4_persona_trend_data[]) as trends,
                       pa.status
                FROM persona_agg pa
                LEFT JOIN persona_trends_agg_converted ptc ON ptc.persona_id = pa.persona_id
                ORDER BY pa.avg_score DESC
                LIMIT 5
            ),
            persona_performance_chart_data_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (name, COALESCE(avg_score, 0)::float, sessions, color, simulation_ids, trends, status)::types.q_get_dashboard_bundle_v4_persona_performance_data
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_persona_performance_data[]
                ) as chart_data
                FROM persona_performance_top5
            ),
            persona_performance_valid_sims AS (
                SELECT COALESCE(
                    ARRAY_AGG(DISTINCT simulation_id::text ORDER BY simulation_id::text),
                    ARRAY[]::text[]
                ) as valid_simulation_ids
                FROM filt
                WHERE simulation_id IS NOT NULL
            ),
            persona_performance_combined AS (
                SELECT (
                    (SELECT chart_data FROM persona_performance_chart_data_agg LIMIT 1),
                    (SELECT valid_simulation_ids FROM persona_performance_valid_sims LIMIT 1),
                    (SELECT colors FROM persona_colors_agg_converted LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_persona_performance_response as persona_performance
            ),
            rubric_heatmap_combined AS (
                SELECT (
                    (SELECT matrices FROM rubric_correlations_converted LIMIT 1),
                    (SELECT valid_rubric_ids FROM rubric_correlations_converted LIMIT 1),
                    (SELECT status FROM rubric_correlations_converted LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_rubric_heatmap_response as rubric_heatmap
            ),
            primary_metrics_combined AS (
                SELECT (
                    (SELECT growth_data FROM growth_data_combined LIMIT 1),
                    (SELECT persona_performance FROM persona_performance_combined LIMIT 1),
                    (SELECT rubric_heatmap FROM rubric_heatmap_combined LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_primary_metrics as primary_metrics
            ),
            -- =====================================================
            -- SECONDARY METRICS
            -- =====================================================
            
            -- Attempt Improvement (ENHANCED with per-simulation facts)
            attempt_first AS (
                SELECT profile_id, simulation_id, attempt_id,
                       MIN(attempt_created_at) AS first_ts
                FROM filt
                GROUP BY profile_id, simulation_id, attempt_id
            ),
            attempt_ord AS (
                SELECT af.*, 
                       ROW_NUMBER() OVER (PARTITION BY af.profile_id, af.simulation_id ORDER BY af.first_ts) AS attempt_no
                FROM attempt_first af
            ),
            attempt_stats AS (
                SELECT
                    ao.profile_id,
                    ao.simulation_id,
                    ao.attempt_id,
                    ao.attempt_no,
                    TRUNC(AVG(f.grade_percent)::numeric, 2)::float AS avg_grade,
                    AVG(f.time_taken_seconds / 60.0)::float AS avg_time_minutes,
                    MAX((f.passed)::int)::int AS passed_any
                FROM attempt_ord ao
                JOIN filt f ON f.attempt_id = ao.attempt_id
                WHERE f.grade_percent IS NOT NULL
                GROUP BY ao.profile_id, ao.simulation_id, ao.attempt_id, ao.attempt_no
            ),
            multiple_users_attempt_data AS (
                SELECT
                    simulation_id,
                    attempt_no,
                    TRUNC(AVG(avg_grade)::numeric, 2)::float AS avg_grade,
                    AVG(avg_time_minutes)::float AS avg_time_minutes,
                    TRUNC((100.0 * AVG(passed_any))::numeric, 2)::float AS pass_rate
                FROM attempt_stats
                WHERE avg_grade IS NOT NULL
                GROUP BY simulation_id, attempt_no
            ),
            attempt_rows AS (
                SELECT
                    attempt_no,
                    TRUNC(AVG(avg_grade)::numeric, 2)::float AS avg_grade,
                    AVG(avg_time_minutes)::float AS avg_time_minutes,
                    TRUNC(AVG(pass_rate)::numeric, 2)::float AS pass_rate
                FROM multiple_users_attempt_data
                WHERE attempt_no <= 5
                GROUP BY attempt_no
            ),
            attempt_improvement_chart_data_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        ('Attempt ' || attempt_no, ROUND(COALESCE(avg_grade, 0))::float, ROUND(COALESCE(avg_time_minutes, 0))::float, ROUND(COALESCE(pass_rate, 0))::float)::types.q_get_dashboard_bundle_v4_attempt_improvement_data
                        ORDER BY attempt_no
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_attempt_improvement_data[]
                ) as chart_data
                FROM attempt_rows
            ),
            attempt_facts AS (
                SELECT
                    simulation_id::text,
                    attempt_no::int,
                    ROUND(COALESCE(avg_grade, 0))::int AS avg_grade,
                    ROUND(COALESCE(avg_time_minutes, 0))::int AS avg_minutes,
                    ROUND(COALESCE(pass_rate, 0))::int AS pass_rate
                FROM multiple_users_attempt_data
            ),
            attempt_improvement_facts_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (simulation_id, attempt_no, avg_grade::float, avg_minutes::float, pass_rate::float)::types.q_get_dashboard_bundle_v4_attempt_improvement_fact
                        ORDER BY simulation_id, attempt_no
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_attempt_improvement_fact[]
                ) as facts
                FROM attempt_facts
            ),
            attempt_improvement_valid_sims AS (
                SELECT COALESCE(
                    ARRAY_AGG(DISTINCT simulation_id::text ORDER BY simulation_id::text),
                    ARRAY[]::text[]
                ) as valid_simulation_ids
                FROM filt
                WHERE simulation_id IS NOT NULL
            ),
            attempt_improvement_status AS (
                SELECT CASE
                    WHEN (SELECT COUNT(*) FROM attempt_rows) < 2 THEN 'neutral'::text
                    WHEN (SELECT avg_grade FROM attempt_rows WHERE attempt_no = (SELECT MAX(attempt_no) FROM attempt_rows)) IS NULL 
                         OR (SELECT avg_grade FROM attempt_rows WHERE attempt_no = (SELECT MIN(attempt_no) FROM attempt_rows)) IS NULL THEN 'neutral'::text
                    WHEN (SELECT avg_grade FROM attempt_rows WHERE attempt_no = (SELECT MAX(attempt_no) FROM attempt_rows)) - 
                         (SELECT avg_grade FROM attempt_rows WHERE attempt_no = (SELECT MIN(attempt_no) FROM attempt_rows)) >= 
                         (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                    WHEN (SELECT avg_grade FROM attempt_rows WHERE attempt_no = (SELECT MAX(attempt_no) FROM attempt_rows)) - 
                         (SELECT avg_grade FROM attempt_rows WHERE attempt_no = (SELECT MIN(attempt_no) FROM attempt_rows)) >= 
                         (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                    ELSE 'danger'::text
                END as status
            ),
            attempt_improvement_combined AS (
                SELECT (
                    (SELECT chart_data FROM attempt_improvement_chart_data_agg LIMIT 1),
                    (SELECT facts FROM attempt_improvement_facts_agg LIMIT 1),
                    (SELECT valid_simulation_ids FROM attempt_improvement_valid_sims LIMIT 1),
                    (SELECT status FROM attempt_improvement_status LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_attempt_improvement_response as attempt_improvement
            ),
            
            -- Cohort Performance (FULL IMPLEMENTATION)
            -- Note: cohort_id is singular in mv_dashboard_facts (not an array)
            filt_with_cohorts AS (
                SELECT f.*, f.cohort_id AS c_id
                FROM filt f
                WHERE f.cohort_id IS NOT NULL
            ),
            cohort_list AS (
                SELECT DISTINCT 
                    c.id, 
                    (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) AS title,
                    ARRAY(
                        SELECT cp.profile_id 
                        FROM profile_cohorts_junction cp
                        JOIN profile_artifact p ON p.id = cp.profile_id
                        WHERE cp.cohort_id = c.id
                            AND cp.active = true
                            AND (SELECT r.role FROM profile_roles_junction pr_j 
                                 JOIN roles_resource r ON pr_j.role_id = r.id 
                                 WHERE pr_j.profile_id = p.id 
                                 LIMIT 1) = ANY((SELECT roles FROM params)::profile_type[])
                    ) AS profile_ids,
                    ARRAY(SELECT cs.simulation_id FROM cohort_simulations_junction cs WHERE cs.cohort_id = c.id AND cs.active = true) AS simulation_ids
                FROM cohort_artifact c
                JOIN (SELECT DISTINCT c_id FROM filt_with_cohorts) fc ON fc.c_id = c.id
            ),
            cohort_attempts AS (
                SELECT
                    fc.c_id AS cohort_id,
                    fc.attempt_id,
                    MAX((fc.passed)::int)::int AS passed_any,
                    TRUNC(AVG(fc.grade_percent)::numeric, 2)::float AS avg_grade_attempt
                FROM filt_with_cohorts fc
                GROUP BY fc.c_id, fc.attempt_id
            ),
            cohort_agg AS (
                SELECT
                    cl.id AS cohort_id,
                    (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = cl.id LIMIT 1) AS cohort_name,
                    COALESCE(cardinality(cl.profile_ids), 0) AS total_students_declared,
                    cardinality(cl.profile_ids) AS total_students_seen,
                    COUNT(DISTINCT ca.attempt_id) AS total_attempts,
                    SUM(ca.passed_any)::int AS passed_attempts,
                    TRUNC((100.0 * AVG(ca.passed_any))::numeric, 2)::float AS pass_rate_attempts,
                    TRUNC(AVG(ca.avg_grade_attempt)::numeric, 2)::float AS avg_percentage_score,
                    (SELECT COUNT(*) FROM (
                        SELECT profile_id
                        FROM filt_with_cohorts fc2
                        WHERE fc2.c_id = cl.id
                        GROUP BY profile_id
                        HAVING 
                            COUNT(DISTINCT simulation_id) = cardinality(cl.simulation_ids)
                            AND NOT EXISTS (
                                SELECT 1 
                                FROM (
                                    SELECT 
                                        simulation_id,
                                        MAX(CASE WHEN grade_percent IS NULL THEN 0 ELSE grade_percent END) as best_score
                                    FROM filt_with_cohorts fc3 
                                    WHERE fc3.c_id = cl.id 
                                        AND fc3.profile_id = fc2.profile_id
                                    GROUP BY simulation_id
                                ) sim_bests
                                WHERE sim_bests.best_score < 80.0
                            )
                    ) s) AS passed_students,
                    (SELECT COUNT(*) FROM (
                        SELECT 1
                        FROM filt_with_cohorts fc2
                        WHERE fc2.c_id = cl.id
                        GROUP BY fc2.profile_id
                        HAVING MAX((fc2.passed)::int) = 1
                    ) s) AS passed_at_least_once,
                    cardinality(cl.simulation_ids) AS simulation_count,
                    cardinality(cl.simulation_ids) AS required_simulations
                FROM cohort_list cl
                LEFT JOIN cohort_attempts ca ON ca.cohort_id = cl.id
                GROUP BY cl.id, (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = cl.id LIMIT 1), cl.profile_ids, cl.simulation_ids
            ),
            cohort_performance_cohort_data_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (cohort_id::text, cohort_name,
                         ROUND(CASE 
                             WHEN total_students_seen > 0 THEN 
                                 (100.0 * passed_students / total_students_seen)::numeric
                             ELSE 0
                         END, 2)::float,
                         ROUND(COALESCE(avg_percentage_score, 0))::int,
                         GREATEST(total_students_declared, total_students_seen),
                         COALESCE(passed_at_least_once, 0),
                         COALESCE(total_attempts, 0),
                         COALESCE(passed_attempts, 0),
                         COALESCE(simulation_count, 0),
                         COALESCE(required_simulations, 0),
                         CASE
                             WHEN total_students_seen = 0 THEN 'neutral'::text
                             WHEN (100.0 * passed_students / NULLIF(total_students_seen, 0)) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                             WHEN (100.0 * passed_students / NULLIF(total_students_seen, 0)) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                             ELSE 'danger'::text
                         END)::types.q_get_dashboard_bundle_v4_cohort_data
                        ORDER BY cohort_name
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_cohort_data[]
                ) as cohort_data
                FROM cohort_agg
            ),
            cohort_daily_data AS (
                SELECT
                    to_char(date_trunc('day', fc.attempt_created_at), 'YYYY-MM-DD') AS date,
                    TRUNC(AVG(fc.grade_percent)::numeric, 2)::float AS avg_score,
                    fc.c_id::text AS cohort_id
                FROM filt_with_cohorts fc
                WHERE fc.grade_percent IS NOT NULL
                GROUP BY fc.c_id, date_trunc('day', fc.attempt_created_at)
            ),
            cohort_performance_daily_data_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (date, ROUND(COALESCE(avg_score, 0))::int, cohort_id)::types.q_get_dashboard_bundle_v4_daily_data
                        ORDER BY cohort_id, date
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_daily_data[]
                ) as daily_data
                FROM cohort_daily_data
            ),
            cohort_performance_valid_sims AS (
                SELECT COALESCE(
                    ARRAY_AGG(DISTINCT simulation_id::text ORDER BY simulation_id::text),
                    ARRAY[]::text[]
                ) as valid_simulation_ids
                FROM filt
                WHERE simulation_id IS NOT NULL
            ),
            cohort_performance_status AS (
                SELECT CASE
                    WHEN (SELECT COUNT(*) FROM cohort_agg) = 0 THEN 'neutral'::text
                    WHEN (SELECT AVG(
                        CASE 
                            WHEN total_students_seen > 0 THEN 
                                (100.0 * passed_students / total_students_seen)::numeric
                            ELSE 0
                        END
                    ) FROM cohort_agg) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                    WHEN (SELECT AVG(
                        CASE 
                            WHEN total_students_seen > 0 THEN 
                                (100.0 * passed_students / total_students_seen)::numeric
                            ELSE 0
                        END
                    ) FROM cohort_agg) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                    ELSE 'danger'::text
                END as status
            ),
            cohort_performance_combined AS (
                SELECT (
                    (SELECT cohort_data FROM cohort_performance_cohort_data_agg LIMIT 1),
                    (SELECT daily_data FROM cohort_performance_daily_data_agg LIMIT 1),
                    ARRAY[]::types.q_get_dashboard_bundle_v4_cohort_fact[],
                    ARRAY[]::types.q_get_dashboard_bundle_v4_cohort_daily_fact[],
                    (SELECT valid_simulation_ids FROM cohort_performance_valid_sims LIMIT 1),
                    (SELECT status FROM cohort_performance_status LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_cohort_performance_response as cohort_performance
            ),
            
            -- Skill Performance (FULL IMPLEMENTATION with radar charts)
            filt_for_skills AS (
                SELECT
                    f.chat_id,
                    f.simulation_id,
                    CASE WHEN f.cohort_id IS NOT NULL THEN ARRAY[f.cohort_id] ELSE ARRAY[]::uuid[] END AS cohort_ids,
                    ARRAY[]::uuid[] AS profile_cohort_ids,
                    COALESCE((SELECT r.role FROM roles_resource r WHERE r.id = f.role_id LIMIT 1), 'member'::profile_type) AS profile_type,
                    (f.attempt_type = 'general' AND NOT f.is_archived) AS is_general,
                    (f.attempt_type = 'practice') AS is_practice,
                    f.is_archived,
                    f.profile_id,
                    f.attempt_created_at
                FROM mv_dashboard_facts f
                WHERE f.attempt_created_at >= (SELECT start_date FROM params)
                    AND f.attempt_created_at < (SELECT end_date FROM params)
                    AND (cardinality((SELECT cohort_ids FROM params)::uuid[]) = 0 OR f.simulation_id IN (SELECT simulation_id FROM filtered_simulation_ids))
                    AND (cardinality((SELECT roles FROM params)::profile_type[]) = 0 OR
                         COALESCE((SELECT r.role FROM roles_resource r WHERE r.id = f.role_id LIMIT 1), 'member'::profile_type) = ANY((SELECT roles FROM params)::profile_type[]))
                    AND (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR f.department_id = ANY((SELECT department_ids FROM params)::uuid[]))
                    AND (cardinality((SELECT simulation_filters FROM params)::text[]) = 0 OR cardinality((SELECT simulation_filters FROM params)::text[]) > 0)
                    AND (
                        (SELECT simulation_filters FROM params)::text[] IS NULL OR (
                            ('general' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.attempt_type = 'general' AND NOT f.is_archived) OR
                            ('practice' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.attempt_type = 'practice') OR
                            ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.is_archived)
                        )
                    )
                    AND (
                        'archived' = ANY((SELECT simulation_filters FROM params)::text[]) OR f.is_archived = FALSE
                    )
            ),
            -- Per-grade group scores using shared view (skill performance)
            per_grade_group_skills AS (
                SELECT
                    vg.rubric_id,
                    vg.standard_group_id AS group_id,
                    vg.group_name,
                    f.simulation_id,
                    vg.total_score AS score,
                    vg.max_group_points AS points,
                    vg.score_percent AS pct
                FROM view_grade_per_standard_group vg
                JOIN filt_for_skills f ON f.chat_id = vg.chat_id
            ),
            radar_rows AS (
                SELECT 
                    pgg.rubric_id, 
                    sg.short_name AS group_name,
                    sg.description AS group_description,
                    AVG(pgg.pct)::float8 AS avg_pct
                FROM per_grade_group_skills pgg
                JOIN standard_groups_resource sg ON sg.id = pgg.group_id
                GROUP BY pgg.rubric_id, sg.short_name, sg.description
            ),
            skill_group_stats AS (
                SELECT
                    pgg.rubric_id,
                    sg.id AS group_id,
                    sg.name AS group_name,
                    sg.description AS group_description,
                    pgg.simulation_id,
                    SUM(pgg.score) AS score_sum,
                    SUM(pgg.points) AS points_sum,
                    ROUND(AVG(pgg.pct))::int AS avg_pct
                FROM per_grade_group_skills pgg
                JOIN standard_groups_resource sg ON sg.id = pgg.group_id
                GROUP BY pgg.rubric_id, sg.id, sg.name, sg.description, pgg.simulation_id
            ),
            radar_data_per_rubric AS (
                SELECT
                    rubric_id,
                    COALESCE(
                        ARRAY_AGG(
                            (group_name, group_description, GREATEST(0, LEAST(1, COALESCE(avg_pct, 0) / 100.0))::float, 1.0::float)::types.q_get_dashboard_bundle_v4_skill_radar_data
                            ORDER BY group_name
                        ),
                        '{}'::types.q_get_dashboard_bundle_v4_skill_radar_data[]
                    ) as radar_data
                FROM radar_rows
                GROUP BY rubric_id
            ),
            group_facts_per_rubric AS (
                SELECT
                    rubric_id,
                    COALESCE(
                        ARRAY_AGG(
                            (group_id::text, group_name, group_description, simulation_id::text, COALESCE(score_sum, 0)::float, COALESCE(points_sum, 0)::float, COALESCE(avg_pct, 0)::float)::types.q_get_dashboard_bundle_v4_skill_standard_fact
                            ORDER BY group_name, simulation_id
                        ),
                        '{}'::types.q_get_dashboard_bundle_v4_skill_standard_fact[]
                    ) as group_facts
                FROM skill_group_stats
                GROUP BY rubric_id
            ),
            skill_performance_packages_agg AS (
                SELECT
                    COALESCE(rd.rubric_id, gf.rubric_id) AS rubric_id,
                    COALESCE(rd.radar_data, '{}'::types.q_get_dashboard_bundle_v4_skill_radar_data[]) AS radar_data,
                    COALESCE(gf.group_facts, '{}'::types.q_get_dashboard_bundle_v4_skill_standard_fact[]) AS group_facts
                FROM radar_data_per_rubric rd
                FULL OUTER JOIN group_facts_per_rubric gf ON gf.rubric_id = rd.rubric_id
            ),
            skill_performance_packages_combined AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (rubric_id::text, radar_data, group_facts)::types.q_get_dashboard_bundle_v4_skill_package
                        ORDER BY rubric_id::text
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_skill_package[]
                ) as packages
                FROM skill_performance_packages_agg
            ),
            skill_performance_valid_rubrics AS (
                SELECT COALESCE(
                    ARRAY_AGG(DISTINCT rubric_id::text ORDER BY rubric_id::text),
                    ARRAY[]::text[]
                ) as valid_rubric_ids
                FROM per_grade_group_skills
            ),
            skill_performance_status AS (
                SELECT CASE
                    WHEN (SELECT COUNT(*) FROM skill_performance_packages_combined) = 0 THEN 'neutral'::text
                    ELSE 'success'::text
                END as status
            ),
            skill_performance_combined AS (
                SELECT (
                    (SELECT packages FROM skill_performance_packages_combined LIMIT 1),
                    (SELECT valid_rubric_ids FROM skill_performance_valid_rubrics LIMIT 1),
                    (SELECT status FROM skill_performance_status LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_skill_performance_response as skill_performance
            ),
            secondary_metrics_combined AS (
                SELECT (
                    (SELECT attempt_improvement FROM attempt_improvement_combined LIMIT 1),
                    (SELECT cohort_performance FROM cohort_performance_combined LIMIT 1),
                    (SELECT skill_performance FROM skill_performance_combined LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_secondary_metrics as secondary_metrics
            ),
            -- =====================================================
            -- FOOTER METRICS
            -- =====================================================
            
            -- Scenario Performance (FULL IMPLEMENTATION with categorical parameters)
            param_ids_categorical AS (
                SELECT id
                FROM parameter_artifact p
                WHERE EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND pf.value = TRUE)
            ),
            cat_map AS (
                SELECT
                    pfr.field_id AS parameter_item_id,
                    pfr.parameter_id AS parameter_id,
                    spf.scenario_id AS scenario_id
                FROM parameter_fields_resource pfr
                JOIN param_ids_categorical p ON p.id = pfr.parameter_id
                JOIN scenario_parameter_fields_junction spf ON spf.parameter_field_id = pfr.id
                WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf2 JOIN flags_resource fl ON sf2.flag_id = fl.id WHERE sf2.scenario_id = spf.scenario_id AND fl.name = 'scenario_active' AND sf2.value = TRUE)
            ),
            scenario_seen AS (
                SELECT DISTINCT f.scenario_id
                FROM filt f
                WHERE f.scenario_id IS NOT NULL
            ),
            cat_map_seen AS (
                SELECT cm.parameter_id, cm.parameter_item_id, cm.scenario_id
                FROM cat_map cm
                JOIN scenario_seen ss ON ss.scenario_id = cm.scenario_id
            ),
            attempt_daily_categorical AS (
                SELECT
                    cm.parameter_id,
                    cm.parameter_item_id,
                    to_char(date_trunc('day', f.attempt_created_at), 'YYYY-MM-DD') AS date,
                    EXTRACT(EPOCH FROM date_trunc('day', f.attempt_created_at))::bigint AS timestamp,
                    TRUNC(AVG(f.grade_percent)::numeric, 2)::float AS avg_score,
                    COUNT(*)::int AS attempts,
                    SUM((f.passed)::int)::int AS passed_attempts
                FROM filt f
                JOIN cat_map_seen cm ON cm.scenario_id = f.scenario_id
                WHERE f.grade_percent IS NOT NULL
                GROUP BY cm.parameter_id, cm.parameter_item_id, date_trunc('day', f.attempt_created_at)
            ),
            scenario_performance_attribute_attempt_facts_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (parameter_id::text, parameter_item_id::text, date, timestamp, avg_score, attempts, passed_attempts)::types.q_get_dashboard_bundle_v4_scenario_attribute_attempt_fact
                        ORDER BY parameter_id, parameter_item_id, date
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_scenario_attribute_attempt_fact[]
                ) as attribute_attempt_facts
                FROM attempt_daily_categorical
            ),
            scenario_performance_attribute_scenario_facts_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (parameter_id::text, parameter_item_id::text, scenario_id::text)::types.q_get_dashboard_bundle_v4_scenario_attribute_scenario_fact
                        ORDER BY parameter_id, parameter_item_id, scenario_id
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_scenario_attribute_scenario_fact[]
                ) as attribute_scenario_facts
                FROM cat_map_seen
            ),
            scenario_performance_valid_params AS (
                SELECT COALESCE(
                    ARRAY_AGG(DISTINCT parameter_id::text ORDER BY parameter_id::text),
                    ARRAY[]::text[]
                ) as valid_parameter_ids
                FROM cat_map_seen
            ),
            scenario_performance_status AS (
                SELECT CASE
                    WHEN (SELECT COUNT(*) FROM attempt_daily_categorical) = 0 THEN 'neutral'::text
                    WHEN (SELECT AVG(avg_score) FROM attempt_daily_categorical) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                    WHEN (SELECT AVG(avg_score) FROM attempt_daily_categorical) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                    ELSE 'danger'::text
                END as status
            ),
            scenario_performance_combined AS (
                SELECT (
                    (SELECT valid_parameter_ids FROM scenario_performance_valid_params LIMIT 1),
                    (SELECT attribute_attempt_facts FROM scenario_performance_attribute_attempt_facts_agg LIMIT 1),
                    (SELECT attribute_scenario_facts FROM scenario_performance_attribute_scenario_facts_agg LIMIT 1),
                    (SELECT status FROM scenario_performance_status LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_scenario_performance_response as scenario_performance
            ),
            
            -- Scenario Stats (Document/Persona parameters displayed as bar chart)
            nums AS (
                SELECT p.id FROM parameter_artifact p
                WHERE EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'parameter_active' AND pf.value = TRUE)
                  AND (
                      EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'document_parameter' AND pf.value = TRUE)
                      OR EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'persona_parameter' AND pf.value = TRUE)
                  )
            ),
            num_field_levels AS (
                SELECT
                    pfj.parameter_id,
                    pfj.field_id,
                    pfj.field_resource_id,
                    ROW_NUMBER() OVER (PARTITION BY pfj.parameter_id ORDER BY pfj.field_id) AS level
                FROM parameter_fields_junction pfj
                JOIN nums n ON n.id = pfj.parameter_id
            ),
            num_map AS (
                SELECT
                    spf.scenario_id,
                    nfl.parameter_id,
                    nfl.level::numeric AS level,
                    nfl.field_id
                FROM num_field_levels nfl
                JOIN parameter_fields_resource pfr ON pfr.field_id = nfl.field_resource_id AND pfr.parameter_id = nfl.parameter_id
                JOIN scenario_parameter_fields_junction spf ON spf.parameter_field_id = pfr.id
                WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf2 JOIN flags_resource fl ON sf2.flag_id = fl.id WHERE sf2.scenario_id = spf.scenario_id AND fl.name = 'scenario_active' AND sf2.value = TRUE)
            ),
            num_map_seen AS (
                SELECT nm.*
                FROM num_map nm
                JOIN scenario_seen ss ON ss.scenario_id = nm.scenario_id
            ),
            numeric_attempts AS (
                SELECT
                    nms.parameter_id,
                    nms.level,
                    nms.field_id,
                    TRUNC(f.grade_percent::numeric, 2)::float AS score
                FROM filt f
                JOIN num_map_seen nms ON nms.scenario_id = f.scenario_id
                WHERE f.grade_percent IS NOT NULL
            ),
            numeric_levels AS (
                SELECT
                    parameter_id,
                    COALESCE(
                        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = na.field_id LIMIT 1),
                        level::int::text
                    ) AS level_label,
                    level::numeric AS level_value,
                    score
                FROM numeric_attempts na
            ),
            numeric_agg AS (
                SELECT 
                    parameter_id, 
                    level_label, 
                    level_value,
                    TRUNC(AVG(score)::numeric, 2)::float AS avg_score,
                    COUNT(*)::int AS attempts
                FROM numeric_levels
                GROUP BY parameter_id, level_label, level_value
            ),
            scenario_stats_numeric_attempt_facts_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (parameter_id::text, level_label, level_value, avg_score, attempts)::types.q_get_dashboard_bundle_v4_numeric_attempt_fact
                        ORDER BY parameter_id, level_value
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_numeric_attempt_fact[]
                ) as numeric_attempt_facts
                FROM numeric_agg
            ),
            scenario_stats_numeric_scenario_facts_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (nms.parameter_id::text, nms.scenario_id::text,
                         COALESCE(
                             (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = nms.field_id LIMIT 1),
                             nms.level::int::text
                         ),
                         nms.level::numeric
                        )::types.q_get_dashboard_bundle_v4_numeric_scenario_fact
                        ORDER BY nms.parameter_id, nms.scenario_id, nms.level
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_numeric_scenario_fact[]
                ) as numeric_scenario_facts
                FROM num_map_seen nms
            ),
            scenario_stats_valid_params AS (
                SELECT COALESCE(
                    ARRAY_AGG(DISTINCT parameter_id::text ORDER BY parameter_id::text),
                    ARRAY[]::text[]
                ) as valid_numeric_parameter_ids
                FROM numeric_levels
            ),
            scenario_stats_status AS (
                SELECT CASE
                    WHEN (SELECT COUNT(*) FROM numeric_agg) = 0 THEN 'neutral'::text
                    WHEN (SELECT AVG(avg_score) FROM numeric_agg) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                    WHEN (SELECT AVG(avg_score) FROM numeric_agg) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                    ELSE 'danger'::text
                END as status
            ),
            scenario_stats_combined AS (
                SELECT (
                    (SELECT valid_numeric_parameter_ids FROM scenario_stats_valid_params LIMIT 1),
                    (SELECT numeric_attempt_facts FROM scenario_stats_numeric_attempt_facts_agg LIMIT 1),
                    (SELECT numeric_scenario_facts FROM scenario_stats_numeric_scenario_facts_agg LIMIT 1),
                    (SELECT status FROM scenario_stats_status LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_scenario_stats_response as scenario_stats
            ),
            
            -- Simulation Performance (existing, keep as-is)
            sim_perf AS (
                SELECT f.simulation_id,
                       f.scenario_id,
                       (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = scsj.scenario_id LIMIT 1) AS scenario_name,
                       TRUNC(COALESCE(AVG(f.grade_percent), 0)::numeric, 2)::float AS avg_score,
                       TRUNC(COALESCE((100.0 * AVG((f.completed OR f.grade_percent IS NOT NULL)::int)), 0)::numeric, 2)::float AS success_rate,
                       COUNT(*)::int AS total_attempts,
                       SUM((f.completed OR f.grade_percent IS NOT NULL)::int)::int AS completed_attempts
                FROM filt f
                JOIN scenario_scenarios_junction scsj ON scsj.scenario_id = f.scenario_id
                JOIN scenarios_resource sc ON sc.id = scsj.scenarios_id
                WHERE f.simulation_id IS NOT NULL AND f.scenario_id IS NOT NULL
                GROUP BY f.simulation_id, f.scenario_id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = scsj.scenario_id LIMIT 1)
            ),
            simulation_performance_scenario_facts_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (simulation_id::text, scenario_id::text, scenario_name, avg_score, success_rate, total_attempts, completed_attempts)::types.q_get_dashboard_bundle_v4_scenario_fact
                        ORDER BY simulation_id, scenario_id
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_scenario_fact[]
                ) as scenario_facts
                FROM sim_perf
            ),
            simulation_performance_valid_sims AS (
                SELECT COALESCE(
                    ARRAY_AGG(DISTINCT simulation_id::text ORDER BY simulation_id::text),
                    ARRAY[]::text[]
                ) as valid_simulation_ids
                FROM sim_perf
            ),
            simulation_performance_status AS (
                SELECT CASE
                    WHEN (SELECT COUNT(*) FROM sim_perf) = 0 THEN 'neutral'::text
                    WHEN (SELECT (0.7 * AVG(avg_score) + 0.3 * AVG(success_rate)) FROM sim_perf) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'::text
                    WHEN (SELECT (0.7 * AVG(avg_score) + 0.3 * AVG(success_rate)) FROM sim_perf) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'::text
                    ELSE 'danger'::text
                END as status
            ),
            simulation_performance_combined AS (
                SELECT (
                    (SELECT valid_simulation_ids FROM simulation_performance_valid_sims LIMIT 1),
                    (SELECT scenario_facts FROM simulation_performance_scenario_facts_agg LIMIT 1),
                    (SELECT status FROM simulation_performance_status LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_simulation_performance_response as simulation_performance
            ),
            
            -- Simulation Composition (ENHANCED with parameter composition)
            sim_seen AS (
                SELECT DISTINCT f.simulation_id
                FROM filt f
                WHERE f.simulation_id IS NOT NULL
            ),
            scen_seen AS (
                SELECT DISTINCT f.scenario_id
                FROM filt f
                WHERE f.scenario_id IS NOT NULL
            ),
            sim_summary AS (
                SELECT
                    f.simulation_id,
                    TRUNC(AVG(f.grade_percent)::numeric, 2)::float AS avg_score,
                    TRUNC((100.0 * AVG((f.passed)::int))::numeric, 2)::float AS pass_rate,
                    TRUNC((100.0 * AVG((f.completed OR f.grade_percent IS NOT NULL)::int))::numeric, 2)::float AS completion_rate,
                    COUNT(*)::int AS attempts
                FROM filt f
                WHERE f.grade_percent IS NOT NULL
                GROUP BY f.simulation_id
            ),
            sim_scenarios_seen AS (
                SELECT
                    s.id AS simulation_id,
                    COUNT(DISTINCT scsj.scenario_id)::int AS scenario_count
                FROM simulation_artifact s
                JOIN simulation_scenarios_junction ss_link ON ss_link.simulation_id = s.id
                JOIN scenarios_resource sc ON sc.id = ss_link.scenario_id
                JOIN scenario_scenarios_junction scsj ON scsj.scenarios_id = sc.id
                JOIN scen_seen ss ON ss.scenario_id = scsj.scenario_id
                WHERE EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource fl ON sf.flag_id = fl.id WHERE sf.simulation_id = s.id AND fl.name = 'simulation_active' AND sf.value = TRUE) AND EXISTS (SELECT 1 FROM scenario_flags_junction sf2 JOIN flags_resource fl2 ON sf2.flag_id = fl2.id WHERE sf2.scenario_id = scsj.scenario_id AND fl2.name = 'scenario_active' AND sf2.value = TRUE)
                GROUP BY s.id
            ),
            sim_param_items_seen AS (
                SELECT
                    s.id AS simulation_id,
                    pfr.parameter_id AS parameter_id,
                    pfr.field_id AS parameter_item_id,
                    COUNT(df.chat_id)::int AS cnt
                FROM simulation_artifact s
                JOIN simulation_scenarios_junction ss_link ON ss_link.simulation_id = s.id
                JOIN scenarios_resource sc ON sc.id = ss_link.scenario_id
                JOIN scenario_scenarios_junction scsj ON scsj.scenarios_id = sc.id
                JOIN scen_seen ss ON ss.scenario_id = scsj.scenario_id
                JOIN scenario_parameter_fields_junction spf ON spf.scenario_id = scsj.scenario_id
                JOIN parameter_fields_resource pfr ON pfr.id = spf.parameter_field_id
                JOIN param_ids_categorical pic ON pic.id = pfr.parameter_id
                JOIN mv_dashboard_facts df ON df.scenario_id = scsj.scenario_id
                WHERE EXISTS (SELECT 1 FROM simulation_flags_junction sf3 JOIN flags_resource fl ON sf3.flag_id = fl.id WHERE sf3.simulation_id = s.id AND fl.name = 'simulation_active' AND sf3.value = TRUE) AND EXISTS (SELECT 1 FROM scenario_flags_junction sf2 JOIN flags_resource fl2 ON sf2.flag_id = fl2.id WHERE sf2.scenario_id = scsj.scenario_id AND fl2.name = 'scenario_active' AND sf2.value = TRUE)
                GROUP BY s.id, pfr.parameter_id, pfr.field_id
            ),
            simulation_facts AS (
                SELECT
                    s.id AS simulation_id,
                    (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) AS simulation_title,
                    COALESCE(ROUND(ss.avg_score), 0)::int AS avg_score,
                    COALESCE(ROUND(ss.pass_rate), 0)::int AS pass_rate,
                    COALESCE(ROUND(ss.completion_rate), 0)::int AS completion_rate,
                    COALESCE(ss.attempts, 0) AS total_attempts,
                    COALESCE(sc_seen.scenario_count, 0) AS scenario_count
                FROM simulation_artifact s
                LEFT JOIN sim_summary ss ON ss.simulation_id = s.id
                LEFT JOIN sim_scenarios_seen sc_seen ON sc_seen.simulation_id = s.id
                WHERE EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = s.id AND f.name = 'simulation_active' AND sf.value = TRUE)
                  AND s.id IN (SELECT simulation_id FROM sim_seen)
            ),
            simulation_composition_simulation_facts_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (simulation_id::text, simulation_title, avg_score::float, completion_rate::float, total_attempts, scenario_count)::types.q_get_dashboard_bundle_v4_simulation_fact
                        ORDER BY simulation_id
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_simulation_fact[]
                ) as simulation_facts
                FROM simulation_facts
            ),
            param_facts_cat AS (
                SELECT
                    simulation_id,
                    parameter_id,
                    parameter_item_id,
                    cnt AS scenario_count
                FROM sim_param_items_seen
            ),
            simulation_composition_param_facts_cat_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (simulation_id::text, parameter_id::text, parameter_item_id::text, scenario_count)::types.q_get_dashboard_bundle_v4_simulation_parameter_fact_categorical
                        ORDER BY simulation_id, parameter_id, parameter_item_id
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_simulation_parameter_fact_categorical[]
                ) as simulation_parameter_facts_categorical
                FROM param_facts_cat
            ),
            sim_param_nums_seen AS (
                SELECT
                    NULL::uuid AS simulation_id,
                    NULL::uuid AS parameter_id,
                    NULL::numeric AS most_common_level,
                    0::int AS chat_count
                WHERE false
            ),
            sim_param_nums_most_common AS (
                SELECT
                    simulation_id,
                    parameter_id,
                    most_common_level AS avg_level,
                    CASE
                        WHEN most_common_level = floor(most_common_level) 
                        THEN (most_common_level::int)::text
                        ELSE to_char(most_common_level, 'FM999D0')
                    END AS level_label,
                    chat_count AS scenario_count
                FROM sim_param_nums_seen
            ),
            simulation_composition_param_facts_num_agg AS (
                SELECT COALESCE(
                    ARRAY_AGG(
                        (simulation_id::text, parameter_id::text, avg_level, level_label, scenario_count)::types.q_get_dashboard_bundle_v4_simulation_parameter_fact_numeric
                        ORDER BY simulation_id, parameter_id
                    ),
                    '{}'::types.q_get_dashboard_bundle_v4_simulation_parameter_fact_numeric[]
                ) as simulation_parameter_facts_numeric
                FROM sim_param_nums_most_common
            ),
            simulation_composition_valid_sims AS (
                SELECT COALESCE(
                    ARRAY_AGG(DISTINCT simulation_id::text ORDER BY simulation_id::text),
                    ARRAY[]::text[]
                ) as valid_simulation_ids
                FROM filt
                WHERE simulation_id IS NOT NULL
            ),
            simulation_composition_has_data AS (
                SELECT COUNT(*) > 0 as has_data
                FROM simulation_facts
            ),
            simulation_composition_status AS (
                SELECT CASE
                    WHEN (SELECT COUNT(*) FROM simulation_facts) = 0 THEN 'neutral'::text
                    ELSE 'success'::text
                END as status
            ),
            simulation_composition_combined AS (
                SELECT (
                    (SELECT valid_simulation_ids FROM simulation_composition_valid_sims LIMIT 1),
                    (SELECT simulation_facts FROM simulation_composition_simulation_facts_agg LIMIT 1),
                    (SELECT simulation_parameter_facts_categorical FROM simulation_composition_param_facts_cat_agg LIMIT 1),
                    (SELECT simulation_parameter_facts_numeric FROM simulation_composition_param_facts_num_agg LIMIT 1),
                    (SELECT has_data FROM simulation_composition_has_data LIMIT 1),
                    (SELECT status FROM simulation_composition_status LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_simulation_composition_response as simulation_composition
            ),
            footer_metrics_combined AS (
                SELECT (
                    (SELECT scenario_performance FROM scenario_performance_combined LIMIT 1),
                    (SELECT scenario_stats FROM scenario_stats_combined LIMIT 1),
                    (SELECT simulation_performance FROM simulation_performance_combined LIMIT 1),
                    (SELECT simulation_composition FROM simulation_composition_combined LIMIT 1)
                )::types.q_get_dashboard_bundle_v4_footer_metrics as footer_metrics
            ),
            -- History - placeholder for now (needs conversion from attempt history CTEs)
            history_combined AS (
                SELECT ARRAY[]::types.q_get_dashboard_bundle_v4_attempt_history_row[] as history
            ),
            -- Insights - placeholder for now (needs conversion)
            insights_combined AS (
                SELECT (
                    NULL::text,
                    ARRAY[]::types.q_get_dashboard_bundle_v4_persona_insight[],
                    NULL::text,
                    NULL::text,
                    ARRAY[]::types.q_get_dashboard_bundle_v4_cohort_insight[],
                    NULL::text,
                    NULL::text,
                    NULL::text,
                    NULL::text,
                    NULL::text
                )::types.q_get_dashboard_bundle_v4_insights as insights
            ),
            -- Thresholds
            thresholds_combined AS (
                SELECT COALESCE(
                    (SELECT (success_threshold, warning_threshold, danger_threshold)::types.q_get_dashboard_bundle_v4_thresholds FROM settings_thresholds LIMIT 1),
                    (85, 80, 70)::types.q_get_dashboard_bundle_v4_thresholds
                ) as thresholds
            )
SELECT
    (SELECT actor_name FROM user_profile)::text as actor_name,
    (SELECT header_metrics FROM header_metrics_combined LIMIT 1) as header_metrics,
    (SELECT primary_metrics FROM primary_metrics_combined LIMIT 1) as primary_metrics,
    (SELECT secondary_metrics FROM secondary_metrics_combined LIMIT 1) as secondary_metrics,
    (SELECT footer_metrics FROM footer_metrics_combined LIMIT 1) as footer_metrics,
    (SELECT history FROM history_combined LIMIT 1) as history,
    (SELECT insights FROM insights_combined LIMIT 1) as insights,
    (SELECT thresholds FROM thresholds_combined LIMIT 1) as thresholds,
    (SELECT simulations_array FROM simulations_converted LIMIT 1) as simulations,
    (SELECT rubrics_array FROM rubrics_converted LIMIT 1) as rubrics,
    (SELECT parameters_array FROM parameters_converted LIMIT 1) as parameters,
    (SELECT fields_array FROM fields_converted LIMIT 1) as fields
$$;
