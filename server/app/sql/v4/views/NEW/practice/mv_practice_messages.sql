-- Materialized View: mv_practice_messages
-- Message-level data for PRACTICE attempt detail endpoint.
--
-- Grain: One row per message
-- Filter: attempt.practice = TRUE (practice only)
--
-- Purpose: Provides message-level data with strengths/improvements/hints for parallel fetching
-- Section: PRACTICE (attempt detail)
--
-- Dependencies: Only uses _entry and _connection tables
-- NOTE: Uses types.mv_strength, types.mv_improvement from mv_home_messages (must be applied first)
-- ============================================================================
-- Step 0: Create composite type for hints (PRACTICE-specific)
-- ============================================================================

-- Drop existing type if it exists
DO $$
BEGIN
    DROP TYPE IF EXISTS types.mv_hint CASCADE;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Hint entry (practice-specific)
CREATE TYPE types.mv_hint AS (
    message_id uuid,
    hint text,
    idx int
);

-- ============================================================================
-- Step 1: Drop all indexes on mv_practice_messages materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_practice_messages'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_practice_messages materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_practice_messages CASCADE;

-- ============================================================================
-- Step 3: Create mv_practice_messages Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_practice_messages AS
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
-- Aggregate strengths per message with their highlights
strengths_agg AS (
    SELECT
        s.message_id,
        ARRAY_AGG(
            (s.id, s.message_id, s.name, s.description,
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
-- Aggregate improvements per message with their replacements
improvements_agg AS (
    SELECT
        i.message_id,
        ARRAY_AGG(
            (i.id, i.message_id, i.name, i.description,
             COALESCE(ra.replacements, ARRAY[]::types.mv_replacement[]))::types.mv_improvement
            ORDER BY i.created_at
        ) AS improvements
    FROM simulation_improvements_entry i
    LEFT JOIN replacements_agg ra ON ra.improvement_id = i.id
    WHERE i.active = TRUE
    GROUP BY i.message_id
),
-- Aggregate hints per message (PRACTICE-specific)
hints_agg AS (
    SELECT
        h.message_id,
        ARRAY_AGG(
            (h.message_id, h.hint, h.idx)::types.mv_hint
            ORDER BY h.idx
        ) AS hints
    FROM simulation_hints_entry h
    WHERE h.active = TRUE
    GROUP BY h.message_id
),
-- Compute message position within chat
messages_with_position AS (
    SELECT
        m.id AS message_id,
        m.chat_id,
        c.attempt_id,
        ce.content,
        CASE WHEN m.role = 'user'::message_type THEN 'query' ELSE 'response' END AS type,
        m.created_at,
        m.completed,
        ROW_NUMBER() OVER (PARTITION BY m.chat_id ORDER BY m.created_at) AS message_position
    FROM simulation_messages_entry m
    JOIN simulation_chats_entry c ON c.id = m.chat_id
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    LEFT JOIN simulation_contents_entry ce ON ce.message_id = m.id AND ce.idx = 0
    WHERE m.active = TRUE
      AND c.active = TRUE
      AND a.active = TRUE
      AND a.practice = TRUE  -- practice only
      AND m.role IN ('user'::message_type, 'assistant'::message_type)
)
SELECT
    -- Primary key
    mwp.message_id,

    -- Foreign keys for parallel lookup and grouping
    mwp.chat_id,
    mwp.attempt_id,

    -- Message data
    mwp.content,
    mwp.type,
    mwp.created_at,
    mwp.completed,
    mwp.message_position::int,

    -- Hints (PRACTICE-specific, only for assistant messages)
    CASE
        WHEN mwp.type = 'response' THEN COALESCE(ha.hints, ARRAY[]::types.mv_hint[])
        ELSE ARRAY[]::types.mv_hint[]
    END AS hints,

    -- Strengths with highlights (denormalized)
    COALESCE(sa.strengths, ARRAY[]::types.mv_strength[]) AS strengths,

    -- Improvements with replacements (denormalized)
    COALESCE(ia.improvements, ARRAY[]::types.mv_improvement[]) AS improvements

FROM messages_with_position mwp
LEFT JOIN hints_agg ha ON ha.message_id = mwp.message_id
LEFT JOIN strengths_agg sa ON sa.message_id = mwp.message_id
LEFT JOIN improvements_agg ia ON ia.message_id = mwp.message_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_practice_messages_pk
    ON mv_practice_messages (message_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Chat ID for grouping
CREATE INDEX mv_practice_messages_chat_id_idx
    ON mv_practice_messages (chat_id);

-- Attempt ID for parallel lookup
CREATE INDEX mv_practice_messages_attempt_id_idx
    ON mv_practice_messages (attempt_id);

-- Composite: chat + position for ordering
CREATE INDEX mv_practice_messages_chat_position_idx
    ON mv_practice_messages (chat_id, message_position);

-- Composite: attempt + chat + position for full ordering
CREATE INDEX mv_practice_messages_attempt_chat_position_idx
    ON mv_practice_messages (attempt_id, chat_id, message_position);

-- Message type for filtering
CREATE INDEX mv_practice_messages_type_idx
    ON mv_practice_messages (type);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_practice_messages;
