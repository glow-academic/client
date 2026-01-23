-- Get practice overview with items and mappings (no history - bundle only returns top half)
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
        WHERE proname = 'api_get_practice_overview_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_practice_overview_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_practice_overview_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_practice_overview_v4_practice_simulation AS (
    view_mode text,  -- 'practice'
    simulation_id uuid,
    simulation_title text,
    simulation_description text,
    simulation_name text,
    time_limit int,
    num_sessions int,
    highest_score int,
    rubric_id uuid,
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
    updated_at timestamptz,
    last_activity_ts timestamptz,
    has_activity boolean,
    standard_groups text[]  -- Array of standard group IDs mapped to standard IDs
);

CREATE TYPE types.q_get_practice_overview_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int
);

CREATE TYPE types.q_get_practice_overview_v4_standard AS (
    standard_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_get_practice_overview_v4_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit int,
    department_ids text[]
);

CREATE TYPE types.q_get_practice_overview_v4_persona AS (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text
);

CREATE TYPE types.q_get_practice_overview_v4_scenario AS (
    scenario_id uuid,
    name text,
    description text,
    persona_ids text[]
);

CREATE TYPE types.q_get_practice_overview_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    document_parameter boolean,
    persona_parameter boolean
);

CREATE TYPE types.q_get_practice_overview_v4_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

