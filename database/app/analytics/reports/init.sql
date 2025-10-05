-- All-in-one reports bundle; one call feeds your Reports page
CREATE OR REPLACE FUNCTION analytics_reports_bundle_fn(
  p_start        timestamptz,
  p_end          timestamptz,
  p_cohort_ids   uuid[],
  p_roles        profile_role[],
  p_sim_filters  text[],              -- e.g. ['general'] or ['general','practice','archived']
  p_profile_id   uuid
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH params AS (
  SELECT
    COALESCE(p_cohort_ids, '{}')              AS cohort_ids,
    COALESCE(p_roles, '{}')                   AS roles,
    COALESCE(p_sim_filters, ARRAY['general']) AS sim_filters,
    p_start                                   AS start_at,
    p_end                                     AS end_at,
    'general'  = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_general,
    'practice' = ANY (COALESCE(p_sim_filters, ARRAY['practice'])) AS want_practice,
    'archived' = ANY (COALESCE(p_sim_filters, ARRAY['archived'])) AS want_archived
),
-- Build roster of all profiles that match the filters (regardless of activity)
roster AS (
  SELECT DISTINCT p.id AS profile_id
  FROM profiles p
  CROSS JOIN params params
  LEFT JOIN cohorts c ON c.id = ANY(params.cohort_ids)
  WHERE
    (cardinality(params.roles) = 0 OR p.role = ANY(params.roles)) AND
    (cardinality(params.cohort_ids) = 0 OR p.id = ANY(c.profile_ids)) AND
    (p_profile_id IS NULL OR p.id = p_profile_id)
),
profiles_set AS (
  SELECT DISTINCT profile_id AS pid FROM roster
),
-- Helper: compute mean/median/mode for a jsonb array of points with numeric "value"
-- We do this per-metric, per-profile via LATERAL; this CTE is just a template note
dummy AS (SELECT 1)
SELECT jsonb_build_object(
  'data', COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'profileId', pid::text,
        'metrics', jsonb_build_object(
          -- 1) Average Score
          'averageScore', (
            WITH m AS (
              SELECT analytics_average_score_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid) AS j
            ),
            pts AS (
              SELECT (e->>'value')::numeric AS v
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            stats AS (
              SELECT
                ROUND(AVG(v))::int AS mean,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v)::int AS median,
                (SELECT v::int FROM (
                    SELECT v, COUNT(*) c, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, v DESC) r
                    FROM pts GROUP BY v
                ) x WHERE r=1 LIMIT 1) AS mode
              FROM pts
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','avg'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'mean', COALESCE((SELECT mean FROM stats),0),
                'median', COALESCE((SELECT median FROM stats),0),
                'mode', COALESCE((SELECT mode FROM stats),0)
              )
            ) FROM m
          ),

          -- 2) Completion %
          'completionPercentage', (
            WITH m AS (
              SELECT analytics_completion_percentage_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid) AS j
            ),
            pts AS (
              SELECT (e->>'value')::int AS bin
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            stats AS (
              SELECT
                SUM(bin) AS completed,
                COUNT(*) AS total,
                CASE WHEN COUNT(*)>0 THEN ROUND(100.0 * SUM(bin)::numeric / COUNT(*))::int ELSE 0 END AS percent
              FROM pts
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','rate'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'completed', COALESCE((SELECT completed FROM stats),0),
                'total',     COALESCE((SELECT total FROM stats),0),
                'percent',   COALESCE((SELECT percent FROM stats),0)
              )
            ) FROM m
          ),

          -- 3) First Attempt Pass Rate
          'firstAttemptPassRate', (
            WITH m AS (
              SELECT analytics_first_attempt_pass_rate_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid) AS j
            ),
            pts AS (
              SELECT (e->>'value')::int AS bin
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            stats AS (
              SELECT
                SUM(bin) AS passed,
                COUNT(*) AS total,
                CASE WHEN COUNT(*)>0 THEN ROUND(100.0 * SUM(bin)::numeric / COUNT(*))::int ELSE 0 END AS percent
              FROM pts
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','rate'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'passed',  COALESCE((SELECT passed FROM stats),0),
                'total',   COALESCE((SELECT total FROM stats),0),
                'percent', COALESCE((SELECT percent FROM stats),0)
              )
            ) FROM m
          ),

          -- 4) Highest Score (plus top list)
          'highestScore', (
            WITH m AS (
              SELECT analytics_highest_score_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid) AS j
            ),
            pts AS (
              SELECT ROUND((e->>'value')::numeric)::int AS v
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            top3 AS (
              SELECT ARRAY(
                SELECT v FROM pts ORDER BY v DESC LIMIT 3
              ) AS arr
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','max'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object('top', COALESCE((SELECT to_jsonb(arr) FROM top3), '[]'::jsonb))
            ) FROM m
          ),

          -- 5) Messages per Session
          'messagesPerSession', (
            WITH m AS (
              SELECT analytics_messages_per_session_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid) AS j
            ),
            pts AS (
              SELECT (e->>'value')::int AS v
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            stats AS (
              SELECT
                ROUND(AVG(v))::int AS mean,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v)::int AS median,
                COUNT(*) AS count
              FROM pts
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','avg'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'mean',   COALESCE((SELECT mean FROM stats),0),
                'median', COALESCE((SELECT median FROM stats),0),
                'count',  COALESCE((SELECT count FROM stats),0)
              )
            ) FROM m
          ),

          -- 6) Persona Response Times (seconds)
          'personaResponseTimes', (
            WITH m AS (
              SELECT analytics_persona_response_times_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid) AS j
            ),
            pts AS (
              SELECT (e->>'value')::int AS v
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            stats AS (
              SELECT
                ROUND(AVG(v))::int AS meanSeconds,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v)::int AS medianSeconds,
                COUNT(*) AS samples
              FROM pts
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','avg'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'meanSeconds',   COALESCE((SELECT meanSeconds FROM stats),0),
                'medianSeconds', COALESCE((SELECT medianSeconds FROM stats),0),
                'samples',       COALESCE((SELECT samples FROM stats),0)
              )
            ) FROM m
          ),

          -- 7) Session Efficiency (hover mirrors your UI fields)
          'sessionEfficiency', (
            WITH m AS (
              SELECT analytics_session_efficiency_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid) AS j
            ),
            pts AS (
              SELECT (e->>'value')::int AS eff
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            stats AS (
              SELECT ROUND(AVG(eff)::numeric,1) AS efficiency
              FROM pts
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','avg'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'avgScorePercent', 0,  -- you can enrich via a dedicated inner calc if desired
                'avgMinutes', 0,
                'efficiency', COALESCE((SELECT efficiency FROM stats),0)
              )
            ) FROM m
          ),

          -- 8) Stagnation Rate
          'stagnationRate', (
            WITH m AS (
              SELECT analytics_stagnation_rate_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid) AS j
            ),
            pts AS (
              SELECT (e->>'value')::int AS bin
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            stats AS (
              SELECT
                COUNT(*) AS tracked,
                SUM(bin) AS stagnant,
                CASE WHEN COUNT(*)>0 THEN ROUND(100.0 * SUM(bin)::numeric / COUNT(*))::int ELSE 0 END AS ratePercent
              FROM pts
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','rate'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'tracked',     COALESCE((SELECT tracked FROM stats),0),
                'stagnant',    COALESCE((SELECT stagnant FROM stats),0),
                'ratePercent', COALESCE((SELECT ratePercent FROM stats),0)
              )
            ) FROM m
          ),

          -- 9) Time Spent (seconds)
          'timeSpent', (
            WITH m AS (
              SELECT analytics_time_spent_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid) AS j
            ),
            pts AS (
              SELECT (e->>'value')::int AS secs
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            by_attempt AS (
              SELECT (e->>'attemptId')::text AS attempt_id, (e->>'value')::int AS secs
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'attemptId' AND e ? 'value'
            ),
            agg_attempt AS (
              SELECT attempt_id, SUM(secs) AS secs
              FROM by_attempt
              GROUP BY attempt_id
            ),
            stats AS (
              SELECT
                CASE WHEN COUNT(*)>0 THEN ROUND(AVG(secs)/60.0)::int ELSE 0 END AS avgChatMinutes
              FROM pts
            ),
            stats2 AS (
              SELECT
                CASE WHEN COUNT(*)>0 THEN ROUND(AVG(secs)/60.0)::int ELSE 0 END AS avgSessionMinutes
              FROM agg_attempt
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','sum'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'avgSessionMinutes', COALESCE((SELECT avgSessionMinutes FROM stats2),0),
                'avgChatMinutes',    COALESCE((SELECT avgChatMinutes    FROM stats ),0),
                'avgOverallMinutes', COALESCE((SELECT avgSessionMinutes FROM stats2),0)
              )
            ) FROM m
          ),

          -- 10) Total Attempts (+ hover derived from its dataPoints)
          'totalAttempts', (
            WITH m AS (
              SELECT analytics_total_attempts_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid) AS j
            ),
            pts AS (
              SELECT (e->>'attemptId')::text AS attempt_id,
                     (e->>'simulationId')::text AS simulation_id
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'attemptId'
            ),
            stats AS (
              SELECT COUNT(DISTINCT attempt_id) AS attempts,
                     COUNT(DISTINCT simulation_id) AS uniqueSimulations,
                     CASE WHEN COUNT(DISTINCT simulation_id)>0
                          THEN ROUND((COUNT(DISTINCT attempt_id)::numeric / COUNT(DISTINCT simulation_id)),1)
                          ELSE 0 END AS perSimulationMean
              FROM pts
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','countDistinct'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'attempts',         COALESCE((SELECT attempts FROM stats),0),
                'uniqueSimulations',COALESCE((SELECT uniqueSimulations FROM stats),0),
                'perSimulationMean',COALESCE((SELECT perSimulationMean FROM stats),0)
              )
            ) FROM m
          )
        )
      )
    ) FILTER (WHERE pid IS NOT NULL),
    '[]'::jsonb
  )
)
FROM (
  -- final profile set: provided profile OR discovered from roster
  SELECT DISTINCT
    CASE
      WHEN p_profile_id IS NOT NULL THEN p_profile_id
      ELSE r.profile_id
    END AS pid
  FROM roster r
  WHERE p_profile_id IS NULL OR r.profile_id = p_profile_id
) profs;
$$;
