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
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL
);

CREATE INDEX ON evals (rubric_id);

-- Junction table linking evals to model_runs
-- Tracks which evals are assigned to which model runs
CREATE TABLE eval_model_runs (
  model_run_id UUID NOT NULL REFERENCES model_runs(id) ON DELETE CASCADE,
  eval_id      UUID NOT NULL REFERENCES evals(id)     ON DELETE CASCADE,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_run_id, eval_id)
);

CREATE INDEX ON eval_model_runs (model_run_id);
CREATE INDEX ON eval_model_runs (eval_id);

-- Grades table for eval results on model runs
-- Similar structure to simulation_chat_grades but for model_run + eval
CREATE TABLE eval_grades (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  description TEXT        NOT NULL DEFAULT 'No description provided',
  passed     BOOLEAN     NOT NULL,
  score      INTEGER     NOT NULL,
  time_taken INTEGER     NOT NULL, -- in seconds
  model_run_id UUID      NOT NULL REFERENCES model_runs(id)  ON DELETE CASCADE,
  eval_id     UUID       NOT NULL REFERENCES evals(id)  ON DELETE CASCADE
);

CREATE INDEX ON eval_grades (model_run_id);
CREATE INDEX ON eval_grades (eval_id);
CREATE INDEX ON eval_grades (model_run_id, eval_id, created_at DESC);

-- Feedbacks table for eval grades
-- Similar structure to simulation_chat_feedbacks
CREATE TABLE eval_feedbacks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  standard_id   UUID        NOT NULL REFERENCES standards(id)  ON DELETE CASCADE,
  eval_grade_id   UUID        NOT NULL REFERENCES eval_grades(id)  ON DELETE CASCADE,
  total INTEGER     NOT NULL,
  feedback TEXT NOT NULL DEFAULT 'No feedback provided'  -- NOT NULL with meaningful default
);

CREATE INDEX ON eval_feedbacks (eval_grade_id);
CREATE INDEX ON eval_feedbacks (standard_id);

