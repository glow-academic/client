-- Indexes for materialized view: attempt_message_tree_mv
--

CREATE UNIQUE INDEX attempt_message_tree_mv_pk
    ON attempt_message_tree_mv (message_id);

CREATE INDEX attempt_message_tree_mv_depth_idx
    ON attempt_message_tree_mv (depth);
