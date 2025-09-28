-- Persona Performance Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with persona performance data, available simulations, and persona colors
-- This function provides raw data without opinionated performance computations

CREATE OR REPLACE FUNCTION analytics_persona_performance_fn(
  p_start        timestamptz,
  p_end          timestamptz,
  p_cohort_ids   uuid[],
  p_roles        profile_role[],
  p_sim_filters  text[],
  p_profile_id   uuid
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
),
-- Only personas that actually appear in the filtered rows
persona_ids AS (
  SELECT DISTINCT f.persona_id
  FROM filt f
  WHERE f.persona_id IS NOT NULL
),
pers AS (
  SELECT pi.persona_id, p.name, COALESCE(p.color, '#3b82f6') AS color
  FROM persona_ids pi
  JOIN personas p ON p.id = pi.persona_id
),
-- Aggregate persona-level summary
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
-- Distinct sim ids per persona (for quick filter UI)
persona_sim_ids AS (
  SELECT f.persona_id, array_agg(DISTINCT f.simulation_id::text ORDER BY f.simulation_id::text) AS sim_ids
  FROM filt f
  GROUP BY f.persona_id
),
-- Daily trend per persona *and simulation*
trend AS (
  SELECT
    f.persona_id,
    f.simulation_id,
    to_char(date_trunc('day', f.chat_created_at),'MM/DD') AS date,
    AVG(f.grade_percent)::float AS score,
    EXTRACT(EPOCH FROM date_trunc('day', f.chat_created_at))::bigint AS ts
  FROM filt f
  GROUP BY f.persona_id, f.simulation_id, date_trunc('day', f.chat_created_at)
),
chart AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'name',     m.name,
             'score',    ROUND(m.score)::int,
             'sessions', m.sessions,
             'color',    m.color,
             'simulationIds', COALESCE(ps.sim_ids, ARRAY[]::text[]),
             'trendData', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                         'date', t.date,
                         'score', ROUND(t.score)::int,
                         'timestamp', t.ts,
                         'simulationId', t.simulation_id::text
                       ) ORDER BY t.ts)
                FROM trend t
                WHERE t.persona_id = m.persona_id
             ), '[]'::jsonb)
           )
           ORDER BY m.score DESC NULLS LAST
         ) AS payload
  FROM main m
  LEFT JOIN persona_sim_ids ps ON ps.persona_id = m.persona_id
),
-- Valid simulation IDs that have data in filtered rows
valid_sim_ids AS (
  SELECT DISTINCT f.simulation_id
  FROM filt f
  WHERE f.simulation_id IS NOT NULL
),
sim_id_array AS (
  SELECT jsonb_agg(vsi.simulation_id::text ORDER BY vsi.simulation_id::text) AS payload
  FROM valid_sim_ids vsi
),
color_map AS (
  SELECT jsonb_object_agg(p.name, p.color) AS payload
  FROM (SELECT DISTINCT name, color FROM pers) p
)
SELECT jsonb_build_object(
  'chartData',            COALESCE((SELECT payload FROM chart), '[]'::jsonb),
  'validSimulationIds',   COALESCE((SELECT payload FROM sim_id_array), '[]'::jsonb),
  'personaColors',        COALESCE((SELECT payload FROM color_map), '{}'::jsonb)
);
$$;
