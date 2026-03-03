-- Materialized View: attempt_message_mv
-- Message-level data for attempt detail views.
--
-- Grain: One row per message
-- Filter: archived = FALSE only
-- Note: Practice filtering done at attempt level, position derived in service layer
--
-- Purpose: Provides lean message-level data for parallel fetching
-- Section: ATTEMPT (unified view - both home and practice)
--
-- Dependencies: Only uses _entry and _connection tables (+ uploads_entry for file paths)

CREATE MATERIALIZED VIEW attempt_message_mv AS
WITH
-- Audio entry ID per message (via uploads)
audio_agg AS (
    SELECT mue.message_id, ae.id AS audio_id
    FROM audios_entry ae
    JOIN audio_uploads_entry aue ON aue.audio_id = ae.id AND aue.active = true
    JOIN message_uploads_entry mue ON mue.upload_id = aue.upload_id AND mue.active = true
    WHERE ae.active = true
),
-- Get runs_id (resource) for each run_id (entry)
runs_resource_agg AS (
    SELECT
        rrc.run_id,
        rrc.runs_id
    FROM runs_runs_connection rrc
    WHERE rrc.active = TRUE
),
-- Base message data (position derived in service layer, practice on attempt level)
base_messages AS (
    SELECT
        sm.id AS message_id,
        sm.chat_id,
        ac.attempt_id,
        m.role,
        (mc.message_id IS NOT NULL) AS completed,
        m.created_at,
        -- Run resource ID (one hop to hydrate)
        rra.runs_id,
        -- Text entry ID (for resource hydration, reverse-lookup via shared upload)
        tue.text_id,
        -- History file path (for LLM context — read from disk)
        ue.file_path AS history_file_path,
        -- Audio resource ID
        aa.audio_id
    FROM attempt_message_entry sm
    JOIN messages_entry m ON m.id = sm.id
    JOIN attempt_chat_entry c ON c.id = sm.chat_id
    JOIN attempt_chat_bridge_entry ac ON ac.attempt_chat_id = c.id
    JOIN attempt_entry a ON a.id = ac.attempt_id
    LEFT JOIN runs_resource_agg rra ON rra.run_id = m.run_id
    LEFT JOIN message_uploads_entry mue ON mue.message_id = m.id AND mue.active = true
    LEFT JOIN uploads_entry ue ON ue.id = mue.upload_id
    LEFT JOIN text_uploads_entry tue ON tue.upload_id = mue.upload_id AND tue.active = true
    LEFT JOIN audio_agg aa ON aa.message_id = sm.id
    -- Latest message completion state (append-only)
    LEFT JOIN LATERAL (
        SELECT message_id FROM messages_completions_entry
        WHERE message_id = m.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
    ) mc ON true
    -- Latest archive state (append-only)
    LEFT JOIN LATERAL (
        SELECT archived FROM attempt_archive_entry
        WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
    ) sa_archive ON true
    WHERE m.active = TRUE
      AND c.active = TRUE
      AND a.active = TRUE
      AND COALESCE(sa_archive.archived, FALSE) = FALSE
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

    -- Run resource ID (one hop to hydrate)
    bm.runs_id,

    -- Text entry ID (for resource hydration)
    bm.text_id,

    -- History file path (for LLM context — read from disk)
    bm.history_file_path,

    -- Audio resource ID
    bm.audio_id

FROM base_messages bm
WITH NO DATA;
