-- Home overview query - complete analytics with embedded history and mappings
-- This query uses dynamic WHERE clause building from AnalyticsQueryBuilder
-- Parameters will be built in the route using the query builder pattern
--
-- Note: This SQL file contains the template structure. The WHERE clause
-- for the 'filt' CTE is built dynamically using AnalyticsQueryBuilder.build_base_filter
-- Parameters (in order):
-- $1, $2: start_date (datetime), end_date (datetime) - for WHERE clause
-- $3: profile_id (uuid) - required, used for member mode detection and role hierarchy computation
-- $4: cohort_ids (uuid[])
-- $5: department_ids (uuid[])
-- Roles are inferred from profile_id in the profile_role_lookup CTE (no longer a parameter)
--
-- The WHERE clause for 'filt' CTE is inserted at the marked location below

WITH resolve_profile_id AS (
    -- Resolve profile ID from parameter
    SELECT 
        CASE 
            WHEN $3::text IS NULL OR $3::text = '' THEN NULL::uuid
            ELSE $3::uuid
        END as resolved_profile_id
),
-- Filter simulations by cohorts (new filtering order: cohorts → simulations)
-- Gets simulations linked to cohorts + practice simulations without cohorts
filtered_simulation_ids AS (
    SELECT DISTINCT s.id AS simulation_id
    FROM simulations s
    WHERE s.active = TRUE
      AND (
          -- If cohort_ids provided, get simulations linked to those cohorts
          (cardinality($4::uuid[]) > 0 AND EXISTS (
              SELECT 1 
              FROM cohort_simulations cs 
              WHERE cs.simulation_id = s.id 
                AND cs.cohort_id = ANY($4::uuid[])
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
          (cardinality($4::uuid[]) = 0)
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
            ELSE COALESCE((SELECT role = 'member' FROM profiles WHERE id = rpi.resolved_profile_id), false)
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
-- Parameters: $1=start_date, $2=end_date (for date filtering)
filt AS (
    SELECT a.* 
    FROM analytics a, profile_role_lookup prl, resolve_profile_id rpi
    WHERE a.attempt_created_at >= $1 
      AND a.attempt_created_at < $2 
      AND a.is_general = TRUE
      AND (NOT prl.is_member_mode OR a.profile_id = rpi.resolved_profile_id)
      -- Filter by simulation_ids from cohorts (new filtering order)
      AND (cardinality($4::uuid[]) = 0 OR a.simulation_id IN (SELECT simulation_id FROM filtered_simulation_ids))
),
-- Get cohort-simulation pairs (includes empty cohorts)
cohort_sim AS (
    SELECT c.id AS cohort_id, c.title AS cohort_title, cs.simulation_id
    FROM cohorts c
    JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.active = true
    LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
    WHERE (cardinality($4::uuid[]) = 0 OR c.id = ANY($4::uuid[]))
    GROUP BY c.id, c.title, cs.simulation_id
    HAVING 
        (cardinality($5::uuid[]) = 0 OR COUNT(cd.cohort_id) FILTER (WHERE cd.department_id = ANY($5::uuid[])) > 0)
        OR (cardinality($5::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true))
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
             LEFT JOIN rubrics r ON r.id = ss_rubric.rubric_id
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
        p.role
    FROM cohort_profiles cp
    JOIN cohorts c ON c.id = cp.cohort_id
    JOIN cohort_simulations cs ON cs.cohort_id = c.id
    JOIN profiles p ON p.id = cp.profile_id
    LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
    CROSS JOIN profile_role_lookup prl
    CROSS JOIN resolve_profile_id rpi
    WHERE cp.active = true  -- Only active cohort memberships for non-history queries
      AND (cardinality($4::uuid[]) = 0 OR c.id = ANY($4::uuid[]))
      AND p.role = ANY(prl.role_hierarchy)  -- Use computed role hierarchy from profile_role_lookup
      -- When member mode, only include the current member's profile_id
      AND (NOT prl.is_member_mode OR cp.profile_id = rpi.resolved_profile_id)
    GROUP BY cp.profile_id, cp.cohort_id, cs.simulation_id, c.title, p.role, c.id
    HAVING 
        (cardinality($5::uuid[]) = 0 OR COUNT(cd.cohort_id) FILTER (WHERE cd.department_id = ANY($5::uuid[])) > 0)
        OR (cardinality($5::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true))
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
        (SELECT ss.rubric_id FROM simulation_scenarios ss WHERE ss.simulation_id = s.id AND ss.active = true ORDER BY ss.position LIMIT 1) as rubric_id,
        COALESCE((SELECT COUNT(*)::int FROM simulation_scenarios ss WHERE ss.simulation_id = s.id), 0) AS num_scenarios,
        COALESCE(r.points, 0) AS rubric_points,
        COALESCE(r.pass_points, 0) AS rubric_pass_points
    FROM simulations s
    LEFT JOIN simulation_scenarios ss_rubric ON ss_rubric.simulation_id = s.id AND ss_rubric.active = true
    LEFT JOIN rubrics r ON r.id = ss_rubric.rubric_id
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
-- TA VIEW: Primary cohort per simulation for the TA
ta_primary_cohort AS (
    SELECT
        c.id AS cohort_id,
        c.title AS cohort_title,
        cs.simulation_id,
        ROW_NUMBER() OVER (ORDER BY c.id, cs.simulation_id) AS order_idx,
        ROW_NUMBER() OVER (PARTITION BY cs.simulation_id ORDER BY c.id) AS rn
    FROM cohorts c
    JOIN cohort_simulations cs ON cs.cohort_id = c.id
    JOIN cohort_profiles cp ON cp.cohort_id = c.id
        AND cp.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
    LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
    WHERE (cardinality($4::uuid[]) = 0 OR c.id = ANY($4::uuid[]))
    GROUP BY c.id, c.title, cs.simulation_id
    HAVING 
        (cardinality($5::uuid[]) = 0 OR COUNT(cd.cohort_id) FILTER (WHERE cd.department_id = ANY($5::uuid[])) > 0)
        OR (cardinality($5::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true))
),
ta_sim_space AS (
    SELECT DISTINCT simulation_id FROM ta_primary_cohort
),
ta_rows AS (
    SELECT
        json_build_object(
            'viewMode', 'member',
            'id', s.simulation_id::text,
            'simulationTitle', s.title,
            'simulationDescription', s.description,
            'simulationName', s.title,
            'timeLimit', s.time_limit,
            'numSessions', s.num_scenarios,
            'highestScore', (
                SELECT ROUND(GREATEST(0, LEAST(100, uss.avg_pct_over_expected)))::int
                FROM user_sim_status uss, resolve_profile_id rpi
                WHERE uss.profile_id = rpi.resolved_profile_id
                  AND uss.simulation_id = s.simulation_id
            ),
            'rubric_id', s.rubric_id::text,
            'color', spm.color,
            'icon', spm.icon,
            'hasPassed', (
                SELECT COALESCE(uss.passed, false)
                FROM user_sim_status uss, resolve_profile_id rpi
                WHERE uss.profile_id = rpi.resolved_profile_id
                  AND uss.simulation_id = s.simulation_id
            ),
            'passRate', CASE WHEN s.rubric_points > 0
                             THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
                             ELSE NULL END,
            'status', COALESCE((
                SELECT CASE
                          WHEN COALESCE(uss.passed, false) THEN 'passed'
                          WHEN COALESCE(uss.chats_completed, 0) > 0 THEN 'in-progress'
                          ELSE 'not-started'
                        END
                FROM user_sim_status uss, resolve_profile_id rpi
                WHERE uss.profile_id = rpi.resolved_profile_id
                  AND uss.simulation_id = s.simulation_id
            ), 'not-started'),
            'completionPct', COALESCE((
                SELECT ROUND(GREATEST(0, LEAST(100, uss.avg_pct_over_expected)))::int
                FROM user_sim_status uss, resolve_profile_id rpi
                WHERE uss.profile_id = rpi.resolved_profile_id
                  AND uss.simulation_id = s.simulation_id
            ), 0),
            'passedCount', NULL,
            'inProgressCount', NULL,
            'notStartedCount', NULL,
            'passPct', CASE WHEN s.rubric_points > 0
                            THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
                            ELSE NULL END,
            'cohortName', (
                SELECT tpc.cohort_title
                FROM ta_primary_cohort tpc
                WHERE tpc.simulation_id = s.simulation_id AND tpc.rn = 1
            ),
            'cohortNames', (
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
            ),
            'orderIndex', (
                SELECT tpc.order_idx
                FROM ta_primary_cohort tpc
                WHERE tpc.simulation_id = s.simulation_id AND tpc.rn = 1
            ),
            'standard_groups', COALESCE((
                SELECT jsonb_object_agg(
                    sg.id::text,
                    (
                        SELECT jsonb_agg(st.id::text ORDER BY st.points DESC)
                        FROM standards st
                        WHERE st.standard_group_id = sg.id
                    )
                )
                FROM simulation_scenarios ss
                JOIN rubric_standard_groups rsg ON rsg.rubric_id = ss.rubric_id AND rsg.active = true
                JOIN standard_groups sg ON sg.id = rsg.standard_group_id
                WHERE ss.simulation_id = s.simulation_id AND ss.active = true
                ORDER BY ss.position
                LIMIT 1
            ), '{}'::jsonb)
        ) AS item
    FROM sim_meta s
    LEFT JOIN sim_persona_meta spm ON spm.simulation_id = s.simulation_id
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
        json_build_object(
            'viewMode', 'instructional',
            'id', s.simulation_id::text,
            'simulationTitle', s.title,
            'simulationDescription', s.description,
            'simulationName', s.title,
            'timeLimit', s.time_limit,
            'numSessions', s.num_scenarios,
            'highestScore', NULL,
            'rubric_id', s.rubric_id::text,
            'color', spm.color,
            'icon', spm.icon,
            'hasPassed', CASE
                            WHEN COALESCE(ic.total_members, 0) = 0 THEN true
                            WHEN COALESCE(ic.passed_count, 0) = COALESCE(ic.total_members, 0) THEN true
                            ELSE false END,
            'passRate', CASE WHEN s.rubric_points > 0
                             THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
                             ELSE NULL END,
            'status', CASE
                         WHEN COALESCE(ic.total_members, 0) = 0 THEN 'passed'
                         WHEN COALESCE(ic.passed_count, 0) = COALESCE(ic.total_members, 0) THEN 'passed'
                         WHEN COALESCE(ic.passed_count, 0) > 0 OR COALESCE(ic.in_progress_count, 0) > 0 THEN 'in-progress'
                         ELSE 'not-started'
                       END,
            'completionPct', CASE
                                WHEN COALESCE(ic.total_members, 0) > 0
                                THEN ROUND(100.0 * (COALESCE(ic.passed_count, 0) + COALESCE(ic.in_progress_count, 0))::numeric / ic.total_members)::int
                                ELSE 0
                              END,
            'passedCount', COALESCE(ic.passed_count, 0),
            'inProgressCount', COALESCE(ic.in_progress_count, 0),
            'notStartedCount', GREATEST(COALESCE(ic.total_members, 0) - COALESCE(ic.passed_count, 0) - COALESCE(ic.in_progress_count, 0), 0),
            'passPct', NULL,
            'cohortName', (icn.titles)[1],
            'cohortNames', CASE
                              WHEN array_length(icn.titles, 1) IS NULL OR array_length(icn.titles, 1) = 0 THEN NULL
                              WHEN array_length(icn.titles, 1) = 1 THEN icn.titles[1]
                              WHEN array_length(icn.titles, 1) = 2 THEN icn.titles[1] || ' and ' || icn.titles[2]
                              ELSE array_to_string(icn.titles[1:array_length(icn.titles,1)-1], ', ')
                                   || ', and ' || icn.titles[array_length(icn.titles,1)]
                            END,
            'orderIndex', ROW_NUMBER() OVER (ORDER BY s.simulation_id),
            'standard_groups', COALESCE((
                SELECT jsonb_object_agg(
                    sg.id::text,
                    (
                        SELECT jsonb_agg(st.id::text ORDER BY st.points DESC)
                        FROM standards st
                        WHERE st.standard_group_id = sg.id
                    )
                )
                FROM simulation_scenarios ss
                JOIN rubric_standard_groups rsg ON rsg.rubric_id = ss.rubric_id AND rsg.active = true
                JOIN standard_groups sg ON sg.id = rsg.standard_group_id
                WHERE ss.simulation_id = s.simulation_id AND ss.active = true
                ORDER BY ss.position
                LIMIT 1
            ), '{}'::jsonb)
        ) AS item,
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
    WHERE NOT EXISTS (SELECT 1 FROM profile_role_lookup prl WHERE prl.is_member_mode)
),
all_rubric_ids AS (
    SELECT DISTINCT rubric_id FROM sim_meta
),
standard_groups_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            sg.id::text,
            jsonb_build_object(
                'name', sg.name,
                'description', sg.description,
                'points', sg.points,
                'passPoints', sg.pass_points
            )
        ),
        '{}'::jsonb
    ) AS mapping
    FROM rubric_standard_groups rsg
    JOIN standard_groups sg ON sg.id = rsg.standard_group_id
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
),
standards_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            st.id::text,
            jsonb_build_object(
                'name', st.name,
                'description', st.description,
                'points', st.points
            )
        ),
        '{}'::jsonb
    ) AS mapping
    FROM standards st
    WHERE st.standard_group_id IN (
        SELECT rsg.standard_group_id FROM rubric_standard_groups rsg
        WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
    )
),
simulation_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            sim.id::text,
            jsonb_build_object(
                'name', sim.title, 
                'description', COALESCE(sim.description, ''),
                'time_limit', COALESCE(
                    (SELECT SUM(stl.time_limit_seconds)
                     FROM scenario_time_limits stl
                     JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
                     WHERE stl.simulation_id = sim.id AND stl.active = true AND ss.active = true),
                    0
                ),
                'department_ids', CASE 
                    WHEN sdd.department_ids IS NOT NULL THEN to_jsonb(sdd.department_ids)
                    ELSE NULL::jsonb
                END
            )
        ),
        '{}'::jsonb
    ) as mapping
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
)
SELECT json_build_object(
    'mode', (SELECT mode FROM profile_role_lookup),
    'hasData', CASE WHEN (SELECT is_member_mode FROM profile_role_lookup) THEN EXISTS(SELECT 1 FROM ta_rows) ELSE EXISTS(SELECT 1 FROM inst_rows) END,
    'items', CASE
        WHEN (SELECT is_member_mode FROM profile_role_lookup) THEN COALESCE((SELECT json_agg(item ORDER BY (item->>'simulationTitle')) FROM ta_rows), '[]'::json)
        ELSE COALESCE((SELECT json_agg(item ORDER BY has_passed_bool ASC, sort_cohort_name NULLS LAST, sort_title) FROM inst_rows), '[]'::json)
    END,
    'standard_groups_mapping', COALESCE((SELECT mapping FROM standard_groups_mapping), '{}'::jsonb),
    'standards_mapping', COALESCE((SELECT mapping FROM standards_mapping), '{}'::jsonb),
    'simulation_mapping', (SELECT mapping FROM simulation_mapping_data)
) AS result

