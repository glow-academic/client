-- Indexes for materialized view: attempt_content_mv
--

CREATE UNIQUE INDEX attempt_content_mv_pk
    ON attempt_content_mv (content_id);

CREATE INDEX attempt_content_mv_message_id_idx
    ON attempt_content_mv (message_id);

CREATE INDEX attempt_content_mv_message_created_idx
    ON attempt_content_mv (message_id, created_at);
