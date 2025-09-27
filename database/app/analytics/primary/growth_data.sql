-- Growth Data Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with chart data, available metrics, growth status, and actionable insights
-- This function reuses existing metric functions to build a comprehensive growth dashboard

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
avg_score AS (
  SELECT * FROM jsonb_to_recordset(
    (SELECT analytics_average_score_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
  ) AS x(date text, value int, count int)
),
pass_rate AS (
  SELECT * FROM jsonb_to_recordset(
    (SELECT analytics_first_attempt_pass_rate_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
  ) AS x(date text, value int, count int)
),
completion AS (
  SELECT * FROM jsonb_to_recordset(
    (SELECT analytics_completion_percentage_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
  ) AS x(date text, value int, count int)
),
msgs AS (
  SELECT * FROM jsonb_to_recordset(
    (SELECT analytics_messages_per_session_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
  ) AS x(date text, value int, count int)
),
resp AS (
  SELECT * FROM jsonb_to_recordset(
    (SELECT analytics_persona_response_times_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
  ) AS x(date text, value int, count int)
),
eff AS (
  SELECT * FROM jsonb_to_recordset(
    (SELECT analytics_session_efficiency_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
  ) AS x(date text, value int, count int)
),
stagn AS (
  SELECT * FROM jsonb_to_recordset(
    (SELECT analytics_stagnation_rate_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
  ) AS x(date text, value int, count int)
),
time_spent AS (
  SELECT * FROM jsonb_to_recordset(
    (SELECT analytics_time_spent_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
  ) AS x(date text, value int, count int)
),
attempts AS (
  SELECT * FROM jsonb_to_recordset(
    (SELECT analytics_total_attempts_fn(p_start,p_end,p_cohort_ids,p_roles,p_sim_filters,p_profile_id)->'trendData')
  ) AS x(date text, value int, count int)
),
-- Full set of day labels
labels AS (
  SELECT DISTINCT date FROM (
    SELECT date FROM avg_score UNION
    SELECT date FROM pass_rate UNION
    SELECT date FROM completion UNION
    SELECT date FROM msgs UNION
    SELECT date FROM resp UNION
    SELECT date FROM eff UNION
    SELECT date FROM stagn UNION
    SELECT date FROM time_spent UNION
    SELECT date FROM attempts
  ) d
),
chart AS (
  SELECT jsonb_agg(jsonb_build_object(
           'date', l.date,
           'averageScore',          COALESCE((SELECT value FROM avg_score   s WHERE s.date=l.date), 0),
           'passRate',              COALESCE((SELECT value FROM pass_rate  s WHERE s.date=l.date), 0),
           'completionRate',        COALESCE((SELECT value FROM completion s WHERE s.date=l.date), 0),
           'firstAttemptPassRate',  COALESCE((SELECT value FROM pass_rate  s WHERE s.date=l.date), 0),
           'messagesPerSession',    COALESCE((SELECT value FROM msgs       s WHERE s.date=l.date), 0),
           'personaResponseTimes',  COALESCE((SELECT value FROM resp       s WHERE s.date=l.date), 0),
           'sessionEfficiency',     COALESCE((SELECT value FROM eff        s WHERE s.date=l.date), 0),
           'stagnationRate',        COALESCE((SELECT value FROM stagn      s WHERE s.date=l.date), 0),
           'timeSpent',             COALESCE((SELECT value FROM time_spent s WHERE s.date=l.date), 0),
           'totalAttempts',         COALESCE((SELECT value FROM attempts   s WHERE s.date=l.date), 0)
         ) ORDER BY to_date(l.date,'MM/DD')) AS payload
  FROM labels l
),
available_metrics AS (
  SELECT jsonb_build_array(
    jsonb_build_object('id','averageScore','name','Average Score','color','#3b82f6','unit','%','description','Average performance score','formatterId','percent'),
    jsonb_build_object('id','passRate','name','Pass Rate','color','#10b981','unit','%','description','Passes on first attempt','formatterId','percent'),
    jsonb_build_object('id','completionRate','name','Completion Rate','color','#22c55e','unit','%','description','Sessions completed','formatterId','percent'),
    jsonb_build_object('id','firstAttemptPassRate','name','First Attempt Pass','color','#0ea5e9','unit','%','description','First try pass rate','formatterId','percent'),
    jsonb_build_object('id','messagesPerSession','name','Messages/Session','color','#f59e0b','unit','msgs','description','Average message count','formatterId','int'),
    jsonb_build_object('id','personaResponseTimes','name','Persona Response','color','#a855f7','unit','sec','description','Avg reply latency','formatterId','sec'),
    jsonb_build_object('id','sessionEfficiency','name','Efficiency','color','#8b5cf6','unit','%','description','Score per time proxy','formatterId','percent'),
    jsonb_build_object('id','stagnationRate','name','Stagnation','color','#ef4444','unit','%','description','Stalled sessions share','formatterId','percent'),
    jsonb_build_object('id','timeSpent','name','Time Spent','color','#64748b','unit','min','description','Total time spent (min)','formatterId','min'),
    jsonb_build_object('id','totalAttempts','name','Total Attempts','color','#14b8a6','unit','attempts','description','Attempt count','formatterId','int')
  ) AS payload
),
status AS (
  -- heuristic: compare last-7 avg score vs previous-7
  WITH a AS (
    SELECT * FROM avg_score
    ORDER BY to_date(date,'MM/DD')
  ),
  last7 AS (SELECT AVG(value) AS v FROM (SELECT value FROM a ORDER BY 1 DESC LIMIT 7) t),
  prev7 AS (SELECT AVG(value) AS v FROM (SELECT value FROM a ORDER BY 1 DESC OFFSET 7 LIMIT 7) t)
  SELECT CASE
           WHEN (SELECT v FROM last7) IS NULL THEN 'neutral'
           WHEN (SELECT v FROM prev7) IS NULL THEN 'neutral'
           WHEN (SELECT v FROM last7) >= (SELECT v FROM prev7) + 5 THEN 'success'
           WHEN (SELECT v FROM last7) >= (SELECT v FROM prev7) - 2 THEN 'warning'
           ELSE 'danger'
         END AS growth_status,
         CASE
           WHEN (SELECT v FROM last7) IS NULL OR (SELECT v FROM prev7) IS NULL THEN NULL
           ELSE 'Avg score moved from ' ||
                COALESCE(ROUND((SELECT v FROM prev7))::int,0) || '% to ' ||
                COALESCE(ROUND((SELECT v FROM last7))::int,0) || '% in the last week'
         END AS insight
)
SELECT jsonb_build_object(
  'chartData',        COALESCE((SELECT payload FROM chart), '[]'::jsonb),
  'availableMetrics', (SELECT payload FROM available_metrics),
  'growthStatus',     (SELECT growth_status FROM status),
  'actionableInsight',(SELECT insight FROM status)
);
$$;
