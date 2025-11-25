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
  file_path  TEXT        NOT NULL,
  mime_type  TEXT        NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE
);

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
  objectives_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  show_scenario BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (simulation_id, video_id)
);

CREATE INDEX ON simulation_videos (simulation_id);
CREATE INDEX ON simulation_videos (video_id);

-- Enforce unique ordering within each simulation
CREATE UNIQUE INDEX simulation_videos_position_uniq
  ON simulation_videos(simulation_id, position);

-- Video → Problem Statements junction table (BCNF normalization)
CREATE TABLE video_problem_statements (
  video_id            UUID NOT NULL REFERENCES videos(id)            ON DELETE CASCADE,
  problem_statement_id UUID NOT NULL REFERENCES problem_statements(id) ON DELETE CASCADE,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, problem_statement_id)
);

CREATE INDEX ON video_problem_statements (video_id);
CREATE INDEX ON video_problem_statements (problem_statement_id);
CREATE INDEX ON video_problem_statements (video_id, active);

-- Video → Objectives junction table (BCNF normalization)
CREATE TABLE video_objectives (
  video_id    UUID NOT NULL REFERENCES videos(id)     ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  idx         INT  NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (video_id, objective_id)
);

CREATE INDEX ON video_objectives (video_id);
CREATE INDEX ON video_objectives (objective_id);

-- Video → Policies junction table (BCNF normalization)
CREATE TABLE video_policies (
  video_id   UUID NOT NULL REFERENCES videos(id)   ON DELETE CASCADE,
  policy_id  UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, policy_id)
);

CREATE INDEX ON video_policies (video_id);
CREATE INDEX ON video_policies (policy_id);

-- Video → Images junction table (BCNF normalization)
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