CREATE TYPE types.q_get_practice_overview_v4_department AS (
    department_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_practice_overview_v4(
    profile_id uuid,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    mode text,  -- 'practice'
    has_data boolean,
    items types.q_get_practice_overview_v4_practice_simulation[],
    standard_groups types.q_get_practice_overview_v4_standard_group[],
    standards types.q_get_practice_overview_v4_standard[],
    simulations types.q_get_practice_overview_v4_simulation[],
    personas types.q_get_practice_overview_v4_persona[],
    scenarios types.q_get_practice_overview_v4_scenario[],
    parameters types.q_get_practice_overview_v4_parameter[],
    fields types.q_get_practice_overview_v4_field[],
    departments types.q_get_practice_overview_v4_department[],
    valid_department_ids text[],
    draft_version int,
    draft_persona_ids jsonb,
    draft_parameter_item_ids jsonb,
    draft_department_ids jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts_entry d ON d.id = x.draft_id
    JOIN profile_drafts_junction pdj ON pdj.draft_id = d.id AND pdj.profile_id = x.profile_id
    WHERE x.draft_id IS NOT NULL

    LIMIT 1
),
resolve_profile_id AS (
    -- Resolve profile ID FROM parameter_artifact
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params)::text IS NULL OR (SELECT profile_id FROM params)::text = '' THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)::uuid
        END as resolved_profile_id
),
-- 1) Simulation meta (practice only)
sim_meta AS (
    SELECT
        s.id AS simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) AS simulation_title,
        (SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1) AS simulation_description,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
            0
        ) AS time_limit,
        (SELECT srr.rubric_id FROM simulation_scenarios_junction ss 
         JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
         JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
         WHERE ss.simulation_id = s.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
         ORDER BY (SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1) 
         LIMIT 1) as rubric_id,
        COALESCE((SELECT COUNT(*)::int FROM simulation_scenarios_junction ss WHERE ss.simulation_id = s.id), 0) AS num_scenarios,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = srr_rubric.rubric_id AND rp.type = 'total'::point_type LIMIT 1) AS rubric_points_junction,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = srr_rubric.rubric_id AND rp.type = 'pass'::point_type LIMIT 1) AS rubric_pass_points,
        s.updated_at
    FROM simulation_artifact s
    LEFT JOIN simulation_scenarios_junction ss_rubric ON ss_rubric.simulation_id = s.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss_rubric.simulation_id AND sfr.scenario_id = ss_rubric.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
    LEFT JOIN simulation_scenario_rubrics_junction ssr_rubric ON ssr_rubric.simulation_id = ss_rubric.simulation_id
    LEFT JOIN scenario_rubrics_resource srr_rubric ON srr_rubric.id = ssr_rubric.scenario_rubric_id AND srr_rubric.scenario_id = ss_rubric.scenario_id
    LEFT JOIN simulation_departments_junction sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE EXISTS (
        SELECT 1 FROM simulation_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = s.id
          AND f.name = 'simulation_active'
          AND sf.value = TRUE
    )
      AND EXISTS (
        SELECT 1 FROM simulation_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = s.id
          AND f.name = 'practice'
          AND sf.value = TRUE
      )
    GROUP BY s.id, s.updated_at, srr_rubric.rubric_id
    HAVING 
        (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR COUNT(sd.simulation_id) FILTER (WHERE sd.department_id = ANY((SELECT department_ids FROM params)::uuid[])) > 0)
        OR (cardinality((SELECT department_ids FROM params)) = 0 OR NOT EXISTS (SELECT 1 FROM simulation_departments_junction sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true))
),
-- 2) Persona color/icon
sim_persona_meta AS (
    SELECT
        sm.simulation_id,
        (ARRAY_AGG((SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) ORDER BY cnt DESC, COALESCE((SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1), '') DESC))[1] AS color,
        (ARRAY_AGG((SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) ORDER BY cnt DESC, COALESCE((SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1), '') DESC))[1] AS icon
    FROM (
        SELECT
            s.id AS simulation_id,
            sp.persona_id,
            COUNT(*) AS cnt
        FROM simulation_artifact s
        LEFT JOIN simulation_scenarios_junction ss_link ON ss_link.simulation_id = s.id
        LEFT JOIN scenarios_resource sc ON sc.id = ss_link.scenario_id
        LEFT JOIN scenario_personas_junction sp ON sp.scenario_id = sc.id AND sp.active = TRUE
        LEFT JOIN simulation_departments_junction sd ON sd.simulation_id = s.id AND sd.active = true
        WHERE EXISTS (
            SELECT 1 FROM simulation_flags_junction sf
            JOIN flags_resource f ON sf.flag_id = f.id
            WHERE sf.simulation_id = s.id
              AND f.name = 'practice'
              AND sf.value = TRUE
        )
        GROUP BY s.id, sp.persona_id
        HAVING 
            (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR COUNT(sd.simulation_id) FILTER (WHERE sd.department_id = ANY((SELECT department_ids FROM params)::uuid[])) > 0)
            OR (cardinality((SELECT department_ids FROM params)) = 0 OR NOT EXISTS (SELECT 1 FROM simulation_departments_junction sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true))
    ) sm
    LEFT JOIN personas_resource p ON p.id = sm.persona_id
    GROUP BY sm.simulation_id
),
-- 3) All-time analytics slice (lifetime data for this user)
filt_all AS (
    SELECT a.*
    FROM analytics a, resolve_profile_id rpi
    WHERE a.profile_id = rpi.resolved_profile_id
      AND a.is_practice = TRUE
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
        COUNT(DISTINCT chat_id) AS chats_entry,
        BOOL_OR(passed) AS any_passed
    FROM filt_all
    GROUP BY profile_id, simulation_id
),
-- 7) Pass threshold
sim_pass_pct AS (
    SELECT DISTINCT ON (s.id)
           s.id AS simulation_id,
           CASE WHEN (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = srr_rubric.rubric_id AND rp.type = 'total'::point_type LIMIT 1) > 0
                THEN TRUNC(((SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = srr_rubric.rubric_id AND rp.type = 'pass'::point_type LIMIT 1)::numeric / (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = srr_rubric.rubric_id AND rp.type = 'total'::point_type LIMIT 1)::numeric) * 100.0, 2)
                ELSE 70 END AS pass_pct
    FROM simulation_artifact s
    LEFT JOIN simulation_scenarios_junction ss_rubric ON ss_rubric.simulation_id = s.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss_rubric.simulation_id AND sfr.scenario_id = ss_rubric.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
    LEFT JOIN simulation_scenario_rubrics_junction ssr_rubric ON ssr_rubric.simulation_id = ss_rubric.simulation_id
    LEFT JOIN scenario_rubrics_resource srr_rubric ON srr_rubric.id = ssr_rubric.scenario_rubric_id AND srr_rubric.scenario_id = ss_rubric.scenario_id
    LEFT JOIN simulation_departments_junction sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE EXISTS (
        SELECT 1 FROM simulation_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = s.id
          AND f.name = 'practice'
          AND sf.value = TRUE
    )
      AND EXISTS (
        SELECT 1 FROM simulation_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = s.id
          AND f.name = 'simulation_active'
          AND sf.value = TRUE
      )
      AND (
          (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR sd.department_id = ANY((SELECT department_ids FROM params)::uuid[]))
          OR (cardinality((SELECT department_ids FROM params)) = 0 OR NOT EXISTS (SELECT 1 FROM simulation_departments_junction sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true))
      )
    ORDER BY s.id
),
-- 8) Standard groups_entry/standards for rubrics
all_rubric_ids AS (
    SELECT DISTINCT rubric_id FROM sim_meta WHERE rubric_id IS NOT NULL
),
-- Standard groups_entry as array
standard_groups_array AS (
    SELECT 
        (sg.id, sg.name, sg.description, sg.points, sg.pass_points)::types.q_get_practice_overview_v4_standard_group AS standard_group
    FROM rubric_standard_groups_junction rsg
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
    WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
),
-- Standards as array
standards_array AS (
    SELECT 
        (st.id, st.name, st.description, st.points)::types.q_get_practice_overview_v4_standard AS standard
    FROM standards_resource st
    WHERE st.standard_group_id IN (
        SELECT rsg.standard_group_id FROM rubric_standard_groups_junction rsg
        WHERE rsg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids) AND rsg.active = true
    )
),
-- 9) Final items with standard_groups mapping
items_with_standard_groups AS (
    SELECT
        sm.simulation_id,
        sm.simulation_title,
        sm.simulation_description,
        sm.num_scenarios,
        sm.rubric_id,
        sm.rubric_points_junction,
        sm.rubric_pass_points,
        sm.updated_at,
        spm.color,
        spm.icon,
        COALESCE(aps.chats_entry, 0) AS chats_entry,
        COALESCE((
            SELECT ROUND(MAX(ap.avg_score_completed))::int
            FROM attempt_progress ap, resolve_profile_id rpi
            WHERE ap.profile_id = rpi.resolved_profile_id
              AND ap.simulation_id = sm.simulation_id
        ), NULL) AS highest_score,
        COALESCE((
            SELECT MAX(ap.avg_score_completed) >= (
                SELECT pass_pct FROM sim_pass_pct WHERE simulation_id = sm.simulation_id LIMIT 1
            )
            FROM attempt_progress ap, resolve_profile_id rpi
            WHERE ap.profile_id = rpi.resolved_profile_id
              AND ap.simulation_id = sm.simulation_id
        ), false) AS has_passed,
        CASE
            WHEN COALESCE((
                SELECT MAX(ap.avg_score_completed) >= (
                    SELECT pass_pct FROM sim_pass_pct WHERE simulation_id = sm.simulation_id LIMIT 1
                )
                FROM attempt_progress ap, resolve_profile_id rpi
                WHERE ap.profile_id = rpi.resolved_profile_id
                  AND ap.simulation_id = sm.simulation_id
              ), false) THEN 'passed'
            WHEN COALESCE(aps.chats_entry, 0) > 0 THEN 'in-progress'
            ELSE 'not-started'
        END AS status,
        COALESCE((
            SELECT ROUND(100.0 * lap.completed_root_scenarios::numeric / GREATEST(sm.num_scenarios, 1))::int
            FROM latest_attempt_per_profile_sim lap, resolve_profile_id rpi
            WHERE lap.profile_id = rpi.resolved_profile_id
              AND lap.simulation_id = sm.simulation_id
            LIMIT 1
        ), 0) AS completion_pct,
        (
            SELECT MAX(ap.last_time)
            FROM attempt_progress ap, resolve_profile_id rpi
            WHERE ap.profile_id = rpi.resolved_profile_id
              AND ap.simulation_id = sm.simulation_id
        ) AS last_activity_ts,
        -- Get standard_group_ids directly as text array (no JSONB)
        COALESCE((
            SELECT ARRAY_AGG(sg.id::text ORDER BY sg.id)
            FROM rubric_standard_groups_junction rsg
            JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
            WHERE rsg.rubric_id = sm.rubric_id AND rsg.active = true
        ), ARRAY[]::text[]) AS standard_groups_ids
    FROM sim_meta sm
    LEFT JOIN sim_persona_meta spm ON spm.simulation_id = sm.simulation_id
    LEFT JOIN activity_by_profile_sim aps
           ON aps.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
          AND aps.simulation_id = sm.simulation_id
),
-- Build items with standard_groups array
items_rows AS (
    SELECT
        ('practice'::text,
         iwsg.simulation_id,
         iwsg.simulation_title,
         iwsg.simulation_description,
         iwsg.simulation_title,
         NULL::int,  -- time_limit (not used in practice overview items)
         iwsg.num_scenarios,
         iwsg.highest_score,
         iwsg.rubric_id,
         iwsg.color,
         iwsg.icon,
         iwsg.has_passed,
         CASE
             WHEN iwsg.rubric_points_junction > 0
                 THEN ROUND(100.0 * iwsg.rubric_pass_points::numeric / iwsg.rubric_points_junction)::int
             ELSE NULL
         END::int,
         iwsg.status,
         iwsg.completion_pct,
         NULL::int,  -- passed_count
         NULL::int,  -- in_progress_count
         NULL::int,  -- not_started_count
         NULL::int,  -- pass_pct
         NULL::text,  -- cohort_name
         iwsg.updated_at,
         iwsg.last_activity_ts,
         (iwsg.chats_entry > 0)::boolean,
         -- Use standard_groups_ids array directly (no JSONB conversion)
         COALESCE(iwsg.standard_groups_ids, ARRAY[]::text[])
        )::types.q_get_practice_overview_v4_practice_simulation AS item,
        iwsg.simulation_title AS sort_title,
        iwsg.last_activity_ts AS sort_last_activity
    FROM items_with_standard_groups iwsg
),
-- Simulation data (for simulations array)
simulation_data AS (
    SELECT
        sim.id,
        (SELECT n.name FROM simulation_names_junction simn JOIN names_resource n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1),
        (SELECT d.description FROM simulation_descriptions_junction simd JOIN descriptions_resource d ON simd.description_id = d.id WHERE simd.simulation_id = sim.id LIMIT 1),
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = sim.id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
            0
        ) as time_limit,
        sdd.department_ids
    FROM simulation_artifact sim
    LEFT JOIN (
        SELECT 
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments_junction sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = sim.id
    WHERE EXISTS (SELECT 1 FROM simulation_flags_junction simf JOIN flags_resource f ON simf.flag_id = f.id WHERE simf.simulation_id = sim.id AND f.name = 'simulation_active' AND simf.value = true)
      AND EXISTS (SELECT 1 FROM simulation_flags_junction simf JOIN flags_resource f ON simf.flag_id = f.id WHERE simf.simulation_id = sim.id AND f.name = 'practice' AND simf.value = true)
    GROUP BY sim.id, (SELECT n.name FROM simulation_names_junction simn JOIN names_resource n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1), (SELECT d.description FROM simulation_descriptions_junction simd JOIN descriptions_resource d ON simd.description_id = d.id WHERE simd.simulation_id = sim.id LIMIT 1), sdd.department_ids
    HAVING 
        (cardinality((SELECT department_ids FROM params)) = 0 OR sdd.department_ids IS NULL OR sdd.department_ids && (SELECT department_ids FROM params)::text[])
        OR (cardinality((SELECT department_ids FROM params)) = 0 OR NOT EXISTS (SELECT 1 FROM simulation_departments_junction sd2 WHERE sd2.simulation_id = sim.id AND sd2.active = true))
),
-- Simulations as array
simulations_array AS (
    SELECT 
        (sim.id, (SELECT n.name FROM simulation_names_junction simn JOIN names_resource n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1), COALESCE((SELECT d.description FROM simulation_descriptions_junction simd JOIN descriptions_resource d ON simd.description_id = d.id WHERE simd.simulation_id = sim.id LIMIT 1), ''), sim.time_limit, COALESCE(sim.department_ids, ARRAY[]::text[]))::types.q_get_practice_overview_v4_simulation AS simulation
    FROM simulation_data sim
),
-- Persona data
persona_data AS (
    SELECT
        p.id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) AS name,
        COALESCE((SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description,
        (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) AS color,
        (SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) AS icon
    FROM persona_artifact p
    LEFT JOIN persona_departments_junction pd ON pd.persona_id = p.id AND pd.active = true
    WHERE EXISTS (
        SELECT 1 FROM persona_flags_junction pf
        JOIN flags_resource f ON pf.flag_id = f.id
        WHERE pf.persona_id = p.id
          AND f.name = 'persona_active'
          AND pf.value = TRUE
    )
    GROUP BY p.id
    HAVING 
        (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY((SELECT department_ids FROM params)::uuid[])) > 0)
        OR (cardinality((SELECT department_ids FROM params)) = 0 OR NOT EXISTS (SELECT 1 FROM persona_departments_junction pd2 WHERE pd2.persona_id = p.id AND pd2.active = true))
),
-- Personas as array
personas_array AS (
    SELECT 
        (p.id, p.name, p.description, COALESCE(p.color, ''), COALESCE(p.icon, ''))::types.q_get_practice_overview_v4_persona AS persona
    FROM persona_data p
),
-- Practice scenario IDs
practice_scenario_ids AS (
    SELECT DISTINCT ss.scenario_id
    FROM simulation_scenarios_junction ss
    JOIN simulation_artifact sim ON sim.id = ss.simulation_id
    WHERE EXISTS (SELECT 1 FROM simulation_flags_junction simf JOIN flags_resource f ON simf.flag_id = f.id WHERE simf.simulation_id = sim.id AND f.name = 'simulation_active' AND simf.value = true)
      AND EXISTS (SELECT 1 FROM simulation_flags_junction simf JOIN flags_resource f ON simf.flag_id = f.id WHERE simf.simulation_id = sim.id AND f.name = 'practice' AND simf.value = true)
),
-- Scenario persona IDs
scenario_persona_ids AS (
    SELECT 
        sp.scenario_id,
        ARRAY_AGG(sp.persona_id::text ORDER BY sp.persona_id) as persona_ids
    FROM scenario_personas_junction sp
    WHERE sp.active = true
    GROUP BY sp.scenario_id
),
-- Scenario data
scenario_data AS (
    SELECT
        s.id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
        COALESCE(
            (SELECT ps.problem_statement 
             FROM scenario_problem_statements_junction sps
             JOIN problem_statements_resource ps ON ps.id = sps.problem_statement_id
             WHERE sps.scenario_id = s.id AND sps.active = true
             ORDER BY sps.created_at DESC
             LIMIT 1), 
            ''
        ) as description,
        COALESCE(spi.persona_ids, ARRAY[]::text[]) as persona_ids
    FROM scenario_artifact s
    JOIN practice_scenario_ids psi ON psi.scenario_id = s.id
    LEFT JOIN scenario_departments_junction sd ON sd.scenario_id = s.id AND sd.active = true
    LEFT JOIN scenario_persona_ids spi ON spi.scenario_id = s.id
    WHERE EXISTS (SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true)
    GROUP BY s.id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), spi.persona_ids
    HAVING 
        (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR COUNT(sd.scenario_id) FILTER (WHERE sd.department_id = ANY((SELECT department_ids FROM params)::uuid[])) > 0)
        OR (cardinality((SELECT department_ids FROM params)) = 0 OR NOT EXISTS (SELECT 1 FROM scenario_departments_junction sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true))
),
-- Scenarios as array
scenarios_array AS (
    SELECT 
        (s.id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), s.persona_ids)::types.q_get_practice_overview_v4_scenario AS scenario
    FROM scenario_data s
),
-- Parameter data
parameter_data AS (
    SELECT
        par.id,
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = par.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = par.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = par.id AND f.name = 'document_parameter' AND pf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = par.id AND f.name = 'persona_parameter' AND pf.value = TRUE) as persona_parameter
    FROM parameter_artifact par
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1) = par.id AND EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'field_active' AND ff.value = true)
    LEFT JOIN field_departments_junction fd ON fd.field_id = f.id AND fd.active = true
    WHERE EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = par.id AND f.name = 'parameter_active' AND pf.value = TRUE)
      AND EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = par.id AND f.name = 'simulation_parameter' AND pf.value = TRUE)
    GROUP BY par.id, (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = par.id LIMIT 1), (SELECT d.description FROM parameter_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = par.id LIMIT 1), EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = par.id AND f.name = 'document_parameter' AND pf.value = TRUE), EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = par.id AND f.name = 'persona_parameter' AND pf.value = TRUE)
    HAVING 
        (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY((SELECT department_ids FROM params)::uuid[])) > 0)
        OR (cardinality((SELECT department_ids FROM params)) = 0 OR NOT EXISTS (SELECT 1 FROM field_departments_junction fd2 
                  JOIN fields_resource f2 ON f2.id = fd2.field_id 
                  WHERE EXISTS (SELECT 1 FROM parameter_fields_junction pf2 WHERE pf2.field_id = f2.id AND pf2.parameter_id = par.id) AND EXISTS (SELECT 1 FROM field_flags_junction ff2 JOIN flags_resource fl2 ON ff2.flag_id = fl2.id WHERE ff2.field_id = f2.id AND fl2.name = 'field_active' AND ff2.value = true)))
),
-- Parameters as array
parameters_array AS (
    SELECT 
        (par.id, par.name, par.description, par.document_parameter, par.persona_parameter)::types.q_get_practice_overview_v4_parameter AS parameter
    FROM parameter_data par
),
-- Parameter item data (fields)
parameter_item_data AS (
    SELECT
        f.id,
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        COALESCE((SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), '') as description,
        (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1),
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = par.id LIMIT 1) as parameter_name
    FROM field_artifact f
    JOIN parameters_resource par ON par.id = (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1)
    LEFT JOIN field_departments_junction fd ON fd.field_id = f.id AND fd.active = true
    WHERE EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = par.id AND f.name = 'parameter_active' AND pf.value = TRUE)
      AND EXISTS (SELECT 1 FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = par.id AND f.name = 'simulation_parameter' AND pf.value = TRUE)
    GROUP BY f.id, (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), (SELECT pf.parameter_id FROM parameter_fields_junction pf WHERE pf.field_id = f.id LIMIT 1), par.id, (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = par.id LIMIT 1)
    HAVING 
        (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR COUNT(fd.field_id) FILTER (WHERE fd.department_id = ANY((SELECT department_ids FROM params)::uuid[])) > 0)
        OR (cardinality((SELECT department_ids FROM params)) = 0 OR NOT EXISTS (SELECT 1 FROM field_departments_junction fd2 
                  WHERE fd2.field_id = f.id AND fd2.active = true))
),
-- Fields as array
fields_array AS (
    SELECT 
        (pi.id, pi.name, pi.description, pi.parameter_id, pi.parameter_name)::types.q_get_practice_overview_v4_field AS field
    FROM parameter_item_data pi
),
-- Department data
department_data AS (
    SELECT
        d.id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM department_artifact d
    WHERE EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
),
-- Departments as array
departments_array AS (
    SELECT 
        (d.id, d.name, d.description)::types.q_get_practice_overview_v4_department AS department
    FROM department_data d
),
-- Valid department IDs
valid_department_ids_data AS (
    SELECT array_agg(d.id::text ORDER BY d.name) as valid_department_ids
    FROM department_data d
),
-- User profile for actor_name
user_profile AS (
    SELECT COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
),
-- Aggregate items
items_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(ir.item 
            ORDER BY
                (ir.item).simulation_title ILIKE 'general%' DESC,
                ir.sort_last_activity DESC NULLS LAST,
                ir.sort_title
        ),
        '{}'::types.q_get_practice_overview_v4_practice_simulation[]
    ) as items
    FROM items_rows ir
),
-- Aggregate mappings separately
standard_groups_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT standard_group), '{}'::types.q_get_practice_overview_v4_standard_group[]) as standard_groups
    FROM standard_groups_array
),
standards_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT standard), '{}'::types.q_get_practice_overview_v4_standard[]) as standards
    FROM standards_array
),
simulations_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT simulation), '{}'::types.q_get_practice_overview_v4_simulation[]) as simulations
    FROM simulations_array
),
personas_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT persona), '{}'::types.q_get_practice_overview_v4_persona[]) as personas
    FROM personas_array
),
scenarios_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT scenario), '{}'::types.q_get_practice_overview_v4_scenario[]) as scenarios
    FROM scenarios_array
),
parameters_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT parameter), '{}'::types.q_get_practice_overview_v4_parameter[]) as parameters
    FROM parameters_array
),
fields_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT field), '{}'::types.q_get_practice_overview_v4_field[]) as fields
    FROM fields_array
),
departments_agg AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT department), '{}'::types.q_get_practice_overview_v4_department[]) as departments
    FROM departments_array
)
SELECT 
    up.actor_name::text as actor_name,
    'practice'::text as mode,
    EXISTS(SELECT 1 FROM items_rows)::boolean as has_data,
    COALESCE((SELECT items FROM items_agg), '{}'::types.q_get_practice_overview_v4_practice_simulation[]) as items,
    COALESCE((SELECT standard_groups FROM standard_groups_agg), '{}'::types.q_get_practice_overview_v4_standard_group[]) as standard_groups,
    COALESCE((SELECT standards FROM standards_agg), '{}'::types.q_get_practice_overview_v4_standard[]) as standards,
    COALESCE((SELECT simulations FROM simulations_agg), '{}'::types.q_get_practice_overview_v4_simulation[]) as simulations,
    COALESCE((SELECT personas FROM personas_agg), '{}'::types.q_get_practice_overview_v4_persona[]) as personas,
    COALESCE((SELECT scenarios FROM scenarios_agg), '{}'::types.q_get_practice_overview_v4_scenario[]) as scenarios,
    COALESCE((SELECT parameters FROM parameters_agg), '{}'::types.q_get_practice_overview_v4_parameter[]) as parameters,
    COALESCE((SELECT fields FROM fields_agg), '{}'::types.q_get_practice_overview_v4_field[]) as fields,
    COALESCE((SELECT departments FROM departments_agg), '{}'::types.q_get_practice_overview_v4_department[]) as departments,
    COALESCE((SELECT valid_department_ids FROM valid_department_ids_data), ARRAY[]::text[]) as valid_department_ids,
    -- Draft version (from draft payload if exists)
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
    -- Extract personaIds from draft payload if available (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'personaIds' FROM draft_payload_data),
        (SELECT payload->'persona_ids' FROM draft_payload_data),
        '[]'::jsonb
    ) as draft_persona_ids,
    -- Extract parameterItemIds from draft payload if available (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'parameterItemIds' FROM draft_payload_data),
        (SELECT payload->'parameter_item_ids' FROM draft_payload_data),
        '[]'::jsonb
    ) as draft_parameter_item_ids,
    -- Extract departmentIds from draft payload if available (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'departmentIds' FROM draft_payload_data),
        (SELECT payload->'department_ids' FROM draft_payload_data),
        '[]'::jsonb
    ) as draft_department_ids
FROM user_profile up
$$;
