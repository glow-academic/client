-- Indexes for materialized view: attempt_message_mv
--

CREATE UNIQUE INDEX attempt_message_mv_pk
    ON attempt_message_mv (message_id);

CREATE INDEX attempt_message_mv_chat_id_idx
    ON attempt_message_mv (chat_id);

CREATE INDEX attempt_message_mv_attempt_id_idx
    ON attempt_message_mv (attempt_id);

CREATE INDEX attempt_message_mv_attempt_chat_idx
    ON attempt_message_mv (attempt_id, chat_id);

CREATE INDEX attempt_message_mv_type_idx
    ON attempt_message_mv (type);

CREATE INDEX attempt_message_mv_created_at_idx
    ON attempt_message_mv (created_at);

CREATE INDEX attempt_message_mv_runs_id_idx
    ON attempt_message_mv (runs_id)
    WHERE runs_id IS NOT NULL;
