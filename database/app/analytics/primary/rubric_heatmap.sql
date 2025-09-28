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
-- Latest grade chosen per chat (whatever rubric it used)
latest_grade_per_chat AS (
  SELECT DISTINCT ON (scg.simulation_chat_id)
         scg.id,
         scg.simulation_chat_id,
         scg.rubric_id,
         scg.created_at
  FROM simulation_chat_grades scg
  JOIN base b ON b.chat_id = scg.simulation_chat_id
  ORDER BY scg.simulation_chat_id, scg.created_at DESC
),
fb AS (
  SELECT
    b.profile_id,
    lg.simulation_chat_id AS chat_id,
    sg.id   AS standard_group_id,
    sg.name AS standard_group_name,
    sg.short_name,
    sg.rubric_id,
    scf.total::numeric AS earned,           -- per standard row
    st.points::numeric AS possible
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
-- Aggregate to per-profile, per-(rubric, group) percentage
per_profile_group AS (
  SELECT
    profile_id,
    rubric_id,
    standard_group_id,
    standard_group_name,
    MIN(short_name) AS short_name,
    100.0 * SUM(earned) / NULLIF(SUM(possible),0) AS pct
  FROM fb
  GROUP BY profile_id, rubric_id, standard_group_id, standard_group_name
),
-- Only groups that actually appear for a rubric
groups AS (
  SELECT DISTINCT
    ppg.rubric_id,
    sg.id,
    sg.name,
    sg.short_name
  FROM per_profile_group ppg
  JOIN standard_groups sg ON sg.id = ppg.standard_group_id
  ORDER BY ppg.rubric_id, sg.name
),
valid_rubrics AS (
  SELECT DISTINCT rubric_id FROM groups
),
-- Pair grid per rubric
pairs AS (
  SELECT g1.rubric_id, g1.id AS g1, g2.id AS g2
  FROM groups g1
  JOIN groups g2 ON g2.rubric_id = g1.rubric_id
),
corrs AS (
  SELECT
    p.rubric_id,
    p.g1, p.g2,
    COUNT(*) FILTER (WHERE a.pct IS NOT NULL AND b.pct IS NOT NULL)::int AS n,
    corr(a.pct, b.pct) AS r
  FROM pairs p
  JOIN per_profile_group a
    ON a.rubric_id = p.rubric_id AND a.standard_group_id = p.g1
  JOIN per_profile_group b
    ON b.rubric_id = p.rubric_id AND b.standard_group_id = p.g2
   AND a.profile_id = b.profile_id
  GROUP BY p.rubric_id, p.g1, p.g2
),
enriched AS (
  SELECT
    c.rubric_id, c.g1, c.g2, c.n,
    CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END AS r,
    CASE WHEN c.r = c.r AND c.n >= 3
         THEN analytics_p_value_from_r_n(c.r, c.n)
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