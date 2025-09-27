-- Rubric Correlation Heatmap Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId, rubricId
-- Returns: JSON object with correlation matrix, standard groups, available rubrics, insights, and status

CREATE OR REPLACE FUNCTION analytics_rubric_heatmap_fn(
  p_start        timestamptz,
  p_end          timestamptz,
  p_cohort_ids   uuid[],
  p_roles        profile_role[],
  p_sim_filters  text[],
  p_profile_id   uuid,
  p_rubric_id    uuid            -- which rubric to analyze
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH base AS (
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
-- Link latest grades in base to rubric and feedback rows per standard
latest_grade_per_chat AS (
  SELECT scg.*
  FROM simulation_chat_grades scg
  JOIN (
    SELECT simulation_chat_id, MAX(created_at) AS max_created
    FROM simulation_chat_grades
    GROUP BY simulation_chat_id
  ) t ON t.simulation_chat_id = scg.simulation_chat_id AND t.max_created = scg.created_at
  WHERE scg.rubric_id = p_rubric_id
),
fb AS (
  SELECT
    b.profile_id,
    lg.simulation_chat_id AS chat_id,
    sg.id   AS standard_group_id,
    sg.name AS standard_group_name,
    sg.short_name,
    sg.rubric_id,
    scf.total::numeric              AS earned,          -- per standard row
    st.points::numeric              AS possible
  FROM base b
  JOIN latest_grade_per_chat lg
    ON lg.simulation_chat_id = b.chat_id
  JOIN simulation_chat_feedbacks scf
    ON scf.simulation_chat_grade_id = lg.id
  JOIN standards st
    ON st.id = scf.standard_id
  JOIN standard_groups sg
    ON sg.id = st.standard_group_id
),
-- Aggregate to per-profile, per-group percentage
per_profile_group AS (
  SELECT
    profile_id,
    standard_group_id,
    standard_group_name,
    MIN(short_name) AS short_name,
    100.0 * SUM(earned) / NULLIF(SUM(possible),0) AS pct
  FROM fb
  GROUP BY profile_id, standard_group_id, standard_group_name
),
groups AS (
  SELECT sg.id, sg.name, sg.short_name, sg.rubric_id
  FROM standard_groups sg
  WHERE sg.rubric_id = p_rubric_id
  ORDER BY sg.name
),
-- Pairwise join on the same set of profiles to compute corr & n
pairs AS (
  SELECT
    g1.id AS g1, g2.id AS g2
  FROM groups g1 CROSS JOIN groups g2
),
corrs AS (
  SELECT
    p.g1, p.g2,
    COUNT(*)::int                       AS n,
    corr(a.pct, b.pct)                  AS r
  FROM pairs p
  JOIN per_profile_group a ON a.standard_group_id = p.g1
  JOIN per_profile_group b ON b.standard_group_id = p.g2
  AND a.profile_id = b.profile_id
  GROUP BY p.g1, p.g2
),
enriched AS (
  SELECT
    c.g1, c.g2, c.n,
    COALESCE(c.r, 0.0) AS r,
    analytics_p_value_from_r_n(c.r, c.n) AS p_value,
    CASE
      WHEN c.n IS NULL OR c.n < 3 THEN 'No Data'
      WHEN ABS(c.r) >= 0.7 THEN 'Strong'
      WHEN ABS(c.r) >= 0.4 THEN 'Moderate'
      WHEN ABS(c.r) >  0.0 THEN 'Weak'
      ELSE 'No Data'
    END AS strength,
    CASE
      WHEN c.n IS NULL OR c.n < 3 THEN '#e5e7eb'
      WHEN c.r >= 0.0 THEN
        CASE
          WHEN ABS(c.r) >= 0.7 THEN '#10b981'
          WHEN ABS(c.r) >= 0.4 THEN '#34d399'
          ELSE '#a7f3d0'
        END
      ELSE
        CASE
          WHEN ABS(c.r) >= 0.7 THEN '#ef4444'
          WHEN ABS(c.r) >= 0.4 THEN '#f87171'
          ELSE '#fecaca'
        END
    END AS color
  FROM corrs c
),
matrix_json AS (
  SELECT jsonb_agg(row_json ORDER BY row_idx) AS matrix
  FROM (
    SELECT
      ROW_NUMBER() OVER () - 1 AS row_idx,
      jsonb_agg(jsonb_build_object(
        'correlation', COALESCE(e.r, 0.0),
        'pValue',      e.p_value,
        'color',       e.color,
        'strength',    e.strength,
        'dataPoints',  COALESCE(e.n, 0)
      ) ORDER BY g2.name) AS row_json
    FROM groups g1
    JOIN groups g2 ON TRUE
    LEFT JOIN enriched e ON e.g1 = g1.id AND e.g2 = g2.id
    GROUP BY g1.id
  ) t
),
sg_json AS (
  SELECT jsonb_agg(jsonb_build_object(
           'id', id::text,
           'name', name,
           'shortName', short_name,
           'rubricId', rubric_id::text
         ) ORDER BY name) AS standard_groups
  FROM groups
),
rubrics_json AS (
  SELECT jsonb_agg(jsonb_build_object(
           'id', r.id::text,
           'name', r.name,
           'description', r.description,
           'points', r.points,
           'active', r.active
         ) ORDER BY r.name) AS rubrics
  FROM rubrics r
  WHERE r.active = TRUE
),
status AS (
  SELECT
    CASE
      WHEN (SELECT COUNT(*) FROM enriched WHERE n >= 3) = 0 THEN 'neutral'
      WHEN (SELECT AVG(ABS(r)) FROM enriched WHERE n >= 3) >= 0.6 THEN 'success'
      WHEN (SELECT AVG(ABS(r)) FROM enriched WHERE n >= 3) >= 0.35 THEN 'warning'
      ELSE 'danger'
    END AS correlation_status
),
insight AS (
  SELECT
    CASE
      WHEN (SELECT COUNT(*) FROM enriched WHERE n >= 3) = 0 THEN NULL
      ELSE (
        SELECT 'Top pair: "' || g1.name || '" vs "' || g2.name ||
               '" r=' || TO_CHAR(e.r, 'FM0.00') ||
               ' (n=' || e.n || ')' AS txt
        FROM enriched e
        JOIN groups g1 ON g1.id = e.g1
        JOIN groups g2 ON g2.id = e.g2
        WHERE e.n >= 3
        ORDER BY ABS(e.r) DESC, e.n DESC
        LIMIT 1
      )
    END AS txt
)
SELECT jsonb_build_object(
  'matrix',            COALESCE((SELECT matrix FROM matrix_json), '[]'::jsonb),
  'standardGroups',    COALESCE((SELECT standard_groups FROM sg_json), '[]'::jsonb),
  'availableRubrics',  COALESCE((SELECT rubrics FROM rubrics_json), '[]'::jsonb),
  'insights',          (SELECT txt FROM insight),
  'correlationStatus', (SELECT correlation_status FROM status),
  'hasData',           ((SELECT COUNT(*) FROM enriched WHERE n >= 3) > 0)
);
$$;
