-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- INSERT DOCUMENTS FOR TRAINING SCENARIOS
-- ============================================================================

CREATE TYPE document_type AS ENUM ('homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus');

CREATE TABLE documents (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    file_path  TEXT        NOT NULL,
    mime_type  TEXT        NOT NULL,
    type       document_type   NOT NULL           DEFAULT 'homework',
    classified BOOLEAN     NOT NULL           DEFAULT FALSE,
    active BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Document → Departments junction table (BCNF normalization)
-- No records = available to all departments (cross-department)
CREATE TABLE document_departments (
  document_id   UUID NOT NULL REFERENCES documents(id)    ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id)  ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, department_id)
);

CREATE INDEX ON document_departments (document_id);
CREATE INDEX ON document_departments (department_id);

-- Note: Document tags are now managed via simulation_tags → simulation_tag_documents
-- See simulations/init.sql for tag-related tables