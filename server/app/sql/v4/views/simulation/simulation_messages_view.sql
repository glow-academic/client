-- Materialized View: mv_simulation_messages
-- Message-level data for simulation attempt detail views.
--
-- Grain: One row per message
-- Filter: archived = FALSE only (practice is a column, not a filter)
--
-- Purpose: Provides message-level data with strengths/improvements for parallel fetching
-- Section: SIMULATION (unified view - both home and practice)
--
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 0: Drop and recreate composite types for message feedback
-- ============================================================================

-- Create types if they don't exist (shared with mv_home_messages)
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

DO $$
BEGIN
    CREATE TYPE types.mv_strength AS (
        id uuid,
        message_id uuid,
        name text,
        description text,
        highlights types.mv_highlight[]
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE types.mv_improvement AS (
        id uuid,
        message_id uuid,
        name text,
        description text,
        replacements types.mv_replacement[]
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE types.mv_hint AS (
        message_id uuid,
        hint text,
        idx int
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Drop and recreate mv_content type (raw data - business logic applied in Python)
DROP TYPE IF EXISTS types.mv_content CASCADE;
CREATE TYPE types.mv_content AS (
    id uuid,
    content text,
    persona_id uuid,        -- persona ID (NULL for user messages)
    persona_name text,      -- persona name (NULL for user messages)
    persona_color text,     -- persona color (NULL for user messages)
    persona_icon text,      -- persona icon (NULL for user messages)
    profile_name text,      -- actor name (populated for user messages)
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
-- Get profile name for user messages (via attempt -> profile connection)
profile_names AS (
    SELECT DISTINCT ON (c.id)
        c.id AS chat_id,
        pf.name AS profile_name
    FROM simulation_chats_entry c
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
    JOIN profiles_resource pf ON pf.id = apc.profiles_id AND pf.active = TRUE
    WHERE c.active = TRUE AND a.active = TRUE
),
-- Get persona info for assistant messages (via chat -> persona connection)
chat_personas AS (
    SELECT DISTINCT ON (cpc.chat_id)
        cpc.chat_id,
        pr.name AS persona_name,
        pr.color AS persona_color,
        pr.icon AS persona_icon
    FROM simulation_chats_personas_connection cpc
    JOIN personas_resource pr ON pr.id = cpc.personas_id AND pr.active = TRUE
),
-- Aggregate contents per message with raw data (business logic in Python)
contents_agg AS (
    SELECT
        sce.simulation_message_id AS message_id,
        ARRAY_AGG(
            (
                ce.id,
                ce.content,
                sce.persona_id,
                COALESCE(cp.persona_name, pr.name),
                COALESCE(cp.persona_color, pr.color),
                COALESCE(cp.persona_icon, pr.icon),
                pn.profile_name,
                ce.created_at
            )::types.mv_content
            ORDER BY ce.created_at
        ) AS contents
    FROM simulation_contents_entry sce
    JOIN contents_entry ce ON ce.id = sce.content_id
    JOIN simulation_messages_entry sm ON sm.id = sce.simulation_message_id
    JOIN messages_entry m ON m.id = sm.id
    LEFT JOIN profile_names pn ON pn.chat_id = sm.chat_id
    LEFT JOIN chat_personas cp ON cp.chat_id = sm.chat_id
    LEFT JOIN personas_resource pr ON pr.id = sce.persona_id AND pr.active = TRUE
    WHERE ce.active = TRUE
    GROUP BY sce.simulation_message_id
),
-- Compute message position within chat
messages_with_position AS (
    SELECT
        sm.id AS message_id,
        sm.chat_id,
        c.attempt_id,
        m.role,
        m.completed,
        m.created_at,
        COALESCE(a.practice, FALSE) AS practice,
        ROW_NUMBER() OVER (PARTITION BY sm.chat_id ORDER BY m.created_at) AS message_position
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
    mwp.message_id,

    -- Foreign keys for parallel lookup and grouping
    mwp.chat_id,
    mwp.attempt_id,

    -- Practice flag (exposed as column for filtering)
    mwp.practice,

    -- Message data (first content for backward compatibility)
    (ca.contents[1]).content AS content,
    CASE WHEN mwp.role = 'user'::message_type THEN 'query' ELSE 'response' END AS type,
    mwp.created_at,
    mwp.completed,
    mwp.message_position::int,

    -- Contents array with persona info
    COALESCE(ca.contents, ARRAY[]::types.mv_content[]) AS contents,

    -- Strengths with highlights (denormalized)
    COALESCE(sa.strengths, ARRAY[]::types.mv_strength[]) AS strengths,

    -- Improvements with replacements (denormalized)
    COALESCE(ia.improvements, ARRAY[]::types.mv_improvement[]) AS improvements,

    -- Hints (PRACTICE-specific, denormalized)
    COALESCE(ha.hints, ARRAY[]::types.mv_hint[]) AS hints

FROM messages_with_position mwp
LEFT JOIN contents_agg ca ON ca.message_id = mwp.message_id
LEFT JOIN strengths_agg sa ON sa.message_id = mwp.message_id
LEFT JOIN improvements_agg ia ON ia.message_id = mwp.message_id
LEFT JOIN hints_agg ha ON ha.message_id = mwp.message_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_messages_pk
    ON mv_simulation_messages (message_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Practice flag for filtering home vs practice
CREATE INDEX mv_simulation_messages_practice_idx
    ON mv_simulation_messages (practice);

-- Chat ID for grouping
CREATE INDEX mv_simulation_messages_chat_id_idx
    ON mv_simulation_messages (chat_id);

-- Attempt ID for parallel lookup
CREATE INDEX mv_simulation_messages_attempt_id_idx
    ON mv_simulation_messages (attempt_id);

-- Composite: chat + position for ordering
CREATE INDEX mv_simulation_messages_chat_position_idx
    ON mv_simulation_messages (chat_id, message_position);

-- Composite: attempt + chat + position for full ordering
CREATE INDEX mv_simulation_messages_attempt_chat_position_idx
    ON mv_simulation_messages (attempt_id, chat_id, message_position);

-- Message type for filtering
CREATE INDEX mv_simulation_messages_type_idx
    ON mv_simulation_messages (type);

-- Composite: practice + attempt (common filter pattern)
CREATE INDEX mv_simulation_messages_practice_attempt_idx
    ON mv_simulation_messages (practice, attempt_id);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_messages;
