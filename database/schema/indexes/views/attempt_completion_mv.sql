-- Indexes for materialized view: attempt_completion_mv
--

CREATE UNIQUE INDEX attempt_completion_mv_pk ON attempt_completion_mv (id);

CREATE INDEX attempt_completion_mv_created_at_idx ON attempt_completion_mv (created_at DESC);

CREATE INDEX attempt_completion_mv_chat_id_idx ON attempt_completion_mv (chat_id);
