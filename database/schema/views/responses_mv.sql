-- Materialized View: responses_mv
-- Grain: One row per response entry per chat
--
-- Purpose: Flat denormalized response rows for simulation chats,
-- replacing the responses_agg composite array in attempt_chat_mv.
--
-- Dependencies: responses_entry, responses_questions_connection,
--               responses_options_connection

CREATE MATERIALIZED VIEW responses_mv AS
SELECT DISTINCT ON (r.id)
    r.id AS response_id,
    r.chat_id,
    rqc.question_id,
    roc.option_id,
    r.created_at
FROM responses_entry r
LEFT JOIN responses_questions_connection rqc ON rqc.responses_id = r.id AND rqc.active = TRUE
LEFT JOIN responses_options_connection roc ON roc.responses_id = r.id AND roc.active = TRUE
WHERE r.active = TRUE
ORDER BY r.id, r.created_at DESC
WITH NO DATA;
