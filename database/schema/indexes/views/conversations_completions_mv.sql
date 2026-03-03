-- Indexes for materialized view: conversations_completions_mv
--

CREATE UNIQUE INDEX conversations_completions_mv_pk ON conversations_completions_mv (id);

CREATE INDEX conversations_completions_mv_created_at_idx ON conversations_completions_mv (created_at DESC);

CREATE INDEX conversations_completions_mv_conversation_id_idx ON conversations_completions_mv (conversation_id);
