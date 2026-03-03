-- Indexes for materialized view: messages_completions_mv
--

CREATE UNIQUE INDEX messages_completions_mv_pk ON messages_completions_mv (id);

CREATE INDEX messages_completions_mv_created_at_idx ON messages_completions_mv (created_at DESC);

CREATE INDEX messages_completions_mv_message_id_idx ON messages_completions_mv (message_id);
