-- Leaderboard bundle query - complete leaderboard metrics with all profile data
-- WHERE clause is built dynamically and inserted at {WHERE_CLAUSE} placeholder
-- Parameters are passed from the WHERE clause builder

WITH filt AS (
    SELECT * FROM analytics a WHERE {WHERE_CLAUSE}
),
profile_stats AS (
    SELECT
        f.profile_id,
        p.first_name,
        p.last_name,
        COUNT(*)::int AS total_attempts,
        MAX(f.grade_percent) AS highest_score,
        AVG(f.num_messages_total) AS avg_messages,
        AVG(f.time_taken_seconds / 60.0) AS avg_time
    FROM filt f
    JOIN profiles p ON f.profile_id = p.id
    WHERE f.grade_percent IS NOT NULL
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
)
SELECT json_build_object(
    'data', COALESCE((SELECT json_agg(json_build_object(
        'profileId', profile_id::text,
        'firstName', first_name,
        'lastName', last_name,
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
                'hasData', true,
                'method', 'max',
                'currentValue', ROUND(highest_score)::int,
                'trendData', '[]'::json,
                'dataPoints', '[]'::json,
                'hover', '{}'::json
            ),
            'messagesPerSession', json_build_object(
                'hasData', true,
                'method', 'avg',
                'currentValue', ROUND(avg_messages)::int,
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
                'hasData', true,
                'method', 'avg',
                'currentValue', ROUND(avg_time)::int,
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
    ) ORDER BY highest_score DESC) FROM all_stats), '[]'::json)
) AS result
