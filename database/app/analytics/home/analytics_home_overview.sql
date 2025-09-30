CREATE OR REPLACE FUNCTION analytics_home_overview_fn(
  p_start           timestamptz,
  p_end             timestamptz,
  p_cohort_ids      uuid[],          -- optional filter
  p_roles           profile_role[],  -- optional filter
  p_sim_filters     text[],          -- optional filter: ['general','practice','archived']
  p_profile_id      uuid             -- TA view if set; Instructional/Admin if NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH
-- ---------------- Simulation meta (title/desc/time/rubric/num_scenarios)
sim_meta AS (
  SELECT
    s.id                           AS simulation_id,
    s.title                        AS simulation_title,
    s.description                  AS simulation_description,
    s.time_limit,
    s.rubric_id,
    COALESCE(cardinality(s.scenario_ids),0) AS num_scenarios,
    r.points                       AS rubric_points,
    r.pass_points                  AS rubric_pass_points,
    -- filter by sim type flags (practice/general). 'archived' is attempt-level, keep sims.
    CASE WHEN p_sim_filters IS NULL THEN TRUE
         ELSE (('practice'  = ANY (p_sim_filters) AND s.practice_simulation = TRUE)
            OR  ('general'   = ANY (p_sim_filters) AND s.practice_simulation = FALSE)
            OR  ('archived'  = ANY (p_sim_filters))) END AS sim_kind_ok
  FROM simulations s
  JOIN rubrics r ON r.id = s.rubric_id
),
-- ---------------- Pick a representative persona color/icon for a sim (from its scenarios)
sim_persona_meta AS (
  SELECT
    sm.simulation_id,
    (ARRAY_AGG(p.color  ORDER BY cnt DESC, COALESCE(p.color,'') DESC))[1] AS color,
    (ARRAY_AGG(p.icon   ORDER BY cnt DESC, COALESCE(p.icon,'')  DESC))[1] AS icon
  FROM (
    SELECT
      s.id AS simulation_id,
      sc.persona_id,
      COUNT(*) AS cnt
    FROM simulations s
    LEFT JOIN LATERAL unnest(s.scenario_ids) AS sid(scenario_id) ON TRUE
    LEFT JOIN scenarios sc ON sc.id = sid.scenario_id
    GROUP BY s.id, sc.persona_id
  ) sm
  LEFT JOIN personas p ON p.id = sm.persona_id
  GROUP BY sm.simulation_id
),
-- ---------------- Analytics slice (time/roles/sim kind/selected cohorts)
filt AS (
  SELECT a.*
  FROM analytics a
  WHERE a.chat_created_at >= p_start
    AND a.chat_created_at <  p_end
    AND (p_roles IS NULL OR a.profile_role = ANY (p_roles))
    AND (
      p_sim_filters IS NULL OR (
         ('general'  = ANY (p_sim_filters) AND a.is_general)  OR
         ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
         ('archived' = ANY (p_sim_filters) AND a.is_archived)
      )
    )
    AND (p_cohort_ids IS NULL OR a.cohort_ids && p_cohort_ids)
),

-- ---------------- Expected scenarios per simulation
sim_expected AS (
  SELECT s.id AS simulation_id,
         COALESCE(cardinality(s.scenario_ids),0) AS expected_scenarios
  FROM simulations s
),

-- ---------------- Per attempt: sum percent over completed root scenarios; zeros for missing
attempt_scores AS (
  SELECT
    ap.attempt_id,
    ap.profile_id,
    ap.simulation_id,
    COALESCE(SUM(ap.grade_percent) FILTER (WHERE ap.completed), 0)::numeric AS sum_completed_pct,
    se.expected_scenarios
  FROM filt ap           -- ap here = analytics rows (1 per chat)
  JOIN sim_expected se ON se.simulation_id = ap.simulation_id
  GROUP BY ap.attempt_id, ap.profile_id, ap.simulation_id, se.expected_scenarios
),

-- ---------------- Average across expected scenarios (missing = 0)
attempt_avg AS (
  SELECT
    attempt_id,
    profile_id,
    simulation_id,
    CASE WHEN expected_scenarios > 0
         THEN (sum_completed_pct / expected_scenarios)
         ELSE 0 END AS avg_pct_over_expected
  FROM attempt_scores
),

-- ---------------- Best attempt per (profile, simulation)
best_user_sim AS (
  SELECT DISTINCT ON (profile_id, simulation_id)
         profile_id, simulation_id, avg_pct_over_expected
  FROM attempt_avg
  ORDER BY profile_id, simulation_id, avg_pct_over_expected DESC
),

-- ---------------- Pass threshold per simulation
sim_pass_pct AS (
  SELECT s.id AS simulation_id,
         CASE WHEN r.points > 0
              THEN (r.pass_points::numeric / r.points::numeric) * 100.0
              ELSE 70 END AS pass_pct
  FROM simulations s
  JOIN rubrics r ON r.id = s.rubric_id
),

-- ---------------- Compute per user status using best attempt & threshold
user_sim_status AS (
  SELECT
    b.profile_id,
    b.simulation_id,
    b.avg_pct_over_expected,
    sp.pass_pct,
    (b.avg_pct_over_expected >= sp.pass_pct) AS passed,
    -- count completed chats for in-progress / not-started
    COALESCE(abps.completed_chats,0) AS chats_completed
  FROM best_user_sim b
  JOIN sim_pass_pct sp ON sp.simulation_id = b.simulation_id
  LEFT JOIN (
    -- OLD UI only considered progress once at least one chat was completed
    SELECT profile_id, simulation_id,
           COUNT(DISTINCT chat_id) FILTER (WHERE completed) AS completed_chats
    FROM filt
    GROUP BY profile_id, simulation_id
  ) abps ON abps.profile_id = b.profile_id AND abps.simulation_id = b.simulation_id
),

-- ---------------- Cohort-simulation pairs (includes empty cohorts)
cohort_sim AS (
  SELECT c.id AS cohort_id, c.title AS cohort_title, sids.simulation_id
  FROM cohorts c
  JOIN LATERAL unnest(c.simulation_ids) AS sids(simulation_id) ON TRUE
  WHERE (p_cohort_ids IS NULL OR c.id = ANY(p_cohort_ids))
),

-- ---------------- Simulation display order from cohort arrays
sim_display_order AS (
  SELECT
    cs.simulation_id,
    MIN(array_position(c.simulation_ids, cs.simulation_id)) AS order_idx
  FROM cohort_sim cs
  JOIN cohorts c ON c.id = cs.cohort_id
  GROUP BY cs.simulation_id
),

-- ---------------- Cohort membership exploded & filtered by cohorts/roles
cohort_membership AS (
  SELECT
    c.id    AS cohort_id,
    c.title AS cohort_title,
    sids.simulation_id,
    pids.profile_id
  FROM cohorts c
  JOIN LATERAL unnest(c.simulation_ids) AS sids(simulation_id) ON TRUE
  JOIN LATERAL unnest(c.profile_ids)    AS pids(profile_id)    ON TRUE
  LEFT JOIN profiles pr ON pr.id = pids.profile_id
  WHERE (p_cohort_ids IS NULL OR c.id = ANY (p_cohort_ids))
    AND (p_roles      IS NULL OR pr.role = ANY (p_roles))
),

/* ========================== TA VIEW ========================== */
ta_sim_space AS (
  -- sims the TA is part of: cohorts include TA OR TA has activity
  SELECT DISTINCT m.simulation_id
  FROM cohort_membership m
  WHERE p_profile_id IS NOT NULL AND m.profile_id = p_profile_id
  UNION
  SELECT DISTINCT uss.simulation_id
  FROM user_sim_status uss
  WHERE p_profile_id IS NOT NULL AND uss.profile_id = p_profile_id
),
ta_rows AS (
  SELECT
    jsonb_build_object(
      'viewMode',              'ta',
      'id',                    s.simulation_id::text,
      'simulationTitle',       s.simulation_title,
      'simulationDescription', s.simulation_description,
      'simulationName',        s.simulation_title,   -- alias kept for your client
      'timeLimit',             s.time_limit,
      'numSessions',           s.num_scenarios,                                 -- NEW: mirror scenarios count
      'highestScore',          (
                                 SELECT ROUND(GREATEST(0, LEAST(100, uss.avg_pct_over_expected)))::int
                                 FROM user_sim_status uss
                                 WHERE uss.profile_id = p_profile_id
                                   AND uss.simulation_id = s.simulation_id
                               ),
      'rubric_id',             s.rubric_id::text,
      'color',                 spm.color,
      'icon',                  spm.icon,
      'hasPassed',             (
                                 SELECT COALESCE(uss.passed, false)
                                 FROM user_sim_status uss
                                 WHERE uss.profile_id = p_profile_id
                                   AND uss.simulation_id = s.simulation_id
                               ),
      'passRate',              CASE WHEN s.rubric_points > 0
                                    THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
                                    ELSE NULL END,                             -- NEW: always provide passRate
      'status',                (
                                 SELECT CASE
                                           WHEN COALESCE(uss.passed, false) THEN 'passed'
                                           WHEN COALESCE(uss.chats_completed, 0) > 0 THEN 'in-progress'
                                           ELSE 'not-started'
                                         END
                                 FROM user_sim_status uss
                                 WHERE uss.profile_id = p_profile_id
                                   AND uss.simulation_id = s.simulation_id
                               ),
      'completionPct',         (
                                 SELECT ROUND(GREATEST(0, LEAST(100, uss.avg_pct_over_expected)))::int
                                 FROM user_sim_status uss
                                 WHERE uss.profile_id = p_profile_id
                                   AND uss.simulation_id = s.simulation_id
                               ),
      'passedCount',           NULL,
      'inProgressCount',       NULL,
      'notStartedCount',       NULL,
      'passPct',               CASE WHEN s.rubric_points > 0
                                    THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
                                    ELSE NULL END,
      'cohortName',            (
                                 SELECT (ARRAY_AGG(DISTINCT c.cohort_title ORDER BY c.cohort_title))[1]
                                 FROM cohort_membership c
                                 WHERE c.simulation_id = s.simulation_id AND c.profile_id = p_profile_id
                               ),
      'cohortNames',           (
                                 SELECT CASE
                                           WHEN array_length(titles,1) IS NULL OR array_length(titles,1)=0 THEN NULL
                                           WHEN array_length(titles,1)=1 THEN titles[1]
                                           WHEN array_length(titles,1)=2 THEN titles[1] || ' and ' || titles[2]
                                           ELSE array_to_string(titles[1:array_length(titles,1)-2], ', ')
                                                || ', ' || titles[array_length(titles,1)-1]
                                                || ', and ' || titles[array_length(titles,1)]
                                         END
                                 FROM (
                                   SELECT ARRAY_AGG(DISTINCT c.cohort_title ORDER BY c.cohort_title) AS titles
                                   FROM cohort_membership c
                                   WHERE c.simulation_id = s.simulation_id AND c.profile_id = p_profile_id
                                 ) x
                               )
    ) AS item
  FROM sim_meta s
  LEFT JOIN sim_persona_meta spm ON spm.simulation_id = s.simulation_id
  WHERE p_profile_id IS NOT NULL
    AND s.sim_kind_ok
    AND EXISTS (SELECT 1 FROM ta_sim_space t WHERE t.simulation_id = s.simulation_id)
),
ta_payload AS (
  SELECT jsonb_build_object(
           'mode',    'ta',
           'hasData', EXISTS(SELECT 1 FROM ta_rows),
           'items',   COALESCE((SELECT jsonb_agg(item ORDER BY (item->>'simulationTitle')) FROM ta_rows), '[]'::jsonb)
         ) AS payload
  WHERE p_profile_id IS NOT NULL
),

/* ======================= INSTRUCTIONAL VIEW ======================= */
inst_counts AS (
  -- counts by simulation over cohort members (filtered by p_cohort_ids/p_roles)
  -- includes empty cohorts
  SELECT
    cs.simulation_id,
    COUNT(DISTINCT cm.profile_id) AS total_members,
    COUNT(DISTINCT CASE WHEN uss.passed THEN cm.profile_id END) AS passed_count,
    COUNT(DISTINCT CASE WHEN (NOT uss.passed) AND uss.chats_completed > 0 THEN cm.profile_id END) AS in_progress_count
  FROM cohort_sim cs
  LEFT JOIN cohort_membership cm
    ON cm.cohort_id = cs.cohort_id AND cm.simulation_id = cs.simulation_id
  LEFT JOIN user_sim_status uss
    ON uss.profile_id = cm.profile_id AND uss.simulation_id = cs.simulation_id
  GROUP BY cs.simulation_id
),
inst_rows AS (
  WITH inst_cohorts AS (
    SELECT
      cs.simulation_id,
      ARRAY_AGG(DISTINCT cs.cohort_title ORDER BY cs.cohort_title) AS titles
    FROM cohort_sim cs
    GROUP BY cs.simulation_id
  ),
  inst_cohort_names AS (
    SELECT
      ic.simulation_id,
      ic.titles,
      /* First title (or NULL) for single-line subtitle */
      CASE
        WHEN array_length(ic.titles, 1) >= 1 THEN ic.titles[1]
        ELSE NULL
      END AS cohort_name,
      /* Pretty format: "A", "A and B", "A, B, and C" */
      CASE
        WHEN array_length(ic.titles, 1) IS NULL OR array_length(ic.titles, 1) = 0 THEN NULL
        WHEN array_length(ic.titles, 1) = 1 THEN ic.titles[1]
        WHEN array_length(ic.titles, 1) = 2 THEN ic.titles[1] || ' and ' || ic.titles[2]
        ELSE
          array_to_string(ic.titles[1:array_length(ic.titles,1)-2], ', ')
          || ', ' || ic.titles[array_length(ic.titles,1)-1]
          || ', and ' || ic.titles[array_length(ic.titles,1)]
      END AS cohort_names
    FROM inst_cohorts ic
  )
  SELECT
    jsonb_build_object(
      'viewMode',              'instructional',
      'id',                    s.simulation_id::text,
      'simulationTitle',       s.simulation_title,
      'simulationDescription', s.simulation_description,
      'simulationName',        s.simulation_title,
      'timeLimit',             s.time_limit,
      'numSessions',           s.num_scenarios,
      'highestScore',          NULL,
      'rubric_id',             s.rubric_id::text,
      'color',                 spm.color,
      'icon',                  spm.icon,
      'hasPassed',             CASE
                                 WHEN COALESCE(ic.total_members,0) = 0 THEN true            -- NEW: empty cohort = complete
                                 WHEN COALESCE(ic.passed_count,0) = COALESCE(ic.total_members,0) THEN true
                                 ELSE false END,
      'passRate',              CASE WHEN s.rubric_points > 0
                                    THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
                                    ELSE NULL END,
      'status',                CASE
                                 WHEN COALESCE(ic.total_members,0) = 0 THEN 'passed'        -- NEW: empty cohort shows "Complete"
                                 WHEN COALESCE(ic.passed_count,0) = COALESCE(ic.total_members,0) THEN 'passed'
                                 WHEN COALESCE(ic.passed_count,0) > 0 OR COALESCE(ic.in_progress_count,0) > 0 THEN 'in-progress'
                                 ELSE 'not-started'
                               END,
      'completionPct',         CASE
                                 WHEN COALESCE(ic.total_members,0) > 0
                                 THEN ROUND(
                                   100.0 * (COALESCE(ic.passed_count,0) + COALESCE(ic.in_progress_count,0))::numeric
                                   / ic.total_members
                                 )::int
                                 ELSE 0
                               END,
      'passedCount',           COALESCE(ic.passed_count, 0),
      'inProgressCount',       COALESCE(ic.in_progress_count, 0),
      'notStartedCount',       GREATEST(COALESCE(ic.total_members,0)
                                  - COALESCE(ic.passed_count,0)
                                  - COALESCE(ic.in_progress_count,0), 0),
      'passPct',               NULL,
      /* NEW: single-line & pretty variants */
      'cohortName',            icn.cohort_name,
      'cohortNames',           icn.cohort_names,
      'orderIndex',            sdo.order_idx          -- <—— expose it
    ) AS item,
    -- carry keys out for ORDER BY in jsonb_agg
    CASE
      WHEN COALESCE(ic.total_members,0) = 0 THEN true
      WHEN COALESCE(ic.passed_count,0) = COALESCE(ic.total_members,0) THEN true
      ELSE false
    END AS has_passed_bool,
    icn.cohort_name AS sort_cohort_name,
    sdo.order_idx   AS sort_order_idx,
    s.simulation_title AS sort_title
  FROM sim_meta s
  JOIN inst_counts ic            ON ic.simulation_id = s.simulation_id
  LEFT JOIN sim_persona_meta spm ON spm.simulation_id = s.simulation_id
  LEFT JOIN inst_cohort_names icn ON icn.simulation_id = s.simulation_id
  LEFT JOIN sim_display_order sdo ON sdo.simulation_id = s.simulation_id
  WHERE p_profile_id IS NULL
    AND s.sim_kind_ok
),
inst_payload AS (
  SELECT jsonb_build_object(
           'mode',    'instructional',
           'hasData', EXISTS(SELECT 1 FROM inst_rows),
           'items',
             COALESCE((
               SELECT jsonb_agg(item
                 ORDER BY
                   has_passed_bool ASC,          -- incomplete first
                   sort_cohort_name NULLS LAST,  -- by cohort
                   sort_order_idx NULLS LAST,    -- by cohort array order
                   sort_title                    -- fallback by title
               )
               FROM inst_rows
             ), '[]'::jsonb)
         ) AS payload
  WHERE p_profile_id IS NULL
)

SELECT COALESCE(
         (SELECT payload FROM ta_payload),
         (SELECT payload FROM inst_payload),
         jsonb_build_object('mode','empty','hasData',false,'items','[]'::jsonb)
       );
$$;