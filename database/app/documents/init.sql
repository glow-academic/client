-- UUIDv7 support is built into PostgreSQL 18+ (no extension needed)

-- ============================================================================
-- INSERT DOCUMENTS FOR TRAINING SCENARIOS
-- ============================================================================

CREATE TABLE documents (
    id         UUID        PRIMARY KEY DEFAULT uuidv7(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    name       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    classified BOOLEAN     NOT NULL           DEFAULT FALSE,
    active BOOLEAN     NOT NULL DEFAULT TRUE,
    template BOOLEAN     NOT NULL DEFAULT FALSE,
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

-- Document → Groups junction table (BCNF normalization)
CREATE TABLE document_groups (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, group_id)
);

CREATE INDEX ON document_groups (document_id);
CREATE INDEX ON document_groups (group_id);
CREATE UNIQUE INDEX document_groups_one_per_document ON document_groups(document_id);

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

-- Templates table (standalone, can exist independently)
-- Strong entity for document templates
CREATE TABLE templates (
  id         UUID        PRIMARY KEY DEFAULT uuidv7(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  upload_id  UUID        NOT NULL REFERENCES uploads(id) ON DELETE RESTRICT,
  args       JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX ON templates (name);
CREATE INDEX ON templates (created_at);
CREATE INDEX ON templates (upload_id);

-- Document → Templates junction table (BCNF normalization)
-- Links documents to templates with template-specific metadata
-- Used for template documents that have HTML templates with args and instructions
CREATE TABLE document_templates (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (document_id, template_id)
);

CREATE INDEX ON document_templates (document_id);
CREATE INDEX ON document_templates (template_id);
CREATE INDEX ON document_templates (document_id, active);

-- Document → Template Uploads junction table (BCNF normalization)
-- DEPRECATED: Use document_templates instead. Kept for migration compatibility.
-- Links documents to template uploads with template-specific metadata
-- Used for template documents that have HTML templates with args and instructions
CREATE TABLE document_template_uploads (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    args JSONB NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (document_id, upload_id)
);

CREATE INDEX ON document_template_uploads (document_id);
CREATE INDEX ON document_template_uploads (upload_id);
CREATE INDEX ON document_template_uploads (document_id, active);

-- Document hierarchy with no NULLs (self-edge denotes root)
CREATE TABLE document_tree (
  parent_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  child_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, child_id)
);

CREATE INDEX ON document_tree (child_id);
CREATE INDEX ON document_tree (parent_id);

-- Enforce single parent per document (tree structure, not DAG)
CREATE UNIQUE INDEX document_tree_one_parent_per_child ON document_tree(child_id);

-- Note: Document tags are now managed via simulation_tags → simulation_tag_documents
-- See simulations/init.sql for tag-related tables