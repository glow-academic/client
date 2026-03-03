-- Materialized View: attempt_highlight_mv
-- Grain: One row per highlight entry per strength
--
-- Filter: active = TRUE with parent chain filters
-- Purpose: Flat denormalized highlights for parallel fetching
-- Dependencies: Only uses _entry tables

CREATE MATERIALIZED VIEW attempt_highlight_mv AS
SELECT
    h.id AS highlight_id,
    h.strength_id,
    h.section,
    h.idx,
    h.created_at
FROM attempt_highlight_entry h
JOIN attempt_strength_entry s ON s.id = h.strength_id
JOIN attempt_message_entry sm ON sm.id = s.message_id
JOIN messages_entry m ON m.id = sm.id
JOIN attempt_chat_entry c ON c.id = sm.chat_id
JOIN attempt_chat_bridge_entry ac ON ac.attempt_chat_id = c.id
JOIN attempt_entry a ON a.id = ac.attempt_id
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE h.active = TRUE
  AND s.active = TRUE
  AND m.active = TRUE
  AND c.active = TRUE
  AND a.active = TRUE
  AND COALESCE(sa_archive.archived, FALSE) = FALSE
WITH NO DATA;
