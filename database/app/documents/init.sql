-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- INSERT DOCUMENTS FOR TRAINING SCENARIOS
-- ============================================================================

CREATE TABLE documents (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    classified BOOLEAN     NOT NULL           DEFAULT FALSE,
    active BOOLEAN     NOT NULL DEFAULT TRUE,
    classify_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    document_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT
);

CREATE INDEX ON documents (classify_agent_id);
CREATE INDEX ON documents (document_agent_id);

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

-- Document → Uploads junction table (BCNF normalization)
-- Allows version history of document uploads
CREATE TABLE document_uploads (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (document_id, upload_id)
);

CREATE INDEX ON document_uploads (document_id);
CREATE INDEX ON document_uploads (upload_id);
CREATE INDEX ON document_uploads (document_id, active);

-- Document → Template Uploads junction table (BCNF normalization)
-- Links documents to template uploads with template-specific metadata
-- Used for template documents that have HTML templates with args and instructions
CREATE TABLE document_template_uploads (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    args JSONB NOT NULL DEFAULT '{}',
    instructions TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (document_id, upload_id)
);

CREATE INDEX ON document_template_uploads (document_id);
CREATE INDEX ON document_template_uploads (upload_id);
CREATE INDEX ON document_template_uploads (document_id, active);

-- Note: Document tags are now managed via simulation_tags → simulation_tag_documents
-- See simulations/init.sql for tag-related tables