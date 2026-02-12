-- Materialized View: mv_activity_feedbacks
-- Feedback-level facts for ACTIVITY section.
--
-- Grain: One row per feedback_id
-- Purpose: Fast feedback timeline across simulation + benchmark.
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: ACTIVITY
-- Source: simulation_feedbacks_entry + benchmark_feedbacks_entry + simulation/benchmark joins

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_activity_feedbacks'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_activity_feedbacks CASCADE;

CREATE MATERIALIZED VIEW mv_activity_feedbacks AS
SELECT
    fe.id AS feedback_id,
    fe.grade_id,
    fe.type AS feedback_type,
    fe.total,
    fe.total_points,
    fe.pass_points,
    fe.created_at,
    fe.updated_at,
    fe.call_id,
    fe.active,
    -- Simulation context
    sa.id AS simulation_attempt_id,
    -- Benchmark context (tests)
    bc.test_id AS benchmark_test_id,
    -- Profile linkage (simulation or benchmark)
    COALESCE(spj.profile_id, bpj.profile_id) AS profile_id
FROM (
    SELECT f.id, f.grade_id, f.total, f.total_points, f.pass_points,
           f.created_at, f.updated_at, f.call_id, f.active,
           CASE WHEN a.practice IS TRUE THEN 'practice'::text ELSE 'general'::text END AS type
    FROM simulation_feedbacks_entry f
    LEFT JOIN simulation_grades_entry g ON g.id = f.grade_id
    LEFT JOIN simulation_chats_entry c ON c.id = g.chat_id
    LEFT JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    UNION ALL
    SELECT id, grade_id, total, total_points, pass_points,
           created_at, updated_at, call_id, active,
           'benchmark'::text AS type
    FROM benchmark_feedbacks_entry
) fe
-- Simulation joins (general/practice)
LEFT JOIN simulation_grades_entry sg
    ON fe.type IN ('general', 'practice')
   AND sg.id = fe.grade_id
LEFT JOIN simulation_chats_entry sc
    ON sc.id = sg.chat_id
LEFT JOIN simulation_attempts_entry sa
    ON sa.id = sc.attempt_id
LEFT JOIN LATERAL (
    SELECT apc.profiles_id AS profiles_id
    FROM simulation_attempts_profiles_connection apc
    WHERE apc.attempt_id = sa.id
      AND apc.active = true
    ORDER BY apc.created_at ASC
    LIMIT 1
) sap ON true
LEFT JOIN profile_profiles_junction spj
    ON spj.profiles_id = sap.profiles_id
   AND spj.active = true
-- Benchmark joins
LEFT JOIN benchmark_grades_entry bg
    ON fe.type = 'benchmark'
   AND bg.id = fe.grade_id
LEFT JOIN benchmark_invocations_entry bc
    ON bc.id = bg.invocation_id
LEFT JOIN LATERAL (
    SELECT btp.profiles_id AS profiles_id
    FROM benchmark_tests_profiles_connection btp
    WHERE btp.attempt_id = bc.test_id
      AND btp.active = true
    ORDER BY btp.created_at ASC
    LIMIT 1
) bp ON true
LEFT JOIN profile_profiles_junction bpj
    ON bpj.profiles_id = bp.profiles_id
   AND bpj.active = true
WITH NO DATA;

CREATE UNIQUE INDEX mv_activity_feedbacks_pk
    ON mv_activity_feedbacks (feedback_id);

CREATE INDEX mv_activity_feedbacks_profile_id_idx
    ON mv_activity_feedbacks (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_activity_feedbacks_type_idx
    ON mv_activity_feedbacks (feedback_type);

CREATE INDEX mv_activity_feedbacks_created_at_idx
    ON mv_activity_feedbacks (created_at DESC);

CREATE INDEX mv_activity_feedbacks_sim_attempt_idx
    ON mv_activity_feedbacks (simulation_attempt_id)
    WHERE simulation_attempt_id IS NOT NULL;

CREATE INDEX mv_activity_feedbacks_benchmark_test_idx
    ON mv_activity_feedbacks (benchmark_test_id)
    WHERE benchmark_test_id IS NOT NULL;

REFRESH MATERIALIZED VIEW mv_activity_feedbacks;
