-- Practice overview query - complete analytics with embedded history and all entity mappings
-- Parameters: $1 = profile_id (uuid), $2 = department_ids (uuid[])
-- Note: profile_id serves as historyProfileId for practice (same person)

WITH
-- Resolve guest-profile-id to actual profile ID
resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $1::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
-- 1) Simulation meta (practice only)
sim_meta AS (
    SELECT
        s.id AS simulation_id,
        s.title AS simulation_title,
        s.description AS simulation_description,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) AS time_limit,
        (SELECT ss.rubric_id FROM simulation_scenarios ss WHERE ss.simulation_id = s.id AND ss.active = true ORDER BY ss.position LIMIT 1) as rubric_id,
        COALESCE((SELECT COUNT(*)::int FROM simulation_scenarios ss WHERE ss.simulation_id = s.id), 0) AS num_scenarios,
        r.points AS rubric_points,
        r.pass_points AS rubric_pass_points,
        s.updated_at
    FROM simulations s
    LEFT JOIN simulation_scenarios ss_rubric ON ss_rubric.simulation_id = s.id AND ss_rubric.active = true
    LEFT JOIN rubrics r ON r.id = ss_rubric.rubric_id
    LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE s.active = TRUE
      AND s.practice_simulation = TRUE
    GROUP BY s.id, s.title, s.description, r.points, r.pass_points, s.updated_at, ss_rubric.rubric_id
    HAVING 
        (cardinality($2::uuid[]) = 0 OR COUNT(sd.simulation_id) FILTER (WHERE sd.department_id = ANY($2::uuid[])) > 0)
        OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true))
),
-- 2) Persona color/icon
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
        LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
        WHERE s.practice_simulation = TRUE
        GROUP BY s.id, sp.persona_id
        HAVING 
            (cardinality($2::uuid[]) = 0 OR COUNT(sd.simulation_id) FILTER (WHERE sd.department_id = ANY($2::uuid[])) > 0)
            OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true))
    ) sm
    LEFT JOIN personas p ON p.id = sm.persona_id
    GROUP BY sm.simulation_id
),
-- 3) All-time analytics slice (lifetime data for this user)
filt_all AS (
    SELECT a.*
    FROM analytics a, resolve_profile_id rpi
    WHERE a.profile_id = rpi.resolved_profile_id
      AND a.is_practice = TRUE
      -- Department filtering removed - departments are already filtered at profile level via profile_departments
),
-- 4) Per-attempt progression (completed-only average - lifetime)
attempt_progress AS (
    SELECT
        attempt_id,
        profile_id,
        simulation_id,
        COUNT(DISTINCT scenario_id) FILTER (WHERE completed) AS completed_root_scenarios,
        AVG(grade_percent) FILTER (WHERE completed) AS avg_score_completed,
        BOOL_OR(passed) AS any_passed_attempt,
        MAX(chat_created_at) AS last_time
    FROM filt_all
    GROUP BY attempt_id, profile_id, simulation_id
),
-- 5) Latest attempt per (profile, simulation) for completionPct
latest_attempt_per_profile_sim AS (
    SELECT DISTINCT ON (profile_id, simulation_id)
           profile_id, simulation_id, attempt_id,
           completed_root_scenarios, any_passed_attempt, last_time
    FROM attempt_progress
    ORDER BY profile_id, simulation_id, last_time DESC
),
-- 6) Activity by (profile, simulation) - lifetime
activity_by_profile_sim AS (
    SELECT
        profile_id,
        simulation_id,
        COUNT(DISTINCT chat_id) AS chats,
        BOOL_OR(passed) AS any_passed
    FROM filt_all
    GROUP BY profile_id, simulation_id
),
-- 7) Pass threshold
sim_pass_pct AS (
    SELECT DISTINCT ON (s.id)
           s.id AS simulation_id,
           CASE WHEN r.points > 0
                THEN (r.pass_points::numeric / r.points::numeric) * 100.0
                ELSE 70 END AS pass_pct
    FROM simulations s
    LEFT JOIN simulation_scenarios ss_rubric ON ss_rubric.simulation_id = s.id AND ss_rubric.active = true
    LEFT JOIN rubrics r ON r.id = ss_rubric.rubric_id
    LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE s.practice_simulation = TRUE
      AND s.active = TRUE
      AND (
          (cardinality($2::uuid[]) = 0 OR sd.department_id = ANY($2::uuid[]))
          OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true))
      )
    ORDER BY s.id, s.title, s.description
),
-- 8) Standard groups/standards for rubrics
all_rubric_ids AS (
    SELECT DISTINCT rubric_id FROM sim_meta
),
standard_groups_mapping AS (
    SELECT jsonb_object_agg(
        sg.id::text,
        jsonb_build_object(
            'name', sg.name,
            'description', sg.description,
            'points', sg.points,
            'passPoints', sg.pass_points
        )
    ) AS mapping
    FROM standard_groups sg
    WHERE sg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
),
standards_mapping AS (
    SELECT jsonb_object_agg(
        st.id::text,
        jsonb_build_object(
            'name', st.name,
            'description', st.description,
            'points', st.points
        )
    ) AS mapping
    FROM standards st
    WHERE st.standard_group_id IN (
        SELECT sg.id FROM standard_groups sg
        WHERE sg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
    )
),
-- 9) Final items
rows AS (
    SELECT
        json_build_object(
            'viewMode', 'practice',
            'id', sm.simulation_id::text,
            'simulationTitle', sm.simulation_title,
            'simulationDescription', sm.simulation_description,
            'simulationName', sm.simulation_title,
            'timeLimit', NULL,
            'numSessions', sm.num_scenarios,
            'highestScore', (
                SELECT ROUND(MAX(ap.avg_score_completed))::int
                FROM attempt_progress ap, resolve_profile_id rpi
                WHERE ap.profile_id = rpi.resolved_profile_id
                  AND ap.simulation_id = sm.simulation_id
            ),
            'rubric_id', sm.rubric_id::text,
            'color', spm.color,
            'icon', spm.icon,
            'hasPassed', COALESCE((
                SELECT MAX(ap.avg_score_completed) >= (
                    SELECT pass_pct FROM sim_pass_pct WHERE simulation_id = sm.simulation_id LIMIT 1
                )
                FROM attempt_progress ap, resolve_profile_id rpi
                WHERE ap.profile_id = rpi.resolved_profile_id
                  AND ap.simulation_id = sm.simulation_id
            ), false),
            'passRate', CASE
                           WHEN sm.rubric_points > 0
                             THEN ROUND(100.0 * sm.rubric_pass_points::numeric / sm.rubric_points)::int
                           ELSE NULL
                         END,
            'status', CASE
                         WHEN COALESCE((
                                SELECT MAX(ap.avg_score_completed) >= (
                                    SELECT pass_pct FROM sim_pass_pct WHERE simulation_id = sm.simulation_id LIMIT 1
                                )
                                FROM attempt_progress ap, resolve_profile_id rpi
                                WHERE ap.profile_id = rpi.resolved_profile_id
                                  AND ap.simulation_id = sm.simulation_id
                              ), false) THEN 'passed'
                         WHEN COALESCE(aps.chats, 0) > 0 THEN 'in-progress'
                         ELSE 'not-started'
                       END,
            'completionPct', COALESCE((
                SELECT ROUND(100.0 * lap.completed_root_scenarios::numeric / GREATEST(sm.num_scenarios, 1))::int
                FROM latest_attempt_per_profile_sim lap, resolve_profile_id rpi
                WHERE lap.profile_id = rpi.resolved_profile_id
                  AND lap.simulation_id = sm.simulation_id
                LIMIT 1
            ), 0),
            'passedCount', NULL,
            'inProgressCount', NULL,
            'notStartedCount', NULL,
            'passPct', NULL,
            'cohortName', NULL,
            'updatedAt', sm.updated_at,
            'lastActivityTs', (
                SELECT MAX(ap.last_time)
                FROM attempt_progress ap, resolve_profile_id rpi
                WHERE ap.profile_id = rpi.resolved_profile_id
                  AND ap.simulation_id = sm.simulation_id
            ),
            'hasActivity', (COALESCE(aps.chats, 0) > 0),
            'standard_groups', COALESCE((
                SELECT jsonb_object_agg(
                    sg.id::text,
                    (
                        SELECT jsonb_agg(st.id::text ORDER BY st.points DESC)
                        FROM standards st
                        WHERE st.standard_group_id = sg.id
                    )
                )
                FROM standard_groups sg
                WHERE sg.rubric_id = sm.rubric_id
            ), '{}'::jsonb)
        ) AS item,
        sm.simulation_title AS sort_title,
        (
            SELECT MAX(ap.last_time)
            FROM attempt_progress ap, resolve_profile_id rpi
            WHERE ap.profile_id = rpi.resolved_profile_id
              AND ap.simulation_id = sm.simulation_id
        ) AS sort_last_activity
    FROM sim_meta sm
    LEFT JOIN sim_persona_meta spm ON spm.simulation_id = sm.simulation_id
    LEFT JOIN activity_by_profile_sim aps
           ON aps.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
          AND aps.simulation_id = sm.simulation_id
),
simulation_data AS (
    SELECT
        sim.id,
        sim.title,
        sim.description,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = sim.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit,
        sdd.department_ids
    FROM simulations sim
    LEFT JOIN (
        SELECT 
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = sim.id
    WHERE sim.active = true
      AND sim.practice_simulation = true
    GROUP BY sim.id, sim.title, sim.description, sdd.department_ids
    HAVING 
        (cardinality($2::uuid[]) = 0 OR sdd.department_ids IS NULL OR sdd.department_ids && $2::text[])
        OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = sim.id AND sd2.active = true))
),
simulation_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            sim.id::text,
            jsonb_build_object(
                'name', sim.title, 
                'description', sim.description,
                'time_limit', sim.time_limit,
                'department_ids', CASE 
                    WHEN sim.department_ids IS NOT NULL THEN to_jsonb(sim.department_ids)
                    ELSE NULL::jsonb
                END
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM simulation_data sim
),
persona_data AS (
    SELECT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.color,
        p.icon
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.color, p.icon
    HAVING 
        (cardinality($2::uuid[]) = 0 OR COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY($2::uuid[])) > 0)
        OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true))
),
persona_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', p.description,
                'color', p.color,
                'icon', p.icon
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM persona_data p
),
practice_scenario_ids AS (
    SELECT DISTINCT ss.scenario_id
    FROM simulation_scenarios ss
    JOIN simulations sim ON sim.id = ss.simulation_id
    WHERE sim.active = true
      AND sim.practice_simulation = true
),
scenario_persona_ids AS (
    SELECT 
        sp.scenario_id,
        ARRAY_AGG(sp.persona_id::text ORDER BY sp.persona_id) as persona_ids
    FROM scenario_personas sp
    WHERE sp.active = true
    GROUP BY sp.scenario_id
),
scenario_data AS (
    SELECT
        s.id,
        s.name,
        COALESCE(
            (SELECT ps.problem_statement 
             FROM scenario_problem_statements sps
             JOIN problem_statements ps ON ps.id = sps.problem_statement_id
             WHERE sps.scenario_id = s.id AND sps.active = true
             ORDER BY sps.created_at DESC, sps.updated_at DESC
             LIMIT 1), 
            ''
        ) as description,
        COALESCE(spi.persona_ids, ARRAY[]::text[]) as persona_ids
    FROM scenarios s
    JOIN practice_scenario_ids psi ON psi.scenario_id = s.id
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    LEFT JOIN scenario_persona_ids spi ON spi.scenario_id = s.id
    WHERE s.active = true
    GROUP BY s.id, s.name, spi.persona_ids
    HAVING 
        (cardinality($2::uuid[]) = 0 OR COUNT(sd.scenario_id) FILTER (WHERE sd.department_id = ANY($2::uuid[])) > 0)
        OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true))
),
scenario_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'name', s.name, 
                'description', s.description,
                'persona_ids', s.persona_ids
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM scenario_data s
),
parameter_data AS (
    SELECT
        par.id,
        par.name,
        COALESCE(par.description, '') as description,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_documents pd WHERE pd.parameter_id = par.id AND pd.active = true) THEN true ELSE false END as document_parameter,
        CASE WHEN EXISTS (SELECT 1 FROM parameter_personas pp WHERE pp.parameter_id = par.id AND pp.active = true) THEN true ELSE false END as persona_parameter
    FROM parameters par
    JOIN parameter_fields fp ON fp.parameter_id = par.id AND fp.active = true
    LEFT JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
    WHERE par.active = true
      AND par.simulation_parameter = true
    GROUP BY par.id, par.name, par.description
    HAVING 
        (cardinality($2::uuid[]) = 0 OR COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY($2::uuid[])) > 0)
        OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                  JOIN parameter_fields fp2 ON fp2.field_id = fd2.field_id 
                  WHERE fp2.parameter_id = par.id AND fp2.active = true))
),
parameter_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            par.id::text,
            jsonb_build_object('name', par.name, 'description', par.description, 'document_parameter', par.document_parameter, 'persona_parameter', par.persona_parameter)
        ),
        '{}'::jsonb
    ) as mapping
    FROM parameter_data par
),
parameter_item_data AS (
    SELECT
        f.id,
        f.name,
        COALESCE(f.description, '') as description,
        fp.parameter_id,
        par.name as parameter_name
    FROM fields f
    JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    JOIN parameters par ON par.id = fp.parameter_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE par.active = true
      AND par.simulation_parameter = true
    GROUP BY f.id, f.name, f.description, fp.parameter_id, par.id, par.name
    HAVING 
        (cardinality($2::uuid[]) = 0 OR COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY($2::uuid[])) > 0)
        OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM field_departments fd2 
                  WHERE fd2.field_id = f.id AND fd2.active = true))
),
field_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            pi.id::text,
            jsonb_build_object(
                'name', pi.name,
                'description', pi.description,
                'parameter_id', pi.parameter_id::text,
                'parameter_name', pi.parameter_name
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM parameter_item_data pi
),
department_data AS (
    SELECT
        d.id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM departments d
    WHERE d.active = true
),
department_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.name,
                'description', d.description
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM department_data d
),
valid_department_ids_data AS (
    SELECT array_agg(d.id::text ORDER BY d.name) as valid_department_ids
    FROM department_data d
)
SELECT json_build_object(
    'mode', 'practice',
    'hasData', EXISTS(SELECT 1 FROM rows),
    'items', COALESCE((
        SELECT json_agg(item
            ORDER BY
                (item->>'simulationTitle') ILIKE 'general%' DESC,
                sort_last_activity DESC NULLS LAST,
                sort_title
        )
        FROM rows
    ), '[]'::json),
    'standard_groups_mapping', COALESCE((SELECT mapping FROM standard_groups_mapping LIMIT 1), '{}'::jsonb),
    'standards_mapping', COALESCE((SELECT mapping FROM standards_mapping LIMIT 1), '{}'::jsonb),
    'simulation_mapping', COALESCE((SELECT mapping FROM simulation_mapping_data LIMIT 1), '{}'::jsonb),
    'persona_mapping', COALESCE((SELECT mapping FROM persona_mapping_data LIMIT 1), '{}'::jsonb),
    'scenario_mapping', COALESCE((SELECT mapping FROM scenario_mapping_data LIMIT 1), '{}'::jsonb),
    'parameter_mapping', COALESCE((SELECT mapping FROM parameter_mapping_data LIMIT 1), '{}'::jsonb),
    'field_mapping', COALESCE((SELECT mapping FROM field_mapping_data LIMIT 1), '{}'::jsonb),
    'department_mapping', COALESCE((SELECT mapping FROM department_mapping_data LIMIT 1), '{}'::jsonb),
    'valid_department_ids', COALESCE((SELECT valid_department_ids FROM valid_department_ids_data LIMIT 1), ARRAY[]::text[])
) AS result
