-- Recreate legacy attempt context view after mv_simulation_attempts is rebuilt.

CREATE OR REPLACE VIEW view_attempt_simulation_context_complete AS
SELECT
    msa.attempt_id,
    ae.created_at AS attempt_created_at,
    ae.updated_at AS attempt_updated_at,
    COALESCE(ae.infinite_mode, FALSE) AS infinite_mode,
    COALESCE(ae.archived, FALSE) AS archived,
    ae.attempt_type,
    msa.profile_id,
    msa.simulation_id,
    (
        SELECT n.name
        FROM simulation_names_junction sn
        JOIN names_resource n ON n.id = sn.name_id
        WHERE sn.simulation_id = msa.simulation_id
        LIMIT 1
    ) AS simulation_title,
    (
        SELECT d.description
        FROM simulation_descriptions_junction sd
        JOIN descriptions_resource d ON d.id = sd.description_id
        WHERE sd.simulation_id = msa.simulation_id
        LIMIT 1
    ) AS simulation_description,
    (
        SELECT sd.department_id
        FROM simulation_departments_junction sd
        WHERE sd.simulation_id = msa.simulation_id
          AND sd.active = TRUE
        ORDER BY sd.created_at
        LIMIT 1
    ) AS simulation_department_id,
    COALESCE(
        (
            SELECT SUM(stlr.time_limit_seconds)::int
            FROM simulation_scenario_time_limits_junction sstl
            JOIN scenario_time_limits_resource stlr
                 ON stlr.id = sstl.scenario_time_limit_id
                AND stlr.active = TRUE
            WHERE sstl.simulation_id = msa.simulation_id
              AND sstl.active = TRUE
        ),
        0
    ) AS simulation_time_limit,
    (
        SELECT srr.rubric_id
        FROM simulation_scenarios_junction ss
        JOIN simulation_scenario_rubrics_junction ssr
             ON ssr.simulation_id = ss.simulation_id
        JOIN scenario_rubrics_resource srr
             ON srr.id = ssr.scenario_rubric_id
            AND srr.scenario_id = ss.scenario_id
        WHERE ss.simulation_id = msa.simulation_id
        LIMIT 1
    ) AS simulation_rubric_id,
    COALESCE(
        (
            SELECT sf.value
            FROM simulation_flags_junction sf
            JOIN flags_resource f ON f.id = sf.flag_id
            WHERE sf.simulation_id = msa.simulation_id
              AND f.name = 'hints_enabled'
            LIMIT 1
        ),
        FALSE
    ) AS hints_enabled,
    COALESCE(
        (
            SELECT sf.value
            FROM simulation_flags_junction sf
            JOIN flags_resource f ON f.id = sf.flag_id
            WHERE sf.simulation_id = msa.simulation_id
              AND f.name = 'objectives_enabled'
            LIMIT 1
        ),
        TRUE
    ) AS objectives_enabled,
    COALESCE(
        (
            SELECT sf.value
            FROM simulation_flags_junction sf
            JOIN flags_resource f ON f.id = sf.flag_id
            WHERE sf.simulation_id = msa.simulation_id
              AND f.name = 'image_input_active'
            LIMIT 1
        ),
        FALSE
    ) AS image_input_active,
    COALESCE(
        (
            SELECT sf.value
            FROM simulation_flags_junction sf
            JOIN flags_resource f ON f.id = sf.flag_id
            WHERE sf.simulation_id = msa.simulation_id
              AND f.name = 'copy_paste_allowed'
            LIMIT 1
        ),
        FALSE
    ) AS copy_paste_allowed
FROM mv_attempt_list msa
JOIN attempts_entry ae ON ae.id = msa.attempt_id;
