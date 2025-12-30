-- Get home overview with items and mappings (no history - bundle only returns top half)
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_home_overview_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_home_overview_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_home_overview_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_home_overview_v3_simulation_item AS (
    view_mode text,  -- 'member' | 'instructional'
    simulation_id uuid,
    simulation_title text,
    simulation_description text,
    simulation_name text,
    time_limit int,
    num_sessions int,
    highest_score int,
    standard_groups text[],  -- Array of standard group IDs (keys from mapping)
    color text,
    icon text,
    has_passed boolean,
    pass_rate int,
    status text,  -- 'not-started' | 'in-progress' | 'passed'
    completion_pct int,
    passed_count int,
    in_progress_count int,
    not_started_count int,
    pass_pct int,
    cohort_name text,
    cohort_names text
);

CREATE TYPE types.q_get_home_overview_v3_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_get_home_overview_v3_standard AS (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_get_home_overview_v3_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit int,
    department_ids text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_home_overview_v3(
    start_date timestamptz,
    end_date timestamptz,
    profile_id uuid,
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    actor_name text,
    mode text,  -- 'member' | 'instructional' | 'empty'
    has_data boolean,
    items types.q_get_home_overview_v3_simulation_item[],
    standard_groups types.q_get_home_overview_v3_standard_group[],
    standards types.q_get_home_overview_v3_standard[],
    simulations types.q_get_home_overview_v3_simulation[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        start_date AS start_date,
        end_date AS end_date,
        profile_id AS profile_id,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params)::text IS NULL OR (SELECT profile_id FROM params)::text = '' THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)::uuid
        END as resolved_profile_id
),
-- Filter simulations by cohorts (new filtering order: cohorts → simulations)
-- Gets simulations linked to cohorts + practice simulations without cohorts
filtered_simulation_ids AS (
    SELECT DISTINCT s.id AS simulation_id
    FROM params p
    CROSS JOIN simulations s
    WHERE s.active = TRUE
      AND (
          -- If cohort_ids provided, get simulations linked to those cohorts
          (cardinality(p.cohort_ids) > 0 AND EXISTS (
              SELECT 1 
              FROM cohort_simulations cs 
              WHERE cs.simulation_id = s.id 
                AND cs.cohort_id = ANY(p.cohort_ids)
                AND cs.active = TRUE
          ))
          OR
          -- Always include practice simulations without cohorts
          (s.practice_simulation = TRUE 
           AND NOT EXISTS (
               SELECT 1 
               FROM cohort_simulations cs2 
               WHERE cs2.simulation_id = s.id 
                 AND cs2.active = TRUE
           ))
          OR
          -- If no cohort_ids provided, include all simulations
          (cardinality(p.cohort_ids) = 0)
      )
),
-- Look up profile role if profileId provided and compute role hierarchy
profile_role_lookup AS (
    SELECT 
        CASE 
            WHEN rpi.resolved_profile_id IS NULL THEN 'instructional'
            WHEN (SELECT role FROM profiles WHERE id = rpi.resolved_profile_id) = 'member' THEN 'member'
            ELSE 'instructional'
        END AS mode,
        CASE
            WHEN rpi.resolved_profile_id IS NULL THEN false
            ELSE COALESCE((SELECT role = profile_role.member FROM profiles WHERE id = rpi.resolved_profile_id), false)
        END AS is_member_mode,
        -- Compute role hierarchy array based on profile's role
        CASE
            WHEN rpi.resolved_profile_id IS NULL THEN ARRAY['instructional', 'member', 'guest']::profile_role[]
            WHEN (SELECT role FROM profiles WHERE id = rpi.resolved_profile_id) = 'superadmin' THEN ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest']::profile_role[]
            WHEN (SELECT role FROM profiles WHERE id = rpi.resolved_profile_id) = 'admin' THEN ARRAY['admin', 'instructional', 'member', 'guest']::profile_role[]
            WHEN (SELECT role FROM profiles WHERE id = rpi.resolved_profile_id) = 'instructional' THEN ARRAY['instructional', 'member', 'guest']::profile_role[]
            WHEN (SELECT role FROM profiles WHERE id = rpi.resolved_profile_id) = 'member' THEN ARRAY['member', 'guest']::profile_role[]
            WHEN (SELECT role FROM profiles WHERE id = rpi.resolved_profile_id) = 'guest' THEN ARRAY['guest']::profile_role[]
            ELSE ARRAY['instructional', 'member', 'guest']::profile_role[]  -- Default fallback
        END AS role_hierarchy
    FROM resolve_profile_id rpi
),
-- Filter analytics for items: for member mode include profileId filter
-- Also filter by simulation_ids from cohorts (new filtering order)
filt AS (
    SELECT a.* 
    FROM params p
    CROSS JOIN profile_role_lookup prl
    CROSS JOIN resolve_profile_id rpi
    CROSS JOIN analytics a
    WHERE a.attempt_created_at >= p.start_date 
      AND a.attempt_created_at < p.end_date 
      AND a.is_general = TRUE
      AND (NOT prl.is_member_mode OR a.profile_id = rpi.resolved_profile_id)
      -- Filter by simulation_ids from cohorts (new filtering order)
      AND (cardinality(p.cohort_ids) = 0 OR a.simulation_id IN (SELECT simulation_id FROM filtered_simulation_ids))
),
-- Get cohort-simulation pairs (includes empty cohorts)
cohort_sim AS (
    SELECT c.id AS cohort_id, c.title AS cohort_title, cs.simulation_id
    FROM params p
    CROSS JOIN cohorts c
    JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.active = true
    LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
    WHERE (cardinality(p.cohort_ids) = 0 OR c.id = ANY(p.cohort_ids))
    GROUP BY c.id, c.title, cs.simulation_id, p.department_ids
    HAVING 
        (cardinality(p.department_ids) = 0 OR COUNT(cd.cohort_id) FILTER (WHERE cd.department_id = ANY(p.department_ids)) > 0)
        OR (cardinality(p.department_ids) = 0 AND NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true))
),
-- Expected scenarios per simulation
sim_expected AS (
    SELECT s.id AS simulation_id,
           COALESCE((SELECT COUNT(*)::int FROM simulation_scenarios ss WHERE ss.simulation_id = s.id), 0) AS expected_scenarios
    FROM simulations s
),
-- Per attempt: sum grade_percent over completed root scenarios (one grade per root scenario per attempt)
attempt_scores AS (
    SELECT
        ap.attempt_id,
        ap.profile_id,
        ap.simulation_id,
        COALESCE(SUM(ap.grade_percent) FILTER (WHERE ap.completed AND ap.grade_percent IS NOT NULL), 0)::numeric AS sum_completed_pct,
        se.expected_scenarios
    FROM (
        SELECT DISTINCT ON (ap_inner.attempt_id, ap_inner.scenario_id)
            ap_inner.*
        FROM filt ap_inner
        WHERE ap_inner.completed AND ap_inner.grade_percent IS NOT NULL
        ORDER BY ap_inner.attempt_id, ap_inner.scenario_id, ap_inner.grade_created_at DESC
    ) ap
    JOIN sim_expected se ON se.simulation_id = ap.simulation_id
    GROUP BY ap.attempt_id, ap.profile_id, ap.simulation_id, se.expected_scenarios
),
-- Average over expected scenarios (missing = 0)
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
-- User-simulation status with best attempt + pass status
user_sim_status AS (
    SELECT
        aa.profile_id,
        aa.simulation_id,
        MAX(aa.avg_pct_over_expected) AS avg_pct_over_expected,
        BOOL_OR(aa.avg_pct_over_expected >= COALESCE(
            (SELECT ROUND(100.0 * r.pass_points::numeric / NULLIF(r.points,0))
             FROM simulations s
             LEFT JOIN simulation_scenarios ss_rubric ON ss_rubric.simulation_id = s.id AND ss_rubric.active = true
             LEFT JOIN simulation_scenarios_rubric_grade_agents ssrga_rubric ON ssrga_rubric.simulation_id = ss_rubric.simulation_id AND ssrga_rubric.scenario_id = ss_rubric.scenario_id
             LEFT JOIN rubric_grade_agents rga_rubric ON rga_rubric.id = ssrga_rubric.rubric_grade_agent_id
             LEFT JOIN rubrics r ON r.id = rga_rubric.rubric_id
             WHERE s.id = aa.simulation_id
             ORDER BY ss_rubric.position
             LIMIT 1), 0
        )) AS passed,
        COUNT(*) AS chats_completed
    FROM attempt_avg aa
    GROUP BY aa.profile_id, aa.simulation_id
),
-- Cohort membership CTE (for non-history queries - only active memberships)
cohort_membership AS (
    SELECT
        cp.profile_id,
        cp.cohort_id,
        cs.simulation_id,
        c.title AS cohort_title,
        prof.role
    FROM params p
    CROSS JOIN cohort_profiles cp
    JOIN cohorts c ON c.id = cp.cohort_id
    JOIN cohort_simulations cs ON cs.cohort_id = c.id
    JOIN profiles prof ON prof.id = cp.profile_id
    LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
    CROSS JOIN profile_role_lookup prl
    CROSS JOIN resolve_profile_id rpi
    WHERE cp.active = true  -- Only active cohort memberships for non-history queries
      AND (cardinality(p.cohort_ids) = 0 OR c.id = ANY(p.cohort_ids))
      AND prof.role = ANY(prl.role_hierarchy)  -- Use computed role hierarchy from profile_role_lookup
      -- When member mode, only include the current member's profile_id
      AND (NOT prl.is_member_mode OR cp.profile_id = rpi.resolved_profile_id)
    GROUP BY cp.profile_id, cp.cohort_id, cs.simulation_id, c.title, prof.role, c.id, p.department_ids
    HAVING 
        (cardinality(p.department_ids) = 0 OR COUNT(cd.cohort_id) FILTER (WHERE cd.department_id = ANY(p.department_ids)) > 0)
        OR (cardinality(p.department_ids) = 0 AND NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true))
),
-- Simulation metadata
sim_meta AS (
    SELECT DISTINCT
        s.id AS simulation_id,
        s.title,
        s.description,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit,
        (SELECT rga.rubric_id FROM simulation_scenarios ss 
         JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = ss.simulation_id AND ssrga.scenario_id = ss.scenario_id
         JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
         WHERE ss.simulation_id = s.id AND ss.active = true 
         ORDER BY ss.position 
         LIMIT 1) as rubric_id,
        COALESCE((SELECT COUNT(*)::int FROM simulation_scenarios ss WHERE ss.simulation_id = s.id), 0) AS num_scenarios,
        COALESCE(r.points, 0) AS rubric_points,
        COALESCE(r.pass_points, 0) AS rubric_pass_points
    FROM simulations s
    LEFT JOIN simulation_scenarios ss_rubric ON ss_rubric.simulation_id = s.id AND ss_rubric.active = true
    LEFT JOIN simulation_scenarios_rubric_grade_agents ssrga_rubric ON ssrga_rubric.simulation_id = ss_rubric.simulation_id AND ssrga_rubric.scenario_id = ss_rubric.scenario_id
    LEFT JOIN rubric_grade_agents rga_rubric ON rga_rubric.id = ssrga_rubric.rubric_grade_agent_id
    LEFT JOIN rubrics r ON r.id = rga_rubric.rubric_id
    WHERE s.id IN (SELECT simulation_id FROM cohort_sim)
),
-- Simulation persona metadata
sim_persona_meta AS (
    SELECT
        sm.simulation_id,
        (ARRAY_AGG(p.color ORDER BY cnt DESC, COALESCE(p.color, '') DESC))[1] AS color,
        (ARRAY_AGG(p.icon ORDER BY cnt DESC, COALESCE(p.icon, '') DESC))[1] AS icon
    FROM (
        SELECT
            s.id AS simulation_id,
            sp.persona_id,
            COUNT(*) AS cnt
        FROM simulations s
        LEFT JOIN simulation_scenarios ss_link ON ss_link.simulation_id = s.id
        LEFT JOIN scenarios sc ON sc.id = ss_link.scenario_id
        LEFT JOIN scenario_personas sp ON sp.scenario_id = sc.id AND sp.active = TRUE
        WHERE s.id IN (SELECT simulation_id FROM sim_meta)
        GROUP BY s.id, sp.persona_id
    ) sm
    LEFT JOIN personas p ON p.id = sm.persona_id
    GROUP BY sm.simulation_id
),
-- Standard groups per simulation (for items) - get from first scenario's rubric
sim_standard_groups AS (
    SELECT DISTINCT ON (ss.simulation_id)
        ss.simulation_id,
        ARRAY_AGG(sg.id::text ORDER BY sg.id) FILTER (WHERE sg.id IS NOT NULL) AS standard_group_ids
    FROM simulation_scenarios ss
    JOIN simulation_scenarios_rubric_grade_agents ssrga_rsg ON ssrga_rsg.simulation_id = ss.simulation_id AND ssrga_rsg.scenario_id = ss.scenario_id
    JOIN rubric_grade_agents rga_rsg ON rga_rsg.id = ssrga_rsg.rubric_grade_agent_id
    JOIN rubric_standard_groups rsg ON rsg.rubric_id = rga_rsg.rubric_id AND rsg.active = true
    JOIN standard_groups sg ON sg.id = rsg.standard_group_id
    WHERE ss.simulation_id IN (SELECT simulation_id FROM sim_meta) AND ss.active = true
    GROUP BY ss.simulation_id, ss.position
    ORDER BY ss.simulation_id, ss.position
),
-- TA VIEW: Primary cohort per simulation for the TA
ta_primary_cohort AS (
    SELECT
        c.id AS cohort_id,
        c.title AS cohort_title,
        cs.simulation_id,
        ROW_NUMBER() OVER (ORDER BY c.id, cs.simulation_id) AS order_idx,
        ROW_NUMBER() OVER (PARTITION BY cs.simulation_id ORDER BY c.id) AS rn
    FROM params p
    CROSS JOIN cohorts c
    JOIN cohort_simulations cs ON cs.cohort_id = c.id
    JOIN cohort_profiles cp ON cp.cohort_id = c.id
        AND cp.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
    LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
    WHERE (cardinality(p.cohort_ids) = 0 OR c.id = ANY(p.cohort_ids))
    GROUP BY c.id, c.title, cs.simulation_id, p.department_ids
    HAVING 
        (cardinality(p.department_ids) = 0 OR COUNT(cd.cohort_id) FILTER (WHERE cd.department_id = ANY(p.department_ids)) > 0)
        OR (cardinality(p.department_ids) = 0 AND NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true))
),
ta_sim_space AS (
    SELECT DISTINCT simulation_id FROM ta_primary_cohort
),
ta_rows AS (
    SELECT
        ('member'::text,
         s.simulation_id,
         s.title,
         s.description,
         s.title,
         s.time_limit,
         s.num_scenarios,
         COALESCE((
            SELECT ROUND(GREATEST(0, LEAST(100, uss.avg_pct_over_expected)))::int
            FROM user_sim_status uss, resolve_profile_id rpi
            WHERE uss.profile_id = rpi.resolved_profile_id
              AND uss.simulation_id = s.simulation_id
         ), NULL)::int,
         COALESCE(ssg.standard_group_ids, ARRAY[]::text[]),
         spm.color,
         spm.icon,
         COALESCE((
            SELECT uss.passed
            FROM user_sim_status uss, resolve_profile_id rpi
            WHERE uss.profile_id = rpi.resolved_profile_id
              AND uss.simulation_id = s.simulation_id
         ), false)::boolean,
         CASE WHEN s.rubric_points > 0
              THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
              ELSE NULL END::int,
         COALESCE((
            SELECT CASE
                      WHEN COALESCE(uss.passed, false) THEN 'passed'
                      WHEN COALESCE(uss.chats_completed, 0) > 0 THEN 'in-progress'
                      ELSE 'not-started'
                    END
            FROM user_sim_status uss, resolve_profile_id rpi
            WHERE uss.profile_id = rpi.resolved_profile_id
              AND uss.simulation_id = s.simulation_id
         ), 'not-started')::text,
         COALESCE((
            SELECT ROUND(GREATEST(0, LEAST(100, uss.avg_pct_over_expected)))::int
            FROM user_sim_status uss, resolve_profile_id rpi
            WHERE uss.profile_id = rpi.resolved_profile_id
              AND uss.simulation_id = s.simulation_id
         ), 0)::int,
         NULL::int,
         NULL::int,
         NULL::int,
         CASE WHEN s.rubric_points > 0
              THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
              ELSE NULL END::int,
         (
            SELECT tpc.cohort_title
            FROM ta_primary_cohort tpc
            WHERE tpc.simulation_id = s.simulation_id AND tpc.rn = 1
         ),
         (
            SELECT CASE
                      WHEN array_length(titles, 1) IS NULL OR array_length(titles, 1) = 0 THEN NULL
                      WHEN array_length(titles, 1) = 1 THEN titles[1]
                      WHEN array_length(titles, 1) = 2 THEN titles[1] || ' and ' || titles[2]
                      ELSE array_to_string(titles[1:array_length(titles,1)-1], ', ')
                           || ', and ' || titles[array_length(titles,1)]
                    END
            FROM (
                SELECT ARRAY_AGG(DISTINCT c.cohort_title ORDER BY c.cohort_title) AS titles
                FROM cohort_membership c, resolve_profile_id rpi
                WHERE c.simulation_id = s.simulation_id
                  AND c.profile_id = rpi.resolved_profile_id
            ) x
         )
        )::types.q_get_home_overview_v3_simulation_item AS item
    FROM sim_meta s
    LEFT JOIN sim_persona_meta spm ON spm.simulation_id = s.simulation_id
    LEFT JOIN sim_standard_groups ssg ON ssg.simulation_id = s.simulation_id
    WHERE EXISTS (SELECT 1 FROM profile_role_lookup prl WHERE prl.is_member_mode)
      AND EXISTS (SELECT 1 FROM ta_sim_space t WHERE t.simulation_id = s.simulation_id)
),
-- INSTRUCTIONAL VIEW: counts across all cohort members
inst_counts AS (
    SELECT
        cs.simulation_id,
        COUNT(DISTINCT cm.profile_id) AS total_members,
        COUNT(DISTINCT CASE WHEN uss.passed THEN cm.profile_id END) AS passed_count,
        COUNT(DISTINCT CASE WHEN (NOT uss.passed) AND uss.chats_completed > 0 THEN cm.profile_id END) AS in_progress_count
    FROM cohort_sim cs
    LEFT JOIN cohort_membership cm ON cm.cohort_id = cs.cohort_id AND cm.simulation_id = cs.simulation_id
    LEFT JOIN user_sim_status uss ON uss.profile_id = cm.profile_id AND uss.simulation_id = cs.simulation_id
    GROUP BY cs.simulation_id
),
inst_cohort_names AS (
    SELECT
        cs.simulation_id,
        ARRAY_AGG(DISTINCT cs.cohort_title ORDER BY cs.cohort_title) AS titles
    FROM cohort_sim cs
    GROUP BY cs.simulation_id
),
inst_rows AS (
    SELECT
        ('instructional'::text,
         s.simulation_id,
         s.title,
         s.description,
         s.title,
         s.time_limit,
         s.num_scenarios,
         NULL::int,
         COALESCE(ssg.standard_group_ids, ARRAY[]::text[]),
         spm.color,
         spm.icon,
         CASE
            WHEN COALESCE(ic.total_members, 0) = 0 THEN true
            WHEN COALESCE(ic.passed_count, 0) = COALESCE(ic.total_members, 0) THEN true
            ELSE false END::boolean,
         CASE WHEN s.rubric_points > 0
              THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
              ELSE NULL END::int,
         CASE
            WHEN COALESCE(ic.total_members, 0) = 0 THEN 'passed'
            WHEN COALESCE(ic.passed_count, 0) = COALESCE(ic.total_members, 0) THEN 'passed'
            WHEN COALESCE(ic.passed_count, 0) > 0 OR COALESCE(ic.in_progress_count, 0) > 0 THEN 'in-progress'
            ELSE 'not-started'
          END::text,
         CASE
            WHEN COALESCE(ic.total_members, 0) > 0
            THEN ROUND(100.0 * (COALESCE(ic.passed_count, 0) + COALESCE(ic.in_progress_count, 0))::numeric / ic.total_members)::int
            ELSE 0
          END::int,
         COALESCE(ic.passed_count, 0)::int,
         COALESCE(ic.in_progress_count, 0)::int,
         GREATEST(COALESCE(ic.total_members, 0) - COALESCE(ic.passed_count, 0) - COALESCE(ic.in_progress_count, 0), 0)::int,
         NULL::int,
         (icn.titles)[1],
         CASE
            WHEN array_length(icn.titles, 1) IS NULL OR array_length(icn.titles, 1) = 0 THEN NULL
            WHEN array_length(icn.titles, 1) = 1 THEN icn.titles[1]
            WHEN array_length(icn.titles, 1) = 2 THEN icn.titles[1] || ' and ' || icn.titles[2]
            ELSE array_to_string(icn.titles[1:array_length(icn.titles,1)-1], ', ')
                 || ', and ' || icn.titles[array_length(icn.titles,1)]
          END
        )::types.q_get_home_overview_v3_simulation_item AS item,
        CASE
            WHEN COALESCE(ic.total_members, 0) = 0 THEN true
            WHEN COALESCE(ic.passed_count, 0) = COALESCE(ic.total_members, 0) THEN true
            ELSE false
        END AS has_passed_bool,
        (icn.titles)[1] AS sort_cohort_name,
        s.title AS sort_title
    FROM sim_meta s
    JOIN inst_counts ic ON ic.simulation_id = s.simulation_id
    LEFT JOIN sim_persona_meta spm ON spm.simulation_id = s.simulation_id
    LEFT JOIN inst_cohort_names icn ON icn.simulation_id = s.simulation_id
    LEFT JOIN sim_standard_groups ssg ON ssg.simulation_id = s.simulation_id
    WHERE NOT EXISTS (SELECT 1 FROM profile_role_lookup prl WHERE prl.is_member_mode)
),
all_rubric_ids AS (
    SELECT DISTINCT rubric_id FROM sim_meta
),
-- Standard groups mapping (as array)
standard_groups_array AS (
    SELECT 
        (sg.id, sg.name, sg.description, sg.points, sg.pass_points)::types.q_get_home_overview_v3_standard_group AS standard_group
    FROM rubric_standard_groups rsg
    JOIN standard_groups sg ON sg.id = rsg.standard_group_id
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
),
-- Standards mapping (as array)
standards_array AS (
    SELECT 
        (st.id, st.standard_group_id, st.name, st.description, st.points)::types.q_get_home_overview_v3_standard AS standard
    FROM standards st
    WHERE st.standard_group_id IN (
        SELECT rsg.standard_group_id FROM rubric_standard_groups rsg
        WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
    )
),
-- Simulation mapping (as array)
simulation_array AS (
    SELECT 
        (sim.id, sim.title, COALESCE(sim.description, ''), 
         COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = sim.id AND stl.active = true AND ss.active = true),
            0
         ),
         COALESCE(sdd.department_ids, ARRAY[]::text[])
        )::types.q_get_home_overview_v3_simulation AS simulation
    FROM simulations sim
    LEFT JOIN (
        SELECT 
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = sim.id
    WHERE sim.id IN (SELECT DISTINCT simulation_id FROM cohort_sim)
),
user_profile AS (
    SELECT 
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles ON profiles.id = rpi.resolved_profile_id
),
-- Aggregate ta items
ta_items_agg AS (
    SELECT COALESCE(ARRAY_AGG(tr.item ORDER BY (SELECT title FROM sim_meta WHERE simulation_id = (tr.item).simulation_id)), '{}'::types.q_get_home_overview_v3_simulation_item[]) as items
    FROM ta_rows tr
),
-- Aggregate inst items
inst_items_agg AS (
    SELECT COALESCE(ARRAY_AGG(ir.item ORDER BY ir.has_passed_bool ASC, ir.sort_cohort_name NULLS LAST, ir.sort_title), '{}'::types.q_get_home_overview_v3_simulation_item[]) as items
    FROM inst_rows ir
),
-- Aggregate mappings separately
standard_groups_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT standard_group), '{}'::types.q_get_home_overview_v3_standard_group[]) as standard_groups
    FROM standard_groups_array
),
standards_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT standard), '{}'::types.q_get_home_overview_v3_standard[]) as standards
    FROM standards_array
),
simulations_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT simulation), '{}'::types.q_get_home_overview_v3_simulation[]) as simulations
    FROM simulation_array
)
SELECT 
    up.actor_name::text as actor_name,
    (SELECT mode FROM profile_role_lookup)::text as mode,
    CASE 
        WHEN (SELECT is_member_mode FROM profile_role_lookup) THEN EXISTS(SELECT 1 FROM ta_rows)
        ELSE EXISTS(SELECT 1 FROM inst_rows)
    END::boolean as has_data,
    CASE
        WHEN (SELECT is_member_mode FROM profile_role_lookup) THEN COALESCE((SELECT items FROM ta_items_agg), '{}'::types.q_get_home_overview_v3_simulation_item[])
        ELSE COALESCE((SELECT items FROM inst_items_agg), '{}'::types.q_get_home_overview_v3_simulation_item[])
    END as items,
    COALESCE((SELECT standard_groups FROM standard_groups_agg), '{}'::types.q_get_home_overview_v3_standard_group[]) as standard_groups,
    COALESCE((SELECT standards FROM standards_agg), '{}'::types.q_get_home_overview_v3_standard[]) as standards,
    COALESCE((SELECT simulations FROM simulations_agg), '{}'::types.q_get_home_overview_v3_simulation[]) as simulations
FROM user_profile up
$$;

COMMIT;

