-- Legacy compatibility views (temporary)
-- Purpose: keep legacy `view_*_entry` references working while queries migrate to *_entry.

CREATE OR REPLACE VIEW view_activity_entry AS
SELECT * FROM activity_entry;

CREATE OR REPLACE VIEW view_audios_entry AS
SELECT * FROM audios_entry;

CREATE OR REPLACE VIEW view_audits_entry AS
SELECT * FROM audits_entry;

CREATE OR REPLACE VIEW view_benchmark_tests_entry AS
SELECT * FROM benchmark_tests_entry;

CREATE OR REPLACE VIEW view_calls_entry AS
SELECT * FROM calls_entry;

CREATE OR REPLACE VIEW view_drafts_entry AS
SELECT * FROM drafts_entry;

CREATE OR REPLACE VIEW view_debug_info_entry AS
SELECT * FROM debug_info_entry;

CREATE OR REPLACE VIEW view_emulations_entry AS
SELECT * FROM emulations_entry;

CREATE OR REPLACE VIEW view_grants_entry AS
SELECT * FROM grants_entry;

CREATE OR REPLACE VIEW view_grades_entry AS
SELECT * FROM grades_entry;

CREATE OR REPLACE VIEW view_simulation_grades_entry AS
SELECT * FROM simulation_grades_entry;

CREATE OR REPLACE VIEW view_feedbacks_entry AS
SELECT * FROM feedbacks_entry;

CREATE OR REPLACE VIEW view_groups_entry AS
SELECT * FROM groups_entry;

CREATE OR REPLACE VIEW view_health_entry AS
SELECT * FROM health_entry;

CREATE OR REPLACE VIEW view_messages_entry AS
SELECT * FROM messages_entry;

CREATE OR REPLACE VIEW view_message_tree_entry AS
SELECT * FROM message_tree_entry;

CREATE OR REPLACE VIEW view_strengths_entry AS
SELECT * FROM strengths_entry;

CREATE OR REPLACE VIEW view_improvements_entry AS
SELECT * FROM improvements_entry;

CREATE OR REPLACE VIEW view_hints_entry AS
SELECT * FROM hints_entry;

CREATE OR REPLACE VIEW view_highlights_entry AS
SELECT * FROM highlights_entry;

CREATE OR REPLACE VIEW view_replacements_entry AS
SELECT * FROM replacements_entry;

CREATE OR REPLACE VIEW view_metrics_entry AS
SELECT * FROM metrics_entry;

CREATE OR REPLACE VIEW view_run_pricing_entry AS
SELECT * FROM run_pricing_entry;

CREATE OR REPLACE VIEW view_runs_entry AS
SELECT * FROM runs_entry;

CREATE OR REPLACE VIEW view_sessions_entry AS
SELECT * FROM sessions_entry;

CREATE OR REPLACE VIEW view_attempts_entry AS
SELECT * FROM attempts_entry;

CREATE OR REPLACE VIEW view_logins_entry AS
SELECT * FROM logins_entry;

CREATE OR REPLACE VIEW view_simulation_attempts_entry AS
SELECT * FROM simulation_attempts_entry;

CREATE OR REPLACE VIEW view_simulation_chats_entry AS
SELECT * FROM simulation_chats_entry;

CREATE OR REPLACE VIEW view_simulation_messages_entry AS
SELECT
    m.id,
    sm.chat_id,
    m.run_id,
    m.role,
    m.created_at,
    m.updated_at,
    COALESCE(m.completed, FALSE) AS completed,
    COALESCE(m.active, FALSE) AS active,
    (
        SELECT sce.content
        FROM simulation_contents_entry sce
        WHERE sce.message_id = m.id
          AND sce.active = TRUE
        ORDER BY sce.created_at DESC
        LIMIT 1
    ) AS value,
    sm.simulation_type
FROM simulation_messages_entry sm
JOIN messages_entry m ON m.id = sm.message_id;

CREATE OR REPLACE VIEW view_tests_entry AS
SELECT * FROM tests_entry;

