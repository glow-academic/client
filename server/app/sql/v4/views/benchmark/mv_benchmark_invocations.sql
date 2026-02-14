-- Materialized View: mv_benchmark_invocations
-- Invocation-level data for benchmark detail views.
--
-- Grain: One row per benchmark invocation (benchmark_invocations_entry.id)
-- Filter: active = TRUE only
--
-- Purpose: Provides invocation-level resource IDs and grade data for
-- parallel fetching. Follows mv_attempt_chats pattern: resource-ID-rich
-- via bundle_snapshot, grade/feedback data denormalized.
--
-- Two sources of run IDs:
--   invocation_run_ids: actual execution runs (benchmark_invocations_runs_connection)
--   run_ids: configured template runs (benchmark_bundle_departments_runs_connection)
--
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 0: Create composite type for benchmark feedback
-- ============================================================================

DO $$
BEGIN
    CREATE TYPE types.mv_benchmark_feedback AS (
        id uuid,
        total integer,
        feedback text,
        total_points integer,
        pass_points integer
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================================================
-- Step 1: Drop all indexes on mv_benchmark_invocations materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_benchmark_invocations'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_benchmark_invocations materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_benchmark_invocations CASCADE;

-- ============================================================================
-- Step 3: Create mv_benchmark_invocations Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_benchmark_invocations AS
WITH
-- Actual execution runs (from invocation-level connection)
invocation_run_links AS (
    SELECT
        c.invocation_id,
        ARRAY_AGG(c.runs_id ORDER BY c.created_at) FILTER (WHERE c.runs_id IS NOT NULL) AS invocation_run_ids
    FROM benchmark_invocations_runs_connection c
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
    FROM benchmark_grades_entry g
    WHERE g.active = true
    ORDER BY g.invocation_id, g.created_at DESC
),
-- Rubric from grade (via benchmark_grades_rubrics_connection)
grade_rubric AS (
    SELECT DISTINCT ON (lg.invocation_id)
        lg.invocation_id,
        grc.rubrics_id AS rubric_id
    FROM latest_grade lg
    JOIN benchmark_grades_rubrics_connection grc ON grc.grade_id = lg.grade_id
    ORDER BY lg.invocation_id
),
-- Feedbacks aggregated per grade
feedbacks_agg AS (
    SELECT
        fe.grade_id,
        ARRAY_AGG(
            (fe.id, fe.total, fe.feedback, fe.total_points, fe.pass_points)::types.mv_benchmark_feedback
            ORDER BY fe.created_at
        ) AS feedbacks
    FROM benchmark_feedbacks_entry fe
    WHERE fe.active = TRUE
    GROUP BY fe.grade_id
),
-- ============================================================================
-- Bundle snapshot: configured resource IDs from benchmark_bundle_departments_*
-- Analogous to subbundle_snapshot in mv_attempt_chats
-- ============================================================================
bundle_snapshot AS (
    SELECT
        bbd.id AS benchmark_bundle_department_id,
        -- Configured runs (template runs from bundle)
        COALESCE(ARRAY_AGG(DISTINCT bbdr.runs_id ORDER BY bbdr.runs_id) FILTER (WHERE bbdr.runs_id IS NOT NULL), ARRAY[]::uuid[]) AS run_ids,
        -- Configured groups
        COALESCE(ARRAY_AGG(DISTINCT bbdg.groups_id ORDER BY bbdg.groups_id) FILTER (WHERE bbdg.groups_id IS NOT NULL), ARRAY[]::uuid[]) AS group_ids,
        -- Agent sub-resources
        COALESCE(ARRAY_AGG(DISTINCT bbdm.models_id ORDER BY bbdm.models_id) FILTER (WHERE bbdm.models_id IS NOT NULL), ARRAY[]::uuid[]) AS model_ids,
        COALESCE(ARRAY_AGG(DISTINCT bbdp.prompts_id ORDER BY bbdp.prompts_id) FILTER (WHERE bbdp.prompts_id IS NOT NULL), ARRAY[]::uuid[]) AS prompt_ids,
        COALESCE(ARRAY_AGG(DISTINCT bbdi.instructions_id ORDER BY bbdi.instructions_id) FILTER (WHERE bbdi.instructions_id IS NOT NULL), ARRAY[]::uuid[]) AS instruction_ids,
        COALESCE(ARRAY_AGG(DISTINCT bbdv.voices_id ORDER BY bbdv.voices_id) FILTER (WHERE bbdv.voices_id IS NOT NULL), ARRAY[]::uuid[]) AS voice_ids,
        COALESCE(ARRAY_AGG(DISTINCT bbdt.temperature_levels_id ORDER BY bbdt.temperature_levels_id) FILTER (WHERE bbdt.temperature_levels_id IS NOT NULL), ARRAY[]::uuid[]) AS temperature_level_ids,
        COALESCE(ARRAY_AGG(DISTINCT bbdrl.reasoning_levels_id ORDER BY bbdrl.reasoning_levels_id) FILTER (WHERE bbdrl.reasoning_levels_id IS NOT NULL), ARRAY[]::uuid[]) AS reasoning_level_ids,
        COALESCE(ARRAY_AGG(DISTINCT bbdtl.tools_id ORDER BY bbdtl.tools_id) FILTER (WHERE bbdtl.tools_id IS NOT NULL), ARRAY[]::uuid[]) AS tool_ids,
        COALESCE(ARRAY_AGG(DISTINCT bbdk.keys_id ORDER BY bbdk.keys_id) FILTER (WHERE bbdk.keys_id IS NOT NULL), ARRAY[]::uuid[]) AS key_ids
    FROM benchmark_bundle_departments_entry bbd
    LEFT JOIN benchmark_bundle_departments_runs_connection bbdr ON bbdr.benchmark_bundle_department_id = bbd.id AND bbdr.active = true
    LEFT JOIN benchmark_bundle_departments_groups_connection bbdg ON bbdg.benchmark_bundle_department_id = bbd.id AND bbdg.active = true
    LEFT JOIN benchmark_bundle_departments_models_connection bbdm ON bbdm.benchmark_bundle_department_id = bbd.id AND bbdm.active = true
    LEFT JOIN benchmark_bundle_departments_prompts_connection bbdp ON bbdp.benchmark_bundle_department_id = bbd.id AND bbdp.active = true
    LEFT JOIN benchmark_bundle_departments_instructions_connection bbdi ON bbdi.benchmark_bundle_department_id = bbd.id AND bbdi.active = true
    LEFT JOIN benchmark_bundle_departments_voices_connection bbdv ON bbdv.benchmark_bundle_department_id = bbd.id AND bbdv.active = true
    LEFT JOIN benchmark_bundle_departments_temperature_levels_connection bbdt ON bbdt.benchmark_bundle_department_id = bbd.id AND bbdt.active = true
    LEFT JOIN benchmark_bundle_departments_reasoning_levels_connection bbdrl ON bbdrl.benchmark_bundle_department_id = bbd.id AND bbdrl.active = true
    LEFT JOIN benchmark_bundle_departments_tools_connection bbdtl ON bbdtl.benchmark_bundle_department_id = bbd.id AND bbdtl.active = true
    LEFT JOIN benchmark_bundle_departments_keys_connection bbdk ON bbdk.benchmark_bundle_department_id = bbd.id AND bbdk.active = true
    WHERE bbd.active = true
    GROUP BY bbd.id
)
SELECT
    -- Primary key
    i.id AS invocation_id,

    -- Foreign keys
    i.test_id,
    i.group_id,
    i.benchmark_bundle_department_id,

    -- Invocation data
    i.created_at AS invocation_created_at,
    i.title AS invocation_title,

    -- Grade data
    (lg.invocation_id IS NOT NULL) AS invocation_completed,
    lg.grade_score,
    lg.grade_passed,
    lg.grade_time_taken,
    gr.rubric_id,
    COALESCE(fa.feedbacks, ARRAY[]::types.mv_benchmark_feedback[]) AS feedbacks,

    -- Actual execution runs (from invocation-level connection)
    COALESCE(irl.invocation_run_ids, ARRAY[]::uuid[]) AS invocation_run_ids,

    -- Configured resource IDs (from bundle department snapshot)
    COALESCE(bs.run_ids, ARRAY[]::uuid[]) AS run_ids,
    COALESCE(bs.group_ids, ARRAY[]::uuid[]) AS group_ids,
    COALESCE(bs.model_ids, ARRAY[]::uuid[]) AS model_ids,
    COALESCE(bs.prompt_ids, ARRAY[]::uuid[]) AS prompt_ids,
    COALESCE(bs.instruction_ids, ARRAY[]::uuid[]) AS instruction_ids,
    COALESCE(bs.voice_ids, ARRAY[]::uuid[]) AS voice_ids,
    COALESCE(bs.temperature_level_ids, ARRAY[]::uuid[]) AS temperature_level_ids,
    COALESCE(bs.reasoning_level_ids, ARRAY[]::uuid[]) AS reasoning_level_ids,
    COALESCE(bs.tool_ids, ARRAY[]::uuid[]) AS tool_ids,
    COALESCE(bs.key_ids, ARRAY[]::uuid[]) AS key_ids

FROM benchmark_invocations_entry i
LEFT JOIN invocation_run_links irl ON irl.invocation_id = i.id
LEFT JOIN latest_grade lg ON lg.invocation_id = i.id
LEFT JOIN grade_rubric gr ON gr.invocation_id = i.id
LEFT JOIN feedbacks_agg fa ON fa.grade_id = lg.grade_id
LEFT JOIN bundle_snapshot bs ON bs.benchmark_bundle_department_id = i.benchmark_bundle_department_id
WHERE i.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_benchmark_invocations_pk
    ON mv_benchmark_invocations (invocation_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Test ID for grouping invocations by test
CREATE INDEX mv_benchmark_invocations_test_id_idx
    ON mv_benchmark_invocations (test_id);

-- Completion status for filtering
CREATE INDEX mv_benchmark_invocations_completed_idx
    ON mv_benchmark_invocations (invocation_completed);

-- Timestamp for sorting
CREATE INDEX mv_benchmark_invocations_created_at_idx
    ON mv_benchmark_invocations (invocation_created_at DESC);

-- Group ID for filtering
CREATE INDEX mv_benchmark_invocations_group_id_idx
    ON mv_benchmark_invocations (group_id)
    WHERE group_id IS NOT NULL;

-- Bundle department ID for filtering
CREATE INDEX mv_benchmark_invocations_bbd_id_idx
    ON mv_benchmark_invocations (benchmark_bundle_department_id)
    WHERE benchmark_bundle_department_id IS NOT NULL;

-- Invocation run IDs for filtering by execution run
CREATE INDEX mv_benchmark_invocations_invocation_run_ids_gin
    ON mv_benchmark_invocations USING GIN (invocation_run_ids);

-- Configured run IDs for filtering by template run
CREATE INDEX mv_benchmark_invocations_run_ids_gin
    ON mv_benchmark_invocations USING GIN (run_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_benchmark_invocations;
