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
--   invocation_run_ids: actual execution runs (test_invocation_runs_entry + runs_runs_connection)
--   run_ids: configured template runs (test_invocation_runs_entry + runs_runs_connection on resolved entry)
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
-- Runs sub-entry: run_ids from test_invocation_runs_entry → runs_runs_connection
runs_entry_links AS (
    SELECT
        re.test_invocation_id,
        ARRAY_AGG(DISTINCT rrc.runs_id ORDER BY rrc.runs_id) FILTER (WHERE rrc.runs_id IS NOT NULL) AS run_ids
    FROM test_invocation_runs_entry re
    JOIN test_invocation_runs_runs_connection rrc ON rrc.test_invocation_runs_id = re.id AND rrc.active = true
    WHERE re.active = true
    GROUP BY re.test_invocation_id
),
-- Groups sub-entry: group_ids from test_invocation_groups_entry → groups_groups_connection
groups_entry_links AS (
    SELECT
        ge.test_invocation_id,
        ARRAY_AGG(DISTINCT ggc.groups_id ORDER BY ggc.groups_id) FILTER (WHERE ggc.groups_id IS NOT NULL) AS group_ids
    FROM test_invocation_groups_entry ge
    JOIN test_invocation_groups_groups_connection ggc ON ggc.test_invocation_groups_id = ge.id AND ggc.active = true
    WHERE ge.active = true
    GROUP BY ge.test_invocation_id
),
-- Groups agents: agent_ids from test_invocation_groups_entry → groups_agents_connection
groups_agents_links AS (
    SELECT
        ge.test_invocation_id,
        ARRAY_AGG(DISTINCT gac.agents_id ORDER BY gac.agents_id) FILTER (WHERE gac.agents_id IS NOT NULL) AS group_agent_ids
    FROM test_invocation_groups_entry ge
    JOIN test_invocation_groups_agents_connection gac ON gac.test_invocation_groups_id = ge.id AND gac.active = true
    WHERE ge.active = true
    GROUP BY ge.test_invocation_id
),
-- Runs agents: agent_ids from test_invocation_runs_entry → runs_agents_connection
runs_agents_links AS (
    SELECT
        re.test_invocation_id,
        ARRAY_AGG(DISTINCT rac.agents_id ORDER BY rac.agents_id) FILTER (WHERE rac.agents_id IS NOT NULL) AS run_agent_ids
    FROM test_invocation_runs_entry re
    JOIN test_invocation_runs_agents_connection rac ON rac.test_invocation_runs_id = re.id AND rac.active = true
    WHERE re.active = true
    GROUP BY re.test_invocation_id
),
-- Department links (from connection table, was direct FK)
department_links AS (
    SELECT
        dc.test_invocation_id,
        ARRAY_AGG(DISTINCT dc.departments_id) FILTER (WHERE dc.departments_id IS NOT NULL) AS department_ids
    FROM test_invocation_departments_connection dc
    WHERE dc.active = true
    GROUP BY dc.test_invocation_id
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
-- ============================================================================
-- Bundle snapshot: configured resource IDs from test_invocation_*
-- Analogous to subbundle_snapshot in attempt_chat_mv
-- Now only: models, voices, temperature_levels, reasoning_levels, keys
-- (prompts, instructions, tools are resolved from agents_resource)
-- ============================================================================
bundle_snapshot AS (
    SELECT
        ir.id AS test_invocation_id,
        -- Agent sub-resources — singular (one per resolved entry)
        (ARRAY_AGG(irm.models_id) FILTER (WHERE irm.models_id IS NOT NULL))[1] AS model_id,
        -- Singular sub-resources (one per resolved entry)
        (ARRAY_AGG(irv.voices_id) FILTER (WHERE irv.voices_id IS NOT NULL))[1] AS voice_id,
        (ARRAY_AGG(irt.temperature_levels_id) FILTER (WHERE irt.temperature_levels_id IS NOT NULL))[1] AS temperature_level_id,
        (ARRAY_AGG(irrl.reasoning_levels_id) FILTER (WHERE irrl.reasoning_levels_id IS NOT NULL))[1] AS reasoning_level_id,
        -- Key — singular (one per resolved entry)
        (ARRAY_AGG(irk.keys_id) FILTER (WHERE irk.keys_id IS NOT NULL))[1] AS key_id
    FROM test_invocation_entry ir
    LEFT JOIN test_invocation_models_connection irm ON irm.test_invocation_id = ir.id AND irm.active = true
    LEFT JOIN test_invocation_voices_connection irv ON irv.test_invocation_id = ir.id AND irv.active = true
    LEFT JOIN test_invocation_temperature_levels_connection irt ON irt.test_invocation_id = ir.id AND irt.active = true
    LEFT JOIN test_invocation_reasoning_levels_connection irrl ON irrl.test_invocation_id = ir.id AND irrl.active = true
    LEFT JOIN test_invocation_keys_connection irk ON irk.test_invocation_id = ir.id AND irk.active = true
    WHERE ir.active = true
    GROUP BY ir.id
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

    -- Invocation data
    i.created_at AS invocation_created_at,
    i.title AS invocation_title,
    i.use_custom,
    i.position,

    -- Grade data
    (lg.invocation_id IS NOT NULL) AS invocation_completed,
    lg.grade_id,
    lg.grade_score,
    lg.grade_passed,
    lg.grade_time_taken,
    NULL::uuid AS rubric_id,

    -- Department IDs (from connection table)
    COALESCE(dl.department_ids, ARRAY[]::uuid[]) AS department_ids,

    -- Configured resource IDs (from sub-entry tables)
    -- Run IDs (from runs sub-entries)
    COALESCE(rel.run_ids, ARRAY[]::uuid[]) AS run_ids,
    -- Group IDs (from groups sub-entries)
    COALESCE(gel.group_ids, ARRAY[]::uuid[]) AS group_ids,
    -- Agent IDs (from sub-entry agent connections)
    COALESCE(ral.run_agent_ids, ARRAY[]::uuid[]) AS run_agent_ids,
    COALESCE(gal.group_agent_ids, ARRAY[]::uuid[]) AS group_agent_ids,

    -- Singular resource IDs (from bundle snapshot, remaining connections)
    bs.model_id,
    bs.voice_id,
    bs.temperature_level_id,
    bs.reasoning_level_id,
    bs.key_id,

    -- Historical runs (all runs in invocation's group)
    COALESCE(hr.historical_run_ids, ARRAY[]::uuid[]) AS historical_run_ids

FROM test_invocation_entry i
LEFT JOIN runs_entry_links rel ON rel.test_invocation_id = i.id
LEFT JOIN groups_entry_links gel ON gel.test_invocation_id = i.id
LEFT JOIN groups_agents_links gal ON gal.test_invocation_id = i.id
LEFT JOIN runs_agents_links ral ON ral.test_invocation_id = i.id
LEFT JOIN department_links dl ON dl.test_invocation_id = i.id
LEFT JOIN latest_grade lg ON lg.invocation_id = i.id
LEFT JOIN bundle_snapshot bs ON bs.test_invocation_id = i.id
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

-- Configured run IDs for filtering by template run
CREATE INDEX test_invocation_mv_run_ids_gin
    ON test_invocation_mv USING GIN (run_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW test_invocation_mv;
