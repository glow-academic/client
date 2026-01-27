-- View: view_attempt_simulation_context_complete
-- Layer 2 Context View: Attempt with full simulation context.
-- Extends view_attempt_base_complete with simulation details.
-- Includes simulation title, description, department, time_limit, rubric, and practice flag.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_attempt_simulation_context_complete AS
SELECT
    ab.id AS attempt_id,
    ab.created_at AS attempt_created_at,
    ab.updated_at AS attempt_updated_at,
    ab.infinite_mode,
    ab.archived,
    ab.attempt_type,
    -- Profile info
    ab.profile_resource_id,
    ppj.profile_id,
    -- Simulation resource and artifact IDs
    ab.simulation_resource_id,
    ssj.simulation_id,
    -- Department/cohort (general only)
    ab.department_resource_id,
    ab.cohort_resource_id,
    ab.role_resource_id,
    -- Simulation details (computed from junctions)
    (SELECT n.name
     FROM simulation_names_junction sn
     JOIN names_resource n ON sn.name_id = n.id
     WHERE sn.simulation_id = ssj.simulation_id
     LIMIT 1) AS simulation_title,
    (SELECT d.description
     FROM simulation_descriptions_junction sd
     JOIN descriptions_resource d ON sd.description_id = d.id
     WHERE sd.simulation_id = ssj.simulation_id
     LIMIT 1) AS simulation_description,
    (SELECT department_id
     FROM simulation_departments_junction sd
     WHERE sd.simulation_id = ssj.simulation_id AND sd.active = true
     ORDER BY sd.created_at
     LIMIT 1) AS simulation_department_id,
    -- Practice simulation flag
    EXISTS (
        SELECT 1
        FROM simulation_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = ssj.simulation_id
          AND f.name = 'practice'
          AND sf.value = TRUE
    ) AS is_practice_simulation,
    -- Time limit (sum of all active scenario time limits)
    COALESCE(
        (SELECT SUM(stlr.time_limit_seconds)::int
         FROM simulation_scenario_time_limits_junction sstl
         JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
         JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id
           AND ss.scenario_id = stlr.scenario_id
         WHERE sstl.simulation_id = ssj.simulation_id
           AND sstl.active = true
           AND stlr.active = true
           AND EXISTS (
               SELECT 1
               FROM simulation_scenario_flags_junction ssf
               JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id
               JOIN flags_resource f ON sfr.flag_id = f.id
               WHERE ssf.simulation_id = ss.simulation_id
                 AND sfr.scenario_id = ss.scenario_id
                 AND f.name = 'simulation_active'
                 AND ssf.value = true
           )),
        0
    )::int AS simulation_time_limit,
    -- Rubric ID (from first active scenario)
    (SELECT srr.rubric_id
     FROM simulation_scenarios_junction ss
     JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
     JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id
       AND srr.scenario_id = ss.scenario_id
     WHERE ss.simulation_id = ssj.simulation_id
       AND EXISTS (
           SELECT 1
           FROM simulation_scenario_flags_junction ssf
           JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id
           JOIN flags_resource f ON sfr.flag_id = f.id
           WHERE ssf.simulation_id = ss.simulation_id
             AND sfr.scenario_id = ss.scenario_id
             AND f.name = 'simulation_active'
             AND ssf.value = true
       )
     ORDER BY (
         SELECT spr.value
         FROM simulation_scenario_positions_junction ssp
         JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
         WHERE ssp.simulation_id = ss.simulation_id
           AND spr.scenario_id = ss.scenario_id
         LIMIT 1
     )
     LIMIT 1) AS simulation_rubric_id,
    -- Simulation flags (computed per-simulation)
    COALESCE(
        (SELECT sf.value
         FROM simulation_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.simulation_id = ssj.simulation_id
           AND f.name = 'hints_enabled'
         LIMIT 1),
        false
    ) AS hints_enabled,
    COALESCE(
        (SELECT sf.value
         FROM simulation_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.simulation_id = ssj.simulation_id
           AND f.name = 'objectives_enabled'
         LIMIT 1),
        true
    ) AS objectives_enabled,
    COALESCE(
        (SELECT sf.value
         FROM simulation_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.simulation_id = ssj.simulation_id
           AND f.name = 'image_input_active'
         LIMIT 1),
        false
    ) AS image_input_active,
    COALESCE(
        (SELECT sf.value
         FROM simulation_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.simulation_id = ssj.simulation_id
           AND f.name = 'copy_paste_allowed'
         LIMIT 1),
        false
    ) AS copy_paste_allowed
FROM view_attempt_base_complete ab
-- Resolve simulation artifact ID
JOIN simulation_simulations_junction ssj ON ssj.simulations_id = ab.simulation_resource_id
-- Resolve profile artifact ID
JOIN profile_profiles_junction ppj ON ppj.profiles_id = ab.profile_resource_id;
