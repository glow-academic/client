-- Materialized View: mv_home_messages
-- Message-level data for HOME attempt detail endpoint.
--
-- Grain: One row per message
-- Filter: attempt.practice IS NOT TRUE AND attempt.archived = FALSE (general/home only)
--
-- Purpose: Provides message-level data with strengths/improvements for parallel fetching
-- Section: HOME (attempt detail)
--
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 0: Drop and recreate composite types for message feedback
-- ============================================================================

-- Drop existing types in reverse dependency order
DO $$
BEGIN
    DROP TYPE IF EXISTS types.mv_strength CASCADE;
    DROP TYPE IF EXISTS types.mv_improvement CASCADE;
    DROP TYPE IF EXISTS types.mv_highlight CASCADE;
    DROP TYPE IF EXISTS types.mv_replacement CASCADE;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Highlight entry (nested under strength)
CREATE TYPE types.mv_highlight AS (
    section text,
    idx int
);

-- Replacement entry (nested under improvement)
CREATE TYPE types.mv_replacement AS (
    section text,
    replace_text text,
    idx int
);

-- Strength with its highlights
CREATE TYPE types.mv_strength AS (
    id uuid,
    message_id uuid,
    name text,
    description text,
    highlights types.mv_highlight[]
);

-- Improvement with its replacements
CREATE TYPE types.mv_improvement AS (
    id uuid,
    message_id uuid,
    name text,
    description text,
    replacements types.mv_replacement[]
);

-- ============================================================================
-- Step 1: Drop all indexes on mv_home_messages materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_home_messages'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_home_messages materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_home_messages CASCADE;

-- ============================================================================
-- Step 3: Create mv_home_messages Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_home_messages AS
WITH
-- Get the latest grade per chat for linking feedbacks
latest_grade_per_chat AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id
    FROM simulation_grades_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
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
    LEFT JOIN LATERAL (
        SELECT content
        FROM simulation_contents_entry ce
        WHERE ce.message_id = m.id
          AND ce.active = TRUE
        ORDER BY ce.created_at
        LIMIT 1
    ) ce ON TRUE
    WHERE m.active = TRUE
      AND c.active = TRUE
      AND a.active = TRUE
      AND a.practice IS NOT TRUE
      AND COALESCE(a.archived, FALSE) = FALSE
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

    -- Strengths with highlights (denormalized)
    COALESCE(sa.strengths, ARRAY[]::types.mv_strength[]) AS strengths,

    -- Improvements with replacements (denormalized)
    COALESCE(ia.improvements, ARRAY[]::types.mv_improvement[]) AS improvements

FROM messages_with_position mwp
LEFT JOIN strengths_agg sa ON sa.message_id = mwp.message_id
LEFT JOIN improvements_agg ia ON ia.message_id = mwp.message_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_home_messages_pk
    ON mv_home_messages (message_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Chat ID for grouping
CREATE INDEX mv_home_messages_chat_id_idx
    ON mv_home_messages (chat_id);

-- Attempt ID for parallel lookup
CREATE INDEX mv_home_messages_attempt_id_idx
    ON mv_home_messages (attempt_id);

-- Composite: chat + position for ordering
CREATE INDEX mv_home_messages_chat_position_idx
    ON mv_home_messages (chat_id, message_position);

-- Composite: attempt + chat + position for full ordering
CREATE INDEX mv_home_messages_attempt_chat_position_idx
    ON mv_home_messages (attempt_id, chat_id, message_position);

-- Message type for filtering
CREATE INDEX mv_home_messages_type_idx
    ON mv_home_messages (type);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_home_messages;
