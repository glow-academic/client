-- Indexes for materialized view: mutes_mv
--

CREATE UNIQUE INDEX mutes_mv_pk ON mutes_mv (id);

CREATE INDEX mutes_mv_created_at_idx ON mutes_mv (created_at DESC);

CREATE INDEX mutes_mv_conversation_id_idx ON mutes_mv (conversation_id);
