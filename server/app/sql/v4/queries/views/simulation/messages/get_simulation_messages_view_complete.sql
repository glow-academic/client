-- ============================================================================
-- Query: get_simulation_messages_view
-- Purpose: Fetch message-level data from mv_simulation_messages
-- Section: VIEWS/SIMULATION/MESSAGES
-- Note: Messages are fully denormalized - no resource JOINs needed
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing function
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_simulation_messages_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_messages_view_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop existing composite types
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_simulation_messages_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Highlight type (nested under strength)
CREATE TYPE types.q_get_simulation_messages_view_v4_highlight AS (
    section text,
    idx int
);

-- Replacement type (nested under improvement)
CREATE TYPE types.q_get_simulation_messages_view_v4_replacement AS (
    section text,
    replace_text text,
    idx int
);

-- Strength type
CREATE TYPE types.q_get_simulation_messages_view_v4_strength AS (
    id uuid,
    message_id uuid,
    name text,
    description text,
    highlights types.q_get_simulation_messages_view_v4_highlight[]
);

-- Improvement type
CREATE TYPE types.q_get_simulation_messages_view_v4_improvement AS (
    id uuid,
    message_id uuid,
    name text,
    description text,
    replacements types.q_get_simulation_messages_view_v4_replacement[]
);

-- Hint type (practice-specific)
CREATE TYPE types.q_get_simulation_messages_view_v4_hint AS (
    message_id uuid,
    hint text,
    idx int
);

-- Content type (with persona info)
CREATE TYPE types.q_get_simulation_messages_view_v4_content AS (
    id uuid,
    content text,
    persona_id uuid,
    persona_name text,
    persona_color text,
    persona_icon text,
    created_at timestamptz
);

