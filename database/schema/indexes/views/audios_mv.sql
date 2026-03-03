-- Indexes for materialized view: audios_mv
--

CREATE UNIQUE INDEX audios_mv_pk
    ON audios_mv (audio_id);

CREATE INDEX audios_mv_uploads_id_idx
    ON audios_mv (uploads_id);

CREATE INDEX audios_mv_created_at_idx
    ON audios_mv (created_at DESC);
