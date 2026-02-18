-- Materialized View: test_invocation_mv
-- Invocation-level data for benchmark detail views.
--
-- Grain: One row per benchmark invocation (test_invocation_entry.id)
-- Filter: active = TRUE only
--
-- Purpose: Provides invocation-level resource IDs and grade data for
-- parallel fetching. Follows attempt_chat_mv pattern: resource-ID-rich
-- via bundle_snapshot, grade data denormalized. Feedbacks fetched separately
-- via test_feedback_mv using grade_id.
--
-- Two sources of run IDs:
--   invocation_run_ids: actual execution runs (test_invocation_runs_connection)
--   run_ids: configured template runs (suite_department_runs_connection)
--
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 1: Drop all indexes on test_invocation_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'test_invocation_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop test_invocation_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS test_invocation_mv CASCADE;

-- ============================================================================
-- Step 3: Create test_invocation_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW test_invocation_mv AS
WITH
-- Actual execution runs (from invocation-level connection)
invocation_run_links AS (
    SELECT
        c.invocation_id,
        ARRAY_AGG(c.runs_id ORDER BY c.created_at) FILTER (WHERE c.runs_id IS NOT NULL) AS invocation_run_ids
    FROM test_invocation_runs_connection c
    WHERE c.active = true
    GROUP BY c.invocation_id
),
-- Grade data (latest grade per invocation)
latest_grade AS (
    SELECT DISTINCT ON (g.invocation_id)
        g.id AS grade_id,
        g.invocation_id,
        g.score AS grade_score,
        g.passed AS grade_passed,
        g.time_taken AS grade_time_taken
    FROM test_grade_entry g
    WHERE g.active = true
    ORDER BY g.invocation_id, g.created_at DESC
),
-- Rubric from grade (via test_grade_rubrics_connection)
grade_rubric AS (
    SELECT DISTINCT ON (lg.invocation_id)
        lg.invocation_id,
        grc.rubrics_id AS rubric_id
    FROM latest_grade lg
    JOIN test_grade_rubrics_connection grc ON grc.grade_id = lg.grade_id
    ORDER BY lg.invocation_id
),
-- ============================================================================
-- Bundle snapshot: configured resource IDs from suite_department_*
-- Analogous to subbundle_snapshot in attempt_chat_mv
-- ============================================================================
bundle_snapshot AS (
    SELECT
        bbd.id AS suite_department_id,
        -- Configured runs (template runs from bundle) — array, multiple per department
        COALESCE(ARRAY_AGG(DISTINCT bbdr.runs_id ORDER BY bbdr.runs_id) FILTER (WHERE bbdr.runs_id IS NOT NULL), ARRAY[]::uuid[]) AS run_ids,
        -- Configured groups — array, multiple per department
        COALESCE(ARRAY_AGG(DISTINCT bbdg.groups_id ORDER BY bbdg.groups_id) FILTER (WHERE bbdg.groups_id IS NOT NULL), ARRAY[]::uuid[]) AS group_ids,
        -- Agent sub-resources — singular (one per department entry)
        (ARRAY_AGG(bbdm.models_id) FILTER (WHERE bbdm.models_id IS NOT NULL))[1] AS model_id,
        (ARRAY_AGG(bbdp.prompts_id) FILTER (WHERE bbdp.prompts_id IS NOT NULL))[1] AS prompt_id,
        -- Instructions — array, multiple per department
        COALESCE(ARRAY_AGG(DISTINCT bbdi.instructions_id ORDER BY bbdi.instructions_id) FILTER (WHERE bbdi.instructions_id IS NOT NULL), ARRAY[]::uuid[]) AS instruction_ids,
        -- Singular sub-resources (one per department entry)
        (ARRAY_AGG(bbdv.voices_id) FILTER (WHERE bbdv.voices_id IS NOT NULL))[1] AS voice_id,
        (ARRAY_AGG(bbdt.temperature_levels_id) FILTER (WHERE bbdt.temperature_levels_id IS NOT NULL))[1] AS temperature_level_id,
        (ARRAY_AGG(bbdrl.reasoning_levels_id) FILTER (WHERE bbdrl.reasoning_levels_id IS NOT NULL))[1] AS reasoning_level_id,
        -- Tools — array, multiple per department
        COALESCE(ARRAY_AGG(DISTINCT bbdtl.tools_id ORDER BY bbdtl.tools_id) FILTER (WHERE bbdtl.tools_id IS NOT NULL), ARRAY[]::uuid[]) AS tool_ids,
        -- Key — singular (one per department entry)
        (ARRAY_AGG(bbdk.keys_id) FILTER (WHERE bbdk.keys_id IS NOT NULL))[1] AS key_id
    FROM suite_department_entry bbd
    LEFT JOIN suite_department_runs_connection bbdr ON bbdr.suite_department_id = bbd.id AND bbdr.active = true
    LEFT JOIN suite_department_groups_connection bbdg ON bbdg.suite_department_id = bbd.id AND bbdg.active = true
    LEFT JOIN suite_department_models_connection bbdm ON bbdm.suite_department_id = bbd.id AND bbdm.active = true
    LEFT JOIN suite_department_prompts_connection bbdp ON bbdp.suite_department_id = bbd.id AND bbdp.active = true
    LEFT JOIN suite_department_instructions_connection bbdi ON bbdi.suite_department_id = bbd.id AND bbdi.active = true
    LEFT JOIN suite_department_voices_connection bbdv ON bbdv.suite_department_id = bbd.id AND bbdv.active = true
    LEFT JOIN suite_department_temperature_levels_connection bbdt ON bbdt.suite_department_id = bbd.id AND bbdt.active = true
    LEFT JOIN suite_department_reasoning_levels_connection bbdrl ON bbdrl.suite_department_id = bbd.id AND bbdrl.active = true
    LEFT JOIN suite_department_tools_connection bbdtl ON bbdtl.suite_department_id = bbd.id AND bbdtl.active = true
    LEFT JOIN suite_department_keys_connection bbdk ON bbdk.suite_department_id = bbd.id AND bbdk.active = true
    WHERE bbd.active = true
    GROUP BY bbd.id
),
-- Historical runs: all runs in the invocation's group (for history building)
historical_runs AS (
    SELECT
        i.id AS invocation_id,
        ARRAY_AGG(rrc.runs_id ORDER BY re.created_at)
            FILTER (WHERE rrc.runs_id IS NOT NULL) AS historical_run_ids
    FROM test_invocation_entry i
    JOIN runs_entry re ON re.group_id = i.group_id
    JOIN runs_runs_connection rrc ON rrc.run_id = re.id AND rrc.active = true
    WHERE i.active = true AND i.group_id IS NOT NULL
    GROUP BY i.id
)
SELECT
    -- Primary key
    i.id AS invocation_id,

    -- Foreign keys
    i.test_id,
    i.group_id,
    i.suite_department_id,

    -- Invocation data
    i.created_at AS invocation_created_at,
    i.title AS invocation_title,

    -- Grade data
    (lg.invocation_id IS NOT NULL) AS invocation_completed,
    lg.grade_id,
    lg.grade_score,
    lg.grade_passed,
    lg.grade_time_taken,
    gr.rubric_id,

    -- Actual execution runs (from invocation-level connection)
    COALESCE(irl.invocation_run_ids, ARRAY[]::uuid[]) AS invocation_run_ids,

    -- Configured resource IDs (from bundle department snapshot)
    -- Arrays (multiple per department)
    COALESCE(bs.run_ids, ARRAY[]::uuid[]) AS run_ids,
    COALESCE(bs.group_ids, ARRAY[]::uuid[]) AS group_ids,
    COALESCE(bs.instruction_ids, ARRAY[]::uuid[]) AS instruction_ids,
    COALESCE(bs.tool_ids, ARRAY[]::uuid[]) AS tool_ids,
    -- Singular (one per department entry)
    bs.model_id,
    bs.prompt_id,
    bs.voice_id,
    bs.temperature_level_id,
    bs.reasoning_level_id,
    bs.key_id,

    -- Historical runs (all runs in invocation's group)
    COALESCE(hr.historical_run_ids, ARRAY[]::uuid[]) AS historical_run_ids

FROM test_invocation_entry i
LEFT JOIN invocation_run_links irl ON irl.invocation_id = i.id
LEFT JOIN latest_grade lg ON lg.invocation_id = i.id
LEFT JOIN grade_rubric gr ON gr.invocation_id = i.id
LEFT JOIN bundle_snapshot bs ON bs.suite_department_id = i.suite_department_id
LEFT JOIN historical_runs hr ON hr.invocation_id = i.id
WHERE i.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX test_invocation_mv_pk
    ON test_invocation_mv (invocation_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Test ID for grouping invocations by test
CREATE INDEX test_invocation_mv_test_id_idx
    ON test_invocation_mv (test_id);

-- Completion status for filtering
CREATE INDEX test_invocation_mv_completed_idx
    ON test_invocation_mv (invocation_completed);

-- Timestamp for sorting
CREATE INDEX test_invocation_mv_created_at_idx
    ON test_invocation_mv (invocation_created_at DESC);

-- Group ID for filtering
CREATE INDEX test_invocation_mv_group_id_idx
    ON test_invocation_mv (group_id)
    WHERE group_id IS NOT NULL;

-- Bundle department ID for filtering
CREATE INDEX test_invocation_mv_bbd_id_idx
    ON test_invocation_mv (suite_department_id)
    WHERE suite_department_id IS NOT NULL;

-- Invocation run IDs for filtering by execution run
CREATE INDEX test_invocation_mv_invocation_run_ids_gin
    ON test_invocation_mv USING GIN (invocation_run_ids);

-- Configured run IDs for filtering by template run
CREATE INDEX test_invocation_mv_run_ids_gin
    ON test_invocation_mv USING GIN (run_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW test_invocation_mv;
