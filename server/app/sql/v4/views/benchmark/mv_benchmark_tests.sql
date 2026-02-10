-- Materialized View: mv_benchmark_tests
-- Test-level facts for benchmark artifacts.
--
-- Grain: One row per benchmark test (benchmark_tests_entry.id)
-- Purpose: Fast filtering for list/get style endpoints without business rules.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_benchmark_tests'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_benchmark_tests CASCADE;

CREATE MATERIALIZED VIEW mv_benchmark_tests AS
WITH eval_links AS (
    SELECT
        c.attempt_id AS test_id,
        (ARRAY_AGG(c.evals_id ORDER BY c.created_at))[1] AS eval_id
    FROM benchmark_tests_evals_connection c
    WHERE c.active = true
    GROUP BY c.attempt_id
),
profile_links AS (
    SELECT
        c.attempt_id AS test_id,
        (ARRAY_AGG(c.profiles_id ORDER BY c.created_at))[1] AS profile_id
    FROM benchmark_tests_profiles_connection c
    WHERE c.active = true
    GROUP BY c.attempt_id
),
department_links AS (
    SELECT
        c.attempt_id AS test_id,
        ARRAY_AGG(DISTINCT c.departments_id) FILTER (WHERE c.departments_id IS NOT NULL) AS department_ids
    FROM benchmark_tests_departments_connection c
    WHERE c.active = true
    GROUP BY c.attempt_id
),
invocation_counts AS (
    SELECT
        i.test_id,
        COUNT(*)::bigint AS num_invocations,
        COUNT(*) FILTER (
            WHERE EXISTS (
                SELECT 1
                FROM benchmark_completions_entry comp
                WHERE comp.invocation_id = i.id
                  AND comp.active = true
            )
        )::bigint AS num_invocations_completed
    FROM benchmark_invocations_entry i
    WHERE i.active = true
    GROUP BY i.test_id
),
message_counts AS (
    SELECT
        i.test_id,
        COUNT(DISTINCT m.id)::bigint AS num_messages
    FROM benchmark_invocations_entry i
    JOIN benchmark_invocations_runs_connection birc
      ON birc.invocation_id = i.id
     AND birc.active = true
    JOIN runs_runs_connection rrc
      ON rrc.runs_id = birc.runs_id
     AND rrc.active = true
    JOIN messages_entry m
      ON m.run_id = rrc.run_id
     AND m.active = true
    WHERE i.active = true
    GROUP BY i.test_id
),
-- Get eval name_id (via eval_links -> eval_names_junction)
eval_name_ids AS (
    SELECT
        el.test_id,
        enj.name_id AS eval_name_id
    FROM eval_links el
    JOIN eval_names_junction enj ON enj.eval_id = el.eval_id AND enj.active = true
),
-- Get eval description_id (via eval_links -> eval_descriptions_junction)
eval_description_ids AS (
    SELECT
        el.test_id,
        edj.description_id AS eval_description_id
    FROM eval_links el
    JOIN eval_descriptions_junction edj ON edj.eval_id = el.eval_id AND edj.active = true
),
-- Get rubric_id per test (via eval -> eval_runs_rubrics or eval_groups_rubrics)
test_rubrics AS (
    SELECT DISTINCT ON (el.test_id)
        el.test_id,
        COALESCE(rr.rubric_id, gr.rubric_id) AS rubric_id
    FROM eval_links el
    JOIN eval_artifact e ON e.id = el.eval_id
    LEFT JOIN eval_runs_rubrics_junction err ON err.eval_id = e.id
    LEFT JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
    LEFT JOIN eval_groups_rubrics_junction egr ON egr.eval_id = e.id
    LEFT JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
    ORDER BY el.test_id, COALESCE(err.created_at, egr.created_at) ASC
)
SELECT
    t.id AS test_id,
    el.eval_id,
    pl.profile_id,
    COALESCE(dl.department_ids, ARRAY[]::uuid[]) AS department_ids,
    t.infinite_mode,
    COALESCE(t.archived, false) AS archived,
    t.created_at AS test_created_at,
    t.updated_at AS test_updated_at,
    COALESCE(ic.num_invocations, 0)::int AS num_chats,
    COALESCE(ic.num_invocations_completed, 0)::int AS num_chats_completed,
    COALESCE(mc.num_messages, 0)::int AS num_messages,
    -- Name/description IDs for hydration
    eni.eval_name_id,
    edi.eval_description_id,
    tr.rubric_id
FROM benchmark_tests_entry t
LEFT JOIN eval_links el ON el.test_id = t.id
LEFT JOIN profile_links pl ON pl.test_id = t.id
LEFT JOIN department_links dl ON dl.test_id = t.id
LEFT JOIN invocation_counts ic ON ic.test_id = t.id
LEFT JOIN message_counts mc ON mc.test_id = t.id
LEFT JOIN eval_name_ids eni ON eni.test_id = t.id
LEFT JOIN eval_description_ids edi ON edi.test_id = t.id
LEFT JOIN test_rubrics tr ON tr.test_id = t.id
WHERE t.active = true
WITH NO DATA;

CREATE UNIQUE INDEX mv_benchmark_tests_pk
    ON mv_benchmark_tests (test_id);

CREATE INDEX mv_benchmark_tests_eval_id_idx
    ON mv_benchmark_tests (eval_id);

CREATE INDEX mv_benchmark_tests_profile_id_idx
    ON mv_benchmark_tests (profile_id);

CREATE INDEX mv_benchmark_tests_archived_idx
    ON mv_benchmark_tests (archived);

CREATE INDEX mv_benchmark_tests_created_at_idx
    ON mv_benchmark_tests (test_created_at DESC);

CREATE INDEX mv_benchmark_tests_department_ids_gin
    ON mv_benchmark_tests USING GIN (department_ids);

REFRESH MATERIALIZED VIEW mv_benchmark_tests;
