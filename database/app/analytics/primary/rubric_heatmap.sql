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
LANGUAGE sql
STABLE
AS $$
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
    'practice' = ANY (COALESCE(p_sim_filters, ARRAY['practice'])) AS want_practice,
    'archived' = ANY (COALESCE(p_sim_filters, ARRAY['archived'])) AS want_archived
),
want AS (
  SELECT
    want_general, want_practice, want_archived,
    (want_general OR want_practice) AS want_nonarchived_or_any
  FROM params
),

/* -------- Base selection from analytics (attempt date window) -------- */
base_general AS MATERIALIZED (
  SELECT a.chat_id, a.profile_id, a.profile_role, a.cohort_ids, a.profile_cohort_ids,
         a.is_general, a.is_practice, a.is_archived, a.simulation_id
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_general
    AND a.is_general = TRUE
    AND a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
base_practice AS MATERIALIZED (
  SELECT a.chat_id, a.profile_id, a.profile_role, a.cohort_ids, a.profile_cohort_ids,
         a.is_general, a.is_practice, a.is_archived, a.simulation_id
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_practice
    AND a.is_practice = TRUE
    AND a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
/* Handle case where we want only archived items (regardless of simulation type) */
base_archived_only AS MATERIALIZED (
  SELECT a.chat_id, a.profile_id, a.profile_role, a.cohort_ids, a.profile_cohort_ids,
         a.is_general, a.is_practice, a.is_archived, a.simulation_id
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_archived 
    AND NOT w.want_nonarchived_or_any
    AND a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
/* Handle case where we want archived items that are neither general nor practice */
base_archived_other AS MATERIALIZED (
  SELECT a.chat_id, a.profile_id, a.profile_role, a.cohort_ids, a.profile_cohort_ids,
         a.is_general, a.is_practice, a.is_archived, a.simulation_id
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_archived 
    AND w.want_nonarchived_or_any
    AND a.is_general = FALSE
    AND a.is_practice = FALSE
    AND a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
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
  UNION ALL
  SELECT * FROM base_archived_only
  UNION ALL
  SELECT * FROM base_archived_other
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
     OR (b.cohort_ids && pr.cohort_ids OR b.profile_cohort_ids && pr.cohort_ids)
),

/* Only the chats we care about, distinct */
filtered_chats AS MATERIALIZED (
  SELECT DISTINCT chat_id
  FROM cohort_scoped
  WHERE chat_id IS NOT NULL
),

/* -------- Latest grade per kept chat (no per-row EXISTS) -------- */
latest_grade_per_chat AS MATERIALIZED (
  SELECT DISTINCT ON (scg.simulation_chat_id)
         scg.id,
         scg.simulation_chat_id AS chat_id,
         scg.rubric_id
  FROM simulation_chat_grades scg
  JOIN filtered_chats fc ON fc.chat_id = scg.simulation_chat_id
  ORDER BY scg.simulation_chat_id, scg.created_at DESC
),

/* -------- Aggregate feedback into per-(chat,rubric,group) pct -------- */
per_grade_group AS MATERIALIZED (
  SELECT
    lg.chat_id,
    sg.rubric_id,
    sg.id   AS group_id,
    sg.name AS group_name,
    /* Sum totals divided by standard group max points */
    (100.0 * SUM(scf.total)::float8 / NULLIF(sg.points::float8, 0))::float8 AS pct
  FROM latest_grade_per_chat lg
  JOIN simulation_chat_feedbacks scf ON scf.simulation_chat_grade_id = lg.id
  JOIN standards s          ON s.id = scf.standard_id
  JOIN standard_groups sg   ON sg.id = s.standard_group_id AND sg.rubric_id = lg.rubric_id
  GROUP BY lg.chat_id, sg.rubric_id, sg.id, sg.name
),

/* -------- Correlations per rubric (upper triangle) -------- */
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
   AND b.group_id >= a.group_id
  GROUP BY a.rubric_id, a.group_id, b.group_id
),

/* -------- Groups actually present -------- */
groups AS MATERIALIZED (
  SELECT DISTINCT pgg.rubric_id, sg.id, sg.name, sg.short_name
  FROM per_grade_group pgg
  JOIN standard_groups sg ON sg.id = pgg.group_id
),
valid_rubrics AS MATERIALIZED (
  SELECT DISTINCT rubric_id FROM groups
),

/* -------- Enrich with p-values, strength, color -------- */
enriched AS MATERIALIZED (
  SELECT
    c.rubric_id, c.g1, c.g2, c.n,
    CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END AS r,
    NULL AS p_value,  -- Disabled due to underflow issues with high correlations
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

/* -------- Build matrices per rubric -------- */
per_rubric_matrix AS MATERIALIZED (
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
               ' (n=' || e2.n || ')'
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
per_rubric AS (
  SELECT
    r.rubric_id,
    COALESCE(m.matrix, '[]'::jsonb)           AS matrix,
    COALESCE(sg.standard_groups, '[]'::jsonb) AS standard_groups,
    (SELECT txt FROM insights i WHERE i.rubric_id = r.rubric_id) AS insights,
    (SELECT h.has_data FROM has_data h WHERE h.rubric_id = r.rubric_id) AS has_data
  FROM valid_rubrics r
  LEFT JOIN matrix_json m ON m.rubric_id = r.rubric_id
  LEFT JOIN sg_json      sg ON sg.rubric_id = r.rubric_id
),
valid_rubric_ids AS (
  SELECT jsonb_agg(rubric_id::text ORDER BY rubric_id::text) AS payload
  FROM valid_rubrics
)
SELECT jsonb_build_object(
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
  'validRubricIds', COALESCE((SELECT payload FROM valid_rubric_ids), '[]'::jsonb)
);
$$;