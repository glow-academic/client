-- Indexes for materialized view: responses_mv
--

CREATE UNIQUE INDEX responses_mv_pk
    ON responses_mv (response_id);

CREATE INDEX responses_mv_chat_id_idx
    ON responses_mv (chat_id);

CREATE INDEX responses_mv_chat_id_created_at_idx
    ON responses_mv (chat_id, created_at);
