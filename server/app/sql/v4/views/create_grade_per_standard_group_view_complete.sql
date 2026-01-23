-- View: view_grade_per_standard_group
-- Encapsulates how standard group scores are calculated from grades/feedbacks.
-- Reused by rubric heatmap correlations AND skill performance radar in both dashboard and reports.
--
-- Business logic captured:
-- 1. Latest grade per chat (DISTINCT ON chat_id, rubric_id ORDER BY created_at DESC)
-- 2. Rubric resolution (scenario rubric -> simulation fallback rubric -> first scenario rubric)
-- 3. Feedback aggregation per standard group (SUM of feedback totals)
-- 4. Score percentage calculation (total_score / max_group_points * 100)
--
-- Uses junction tables: scenario_chats_junction, simulation_attempts_junction

DROP VIEW IF EXISTS view_grade_per_standard_group;

CREATE OR REPLACE VIEW view_grade_per_standard_group AS
WITH chat_scenario_info AS (
    SELECT DISTINCT
        c.id AS chat_id,
        scj.scenario_id,
        saj.simulation_id
    FROM chats_entry c
    JOIN scenario_chats_junction scj ON scj.chat_id = c.id
    JOIN attempts_entry sa ON sa.id = c.attempt_id
    JOIN simulation_attempts_junction saj ON saj.attempt_id = sa.id
),
-- Get first scenario's rubric per simulation (fallback when no direct scenario rubric exists)
sim_first_scenario_rubric AS (
    SELECT DISTINCT ON (ss.simulation_id)
        ss.simulation_id,
        srr.rubric_id
    FROM simulation_scenarios_junction ss
    LEFT JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
    LEFT JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
    WHERE EXISTS (
        SELECT 1 FROM simulation_scenario_flags_junction ssf
        JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id
        JOIN flags_resource f ON sfr.flag_id = f.id
        WHERE ssf.simulation_id = ss.simulation_id
          AND sfr.scenario_id = ss.scenario_id
          AND f.name = 'scenario_active'
          AND ssf.value = true
    )
    ORDER BY ss.simulation_id, (
        SELECT spr.value FROM simulation_scenario_positions_junction ssp
        JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
        WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id
        LIMIT 1
    )
),
-- Latest grade per chat with rubric resolution
latest_grade AS (
    SELECT DISTINCT ON (c.id, COALESCE(srr.rubric_id, srr_fallback.rubric_id, sfsr.rubric_id))
        scg.id AS grade_id,
        c.id AS chat_id,
        COALESCE(
            srr.rubric_id,
            srr_fallback.rubric_id,
            sfsr.rubric_id
        ) AS rubric_id,
        scg.created_at
    FROM grades_entry scg
    JOIN chats_entry c ON c.id = scg.chat_id
    LEFT JOIN chat_scenario_info csi ON csi.chat_id = c.id
    LEFT JOIN scenario_rubrics_resource srr ON srr.scenario_id = csi.scenario_id
    LEFT JOIN simulation_scenario_rubrics_junction ssr_fallback ON ssr_fallback.simulation_id = csi.simulation_id
    LEFT JOIN scenario_rubrics_resource srr_fallback ON srr_fallback.id = ssr_fallback.scenario_rubric_id
        AND srr_fallback.scenario_id = csi.scenario_id
        AND srr.rubric_id IS NULL
    LEFT JOIN sim_first_scenario_rubric sfsr ON sfsr.simulation_id = csi.simulation_id
        AND srr.rubric_id IS NULL
        AND srr_fallback.rubric_id IS NULL
    WHERE COALESCE(
        srr.rubric_id,
        srr_fallback.rubric_id,
        sfsr.rubric_id
    ) IS NOT NULL
    ORDER BY c.id, COALESCE(srr.rubric_id, srr_fallback.rubric_id, sfsr.rubric_id), scg.created_at DESC
)
SELECT
    lg.chat_id,
    lg.rubric_id,
    sg.id AS standard_group_id,
    sg.name AS group_name,
    sg.short_name AS group_short_name,
    SUM(fe.total)::float8 AS total_score,
    sg.points::float8 AS max_group_points,
    CASE WHEN sg.points > 0
         THEN TRUNC((100.0 * SUM(fe.total)::numeric / sg.points::numeric), 2)::float8
         ELSE NULL
    END AS score_percent
FROM latest_grade lg
JOIN feedbacks_entry fe ON fe.grade_id = lg.grade_id
JOIN standards_resource s ON s.id = fe.standard_id
JOIN rubric_standard_groups_junction rsg ON rsg.rubric_id = lg.rubric_id AND rsg.active = true
JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id AND sg.id = s.standard_group_id
GROUP BY lg.chat_id, lg.rubric_id, sg.id, sg.name, sg.short_name, sg.points;