CREATE OR REPLACE VIEW view_uploads_entry AS
SELECT
    ur.id,
    ue.id AS upload_id,
    ue.created_at,
    ue.updated_at,
    ue.file_path,
    ue.mime_type,
    ue.size,
    COALESCE(ur.active, ue.active, FALSE) AS active,
    COALESCE(ur.generated, ue.generated, FALSE) AS generated,
    COALESCE(ur.mcp, ue.mcp, FALSE) AS mcp,
    ue.file_path::text AS value,
    NULL::text AS name,
    NULL::text AS description,
    NULL::numeric AS length_seconds
FROM uploads_resource ur
LEFT JOIN uploads_uploads_connection uuc
       ON uuc.uploads_id = ur.id
      AND uuc.active = TRUE
LEFT JOIN uploads_entry ue
       ON ue.id = uuc.upload_id;

-- Edit-state views are used directly by multiple endpoints.
CREATE OR REPLACE VIEW view_cohort_edit_state AS
SELECT
    c.id AS cohort_id,
    (
        SELECT array_agg(cd.department_id::text ORDER BY cd.created_at)
        FROM cohort_departments_junction cd
        WHERE cd.cohort_id = c.id AND cd.active = TRUE
    ) AS department_ids,
    COALESCE(
        (
            SELECT COUNT(DISTINCT gacc.attempt_id)
            FROM cohort_cohorts_junction ccj
            JOIN simulation_attempts_cohorts_connection gacc ON gacc.cohorts_id = ccj.cohorts_id
            WHERE ccj.cohort_id = c.id AND gacc.active = TRUE
        ),
        0::bigint
    ) AS usage_count
FROM cohort_artifact c;

CREATE OR REPLACE VIEW view_persona_edit_state AS
SELECT
    p.id AS persona_id,
    COUNT(DISTINCT CASE WHEN sp.active = TRUE THEN sp.scenario_id ELSE NULL::uuid END) AS active_scenario_count,
    (
        SELECT array_agg(pd.department_id::text ORDER BY pd.created_at)
        FROM persona_departments_junction pd
        WHERE pd.persona_id = p.id AND pd.active = TRUE
    ) AS department_ids,
    COUNT(DISTINCT sp.scenario_id) AS total_scenario_links
FROM persona_artifact p
LEFT JOIN persona_personas_junction ppj ON ppj.persona_id = p.id
LEFT JOIN personas_resource pr ON pr.id = ppj.personas_id
LEFT JOIN scenario_personas_junction sp ON sp.persona_id = pr.id
GROUP BY p.id;

CREATE OR REPLACE VIEW view_scenario_edit_state AS
SELECT
    s.id AS scenario_id,
    COUNT(
        DISTINCT CASE
            WHEN EXISTS (
                SELECT 1
                FROM scenario_flags_junction sf
                JOIN flags_resource f ON f.id = sf.flag_id
                WHERE sf.scenario_id = s.id
                  AND f.name = 'scenario_active'
                  AND sf.value = TRUE
            ) THEN ss.simulation_id
            ELSE NULL::uuid
        END
    ) AS active_usage_count,
    (
        SELECT array_agg(sd.department_id::text ORDER BY sd.created_at)
        FROM scenario_departments_junction sd
        WHERE sd.scenario_id = s.id AND sd.active = TRUE
    ) AS department_ids,
    COUNT(DISTINCT ss.simulation_id) AS total_links
FROM scenario_artifact s
LEFT JOIN simulation_scenarios_junction ss ON ss.scenario_id = s.id
GROUP BY s.id;

CREATE OR REPLACE VIEW view_simulation_edit_state AS
SELECT
    s.id AS simulation_id,
    (
        SELECT array_agg(sd.department_id::text ORDER BY sd.created_at)
        FROM simulation_departments_junction sd
        WHERE sd.simulation_id = s.id AND sd.active = TRUE
    ) AS department_ids,
    COUNT(DISTINCT CASE WHEN cs.active = TRUE THEN cs.cohort_id ELSE NULL::uuid END) AS active_cohort_count,
    COUNT(cs.cohort_id) AS total_cohort_links,
    COUNT(DISTINCT cs.cohort_id) AS num_cohorts
FROM simulation_artifact s
LEFT JOIN cohort_simulations_junction cs ON cs.simulation_id = s.id
GROUP BY s.id;
