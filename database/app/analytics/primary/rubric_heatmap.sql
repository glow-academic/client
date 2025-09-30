-- Rubric Correlation Heatmap Analytics Function (Multi-Rubric)
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with matrices for all rubrics, available rubrics, and valid rubric IDs

CREATE OR REPLACE FUNCTION analytics_rubric_heatmap_fn(
  p_start        timestamptz,
  p_end          timestamptz,
  p_cohort_ids   uuid[],
  p_roles        profile_role[],
  p_sim_filters  text[],
  p_profile_id   uuid
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
-- A. Tighten filters & avoid "now()" in the range
WITH base AS MATERIALIZED (
  SELECT chat_id, profile_id, profile_role, cohort_ids, profile_cohort_ids,
         is_general, is_practice, is_archived, simulation_id
  FROM analytics a
  WHERE a.chat_created_at > p_start
    AND a.chat_created_at < p_end                    -- ← drop GREATEST(..., now())
    AND (p_cohort_ids IS NULL OR (a.cohort_ids && p_cohort_ids AND a.profile_cohort_ids && p_cohort_ids))
    AND (p_cohort_ids IS NOT NULL OR p_roles IS NULL OR a.profile_role = ANY(p_roles) OR (p_profile_id IS NOT NULL AND a.profile_id = p_profile_id))
    AND (p_sim_filters IS NULL OR cardinality(p_sim_filters) > 0)
    AND (
      p_sim_filters IS NULL OR (
        ('general'  = ANY (p_sim_filters) AND a.is_general)  OR
        ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
        ('archived' = ANY (p_sim_filters) AND a.is_archived)
      )
    )
    AND (p_profile_id IS NULL OR a.profile_id = p_profile_id)
),
-- B. Pick latest grade per chat **without** joining `base` until the end
latest_grade_per_chat AS MATERIALIZED (
  SELECT DISTINCT ON (scg.simulation_chat_id)
         scg.id,
         scg.simulation_chat_id AS chat_id,
         scg.rubric_id
  FROM simulation_chat_grades scg
  ORDER BY scg.simulation_chat_id, scg.created_at DESC
),
-- C. Pre-aggregate once, with `float8`, and materialize
per_grade_group AS MATERIALIZED (
  SELECT
    lg.chat_id,
    sg.rubric_id,
    sg.id   AS group_id,
    sg.name AS group_name,
    (100.0 * SUM(scf.total)::float8 / NULLIF(SUM(s.points)::float8, 0))::float8 AS pct
  FROM latest_grade_per_chat lg
  JOIN simulation_chat_feedbacks scf ON scf.simulation_chat_grade_id = lg.id
  JOIN standards s          ON s.id = scf.standard_id
  JOIN standard_groups sg   ON sg.id = s.standard_group_id AND sg.rubric_id = lg.rubric_id
  WHERE EXISTS (SELECT 1 FROM base b WHERE b.chat_id = lg.chat_id)  -- semi-join to filtered chats
  GROUP BY lg.chat_id, sg.rubric_id, sg.id, sg.name
),
-- D. Drop the O(G²) `pairs` CTE; self-join on (rubric, chat)
corrs AS MATERIALIZED (
  SELECT
    a.rubric_id,
    a.group_id AS g1,
    b.group_id AS g2,
    COUNT(*) FILTER (WHERE a.pct IS NOT NULL AND b.pct IS NOT NULL) AS n,
    corr(a.pct, b.pct) AS r
  FROM per_grade_group a
  JOIN per_grade_group b
    ON b.rubric_id = a.rubric_id
   AND b.chat_id   = a.chat_id
   AND b.group_id >= a.group_id   -- upper triangle incl. diagonal
  GROUP BY a.rubric_id, a.group_id, b.group_id
),
-- E. Build `groups` from what actually appears
groups AS MATERIALIZED (
  SELECT DISTINCT
    pgg.rubric_id, sg.id, sg.name, sg.short_name
  FROM per_grade_group pgg
  JOIN standard_groups sg ON sg.id = pgg.group_id
),
valid_rubrics AS (
  SELECT DISTINCT rubric_id FROM groups
),
enriched AS (
  SELECT
    c.rubric_id, c.g1, c.g2, c.n,
    CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END AS r,
    CASE WHEN c.r = c.r AND c.n >= 3
         THEN analytics_p_value_from_r_n(c.r, c.n::integer)
         ELSE NULL
    END AS p_value,
    CASE
      WHEN c.n IS NULL OR c.n < 3 THEN 'No Data'
      WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.7 THEN 'Strong'
      WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.4 THEN 'Moderate'
      WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >  0.0 THEN 'Weak'
      ELSE 'No Data'
    END AS strength,
    CASE
      WHEN c.n IS NULL OR c.n < 3 THEN '#e5e7eb'
      WHEN (CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.0 THEN
        CASE
          WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.7 THEN '#10b981'
          WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.4 THEN '#34d399'
          ELSE '#a7f3d0'
        END
      ELSE
        CASE
          WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.7 THEN '#ef4444'
          WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.4 THEN '#f87171'
          ELSE '#fecaca'
        END
    END AS color
  FROM corrs c
),
-- Build matrix per rubric as a JSON object
per_rubric_matrix AS (
  SELECT
    g1.rubric_id,
    ROW_NUMBER() OVER (PARTITION BY g1.rubric_id ORDER BY g1.name) - 1 AS row_idx,
    jsonb_agg(
      jsonb_build_object(
        'rubricId', g1.rubric_id::text,
        'correlation', COALESCE(e.r, 0.0),
        'pValue',      e.p_value,
        'color',       COALESCE(e.color, '#e5e7eb'),
        'strength',    COALESCE(e.strength, 'No Data'),
        'dataPoints',  COALESCE(e.n, 0)
      )
      ORDER BY g2.name
    ) AS row_json
  FROM groups g1
  JOIN groups g2
    ON g2.rubric_id = g1.rubric_id
  LEFT JOIN enriched e
    ON e.rubric_id = g1.rubric_id AND e.g1 = g1.id AND e.g2 = g2.id
  GROUP BY g1.rubric_id, g1.id, g1.name
),
matrix_json AS (
  SELECT rubric_id, jsonb_agg(row_json ORDER BY row_idx) AS matrix
  FROM per_rubric_matrix
  GROUP BY rubric_id
),
sg_json AS (
  SELECT rubric_id,
         jsonb_agg(jsonb_build_object(
           'id', id::text,
           'name', name,
           'shortName', short_name,
           'rubricId', rubric_id::text
         ) ORDER BY name) AS standard_groups
  FROM groups
  GROUP BY rubric_id
),
insights AS (
  SELECT
    e.rubric_id,
    CASE
      WHEN COALESCE(SUM(CASE WHEN e.n >= 3 THEN 1 ELSE 0 END),0) = 0 THEN NULL
      ELSE (
        SELECT 'Top pair: "' || g1.name || '" vs "' || g2.name ||
               '" r=' || TO_CHAR(e2.r, 'FM0.00') ||
               ' (n=' || e2.n || ')' AS txt
        FROM enriched e2
        JOIN groups g1 ON g1.id = e2.g1 AND g1.rubric_id = e2.rubric_id
        JOIN groups g2 ON g2.id = e2.g2 AND g2.rubric_id = e2.rubric_id
        WHERE e2.rubric_id = e.rubric_id AND e2.n >= 3
        ORDER BY ABS(e2.r) DESC, e2.n DESC
        LIMIT 1
      )
    END AS txt
  FROM enriched e
  GROUP BY e.rubric_id
),
has_data AS (
  SELECT rubric_id,
         (SUM(CASE WHEN n >= 3 THEN 1 ELSE 0 END) > 0) AS has_data
  FROM enriched
  GROUP BY rubric_id
),
-- Pack per-rubric objects
per_rubric AS (
  SELECT
    r.rubric_id,
    COALESCE(m.matrix, '[]'::jsonb)          AS matrix,
    COALESCE(sg.standard_groups, '[]'::jsonb) AS standard_groups,
    (SELECT txt FROM insights i WHERE i.rubric_id = r.rubric_id) AS insights,
    (SELECT h.has_data FROM has_data h WHERE h.rubric_id = r.rubric_id) AS has_data
  FROM valid_rubrics r
  LEFT JOIN matrix_json m ON m.rubric_id = r.rubric_id
  LEFT JOIN sg_json sg ON sg.rubric_id = r.rubric_id
),
valid_rubric_ids AS (
  SELECT jsonb_agg(rubric_id::text ORDER BY rubric_id::text) AS payload
  FROM valid_rubrics
)
SELECT jsonb_build_object(
  -- Multi-rubric payload
  'matrices', COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
               'rubricId', pr.rubric_id::text,
               'standardGroups', pr.standard_groups,
               'matrix', pr.matrix,
               'insights', pr.insights,
               'hasData', COALESCE(pr.has_data, FALSE)
             ) ORDER BY pr.rubric_id::text)
      FROM per_rubric pr
    ),
    '[]'::jsonb
  ),
  'validRubricIds',    COALESCE((SELECT payload FROM valid_rubric_ids), '[]'::jsonb)
);
$$;