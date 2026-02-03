-- Get home overview with items and mappings (no history - bundle only returns top half)
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_home_overview_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_home_overview_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_home_overview_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_home_overview_v4_simulation_item AS (
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
    cohort_names_junction text
);

CREATE TYPE types.q_get_home_overview_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_get_home_overview_v4_standard AS (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_get_home_overview_v4_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit int,
    department_ids text[]
);

-- 4) Recreate function
-- Accept dates as text (ISO format strings) and cast to timestamptz internally
-- This allows Python to pass ISO strings from model_dump(mode="json"), and SQL handles conversion
CREATE OR REPLACE FUNCTION api_get_home_overview_v4(
    start_date text,
    end_date text,
    profile_id uuid,
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    actor_name text,
    mode text,  -- 'member' | 'instructional' | 'empty'
    has_data boolean,
    items types.q_get_home_overview_v4_simulation_item[],
    standard_groups types.q_get_home_overview_v4_standard_group[],
    standards types.q_get_home_overview_v4_standard[],
    simulations types.q_get_home_overview_v4_simulation[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        start_date::timestamptz AS start_date,
        end_date::timestamptz AS end_date,
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
-- Get profile info from profiles_resource (denormalized: role, cohort_ids, department_ids)
current_profile AS (
    SELECT
        pr.id,
        pr.role,
        pr.cohort_ids,
        pr.department_ids
    FROM profiles_resource pr
    CROSS JOIN resolve_profile_id rpi
    WHERE pr.id = rpi.resolved_profile_id
),
-- Look up profile role using profiles_resource.role directly (no junction needed)
profile_type_lookup AS (
    SELECT
        CASE
            WHEN rpi.resolved_profile_id IS NULL THEN 'instructional'
            WHEN cp.role = 'member' THEN 'member'
            ELSE 'instructional'
        END AS mode,
        CASE
            WHEN rpi.resolved_profile_id IS NULL THEN false
            ELSE COALESCE(cp.role = 'member', false)
        END AS is_member_mode,
        -- Compute role hierarchy array based on profile's role
        CASE
            WHEN rpi.resolved_profile_id IS NULL THEN ARRAY['instructional', 'member', 'guest']::profile_type[]
            WHEN cp.role = 'superadmin' THEN ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest']::profile_type[]
            WHEN cp.role = 'admin' THEN ARRAY['admin', 'instructional', 'member', 'guest']::profile_type[]
            WHEN cp.role = 'instructional' THEN ARRAY['instructional', 'member', 'guest']::profile_type[]
            WHEN cp.role = 'member' THEN ARRAY['member', 'guest']::profile_type[]
            WHEN cp.role = 'guest' THEN ARRAY['guest']::profile_type[]
            ELSE ARRAY['instructional', 'member', 'guest']::profile_type[]
        END AS role_hierarchy
    FROM resolve_profile_id rpi
    LEFT JOIN current_profile cp ON true
),
-- Filter using mv_dashboard_facts for items: for member mode include profileId filter
-- Filter by cohort_id directly using resource IDs (matches mv_dashboard_facts.cohort_id)
filt AS (
    SELECT
        f.chat_id,
        f.attempt_id,
        f.profile_id,
        f.simulation_id,
        f.scenario_id,
        f.persona_id,
        f.department_id,
        f.cohort_id,
        f.role_id,
        f.attempt_created_at,
        f.chat_created_at,
        f.grade_created_at,
        f.is_archived,
        f.infinite_mode,
        f.completed,
        f.score,
        f.passed,
        f.time_taken AS time_taken_seconds,
        f.rubric_total_points AS rubric_points_junction,
        f.rubric_pass_points,
        f.grade_percent,
        f.num_messages_total,
        f.num_query_messages,
        f.num_response_messages,
        f.message_time_taken_seconds,
        f.attempt_type,
        (f.attempt_type = 'general' AND NOT f.is_archived) AS is_general,
        (f.attempt_type = 'practice') AS is_practice
    FROM params p
    CROSS JOIN profile_type_lookup prl
    CROSS JOIN resolve_profile_id rpi
    CROSS JOIN mv_dashboard_facts f
    WHERE f.attempt_created_at >= p.start_date
      AND f.attempt_created_at < p.end_date
      AND f.attempt_type = 'general'
      AND NOT f.is_archived
      AND (NOT prl.is_member_mode OR f.profile_id = rpi.resolved_profile_id)
      -- Filter by cohort_id directly (cohort_ids are now resource IDs matching mv_dashboard_facts.cohort_id)
      AND (cardinality(p.cohort_ids) = 0 OR f.cohort_id = ANY(p.cohort_ids))
),
-- Get cohort-simulation pairs using denormalized fields
-- cohorts_resource.simulation_ids contains resource IDs, cohorts_resource.department_ids for filtering
cohort_sim AS (
    SELECT
        cr.id AS cohort_id,
        COALESCE(cr.name, '') AS cohort_title,
        unnest(cr.simulation_ids) AS simulation_id
    FROM params p
    CROSS JOIN cohorts_resource cr
    WHERE cr.active = true
      AND (cardinality(p.cohort_ids) = 0 OR cr.id = ANY(p.cohort_ids))
      AND (cardinality(p.department_ids) = 0 OR cr.department_ids && p.department_ids OR cardinality(cr.department_ids) = 0)
),
-- Expected scenarios per simulation - derived from actual attempts in filt
-- (scenarios that appear in mv_dashboard_facts are active by definition)
sim_expected AS (
    SELECT
        f.simulation_id,
        COUNT(DISTINCT f.scenario_id)::int AS expected_scenarios
    FROM filt f
    WHERE f.scenario_id IS NOT NULL
    GROUP BY f.simulation_id
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
-- Completed attempts count (includes attempts with or without view_grades_entry)
completed_attempts_count AS (
    SELECT
        a.profile_id,
        a.simulation_id,
        COUNT(DISTINCT a.attempt_id) AS completed_count
    FROM filt a
    WHERE a.completed = TRUE
    GROUP BY a.profile_id, a.simulation_id
),
-- Pass threshold per simulation - from mv_dashboard_facts (already denormalized)
sim_pass_threshold AS (
    SELECT DISTINCT ON (simulation_id)
        simulation_id,
        CASE WHEN rubric_points_junction > 0
             THEN ROUND(100.0 * rubric_pass_points::numeric / rubric_points_junction)
             ELSE 0 END AS pass_threshold_pct
    FROM filt
    WHERE rubric_points_junction IS NOT NULL AND rubric_points_junction > 0
),
-- User-simulation status with best attempt + pass status
-- Uses denormalized rubric data from mv_dashboard_facts (no junction lookups needed)
user_sim_status AS (
    SELECT
        COALESCE(aa.profile_id, cac.profile_id) AS profile_id,
        COALESCE(aa.simulation_id, cac.simulation_id) AS simulation_id,
        MAX(aa.avg_pct_over_expected) AS avg_pct_over_expected,
        COALESCE(BOOL_OR(aa.avg_pct_over_expected >= COALESCE(spt.pass_threshold_pct, 0)), false) AS passed,
        COALESCE(MAX(cac.completed_count), 0) AS chats_completed
    FROM attempt_avg aa
    FULL OUTER JOIN completed_attempts_count cac ON cac.profile_id = aa.profile_id AND cac.simulation_id = aa.simulation_id
    LEFT JOIN sim_pass_threshold spt ON spt.simulation_id = COALESCE(aa.simulation_id, cac.simulation_id)
    GROUP BY COALESCE(aa.profile_id, cac.profile_id), COALESCE(aa.simulation_id, cac.simulation_id), spt.pass_threshold_pct
),
-- Cohort membership CTE (for non-history queries - only active memberships)
-- Uses denormalized fields: profiles_resource.cohort_ids, profiles_resource.role, cohorts_resource.simulation_ids, cohorts_resource.department_ids
cohort_membership AS (
    SELECT
        pr.id AS profile_id,
        cr.id AS cohort_id,
        unnest(cr.simulation_ids) AS simulation_id,
        COALESCE(cr.name, '') AS cohort_title,
        pr.role
    FROM params p
    CROSS JOIN profiles_resource pr
    CROSS JOIN LATERAL unnest(pr.cohort_ids) AS profile_cohort_id
    JOIN cohorts_resource cr ON cr.id = profile_cohort_id AND cr.active = true
    CROSS JOIN profile_type_lookup prl
    CROSS JOIN resolve_profile_id rpi
    WHERE pr.active = true
      AND (cardinality(p.cohort_ids) = 0 OR cr.id = ANY(p.cohort_ids))
      AND pr.role = ANY(prl.role_hierarchy)  -- Use computed role hierarchy from profile_type_lookup
      -- When member mode, only include the current member's profile_id
      AND (NOT prl.is_member_mode OR pr.id = rpi.resolved_profile_id)
      -- Filter by department_ids using denormalized field on cohorts_resource
      AND (cardinality(p.department_ids) = 0 OR cr.department_ids && p.department_ids OR cardinality(cr.department_ids) = 0)
),
-- Simulation scenario data - derived from actual attempts in filt
-- Gets time limits from scenario_time_limits_resource (joined via scenario_id)
sim_scenario_data AS (
    SELECT
        f.simulation_id,
        COUNT(DISTINCT f.scenario_id)::int AS num_scenarios,
        COALESCE(SUM(DISTINCT stlr.time_limit_seconds), 0)::int AS time_limit,
        -- Get rubric_id from scenario_rubrics_resource (mv_dashboard_facts.rubric_id is not populated)
        (ARRAY_AGG(srr.rubric_id) FILTER (WHERE srr.rubric_id IS NOT NULL))[1] AS rubric_id,
        MAX(f.rubric_points_junction)::int AS rubric_points_junction,
        MAX(f.rubric_pass_points)::int AS rubric_pass_points
    FROM filt f
    LEFT JOIN scenario_time_limits_resource stlr ON stlr.scenario_id = f.scenario_id AND stlr.active = true
    LEFT JOIN scenario_rubrics_resource srr ON srr.scenario_id = f.scenario_id AND srr.active = true
    WHERE f.scenario_id IS NOT NULL
    GROUP BY f.simulation_id
),
-- Simulation metadata - uses simulations_resource for name/description, sim_scenario_data for the rest
sim_meta AS (
    SELECT DISTINCT
        cs.simulation_id AS simulation_id,
        COALESCE(sr.name, '') AS title,
        COALESCE(sr.description, '') AS description,
        COALESCE(ssd.time_limit, 0) AS time_limit,
        ssd.rubric_id,
        COALESCE(ssd.num_scenarios, 0) AS num_scenarios,
        COALESCE(ssd.rubric_points_junction, 0) AS rubric_points_junction,
        COALESCE(ssd.rubric_pass_points, 0) AS rubric_pass_points
    FROM cohort_sim cs
    JOIN simulations_resource sr ON sr.id = cs.simulation_id
    LEFT JOIN sim_scenario_data ssd ON ssd.simulation_id = cs.simulation_id
),
-- Simulation persona metadata - get most common persona's color/icon from actual attempts
-- Uses personas_resource directly (has icon/color columns) and mv_dashboard_facts.persona_id
sim_persona_meta AS (
    SELECT
        sm.simulation_id,
        (ARRAY_AGG(COALESCE(p.color, '') ORDER BY cnt DESC, COALESCE(p.color, '') DESC))[1] AS color,
        (ARRAY_AGG(COALESCE(p.icon, '') ORDER BY cnt DESC, COALESCE(p.icon, '') DESC))[1] AS icon
    FROM (
        SELECT
            f.simulation_id,
            f.persona_id,
            COUNT(*) AS cnt
        FROM filt f
        WHERE f.persona_id IS NOT NULL
        GROUP BY f.simulation_id, f.persona_id
    ) sm
    LEFT JOIN personas_resource p ON p.id = sm.persona_id
    GROUP BY sm.simulation_id
),
-- Standard view_groups_entry per simulation - uses rubric_standard_groups_junction (normalized)
sim_standard_groups AS (
    SELECT
        sme.simulation_id,
        ARRAY(SELECT rsgj.standard_group_id::text FROM rubric_rubrics_junction rrj
              JOIN rubric_standard_groups_junction rsgj ON rsgj.rubric_id = rrj.rubric_id AND rsgj.active = true
              WHERE rrj.rubrics_id = sme.rubric_id AND rrj.active = true
              ORDER BY rsgj.standard_group_id) AS standard_group_ids
    FROM sim_meta sme
    WHERE sme.rubric_id IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM rubric_rubrics_junction rrj
          JOIN rubric_standard_groups_junction rsgj ON rsgj.rubric_id = rrj.rubric_id AND rsgj.active = true
          WHERE rrj.rubrics_id = sme.rubric_id AND rrj.active = true
      )
),
-- TA VIEW: Primary cohort per simulation for the TA
-- Uses denormalized fields: current_profile.cohort_ids, cohorts_resource.simulation_ids, cohorts_resource.department_ids
ta_primary_cohort AS (
    SELECT
        cr.id AS cohort_id,
        COALESCE(cr.name, '') AS cohort_title,
        sim_id AS simulation_id,
        ROW_NUMBER() OVER (ORDER BY cr.id, sim_id) AS order_idx,
        ROW_NUMBER() OVER (PARTITION BY sim_id ORDER BY cr.id) AS rn
    FROM params p
    CROSS JOIN current_profile cp
    CROSS JOIN LATERAL unnest(cp.cohort_ids) AS profile_cohort_id
    JOIN cohorts_resource cr ON cr.id = profile_cohort_id AND cr.active = true
    CROSS JOIN LATERAL unnest(cr.simulation_ids) AS sim_id
    WHERE (cardinality(p.cohort_ids) = 0 OR cr.id = ANY(p.cohort_ids))
      -- Filter by department_ids using denormalized field on cohorts_resource
      AND (cardinality(p.department_ids) = 0 OR cr.department_ids && p.department_ids OR cardinality(cr.department_ids) = 0)
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
         CASE WHEN s.rubric_points_junction > 0
              THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points_junction)::int
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
         CASE WHEN s.rubric_points_junction > 0
              THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points_junction)::int
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
        )::types.q_get_home_overview_v4_simulation_item AS item
    FROM sim_meta s
    LEFT JOIN sim_persona_meta spm ON spm.simulation_id = s.simulation_id
    LEFT JOIN sim_standard_groups ssg ON ssg.simulation_id = s.simulation_id
    WHERE EXISTS (SELECT 1 FROM profile_type_lookup prl WHERE prl.is_member_mode)
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
         CASE WHEN s.rubric_points_junction > 0
              THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points_junction)::int
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
        )::types.q_get_home_overview_v4_simulation_item AS item,
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
    WHERE NOT EXISTS (SELECT 1 FROM profile_type_lookup prl WHERE prl.is_member_mode)
),
-- Get all standard_group_ids from rubrics used in sim_meta (using normalized junction table)
all_standard_group_ids AS (
    SELECT DISTINCT rsgj.standard_group_id
    FROM sim_meta sme
    JOIN rubric_rubrics_junction rrj ON rrj.rubrics_id = sme.rubric_id AND rrj.active = true
    JOIN rubric_standard_groups_junction rsgj ON rsgj.rubric_id = rrj.rubric_id AND rsgj.active = true
    WHERE sme.rubric_id IS NOT NULL
),
-- Standard view_groups_entry mapping (as array)
standard_groups_array AS (
    SELECT
        (sg.id, sg.name, sg.description, sg.points, sg.pass_points)::types.q_get_home_overview_v4_standard_group AS standard_group
    FROM all_standard_group_ids asg
    JOIN standard_groups_resource sg ON sg.id = asg.standard_group_id AND sg.active = true
),
-- Standards mapping (as array)
standards_array AS (
    SELECT
        (st.id, st.standard_group_id, st.name, st.description, st.points)::types.q_get_home_overview_v4_standard AS standard
    FROM standards_resource st
    WHERE st.standard_group_id IN (SELECT standard_group_id FROM all_standard_group_ids)
      AND st.active = true
),
-- Simulation mapping (as array) - uses sim_meta for time_limit, simulations_resource for departments
simulation_array AS (
    SELECT
        (sr.id, COALESCE(sr.name, ''), COALESCE(sr.description, ''),
         COALESCE(sme.time_limit, 0),
         COALESCE(sr.department_ids::text[], ARRAY[]::text[])
        )::types.q_get_home_overview_v4_simulation AS simulation
    FROM (SELECT DISTINCT simulation_id FROM cohort_sim) cs
    JOIN simulations_resource sr ON sr.id = cs.simulation_id
    LEFT JOIN sim_meta sme ON sme.simulation_id = cs.simulation_id
),
user_profile AS (
    SELECT COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
),
-- Aggregate ta items
ta_items_agg AS (
    SELECT COALESCE(ARRAY_AGG(tr.item ORDER BY (SELECT sm.title FROM sim_meta sm WHERE sm.simulation_id = (tr.item).simulation_id)), '{}'::types.q_get_home_overview_v4_simulation_item[]) as items
    FROM ta_rows tr
),
-- Aggregate inst items
inst_items_agg AS (
    SELECT COALESCE(ARRAY_AGG(ir.item ORDER BY ir.has_passed_bool ASC, ir.sort_cohort_name NULLS LAST, ir.sort_title), '{}'::types.q_get_home_overview_v4_simulation_item[]) as items
    FROM inst_rows ir
),
-- Aggregate mappings separately
standard_groups_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT standard_group), '{}'::types.q_get_home_overview_v4_standard_group[]) as standard_groups
    FROM standard_groups_array
),
standards_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT standard), '{}'::types.q_get_home_overview_v4_standard[]) as standards
    FROM standards_array
),
simulations_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT simulation), '{}'::types.q_get_home_overview_v4_simulation[]) as simulations
    FROM simulation_array
)
SELECT 
    up.actor_name::text as actor_name,
    (SELECT mode FROM profile_type_lookup)::text as mode,
    CASE 
        WHEN (SELECT is_member_mode FROM profile_type_lookup) THEN EXISTS(SELECT 1 FROM ta_rows)
        ELSE EXISTS(SELECT 1 FROM inst_rows)
    END::boolean as has_data,
    CASE
        WHEN (SELECT is_member_mode FROM profile_type_lookup) THEN COALESCE((SELECT items FROM ta_items_agg), '{}'::types.q_get_home_overview_v4_simulation_item[])
        ELSE COALESCE((SELECT items FROM inst_items_agg), '{}'::types.q_get_home_overview_v4_simulation_item[])
    END as items,
    COALESCE((SELECT standard_groups FROM standard_groups_agg), '{}'::types.q_get_home_overview_v4_standard_group[]) as standard_groups,
    COALESCE((SELECT standards FROM standards_agg), '{}'::types.q_get_home_overview_v4_standard[]) as standards,
    COALESCE((SELECT simulations FROM simulations_agg), '{}'::types.q_get_home_overview_v4_simulation[]) as simulations
FROM user_profile up
$$;