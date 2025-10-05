-- Growth Data Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with chart data, available metrics, and optional window averages
-- This function provides raw data without opinionated growth computations

CREATE OR REPLACE FUNCTION analytics_growth_data_fn(
  p_start        timestamptz,
  p_end          timestamptz,
  p_cohort_ids   uuid[],
  p_roles        profile_role[],
  p_sim_filters  text[],
  p_profile_id   uuid
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH
-- 1) Date spine (daily) — drives consistent x-axis even if a metric is missing that day
spine AS (
  SELECT generate_series(date_trunc('day', p_start)::date,
                         (date_trunc('day', p_end) - interval '1 second')::date,
                         interval '1 day')::date AS d
),

-- 2) Pull each metric's trendData (date text like 'MM/DD', value int, count int)
--    Normalize to a real date by matching the spine via to_char(spine.d,'MM/DD')
avg_score AS (
  SELECT s.d, x.value::int, x.count::int
  FROM spine s
  LEFT JOIN LATERAL (
    SELECT * FROM jsonb_to_recordset(
      (SELECT analytics_average_score_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
    ) AS t(date text, value int, count int)
  ) x ON x.date = to_char(s.d, 'YYYY-MM-DD')
),
pass_rate AS (
  SELECT s.d, x.value::int, x.count::int
  FROM spine s
  LEFT JOIN LATERAL (
    SELECT * FROM jsonb_to_recordset(
      (SELECT analytics_first_attempt_pass_rate_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
    ) AS t(date text, value int, count int)
  ) x ON x.date = to_char(s.d, 'YYYY-MM-DD')
),
completion AS (
  SELECT s.d, x.value::int, x.count::int
  FROM spine s
  LEFT JOIN LATERAL (
    SELECT * FROM jsonb_to_recordset(
      (SELECT analytics_completion_percentage_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
    ) AS t(date text, value int, count int)
  ) x ON x.date = to_char(s.d, 'YYYY-MM-DD')
),
msgs AS (
  SELECT s.d, x.value::int, x.count::int
  FROM spine s
  LEFT JOIN LATERAL (
    SELECT * FROM jsonb_to_recordset(
      (SELECT analytics_messages_per_session_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
    ) AS t(date text, value int, count int)
  ) x ON x.date = to_char(s.d, 'YYYY-MM-DD')
),
resp AS (
  SELECT s.d, x.value::int, x.count::int
  FROM spine s
  LEFT JOIN LATERAL (
    SELECT * FROM jsonb_to_recordset(
      (SELECT analytics_persona_response_times_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
    ) AS t(date text, value int, count int)
  ) x ON x.date = to_char(s.d, 'YYYY-MM-DD')
),
eff AS (
  SELECT s.d, x.value::int, x.count::int
  FROM spine s
  LEFT JOIN LATERAL (
    SELECT * FROM jsonb_to_recordset(
      (SELECT analytics_session_efficiency_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
    ) AS t(date text, value int, count int)
  ) x ON x.date = to_char(s.d, 'YYYY-MM-DD')
),
stagn AS (
  SELECT s.d, x.value::int, x.count::int
  FROM spine s
  LEFT JOIN LATERAL (
    SELECT * FROM jsonb_to_recordset(
      (SELECT analytics_stagnation_rate_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
    ) AS t(date text, value int, count int)
  ) x ON x.date = to_char(s.d, 'YYYY-MM-DD')
),
time_spent AS (
  SELECT s.d, x.value::int, x.count::int
  FROM spine s
  LEFT JOIN LATERAL (
    SELECT * FROM jsonb_to_recordset(
      (SELECT analytics_time_spent_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
    ) AS t(date text, value int, count int)
  ) x ON x.date = to_char(s.d, 'YYYY-MM-DD')
),
attempts AS (
  SELECT s.d, x.value::int, x.count::int
  FROM spine s
  LEFT JOIN LATERAL (
    SELECT * FROM jsonb_to_recordset(
      (SELECT analytics_total_attempts_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
    ) AS t(date text, value int, count int)
  ) x ON x.date = to_char(s.d, 'YYYY-MM-DD')
),

-- 3) UI-ready chart rows (only days with actual data, like header functions)
chart AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'date', to_char(s.d,'YYYY-MM-DD'),
             'averageScore',         a.value,
             'passRate',             p.value,
             'completionRate',       c.value,
             'firstAttemptPassRate', p.value,   -- synonym for pass rate
             'messagesPerSession',   m.value,
             'personaResponseTimes', r.value,
             'sessionEfficiency',    e.value,
             'stagnationRate',       g.value,
             'timeSpent',            CASE WHEN ts.value IS NOT NULL THEN ts.value / 60.0 ELSE NULL END,
             'totalAttempts',        t.value
           )
           ORDER BY s.d
         ) AS payload
  FROM spine s
  LEFT JOIN avg_score   a  ON a.d  = s.d
  LEFT JOIN pass_rate   p  ON p.d  = s.d
  LEFT JOIN completion  c  ON c.d  = s.d
  LEFT JOIN msgs        m  ON m.d  = s.d
  LEFT JOIN resp        r  ON r.d  = s.d
  LEFT JOIN eff         e  ON e.d  = s.d
  LEFT JOIN stagn       g  ON g.d  = s.d
  LEFT JOIN time_spent  ts ON ts.d = s.d
  LEFT JOIN attempts    t  ON t.d  = s.d
  -- Only include days where at least one metric has data (like header functions)
  WHERE a.value IS NOT NULL 
     OR p.value IS NOT NULL 
     OR c.value IS NOT NULL 
     OR m.value IS NOT NULL 
     OR r.value IS NOT NULL 
     OR e.value IS NOT NULL 
     OR g.value IS NOT NULL 
     OR ts.value IS NOT NULL 
     OR t.value IS NOT NULL
),

-- 4) Metric catalog for your GrowthPicker (no opinions, just metadata)
available_metrics AS (
  SELECT jsonb_build_array(
    jsonb_build_object('id','averageScore','name','Average Score','color','#3b82f6','unit','%','description','Average performance score','formatterId','percent'),
    jsonb_build_object('id','passRate','name','Pass Rate','color','#10b981','unit','%','description','Passes on first attempt','formatterId','percent'),
    jsonb_build_object('id','completionRate','name','Completion Rate','color','#22c55e','unit','%','description','Sessions completed','formatterId','percent'),
    jsonb_build_object('id','firstAttemptPassRate','name','First Attempt Pass','color','#0ea5e9','unit','%','description','First try pass rate','formatterId','percent'),
    jsonb_build_object('id','messagesPerSession','name','Messages/Session','color','#f59e0b','unit','msgs','description','Average message count','formatterId','int'),
    jsonb_build_object('id','personaResponseTimes','name','Response Time','color','#a855f7','unit','sec','description','Avg reply latency','formatterId','sec'),
    jsonb_build_object('id','sessionEfficiency','name','Efficiency','color','#8b5cf6','unit','%','description','Score per time proxy','formatterId','percent'),
    jsonb_build_object('id','stagnationRate','name','Stagnation','color','#ef4444','unit','%','description','Stalled sessions share','formatterId','percent'),
    jsonb_build_object('id','timeSpent','name','Time Spent','color','#64748b','unit','min','description','Total time spent (minutes)','formatterId','minutes'),
    jsonb_build_object('id','totalAttempts','name','Total Attempts','color','#14b8a6','unit','attempts','description','Attempt count','formatterId','int')
  ) AS payload
),

-- 5) Optional: Raw window averages for client-side threshold application
win_params AS (
  SELECT 7::int AS n
),

avg_series AS (
  SELECT s.d, COALESCE(a.value,0) AS average_score
  FROM spine s LEFT JOIN avg_score a ON a.d = s.d
  ORDER BY s.d
),
avg_positions AS (
  SELECT
    COUNT(*) AS total_days,
    (SELECT n FROM win_params) AS n
  FROM avg_series
),
avg_windows AS (
  SELECT
    (SELECT AVG(average_score)::numeric FROM avg_series
     WHERE d >  (SELECT max(d) FROM avg_series) - (SELECT make_interval(days => n) FROM win_params)
    ) AS lastn_avg,
    (SELECT AVG(average_score)::numeric FROM avg_series
     WHERE d <= (SELECT max(d) FROM avg_series) - (SELECT make_interval(days => n) FROM win_params)
       AND d >  (SELECT max(d) FROM avg_series) - (SELECT make_interval(days => 2*n) FROM win_params)
    ) AS prevn_avg,
    (SELECT n FROM win_params) AS n
)

SELECT jsonb_build_object(
  'chartData',        COALESCE((SELECT payload FROM chart), '[]'::jsonb),
  'availableMetrics', (SELECT payload FROM available_metrics),
  'windowAverages', jsonb_build_object(
    'averageScore', jsonb_build_object(
        'n', (SELECT n FROM avg_windows),
        'last', COALESCE((SELECT lastn_avg FROM avg_windows), NULL),
        'prev', COALESCE((SELECT prevn_avg FROM avg_windows), NULL)
    )
  )
);
$$;