-- Main message item type
CREATE TYPE types.q_get_simulation_messages_view_v4_item AS (
    -- Primary key
    message_id uuid,

    -- Foreign keys
    chat_id uuid,
    attempt_id uuid,

    -- Practice flag
    practice boolean,

    -- Message data
    content text,
    type text,
    created_at timestamptz,
    completed boolean,
    message_position int,

    -- Contents array with persona info
    contents types.q_get_simulation_messages_view_v4_content[],

    -- Strengths and improvements
    strengths types.q_get_simulation_messages_view_v4_strength[],
    improvements types.q_get_simulation_messages_view_v4_improvement[],

    -- Hints (practice-specific)
    hints types.q_get_simulation_messages_view_v4_hint[]
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_simulation_messages_view_v4(
    attempt_id_filter uuid DEFAULT NULL,
    chat_id_filter uuid DEFAULT NULL,
    message_ids uuid[] DEFAULT NULL,
    practice_filter boolean DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_simulation_messages_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Parameter normalization
    params AS (
        SELECT
            attempt_id_filter AS attempt_id_filter,
            chat_id_filter AS chat_id_filter,
            COALESCE(message_ids, ARRAY[]::uuid[]) AS message_ids,
            practice_filter AS practice_filter
    ),
    -- Fetch from MV with filters
    mv_data AS (
        SELECT mv.*
        FROM mv_simulation_messages mv, params p
        WHERE (p.attempt_id_filter IS NULL OR mv.attempt_id = p.attempt_id_filter)
          AND (p.chat_id_filter IS NULL OR mv.chat_id = p.chat_id_filter)
          AND (CARDINALITY(p.message_ids) = 0 OR mv.message_id = ANY(p.message_ids))
          AND (p.practice_filter IS NULL OR mv.practice = p.practice_filter)
    ),
    -- Transform contents (MV types.mv_content -> query types)
    contents_transformed AS (
        SELECT
            mv.message_id,
            COALESCE(
                ARRAY_AGG(
                    (
                        (c).id,
                        (c).content,
                        (c).persona_id,
                        (c).persona_name,
                        (c).persona_color,
                        (c).persona_icon,
                        (c).created_at
                    )::types.q_get_simulation_messages_view_v4_content
                    ORDER BY (c).created_at
                ) FILTER (WHERE (c).id IS NOT NULL),
                ARRAY[]::types.q_get_simulation_messages_view_v4_content[]
            ) AS contents
        FROM mv_data mv
        LEFT JOIN LATERAL unnest(mv.contents) AS c ON true
        GROUP BY mv.message_id
    ),
    -- Transform strengths (MV types.mv_strength -> query types)
    strengths_transformed AS (
        SELECT
            mv.message_id,
            COALESCE(
                ARRAY_AGG(
                    (
                        (s).id,
                        (s).message_id,
                        (s).name,
                        (s).description,
                        -- Transform highlights
                        (
                            SELECT COALESCE(
                                ARRAY_AGG(
                                    ((h).section, (h).idx)::types.q_get_simulation_messages_view_v4_highlight
                                    ORDER BY (h).idx
                                ),
                                ARRAY[]::types.q_get_simulation_messages_view_v4_highlight[]
                            )
                            FROM unnest((s).highlights) AS h
                        )
                    )::types.q_get_simulation_messages_view_v4_strength
                    ORDER BY (s).id
                ) FILTER (WHERE (s).id IS NOT NULL),
                ARRAY[]::types.q_get_simulation_messages_view_v4_strength[]
            ) AS strengths
        FROM mv_data mv
        LEFT JOIN LATERAL unnest(mv.strengths) AS s ON true
        GROUP BY mv.message_id
    ),
    -- Transform improvements (MV types.mv_improvement -> query types)
    improvements_transformed AS (
        SELECT
            mv.message_id,
            COALESCE(
                ARRAY_AGG(
                    (
                        (i).id,
                        (i).message_id,
                        (i).name,
                        (i).description,
                        -- Transform replacements
                        (
                            SELECT COALESCE(
                                ARRAY_AGG(
                                    ((r).section, (r).replace_text, (r).idx)::types.q_get_simulation_messages_view_v4_replacement
                                    ORDER BY (r).idx
                                ),
                                ARRAY[]::types.q_get_simulation_messages_view_v4_replacement[]
                            )
                            FROM unnest((i).replacements) AS r
                        )
                    )::types.q_get_simulation_messages_view_v4_improvement
                    ORDER BY (i).id
                ) FILTER (WHERE (i).id IS NOT NULL),
                ARRAY[]::types.q_get_simulation_messages_view_v4_improvement[]
            ) AS improvements
        FROM mv_data mv
        LEFT JOIN LATERAL unnest(mv.improvements) AS i ON true
        GROUP BY mv.message_id
    ),
    -- Transform hints (MV types.mv_hint -> query types) - practice-specific
    hints_transformed AS (
        SELECT
            mv.message_id,
            COALESCE(
                ARRAY_AGG(
                    ((h).message_id, (h).hint, (h).idx)::types.q_get_simulation_messages_view_v4_hint
                    ORDER BY (h).idx
                ) FILTER (WHERE (h).hint IS NOT NULL),
                ARRAY[]::types.q_get_simulation_messages_view_v4_hint[]
            ) AS hints
        FROM mv_data mv
        LEFT JOIN LATERAL unnest(mv.hints) AS h ON true
        GROUP BY mv.message_id
    ),
    -- Combine data
    with_nested AS (
        SELECT
            mv.message_id,
            mv.chat_id,
            mv.attempt_id,
            mv.practice,
            mv.content,
            mv.type,
            mv.created_at,
            mv.completed,
            mv.message_position,
            ct.contents,
            st.strengths,
            it.improvements,
            ht.hints
        FROM mv_data mv
        LEFT JOIN contents_transformed ct ON ct.message_id = mv.message_id
        LEFT JOIN strengths_transformed st ON st.message_id = mv.message_id
        LEFT JOIN improvements_transformed it ON it.message_id = mv.message_id
        LEFT JOIN hints_transformed ht ON ht.message_id = mv.message_id
    ),
    -- Aggregate into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    message_id,
                    chat_id,
                    attempt_id,
                    practice,
                    content,
                    type,
                    created_at,
                    completed,
                    message_position,
                    contents,
                    strengths,
                    improvements,
                    hints
                )::types.q_get_simulation_messages_view_v4_item
                ORDER BY chat_id, message_position
            ),
            ARRAY[]::types.q_get_simulation_messages_view_v4_item[]
        ) AS items
        FROM with_nested
    )
    SELECT items FROM items_agg;
$$;
