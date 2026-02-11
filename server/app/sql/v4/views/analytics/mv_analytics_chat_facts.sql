-- Materialized View: mv_chat_facts
-- Base fact table for all analytics queries across Home, Practice, Dashboard, and Reports.
--
-- Grain: One row per chat
-- Filter: None at MV level - all data included (filtering done at query time)
--
-- Purpose: Base fact table that all other analytics MVs derive from
-- Section: ANALYTICS (unified base layer)
--
-- Dependencies: Uses entry tables + mv_attempt_chats scope (avoids direct chat connection table coupling)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_chat_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_chat_facts CASCADE;

CREATE MATERIALIZED VIEW mv_chat_facts AS
WITH
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id,
        g.score,
        g.passed,
        g.time_taken,
        g.total_points AS rubric_total_points,
        g.pass_points AS rubric_pass_points,
        g.created_at AS grade_created_at
    FROM simulation_grades_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
message_stats AS (
    SELECT
        sm.chat_id,
        COUNT(*)::int AS num_messages_total,
        ARRAY_AGG(
            EXTRACT(EPOCH FROM (sm.updated_at - sm.created_at))::int
            ORDER BY sm.created_at
        ) FILTER (WHERE m.role = 'assistant'::message_type) AS message_time_taken_seconds
    FROM simulation_messages_entry sm
    JOIN messages_entry m ON m.id = sm.id
    WHERE m.active = TRUE
      AND m.role IN ('user'::message_type, 'assistant'::message_type)
    GROUP BY sm.chat_id
),
grade_rubric AS (
    SELECT DISTINCT ON (grc.grade_id)
        grc.grade_id,
        grc.rubrics_id AS rubric_id
    FROM simulation_grades_rubrics_connection grc
    WHERE grc.active = TRUE
    ORDER BY grc.grade_id, grc.created_at DESC
),
chat_scope AS (
    SELECT
        msc.chat_id,
        msc.scenario_id,
        msc.rubric_id,
        msc.persona_ids,
        msc.document_ids
    FROM mv_attempt_chats msc
),
chat_persona AS (
    SELECT
        cs.chat_id,
        (cs.persona_ids)[1] AS persona_id
    FROM chat_scope cs
),
chat_parameter_fields AS (
    SELECT
        cs.chat_id,
        ARRAY_AGG(DISTINCT pfr.id ORDER BY pfr.id)
            FILTER (WHERE pfr.id IS NOT NULL) AS parameter_field_ids,
        ARRAY_AGG(DISTINCT pfr.parameter_id ORDER BY pfr.parameter_id)
            FILTER (WHERE pfr.parameter_id IS NOT NULL) AS parameter_ids,
        ARRAY_AGG(DISTINCT pfr.field_id ORDER BY pfr.field_id)
            FILTER (WHERE pfr.field_id IS NOT NULL) AS field_ids
    FROM chat_scope cs
    LEFT JOIN scenario_parameter_fields_junction spfj
      ON spfj.active = TRUE
     AND spfj.scenario_id = (
        SELECT ssj.scenario_id
        FROM scenario_scenarios_junction ssj
        WHERE ssj.scenarios_id = cs.scenario_id
          AND ssj.active = TRUE
        LIMIT 1
     )
    LEFT JOIN parameter_fields_resource pfr
      ON pfr.id = spfj.parameter_field_id
     AND pfr.active = TRUE
    GROUP BY cs.chat_id
),
chat_persona_parameter_fields AS (
    SELECT
        cs.chat_id,
        ARRAY_AGG(DISTINCT ppfj.parameter_field_id ORDER BY ppfj.parameter_field_id)
            FILTER (WHERE ppfj.parameter_field_id IS NOT NULL) AS persona_parameter_field_ids,
        ARRAY_AGG(DISTINCT pfr.parameter_id ORDER BY pfr.parameter_id)
            FILTER (WHERE pfr.parameter_id IS NOT NULL) AS persona_parameter_ids,
        ARRAY_AGG(DISTINCT pfr.field_id ORDER BY pfr.field_id)
            FILTER (WHERE pfr.field_id IS NOT NULL) AS persona_field_ids
    FROM chat_scope cs
    LEFT JOIN LATERAL unnest(COALESCE(cs.persona_ids, ARRAY[]::uuid[])) pid(persona_resource_id) ON TRUE
    LEFT JOIN persona_personas_junction ppj
      ON ppj.personas_id = pid.persona_resource_id
     AND ppj.active = TRUE
    LEFT JOIN persona_parameter_fields_junction ppfj
      ON ppfj.persona_id = ppj.persona_id
     AND ppfj.active = TRUE
    LEFT JOIN parameter_fields_resource pfr
      ON pfr.id = ppfj.parameter_field_id
     AND pfr.active = TRUE
    GROUP BY cs.chat_id
),
chat_document_parameter_fields AS (
    SELECT
        cs.chat_id,
        ARRAY_AGG(DISTINCT dpfj.parameter_field_id ORDER BY dpfj.parameter_field_id)
            FILTER (WHERE dpfj.parameter_field_id IS NOT NULL) AS document_parameter_field_ids,
        ARRAY_AGG(DISTINCT pfr.parameter_id ORDER BY pfr.parameter_id)
            FILTER (WHERE pfr.parameter_id IS NOT NULL) AS document_parameter_ids,
        ARRAY_AGG(DISTINCT pfr.field_id ORDER BY pfr.field_id)
            FILTER (WHERE pfr.field_id IS NOT NULL) AS document_field_ids
    FROM chat_scope cs
    LEFT JOIN LATERAL unnest(COALESCE(cs.document_ids, ARRAY[]::uuid[])) did(document_resource_id) ON TRUE
    LEFT JOIN document_documents_junction ddj
      ON ddj.documents_id = did.document_resource_id
     AND ddj.active = TRUE
    LEFT JOIN document_parameter_fields_junction dpfj
      ON dpfj.document_id = ddj.document_id
     AND dpfj.active = TRUE
    LEFT JOIN parameter_fields_resource pfr
      ON pfr.id = dpfj.parameter_field_id
     AND pfr.active = TRUE
    GROUP BY cs.chat_id
)
SELECT
    c.id AS chat_id,
    c.attempt_id,
    lg.grade_id,

    asc_conn.simulations_id AS simulation_id,
    apc.profiles_id AS profile_id,
    acc.cohorts_id AS cohort_id,
    adc.departments_id AS department_id,
    arc.roles_id AS role_id,
    cs.scenario_id,
    cp.persona_id,
    COALESCE(cs.rubric_id, gr.rubric_id) AS rubric_id,

    COALESCE(cpf.parameter_field_ids, ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(cpf.parameter_ids, ARRAY[]::uuid[]) AS parameter_ids,
    COALESCE(cpf.field_ids, ARRAY[]::uuid[]) AS field_ids,
    COALESCE(cppf.persona_parameter_field_ids, ARRAY[]::uuid[]) AS persona_parameter_field_ids,
    COALESCE(cppf.persona_parameter_ids, ARRAY[]::uuid[]) AS persona_parameter_ids,
    COALESCE(cppf.persona_field_ids, ARRAY[]::uuid[]) AS persona_field_ids,
    COALESCE(cdpf.document_parameter_field_ids, ARRAY[]::uuid[]) AS document_parameter_field_ids,
    COALESCE(cdpf.document_parameter_ids, ARRAY[]::uuid[]) AS document_parameter_ids,
    COALESCE(cdpf.document_field_ids, ARRAY[]::uuid[]) AS document_field_ids,

    a.created_at AS attempt_created_at,
    c.created_at AS chat_created_at,
    lg.grade_created_at,

    CASE WHEN COALESCE(a.practice, FALSE) THEN 'practice' ELSE 'general' END AS attempt_type,
    COALESCE(a.archived, FALSE) AS is_archived,
    COALESCE(a.infinite_mode, FALSE) AS infinite_mode,
    (EXISTS (SELECT 1 FROM simulation_completions_entry comp WHERE comp.chat_id = c.id AND comp.active = TRUE)) AS completed,

    lg.score,
    lg.passed,
    lg.time_taken,
    CASE
        WHEN lg.rubric_total_points IS NOT NULL AND lg.rubric_total_points > 0
        THEN ROUND((lg.score::numeric / lg.rubric_total_points::numeric) * 100, 2)
        ELSE NULL
    END AS grade_percent,
    lg.rubric_total_points,
    lg.rubric_pass_points,

    COALESCE(ms.num_messages_total, 0) AS num_messages_total,
    COALESCE(ms.message_time_taken_seconds, ARRAY[]::int[]) AS message_time_taken_seconds

FROM simulation_chats_entry c
JOIN simulation_attempts_entry a ON a.id = c.attempt_id
JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
LEFT JOIN simulation_attempts_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
LEFT JOIN simulation_attempts_roles_connection arc ON arc.attempt_id = a.id
JOIN chat_scope cs ON cs.chat_id = c.id
LEFT JOIN chat_persona cp ON cp.chat_id = c.id
LEFT JOIN chat_parameter_fields cpf ON cpf.chat_id = c.id
LEFT JOIN chat_persona_parameter_fields cppf ON cppf.chat_id = c.id
LEFT JOIN chat_document_parameter_fields cdpf ON cdpf.chat_id = c.id
LEFT JOIN latest_grade lg ON lg.chat_id = c.id
LEFT JOIN grade_rubric gr ON gr.grade_id = lg.grade_id
LEFT JOIN message_stats ms ON ms.chat_id = c.id
WHERE c.active = TRUE
  AND a.active = TRUE
WITH NO DATA;

CREATE UNIQUE INDEX mv_chat_facts_pk
    ON mv_chat_facts (chat_id);

CREATE INDEX mv_chat_facts_attempt_id_idx
    ON mv_chat_facts (attempt_id);

CREATE INDEX mv_chat_facts_simulation_id_idx
    ON mv_chat_facts (simulation_id);

CREATE INDEX mv_chat_facts_profile_id_idx
    ON mv_chat_facts (profile_id);

CREATE INDEX mv_chat_facts_cohort_id_idx
    ON mv_chat_facts (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_chat_facts_department_id_idx
    ON mv_chat_facts (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX mv_chat_facts_role_id_idx
    ON mv_chat_facts (role_id)
    WHERE role_id IS NOT NULL;

CREATE INDEX mv_chat_facts_scenario_id_idx
    ON mv_chat_facts (scenario_id);

CREATE INDEX mv_chat_facts_persona_id_idx
    ON mv_chat_facts (persona_id)
    WHERE persona_id IS NOT NULL;

CREATE INDEX mv_chat_facts_rubric_id_idx
    ON mv_chat_facts (rubric_id)
    WHERE rubric_id IS NOT NULL;

CREATE INDEX mv_chat_facts_attempt_created_at_desc_idx
    ON mv_chat_facts (attempt_created_at DESC);

CREATE INDEX mv_chat_facts_chat_created_at_desc_idx
    ON mv_chat_facts (chat_created_at DESC);

CREATE INDEX mv_chat_facts_attempt_type_idx
    ON mv_chat_facts (attempt_type);

CREATE INDEX mv_chat_facts_is_archived_idx
    ON mv_chat_facts (is_archived);

CREATE INDEX mv_chat_facts_completed_idx
    ON mv_chat_facts (completed);

CREATE INDEX mv_chat_facts_has_passed_idx
    ON mv_chat_facts (passed)
    WHERE passed IS NOT NULL;

CREATE INDEX mv_chat_facts_profile_type_archived_time_idx
    ON mv_chat_facts (profile_id, attempt_type, is_archived, attempt_created_at DESC);

CREATE INDEX mv_chat_facts_profile_simulation_time_idx
    ON mv_chat_facts (profile_id, simulation_id, attempt_created_at DESC);

CREATE INDEX mv_chat_facts_cohort_type_time_idx
    ON mv_chat_facts (cohort_id, attempt_type, attempt_created_at DESC)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_chat_facts_scenario_created_idx
    ON mv_chat_facts (scenario_id, chat_created_at DESC);

CREATE INDEX mv_chat_facts_practice_profile_created_idx
    ON mv_chat_facts (attempt_type, profile_id, attempt_created_at DESC)
    WHERE is_archived = FALSE;

CREATE INDEX mv_chat_facts_parameter_field_ids_gin_idx
    ON mv_chat_facts USING GIN (parameter_field_ids);

CREATE INDEX mv_chat_facts_parameter_ids_gin_idx
    ON mv_chat_facts USING GIN (parameter_ids);

CREATE INDEX mv_chat_facts_field_ids_gin_idx
    ON mv_chat_facts USING GIN (field_ids);

CREATE INDEX mv_chat_facts_persona_parameter_field_ids_gin_idx
    ON mv_chat_facts USING GIN (persona_parameter_field_ids);

CREATE INDEX mv_chat_facts_document_parameter_field_ids_gin_idx
    ON mv_chat_facts USING GIN (document_parameter_field_ids);

REFRESH MATERIALIZED VIEW mv_chat_facts;
