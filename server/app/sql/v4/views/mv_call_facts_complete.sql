-- Materialized View: mv_call_facts
-- Pre-joins calls with agents, models, providers, templates, and tools.
-- Stores IDs for runtime resource joins.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- Key principle: MVs only go stale when new calls are added.
-- Resource metadata changes are always fresh via query-time joins.
-- ============================================================================
-- Step 1: Drop all indexes on mv_call_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_call_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_call_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_call_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_call_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_call_facts AS
WITH
-- Get first agent/model/provider per call to avoid Cartesian product
-- (A call typically has one agent/model/provider, but some test data has multiple)
call_agent AS (
    SELECT DISTINCT ON (call_id) call_id, agents_id
    FROM agents_calls_connection
    WHERE active = TRUE
    ORDER BY call_id, created_at DESC
),
call_model AS (
    SELECT DISTINCT ON (call_id) call_id, models_id
    FROM models_calls_connection
    WHERE active = TRUE
    ORDER BY call_id, created_at DESC
),
call_provider AS (
    SELECT DISTINCT ON (call_id) call_id, providers_id
    FROM providers_calls_connection
    WHERE active = TRUE
    ORDER BY call_id, created_at DESC
)
SELECT
    -- Entry ID
    c.id AS call_id,

    -- Resource IDs (from connections - using first/most recent)
    ca.agents_id AS agent_id,
    cm.models_id AS model_id,
    cp.providers_id AS provider_id,
    c.run_id,
    c.template_id,
    tcj.tool_id,

    -- Call data
    c.external_call_id,
    c.completed,
    LENGTH(c.arguments_raw)::int AS arguments_length,

    -- Tool flags (from tool_calls_junction)
    COALESCE(tcj.generated, FALSE) AS is_generated,
    COALESCE(tcj.mcp, FALSE) AS is_mcp,

    -- Timestamps
    c.created_at AS call_created_at,
    c.updated_at AS call_updated_at,

    -- Completion time (in milliseconds)
    CASE
        WHEN c.completed = TRUE AND c.updated_at > c.created_at
        THEN EXTRACT(EPOCH FROM (c.updated_at - c.created_at))::numeric * 1000
        ELSE NULL
    END AS completion_time_ms

FROM calls_entry c
LEFT JOIN call_agent ca ON ca.call_id = c.id
LEFT JOIN call_model cm ON cm.call_id = c.id
LEFT JOIN call_provider cp ON cp.call_id = c.id
LEFT JOIN tool_calls_junction tcj ON tcj.call_id = c.id AND tcj.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

-- Note: A call can have multiple tools, so we include tool_id in the PK
CREATE UNIQUE INDEX mv_call_facts_pk
    ON mv_call_facts (call_id, COALESCE(tool_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Call ID index for direct lookups
CREATE INDEX mv_call_facts_call_id_idx
    ON mv_call_facts (call_id);

-- Resource ID indexes for filtering
CREATE INDEX mv_call_facts_agent_id_idx
    ON mv_call_facts (agent_id)
    WHERE agent_id IS NOT NULL;

CREATE INDEX mv_call_facts_model_id_idx
    ON mv_call_facts (model_id)
    WHERE model_id IS NOT NULL;

CREATE INDEX mv_call_facts_provider_id_idx
    ON mv_call_facts (provider_id)
    WHERE provider_id IS NOT NULL;

CREATE INDEX mv_call_facts_run_id_idx
    ON mv_call_facts (run_id)
    WHERE run_id IS NOT NULL;

CREATE INDEX mv_call_facts_template_id_idx
    ON mv_call_facts (template_id)
    WHERE template_id IS NOT NULL;

CREATE INDEX mv_call_facts_tool_id_idx
    ON mv_call_facts (tool_id)
    WHERE tool_id IS NOT NULL;

-- Timestamp indexes
CREATE INDEX mv_call_facts_call_created_at_idx
    ON mv_call_facts (call_created_at);

CREATE INDEX mv_call_facts_call_created_at_desc_idx
    ON mv_call_facts (call_created_at DESC);

-- Completion status indexes
CREATE INDEX mv_call_facts_completed_idx
    ON mv_call_facts (completed);

CREATE INDEX mv_call_facts_completed_true_idx
    ON mv_call_facts (call_created_at DESC)
    WHERE completed = TRUE;

CREATE INDEX mv_call_facts_pending_idx
    ON mv_call_facts (call_created_at DESC)
    WHERE completed = FALSE;

-- Flag indexes
CREATE INDEX mv_call_facts_is_generated_idx
    ON mv_call_facts (is_generated)
    WHERE is_generated = TRUE;

CREATE INDEX mv_call_facts_is_mcp_idx
    ON mv_call_facts (is_mcp)
    WHERE is_mcp = TRUE;

-- Completion time index for performance analysis
CREATE INDEX mv_call_facts_completion_time_ms_idx
    ON mv_call_facts (completion_time_ms ASC NULLS LAST)
    WHERE completion_time_ms IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX mv_call_facts_agent_created_at_idx
    ON mv_call_facts (agent_id, call_created_at DESC)
    WHERE agent_id IS NOT NULL;

CREATE INDEX mv_call_facts_model_created_at_idx
    ON mv_call_facts (model_id, call_created_at DESC)
    WHERE model_id IS NOT NULL;

CREATE INDEX mv_call_facts_provider_created_at_idx
    ON mv_call_facts (provider_id, call_created_at DESC)
    WHERE provider_id IS NOT NULL;

CREATE INDEX mv_call_facts_run_created_at_idx
    ON mv_call_facts (run_id, call_created_at DESC)
    WHERE run_id IS NOT NULL;

CREATE INDEX mv_call_facts_tool_created_at_idx
    ON mv_call_facts (tool_id, call_created_at DESC)
    WHERE tool_id IS NOT NULL;

-- Agent + model composite index
CREATE INDEX mv_call_facts_agent_model_idx
    ON mv_call_facts (agent_id, model_id)
    WHERE agent_id IS NOT NULL AND model_id IS NOT NULL;

-- External call ID index for lookups
CREATE INDEX mv_call_facts_external_call_id_idx
    ON mv_call_facts (external_call_id);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_call_facts;
