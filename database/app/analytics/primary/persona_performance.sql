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
/* -------- Params and flags -------- */
WITH params AS (
  SELECT
    COALESCE(p_cohort_ids, '{}')               AS cohort_ids,
    COALESCE(p_roles, '{}')                    AS roles,
    COALESCE(p_sim_filters, ARRAY['general'])  AS sim_filters,
    p_profile_id                               AS profile_id,
    p_start                                    AS start_at,
    p_end                                      AS end_at,
    'general'  = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_general,
    'practice' = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_practice,
    'archived' = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_archived
),
want AS (
  SELECT
    want_general, want_practice, want_archived,
    (want_general OR want_practice) AS want_nonarchived_or_any
  FROM params
),

/* -------- Base selection from analytics (chat date window) -------- */
base_general AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_general
    AND a.is_general = TRUE
    AND a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
base_practice AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_practice
    AND a.is_practice = TRUE
    AND a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
base_union AS MATERIALIZED (
  SELECT * FROM base_general
  UNION ALL
  SELECT * FROM base_practice
),

/* -------- Archived tri-state -------- */
base_archived AS MATERIALIZED (
  SELECT bu.*
  FROM base_union bu
  CROSS JOIN want w
  WHERE
    CASE
      WHEN w.want_archived AND w.want_nonarchived_or_any THEN TRUE
      WHEN w.want_archived AND NOT w.want_nonarchived_or_any THEN bu.is_archived = TRUE
      WHEN NOT w.want_archived AND w.want_nonarchived_or_any THEN bu.is_archived = FALSE
      ELSE FALSE
    END
),

/* -------- Cohort scoping (if passed) -------- */
cohort_scoped AS MATERIALIZED (
  SELECT b.*
  FROM base_archived b
  CROSS JOIN params pr
  WHERE cardinality(pr.cohort_ids) = 0
     OR (b.cohort_ids && pr.cohort_ids AND b.profile_cohort_ids && pr.cohort_ids)
),

filtered_chats AS MATERIALIZED (
  SELECT DISTINCT chat_id
  FROM cohort_scoped
  WHERE chat_id IS NOT NULL
),
persona_ids AS MATERIALIZED (
  SELECT DISTINCT persona_id
  FROM cohort_scoped
  WHERE persona_id IS NOT NULL
),

filt AS (
  SELECT * FROM cohort_scoped
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
-- latest grade per chat (same chat may have multiple grades; we want each event)
grade_events AS (
  SELECT
    scg.id                AS grade_id,
    b.persona_id,
    b.simulation_id,
    b.chat_id,
    scg.created_at        AS grade_at,
    (CASE WHEN r.points > 0 THEN (scg.score::numeric / r.points::numeric) * 100.0 END) AS pct
  FROM simulation_chat_grades scg
  JOIN filtered_chats fc ON fc.chat_id = scg.simulation_chat_id
  JOIN analytics b ON b.chat_id = scg.simulation_chat_id
  JOIN rubrics r   ON r.id = scg.rubric_id
),
trend AS (
  SELECT
    g.persona_id,
    g.simulation_id,
    to_char(date_trunc('day', g.grade_at),'YYYY-MM-DD') AS date,
    g.pct::float                                        AS score,
    (EXTRACT(EPOCH FROM g.grade_at)*1000)::bigint       AS ts
  FROM grade_events g
  WHERE g.pct IS NOT NULL
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
