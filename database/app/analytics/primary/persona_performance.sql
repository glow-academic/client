-- Persona Performance Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId, simulationIds (optional)
-- Returns: JSON object with persona performance data, available simulations, persona colors, and performance status

CREATE OR REPLACE FUNCTION analytics_persona_performance_fn(
  p_start        timestamptz,
  p_end          timestamptz,
  p_cohort_ids   uuid[],
  p_roles        profile_role[],
  p_sim_filters  text[],
  p_profile_id   uuid,
  p_simulation_ids uuid[] DEFAULT NULL  -- optional picker filter
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH filt AS (
  SELECT *
  FROM analytics a
  WHERE a.chat_created_at >= p_start
    AND a.chat_created_at <  p_end
    AND (p_cohort_ids  IS NULL OR a.cohort_ids && p_cohort_ids)
    AND (p_roles       IS NULL OR a.profile_role = ANY (p_roles))
    AND (p_sim_filters IS NULL OR (
          ('general'  = ANY (p_sim_filters) AND a.is_general) OR
          ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
          ('archived' = ANY (p_sim_filters) AND a.is_archived)
        ))
    AND (p_profile_id IS NULL OR a.profile_id = p_profile_id)
    AND (p_simulation_ids IS NULL OR a.simulation_id = ANY(p_simulation_ids))
),
pers AS (
  SELECT s.persona_id, p.name, COALESCE(p.color, '#3b82f6') AS color
  FROM scenarios s
  JOIN personas p ON p.id = s.persona_id
  GROUP BY s.persona_id, p.name, p.color
),
main AS (
  SELECT
    f.persona_id,
    p.name,
    p.color,
    AVG(f.grade_percent)::float AS score,
    COUNT(*)::int               AS sessions
  FROM filt f
  JOIN pers p ON p.persona_id = f.persona_id
  WHERE f.grade_percent IS NOT NULL
  GROUP BY f.persona_id, p.name, p.color
),
trend AS (
  SELECT
    f.persona_id,
    to_char(date_trunc('day', f.chat_created_at),'MM/DD') AS date,
    AVG(f.grade_percent)::float AS score,
    EXTRACT(EPOCH FROM date_trunc('day', f.chat_created_at))::bigint AS ts
  FROM filt f
  WHERE f.grade_percent IS NOT NULL
  GROUP BY f.persona_id, date_trunc('day', f.chat_created_at)
),
chart AS (
  SELECT jsonb_agg(jsonb_build_object(
           'name', m.name,
           'score', ROUND(m.score)::int,
           'sessions', m.sessions,
           'color', m.color,
           'trendData', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                       'date', t.date,
                       'score', ROUND(t.score)::int,
                       'timestamp', t.ts
                     ) ORDER BY t.ts)
              FROM trend t WHERE t.persona_id = m.persona_id
           ), '[]'::jsonb)
         ) ORDER BY m.score DESC NULLS LAST) AS payload
  FROM main m
),
sims AS (
  SELECT jsonb_agg(jsonb_build_object(
           'id', s.id::text,
           'name', s.title,
           'timeLimit', s.time_limit
         ) ORDER BY s.title) AS payload
  FROM simulations s
  WHERE s.active = TRUE
),
color_map AS (
  SELECT jsonb_object_agg(p.name, p.color) AS payload
  FROM (SELECT DISTINCT name, color FROM pers) p
),
status AS (
  SELECT CASE
           WHEN (SELECT COUNT(*) FROM main) = 0 THEN 'neutral'
           WHEN (SELECT AVG(score) FROM main) >= 80 THEN 'success'
           WHEN (SELECT AVG(score) FROM main) >= 60 THEN 'warning'
           ELSE 'danger'
         END AS performance_status
)
SELECT jsonb_build_object(
  'chartData',         COALESCE((SELECT payload FROM chart), '[]'::jsonb),
  'availableSimulations', COALESCE((SELECT payload FROM sims), '[]'::jsonb),
  'personaColors',     COALESCE((SELECT payload FROM color_map), '{}'::jsonb),
  'performanceStatus', (SELECT performance_status FROM status)
);
$$;
