-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE evals (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  rubric_id   UUID        NOT NULL REFERENCES rubrics(id)  ON DELETE CASCADE,
  agent_id   UUID        NOT NULL REFERENCES agents(id)  ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL
);

CREATE INDEX ON evals (rubric_id);
CREATE INDEX ON evals (agent_id);

-- Junction table linking evals to runs
-- Tracks which evals are assigned to which runs
CREATE TABLE eval_runs (
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  eval_id      UUID NOT NULL REFERENCES evals(id)     ON DELETE CASCADE,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, eval_id)
);

CREATE INDEX ON eval_runs (run_id);
CREATE INDEX ON eval_runs (eval_id);

-- Note: eval_grades and eval_feedbacks are now unified into grades and feedbacks tables
-- See database/app/simulations/init.sql for unified tables

