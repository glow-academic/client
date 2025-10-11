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
    file_id    TEXT        NULL,
    active BOOLEAN     NOT NULL DEFAULT TRUE,
    department_id UUID        NOT NULL REFERENCES departments(id) ON DELETE CASCADE
);

-- Note: Document tags are now managed via simulation_tags → simulation_tag_documents
-- See simulations/init.sql for tag-related tables