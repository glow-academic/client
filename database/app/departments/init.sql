-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE departments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  title      TEXT        NOT NULL,
  description TEXT        NOT NULL,
  active BOOLEAN     NOT NULL DEFAULT TRUE,
  title_agent_id UUID        NOT NULL,
  scenario_agent_id UUID        NOT NULL,
  classify_agent_id UUID        NOT NULL,
  assistant_agent_id UUID        NOT NULL,
  grade_agent_id UUID        NOT NULL,
  guardrail_agent_id UUID        NOT NULL
);