-- Improvement per Day Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- What it is: Maximum improvement rate per day across all simulations for a user
-- Method: max (client computes max of improvement rates per simulation, rounded to integer)

CREATE OR REPLACE FUNCTION analytics_improvement_per_day_fn(
  p_start           timestamptz,
  p_end             timestamptz,
  p_cohort_ids      uuid[],
  p_roles           profile_role[],
  p_sim_filters     text[],
  p_profile_id      uuid,
  p_department_ids  uuid[]
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH filt AS (
  SELECT *
  FROM analytics a
  WHERE a.chat_created_at >= p_start
    AND a.chat_created_at <  p_end
    AND (cardinality(p_department_ids) = 0 OR a.department_id = ANY(p_department_ids))
    AND (p_cohort_ids  IS NULL OR a.cohort_ids && p_cohort_ids)
    AND (p_roles       IS NULL OR a.profile_role = ANY (p_roles))
    AND (p_sim_filters IS NULL OR (
          ('general'  = ANY (p_sim_filters) AND a.is_general) OR
          ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
          ('archived' = ANY (p_sim_filters) AND a.is_archived)
        ))
    AND (p_profile_id IS NULL OR a.profile_id = p_profile_id)
),
-- Get attempts by simulation with grades and timestamps
attempts_by_sim AS (
  SELECT 
    a.simulation_id,
    a.attempt_id,
    a.profile_id,
    a.chat_created_at,
    a.grade_percent
  FROM filt a
  WHERE a.grade_percent IS NOT NULL
    AND a.attempt_id IS NOT NULL
),
-- Group by simulation and attempt to get the best grade per attempt
attempt_grades AS (
  SELECT 
    simulation_id,
    attempt_id,
    profile_id,
    MIN(chat_created_at) as first_time,
    MAX(grade_percent) as best_grade
  FROM attempts_by_sim
  GROUP BY simulation_id, attempt_id, profile_id
),
-- Calculate improvement rate per simulation
sim_rates AS (
  SELECT 
    simulation_id,
    profile_id,
    CASE 
      WHEN COUNT(*) >= 2 THEN
        -- Calculate improvement rate: (best_last_grade - best_first_grade) / days
        ROUND(
          (MAX(best_grade) - MIN(best_grade)) / 
          GREATEST(1.0, 
            EXTRACT(EPOCH FROM (MAX(first_time) - MIN(first_time))) / 86400.0
          )
        )::int
      ELSE 0
    END AS improvement_rate
  FROM attempt_grades
  GROUP BY simulation_id, profile_id
),
-- Get the maximum improvement rate per profile
max_rates AS (
  SELECT 
    profile_id,
    COALESCE(MAX(improvement_rate), 0) AS max_improvement_rate
  FROM sim_rates
  GROUP BY profile_id
),
-- For trend data, use daily averages (simplified)
by_day AS (
  SELECT
    to_char(date_trunc('day', chat_created_at), 'MM/DD') AS date,
    avg(grade_percent)::float AS value,
    count(*)::int AS count
  FROM filt
  WHERE grade_percent IS NOT NULL
  GROUP BY 1
),
cur AS (
  SELECT (SELECT count(*) > 0 FROM filt WHERE grade_percent IS NOT NULL) AS has_data
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId', profile_id::text,
           'value', max_improvement_rate,
           'count', 1
         ) ORDER BY profile_id) AS payload
  FROM max_rates
)
SELECT jsonb_build_object(
  'hasData',    COALESCE((SELECT has_data FROM cur), false),
  'method',     'max',
  'trendData',  COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'date',  date,
                    'value', round(value)::int,
                    'count', count
                  ) ORDER BY date)
                  FROM by_day), '[]'::jsonb),
  'dataPoints', COALESCE((SELECT payload FROM data_points), '[]'::jsonb),
  'hover', jsonb_build_object(
    'maxRate', COALESCE((SELECT max(max_improvement_rate) FROM max_rates), 0)
  )
);
$$;
