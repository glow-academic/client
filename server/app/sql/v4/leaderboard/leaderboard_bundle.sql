-- Leaderboard bundle query - complete leaderboard metrics with all profile data
-- Parameters:
--   $1 = start_date (timestamp) - required
--   $2 = end_date (timestamp) - required
--   $3 = roles (text[] | NULL) - optional role filter
--   $4 = cohort_ids (uuid[] | NULL) - optional cohort filter
-- Note: Simulation type filters (general/practice/archived) are built dynamically by route
--       due to complex conditional logic that's difficult to parameterize

WITH
-- Get colors from active settings (defaults if no settings found)
settings_colors AS (
    SELECT 
        COALESCE(primary_color, '#171717') AS primary_color,
        COALESCE(accent, '#f5f5f5') AS accent
    FROM settings
    WHERE active = true
    LIMIT 1
),
filt AS (
    SELECT * FROM analytics a 
    WHERE a.attempt_created_at >= $1 
      AND a.attempt_created_at < $2
      AND a.is_general = TRUE
      AND ($3::text[] IS NULL OR a.profile_role::text = ANY($3::text[]))
      AND ($4::uuid[] IS NULL OR a.simulation_id IN (
          SELECT DISTINCT s.id
          FROM simulations s
          WHERE s.active = TRUE
            AND (
                EXISTS (
                    SELECT 1 
                    FROM cohort_simulations cs 
                    WHERE cs.simulation_id = s.id 
                      AND cs.cohort_id = ANY($4::uuid[])
                      AND cs.active = TRUE
                )
                OR
                (s.practice_simulation = TRUE 
                 AND NOT EXISTS (
                     SELECT 1 
                     FROM cohort_simulations cs2 
                     WHERE cs2.simulation_id = s.id 
                       AND cs2.active = TRUE
                 ))
            )
      ))
),
profile_stats AS (
    SELECT
        f.profile_id,
        p.first_name,
        p.last_name,
        COUNT(DISTINCT f.attempt_id)::int AS total_attempts,
        MAX(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS highest_score,
        AVG(f.num_messages_total) FILTER (WHERE f.num_messages_total IS NOT NULL) AS avg_messages,
        COALESCE(SUM(LEAST(f.time_taken_seconds / 60.0, 30.0)) FILTER (WHERE f.time_taken_seconds IS NOT NULL), 0.0)::float AS total_time,
        ARRAY_AGG(DISTINCT f.simulation_id) FILTER (WHERE f.simulation_id IS NOT NULL) AS simulation_ids,
        ARRAY_AGG(DISTINCT f.scenario_id) FILTER (WHERE f.scenario_id IS NOT NULL) AS scenario_ids
    FROM filt f
    JOIN profiles p ON f.profile_id = p.id
    GROUP BY f.profile_id, p.first_name, p.last_name
),
-- Persona response times per profile
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
        ROUND(AVG(delta_sec))::int AS avg_response_time
    FROM persona_times
    GROUP BY profile_id
),
-- Improvement rate per day per profile
attempt_grades AS (
    SELECT
        simulation_id,
        attempt_id,
        profile_id,
        MIN(chat_created_at) as first_time,
        MAX(grade_percent) as best_grade
    FROM filt
    WHERE grade_percent IS NOT NULL AND attempt_id IS NOT NULL
    GROUP BY simulation_id, attempt_id, profile_id
),
sim_improvement_rates AS (
    SELECT
        profile_id,
        simulation_id,
        CASE
            WHEN COUNT(*) >= 2 THEN
                ROUND(
                    (MAX(best_grade) - MIN(best_grade)) /
                    GREATEST(1.0,
                        EXTRACT(EPOCH FROM (MAX(first_time) - MIN(first_time))) / 86400.0
                    )
                )::int
            ELSE 0
        END AS improvement_rate
    FROM attempt_grades
    GROUP BY profile_id, simulation_id
),
improvement_per_profile AS (
    SELECT
        profile_id,
        MAX(improvement_rate) AS max_improvement_rate
    FROM sim_improvement_rates
    GROUP BY profile_id
),
-- Perfect score count per profile
perfect_per_profile AS (
    SELECT
        profile_id,
        COUNT(*) AS perfect_count
    FROM filt
    WHERE grade_percent >= 100.0
    GROUP BY profile_id
),
-- Quickest pass per profile
quickest_per_profile AS (
    SELECT
        profile_id,
        MIN(time_taken_seconds / 60.0) AS quickest_minutes
    FROM filt
    WHERE passed = TRUE AND time_taken_seconds IS NOT NULL
    GROUP BY profile_id
),
-- Join all metrics together
all_stats AS (
    SELECT
        ps.*,
        COALESCE(pp.avg_response_time, 0) AS persona_response_time,
        COALESCE(ip.max_improvement_rate, 0) AS improvement_rate,
        COALESCE(pf.perfect_count, 0) AS perfect_count,
        COALESCE(qp.quickest_minutes, 0) AS quickest_pass
    FROM profile_stats ps
    LEFT JOIN persona_per_profile pp ON ps.profile_id = pp.profile_id
    LEFT JOIN improvement_per_profile ip ON ps.profile_id = ip.profile_id
    LEFT JOIN perfect_per_profile pf ON ps.profile_id = pf.profile_id
    LEFT JOIN quickest_per_profile qp ON ps.profile_id = qp.profile_id
),
-- Get all unique simulation IDs for mapping
all_simulation_ids AS (
    SELECT DISTINCT unnest(simulation_ids) AS simulation_id
    FROM profile_stats
    WHERE simulation_ids IS NOT NULL
),
simulation_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'name', s.title,
                'description', COALESCE(s.description, ''),
                'time_limit', COALESCE(
                    (SELECT SUM(stl.time_limit_seconds)
                     FROM scenario_time_limits stl
                     JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
                     WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
                    0
                ),
                'department_ids', CASE 
                    WHEN (SELECT ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at)
                          FROM simulation_departments sd
                          WHERE sd.simulation_id = s.id AND sd.active = true) IS NOT NULL 
                    THEN to_jsonb((SELECT ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at)
                                   FROM simulation_departments sd
                                   WHERE sd.simulation_id = s.id AND sd.active = true))
                    ELSE NULL::jsonb
                END
            )
        ) FILTER (WHERE s.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_simulation_ids asi
    LEFT JOIN simulations s ON s.id = asi.simulation_id
    WHERE s.active = true
),
-- Get all unique scenario IDs for mapping
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) AS scenario_id
    FROM profile_stats
    WHERE scenario_ids IS NOT NULL
),
scenario_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            sc.id::text,
            jsonb_build_object(
                'name', sc.name,
                'description', COALESCE((SELECT ps.problem_statement FROM scenario_problem_statements sps JOIN problem_statements ps ON ps.id = sps.problem_statement_id WHERE sps.scenario_id = sc.id AND sps.active = true ORDER BY sps.created_at DESC, sps.updated_at DESC LIMIT 1), '')
            )
        ) FILTER (WHERE sc.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_scenario_ids asci
    LEFT JOIN scenarios sc ON sc.id = asci.scenario_id
    WHERE sc.active = true
),
-- Get top 25% of profiles by highest score
ranked_stats AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (ORDER BY highest_score DESC) as rank,
        COUNT(*) OVER () as total_count
    FROM all_stats
),
top_25_percent AS (
    SELECT *
    FROM ranked_stats
    WHERE rank <= GREATEST(1, CEIL(total_count * 0.25)::int)
)
SELECT json_build_object(
    'data', COALESCE((SELECT json_agg(json_build_object(
        'profileId', profile_id::text,
        'firstName', first_name,
        'lastName', last_name,
        'simulationIds', COALESCE(simulation_ids, ARRAY[]::uuid[])::text[],
        'scenarioIds', COALESCE(scenario_ids, ARRAY[]::uuid[])::text[],
        'metrics', json_build_object(
            'totalAttempts', json_build_object(
                'hasData', true,
                'method', 'countDistinct',
                'currentValue', total_attempts,
                'trendData', '[]'::json,
                'dataPoints', '[]'::json,
                'hover', '{}'::json
            ),
            'highestScoreAvg', json_build_object(
                'hasData', highest_score IS NOT NULL,
                'method', 'max',
                'currentValue', ROUND(COALESCE(highest_score, 0))::int,
                'trendData', '[]'::json,
                'dataPoints', '[]'::json,
                'hover', '{}'::json
            ),
            'messagesPerSession', json_build_object(
                'hasData', avg_messages IS NOT NULL,
                'method', 'avg',
                'currentValue', ROUND(COALESCE(avg_messages, 0))::int,
                'trendData', '[]'::json,
                'dataPoints', '[]'::json,
                'hover', '{}'::json
            ),
            'personaResponseSeconds', json_build_object(
                'hasData', persona_response_time > 0,
                'method', 'avg',
                'currentValue', persona_response_time,
                'trendData', '[]'::json,
                'dataPoints', '[]'::json,
                'hover', '{}'::json
            ),
            'timeSpentMinutes', json_build_object(
                'hasData', total_time IS NOT NULL AND total_time > 0,
                'method', 'sum',
                'currentValue', ROUND(COALESCE(total_time, 0))::int,
                'trendData', '[]'::json,
                'dataPoints', '[]'::json,
                'hover', '{}'::json
            ),
            'improvementRatePerDay', json_build_object(
                'hasData', improvement_rate > 0,
                'method', 'slope',
                'currentValue', improvement_rate,
                'trendData', '[]'::json,
                'dataPoints', '[]'::json,
                'hover', '{}'::json
            ),
            'perfectScoreCount', json_build_object(
                'hasData', perfect_count > 0,
                'method', 'sum',
                'currentValue', perfect_count,
                'trendData', '[]'::json,
                'dataPoints', '[]'::json,
                'hover', '{}'::json
            ),
            'quickestPassMinutes', json_build_object(
                'hasData', quickest_pass > 0,
                'method', 'min',
                'currentValue', ROUND(quickest_pass)::int,
                'trendData', '[]'::json,
                'dataPoints', '[]'::json,
                'hover', '{}'::json
            )
        )
    ) ORDER BY highest_score DESC) FROM top_25_percent), '[]'::json),
    'simulation_mapping', COALESCE((SELECT mapping FROM simulation_mapping_data LIMIT 1), '{}'::jsonb),
    'scenario_mapping', COALESCE((SELECT mapping FROM scenario_mapping_data LIMIT 1), '{}'::jsonb),
    'primary_color', (SELECT primary_color FROM settings_colors LIMIT 1),
    'accent_color', (SELECT accent FROM settings_colors LIMIT 1)
) AS result
