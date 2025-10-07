-- Analytics Leaderboard Bundle Function
-- Returns all leaderboard metrics by calling individual functions
-- Similar to reports bundle but for leaderboard data

CREATE OR REPLACE FUNCTION analytics_leaderboard_bundle_fn(
  p_start        timestamptz,
  p_end          timestamptz,
  p_cohort_ids   uuid[],
  p_roles        profile_role[],
  p_sim_filters  text[],              -- e.g. ['general'] or ['general','practice','archived']
  p_profile_id   uuid,
  p_department_ids uuid[]
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
        'firstName', COALESCE(p.first_name, ''),
        'lastName', COALESCE(p.last_name, ''),
        'metrics', jsonb_build_object(
          -- 1) Total Attempts (count distinct attempts per profile)
          'totalAttempts', (
            WITH m AS (
              SELECT analytics_total_attempts_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid, p_department_ids) AS j
            ),
            pts AS (
              SELECT (e->>'attemptId')::text AS attempt_id
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'attemptId'
            ),
            stats AS (
              SELECT COUNT(DISTINCT attempt_id) AS attempts
              FROM pts
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','countDistinct'),
              'keyField', 'attemptId',
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'attempts', COALESCE((SELECT attempts FROM stats),0)
              )
            ) FROM m
          ),

          -- 2) Highest Score Average
          'highestScoreAvg', (
            WITH m AS (
              SELECT analytics_highest_score_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid, p_department_ids) AS j
            ),
            pts AS (
              SELECT ROUND((e->>'value')::numeric)::int AS v
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
              'method',  COALESCE(m.j->>'method','max'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'mean', COALESCE((SELECT mean FROM stats),0),
                'median', COALESCE((SELECT median FROM stats),0),
                'mode', COALESCE((SELECT mode FROM stats),0)
              )
            ) FROM m
          ),

          -- 3) Messages per Session
          'messagesPerSession', (
            WITH m AS (
              SELECT analytics_messages_per_session_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid, p_department_ids) AS j
            ),
            pts AS (
              SELECT (e->>'value')::int AS v
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            stats AS (
              SELECT
                ROUND(AVG(v) - 0.0001)::int AS mean,
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

          -- 4) Persona Response Times (seconds)
          'personaResponseSeconds', (
            WITH m AS (
              SELECT analytics_persona_response_times_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid, p_department_ids) AS j
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

          -- 5) Time Spent (minutes)
          'timeSpentMinutes', (
            WITH m AS (
              SELECT analytics_time_spent_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid, p_department_ids) AS j
            ),
            pts AS (
              SELECT (e->>'value')::numeric AS minutes
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            stats AS (
              SELECT
                CASE WHEN COUNT(*)>0 THEN ROUND(AVG(minutes))::int ELSE 0 END AS avgMinutes
              FROM pts
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','sum'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'avgMinutes', COALESCE((SELECT avgMinutes FROM stats),0)
              )
            ) FROM m
          ),

          -- 6) Improvement Rate per Day
          'improvementRatePerDay', (
            WITH m AS (
              SELECT analytics_improvement_per_day_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid, p_department_ids) AS j
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','max'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', COALESCE(m.j->'hover', jsonb_build_object('maxRate', 0))
            ) FROM m
          ),

          -- 7) Perfect Score Count
          'perfectScoreCount', (
            WITH m AS (
              SELECT analytics_perfect_scores_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid, p_department_ids) AS j
            ),
            pts AS (
              SELECT (e->>'value')::int AS count
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            stats AS (
              SELECT
                SUM(count) AS totalPerfect,
                COUNT(*) AS sessions
              FROM pts
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','sum'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'totalPerfect', COALESCE((SELECT totalPerfect FROM stats),0),
                'sessions',     COALESCE((SELECT sessions FROM stats),0)
              )
            ) FROM m
          ),

          -- 8) Quickest Pass (minutes)
          'quickestPassMinutes', (
            WITH m AS (
              SELECT analytics_quickest_pass_fn(p_start, p_end, p_cohort_ids, p_roles, p_sim_filters, pid, p_department_ids) AS j
            ),
            pts AS (
              SELECT (e->>'value')::numeric AS minutes
              FROM m, LATERAL jsonb_array_elements(j->'dataPoints') e
              WHERE e ? 'value'
            ),
            stats AS (
              SELECT
                MIN(minutes) AS quickest,
                AVG(minutes) AS avgTime,
                COUNT(*) AS attempts
              FROM pts
            )
            SELECT jsonb_build_object(
              'hasData', COALESCE((m.j->>'hasData')::boolean, false),
              'method',  COALESCE(m.j->>'method','min'),
              'trendData', COALESCE(m.j->'trendData','[]'::jsonb),
              'dataPoints', COALESCE(m.j->'dataPoints','[]'::jsonb),
              'hover', jsonb_build_object(
                'quickest', COALESCE((SELECT quickest FROM stats),0),
                'avgTime',  COALESCE((SELECT avgTime FROM stats),0),
                'attempts', COALESCE((SELECT attempts FROM stats),0)
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
) profs
LEFT JOIN profiles p ON profs.pid = p.id;
$$;
