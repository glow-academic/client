-- Materialized View: mv_simulation_messages
-- Message-level data for simulation attempt detail views.
--
-- Grain: One row per message
-- Filter: archived = FALSE only
-- Note: Practice filtering done at attempt level, position derived in service layer
--
-- Purpose: Provides message-level data with strengths/improvements for parallel fetching
-- Section: SIMULATION (unified view - both home and practice)
--
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 0: Drop and recreate composite types for message feedback
-- ============================================================================

-- Create types if they don't exist (shared with mv_home_messages)
-- Note: message_id removed from nested types - implied by parent message
DO $$
BEGIN
    CREATE TYPE types.mv_highlight AS (
        section text,
        idx int
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE types.mv_replacement AS (
        section text,
        replace_text text,
        idx int
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Drop and recreate strength type (message_id removed - implied)
DROP TYPE IF EXISTS types.mv_strength CASCADE;
CREATE TYPE types.mv_strength AS (
    id uuid,
    name text,
    description text,
    highlights types.mv_highlight[]
);

-- Drop and recreate improvement type (message_id removed - implied)
DROP TYPE IF EXISTS types.mv_improvement CASCADE;
CREATE TYPE types.mv_improvement AS (
    id uuid,
    name text,
    description text,
    replacements types.mv_replacement[]
);

-- Drop and recreate hint type (message_id removed - implied)
DROP TYPE IF EXISTS types.mv_hint CASCADE;
CREATE TYPE types.mv_hint AS (
    hint text,
    idx int
);

-- Drop and recreate mv_content type (only persona_id - metadata fetched via handler)
DROP TYPE IF EXISTS types.mv_content CASCADE;
CREATE TYPE types.mv_content AS (
    id uuid,
    content text,
    persona_id uuid,        -- persona ID (NULL for user messages, fetch metadata via handler)
    created_at timestamptz
);

-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_messages materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_messages'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_simulation_messages materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_messages CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_messages Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_messages AS
WITH
-- Aggregate highlights per strength
highlights_agg AS (
    SELECT
        h.strength_id,
        ARRAY_AGG(
            (h.section, h.idx)::types.mv_highlight
            ORDER BY h.idx
        ) AS highlights
    FROM simulation_highlights_entry h
    WHERE h.active = TRUE
    GROUP BY h.strength_id
),
-- Aggregate strengths per message with their highlights (message_id removed - implied)
strengths_agg AS (
    SELECT
        s.message_id,
        ARRAY_AGG(
            (s.id, s.name, s.description,
             COALESCE(ha.highlights, ARRAY[]::types.mv_highlight[]))::types.mv_strength
            ORDER BY s.created_at
        ) AS strengths
    FROM simulation_strengths_entry s
    LEFT JOIN highlights_agg ha ON ha.strength_id = s.id
    WHERE s.active = TRUE
    GROUP BY s.message_id
),
-- Aggregate replacements per improvement
replacements_agg AS (
    SELECT
        r.improvement_id,
        ARRAY_AGG(
            (r.section, r.replace, r.idx)::types.mv_replacement
            ORDER BY r.idx
        ) AS replacements
    FROM simulation_replacements_entry r
    WHERE r.active = TRUE
    GROUP BY r.improvement_id
),
-- Aggregate improvements per message with their replacements (message_id removed - implied)
improvements_agg AS (
    SELECT
        i.message_id,
        ARRAY_AGG(
            (i.id, i.name, i.description,
             COALESCE(ra.replacements, ARRAY[]::types.mv_replacement[]))::types.mv_improvement
            ORDER BY i.created_at
        ) AS improvements
    FROM simulation_improvements_entry i
    LEFT JOIN replacements_agg ra ON ra.improvement_id = i.id
    WHERE i.active = TRUE
    GROUP BY i.message_id
),
-- Aggregate hints per message (PRACTICE-specific, message_id removed - implied)
hints_agg AS (
    SELECT
        h.message_id,
        ARRAY_AGG(
            (h.hint, h.idx)::types.mv_hint
            ORDER BY h.idx
        ) AS hints
    FROM simulation_hints_entry h
    WHERE h.active = TRUE
    GROUP BY h.message_id
),
-- Aggregate contents per message (only persona_id - metadata fetched via handler)
contents_agg AS (
    SELECT
        sce.simulation_message_id AS message_id,
        ARRAY_AGG(
            (
                ce.id,
                ce.content,
                sce.persona_id,
                ce.created_at
            )::types.mv_content
            ORDER BY ce.created_at
        ) AS contents
    FROM simulation_contents_entry sce
    JOIN contents_entry ce ON ce.id = sce.content_id
    WHERE ce.active = TRUE
    GROUP BY sce.simulation_message_id
),
-- Base message data (position derived in service layer, practice on attempt level)
base_messages AS (
    SELECT
        sm.id AS message_id,
        sm.chat_id,
        c.attempt_id,
        m.role,
        m.completed,
        m.created_at
    FROM simulation_messages_entry sm
    JOIN messages_entry m ON m.id = sm.id
    JOIN simulation_chats_entry c ON c.id = sm.chat_id
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    WHERE m.active = TRUE
      AND c.active = TRUE
      AND a.active = TRUE
      AND COALESCE(a.archived, FALSE) = FALSE
      AND m.role IN ('user'::message_type, 'assistant'::message_type)
)
SELECT
    -- Primary key
    bm.message_id,

    -- Foreign keys for parallel lookup and grouping
    bm.chat_id,
    bm.attempt_id,

    -- Message data (position derived in service layer)
    CASE WHEN bm.role = 'user'::message_type THEN 'query' ELSE 'response' END AS type,
    bm.created_at,
    bm.completed,

    -- Contents array with persona_id (metadata fetched via handler)
    COALESCE(ca.contents, ARRAY[]::types.mv_content[]) AS contents,

    -- Strengths with highlights (denormalized, message_id implied)
    COALESCE(sa.strengths, ARRAY[]::types.mv_strength[]) AS strengths,

    -- Improvements with replacements (denormalized, message_id implied)
    COALESCE(ia.improvements, ARRAY[]::types.mv_improvement[]) AS improvements,

    -- Hints (PRACTICE-specific, denormalized, message_id implied)
    COALESCE(ha.hints, ARRAY[]::types.mv_hint[]) AS hints

FROM base_messages bm
LEFT JOIN contents_agg ca ON ca.message_id = bm.message_id
LEFT JOIN strengths_agg sa ON sa.message_id = bm.message_id
LEFT JOIN improvements_agg ia ON ia.message_id = bm.message_id
LEFT JOIN hints_agg ha ON ha.message_id = bm.message_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_messages_pk
    ON mv_simulation_messages (message_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Chat ID for grouping
CREATE INDEX mv_simulation_messages_chat_id_idx
    ON mv_simulation_messages (chat_id);

-- Attempt ID for parallel lookup
CREATE INDEX mv_simulation_messages_attempt_id_idx
    ON mv_simulation_messages (attempt_id);

-- Composite: attempt + chat for ordering (position derived in service layer)
CREATE INDEX mv_simulation_messages_attempt_chat_idx
    ON mv_simulation_messages (attempt_id, chat_id);

-- Message type for filtering
CREATE INDEX mv_simulation_messages_type_idx
    ON mv_simulation_messages (type);

-- Created at for ordering (position derived from this)
CREATE INDEX mv_simulation_messages_created_at_idx
    ON mv_simulation_messages (created_at);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_messages;
