-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE videos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  length_seconds INTEGER NOT NULL CHECK (length_seconds > 0),
  upload_id  UUID        REFERENCES uploads(id) ON DELETE RESTRICT,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  objectives_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  image_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  outline_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  image_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT
);

CREATE INDEX ON videos (outline_agent_id);
CREATE INDEX ON videos (image_agent_id);
CREATE INDEX ON videos (upload_id);

-- Outlines table (standalone, can exist independently)
CREATE TABLE outlines (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name            TEXT        NOT NULL,
  outline         TEXT        NOT NULL
);

CREATE INDEX ON outlines (name);
CREATE INDEX ON outlines (created_at);

-- Video → Departments junction table (BCNF normalization)
-- No records = available to all departments (cross-department)
CREATE TABLE video_departments (
  video_id      UUID NOT NULL REFERENCES videos(id)     ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id)   ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, department_id)
);

CREATE INDEX ON video_departments (video_id);
CREATE INDEX ON video_departments (department_id);

-- Video hierarchy with no NULLs (self-edge denotes root)
CREATE TABLE video_tree (
  parent_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  child_id  UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, child_id)
);

CREATE INDEX ON video_tree (child_id);
CREATE INDEX ON video_tree (parent_id);

-- Enforce single parent per video (tree structure, not DAG)
CREATE UNIQUE INDEX video_tree_one_parent_per_child ON video_tree(child_id);

-- Simulation → Videos junction table with ordering
CREATE TABLE simulation_videos (
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  video_id      UUID NOT NULL REFERENCES videos(id)   ON DELETE CASCADE,
  position      INT  NOT NULL DEFAULT 1,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  show_problem_statement BOOLEAN NOT NULL DEFAULT TRUE,
  show_objectives BOOLEAN NOT NULL DEFAULT TRUE,
  show_image BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (simulation_id, video_id)
);

CREATE INDEX ON simulation_videos (simulation_id);
CREATE INDEX ON simulation_videos (video_id);

-- Enforce unique ordering within each simulation
CREATE UNIQUE INDEX simulation_videos_position_uniq
  ON simulation_videos(simulation_id, position);

-- Video → Outlines junction table (BCNF normalization)
CREATE TABLE video_outlines (
  video_id            UUID NOT NULL REFERENCES videos(id)            ON DELETE CASCADE,
  outline_id         UUID NOT NULL REFERENCES outlines(id)           ON DELETE CASCADE,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, outline_id)
);

CREATE INDEX ON video_outlines (video_id);
CREATE INDEX ON video_outlines (outline_id);
CREATE INDEX ON video_outlines (video_id, active);

-- Video → Documents junction table (BCNF normalization)
CREATE TABLE video_documents (
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, document_id)
);

CREATE INDEX ON video_documents (video_id);
CREATE INDEX ON video_documents (document_id);

-- Video → Images junction table (BCNF normalization)
-- Uses uploads directly instead of images table
CREATE TABLE video_images (
  video_id   UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  upload_id  UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, upload_id)
);

CREATE INDEX ON video_images (video_id);
CREATE INDEX ON video_images (upload_id);
CREATE INDEX ON video_images (video_id, active);

-- Video → Parameter Items junction table (BCNF normalization)
CREATE TABLE video_parameter_items (
  video_id         UUID NOT NULL REFERENCES videos(id)       ON DELETE CASCADE,
  parameter_item_id UUID NOT NULL REFERENCES parameter_items(id) ON DELETE CASCADE,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, parameter_item_id)
);

CREATE INDEX ON video_parameter_items (video_id);
CREATE INDEX ON video_parameter_items (parameter_item_id);

