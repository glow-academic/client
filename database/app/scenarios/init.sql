-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE parameters (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  numerical BOOLEAN     NOT NULL DEFAULT FALSE,
  active BOOLEAN     NOT NULL DEFAULT FALSE,
  default_parameter BOOLEAN     NOT NULL DEFAULT FALSE,
  department_id UUID        REFERENCES departments(id) ON DELETE CASCADE
);

CREATE TABLE parameter_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  value TEXT        NOT NULL,
  parameter_id UUID        NOT NULL REFERENCES parameters(id) ON DELETE CASCADE,
  default_item BOOLEAN     NOT NULL DEFAULT FALSE
);
  
CREATE TABLE scenarios (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  persona_id UUID         NULL REFERENCES personas(id)  ON DELETE SET NULL DEFAULT NULL,
  parameter_item_ids UUID[] NULL DEFAULT NULL,
  document_ids UUID[] NULL DEFAULT NULL, 
  default_scenario BOOLEAN     NOT NULL DEFAULT FALSE,
  practice_scenario BOOLEAN     NOT NULL DEFAULT FALSE,
  generated BOOLEAN     NOT NULL DEFAULT FALSE,
  parent_id UUID        NULL DEFAULT NULL,
  active BOOLEAN     NOT NULL DEFAULT TRUE,
  department_id UUID        REFERENCES departments(id) ON DELETE CASCADE
);