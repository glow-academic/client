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
  eval_agent_id UUID     NOT NULL REFERENCES agents(id)  ON DELETE RESTRICT,
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  dynamic    BOOLEAN     NOT NULL           DEFAULT FALSE
);

CREATE INDEX ON evals (rubric_id);
CREATE INDEX ON evals (agent_id);
CREATE INDEX ON evals (eval_agent_id);

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

-- Eval → Departments junction table (BCNF normalization)
-- No records = available to all departments (cross-department)
CREATE TABLE eval_departments (
  eval_id       UUID NOT NULL REFERENCES evals(id)       ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id)  ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (eval_id, department_id)
);

CREATE INDEX ON eval_departments (eval_id);
CREATE INDEX ON eval_departments (department_id);

-- Note: eval_grades and eval_feedbacks are now unified into grades and feedbacks tables
-- See database/app/simulations/init.sql for unified tables

-- ============================================================================
-- Eval Attempts and Tests Tables
-- ============================================================================

CREATE TABLE eval_attempts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  eval_id    UUID        NOT NULL REFERENCES evals(id) ON DELETE CASCADE,
  archived   BOOLEAN    NOT NULL DEFAULT FALSE
);

CREATE INDEX ON eval_attempts (eval_id);
CREATE INDEX ON eval_attempts (archived);

CREATE TABLE tests (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  title      TEXT         NOT NULL,
  run_id     UUID         NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  completed  BOOLEAN      NOT NULL DEFAULT FALSE,
  trace_id   TEXT         NOT NULL
);

CREATE INDEX ON tests (run_id);

-- Attempt Tests Junction Table
CREATE TABLE attempt_tests (
  attempt_id UUID NOT NULL REFERENCES eval_attempts(id) ON DELETE CASCADE,
  test_id    UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, test_id)
);

CREATE INDEX ON attempt_tests (attempt_id);
CREATE INDEX ON attempt_tests (test_id);
CREATE INDEX ON attempt_tests (attempt_id, test_id);

-- Test Runs Junction Table (links eval agent runs to tests)
CREATE TABLE test_runs (
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, test_id)
);

CREATE INDEX ON test_runs (run_id);
CREATE INDEX ON test_runs (test_id);

