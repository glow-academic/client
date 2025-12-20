-- UUIDv7 support is built into PostgreSQL 18+ (no extension needed)

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE videos (
  id         UUID        PRIMARY KEY DEFAULT uuidv7(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  length_seconds INTEGER NOT NULL CHECK (length_seconds > 0),
  completed  BOOLEAN     NOT NULL DEFAULT FALSE,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  image_enabled BOOLEAN NOT NULL DEFAULT TRUE
);


-- Generations table (standalone, can exist independently)
-- Strong entity for video file generations
CREATE TABLE generations (
  id         UUID        PRIMARY KEY DEFAULT uuidv7(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  file_path  TEXT        NOT NULL,
  mime_type  TEXT        NOT NULL,
  upload_id  UUID        NOT NULL REFERENCES uploads(id) ON DELETE RESTRICT,
  active     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX ON generations (file_path);
CREATE INDEX ON generations (created_at);
CREATE INDEX ON generations (active);
CREATE INDEX ON generations (upload_id);

-- Video → Images junction table (BCNF normalization)
-- Links videos to images (strong entity)
CREATE TABLE video_images (
  video_id   UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  image_id   UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, image_id)
);

CREATE INDEX ON video_images (video_id);
CREATE INDEX ON video_images (image_id);
CREATE INDEX ON video_images (video_id, active);

-- Video → Generations junction table (BCNF normalization)
-- Links videos to video file generations
CREATE TABLE video_generations (
  video_id      UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, generation_id)
);

CREATE INDEX ON video_generations (video_id);
CREATE INDEX ON video_generations (generation_id);
CREATE INDEX ON video_generations (video_id, active);

CREATE UNIQUE INDEX video_generations_one_active_per_video 
  ON video_generations(video_id) 
  WHERE active = TRUE;


-- Video → Uploads junction table (BCNF normalization)
-- Allows version history of video uploads
CREATE TABLE video_uploads (
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (video_id, upload_id)
);

CREATE INDEX ON video_uploads (video_id);
CREATE INDEX ON video_uploads (upload_id);
CREATE INDEX ON video_uploads (video_id, active);

