-- Migration 0037: Create binary relationship tables and rename ternary tables
-- Rename existing ternary tables: agent_departments → agent_department_prompts, persona_departments → persona_department_prompts
-- Create new binary tables: agent_departments and persona_departments (no prompt_id)

-- ============================================================================
-- RENAME EXISTING TERNARY TABLES
-- ============================================================================

-- Rename agent_departments to agent_department_prompts (ternary: agent, department, prompt)
ALTER TABLE agent_departments RENAME TO agent_department_prompts;

-- Rename persona_departments to persona_department_prompts (ternary: persona, department, prompt)
ALTER TABLE persona_departments RENAME TO persona_department_prompts;

-- ============================================================================
-- UPDATE INDEXES AND CONSTRAINTS FOR RENAMED TABLES
-- ============================================================================

-- Drop old indexes on agent_department_prompts
DROP INDEX IF EXISTS agent_departments_agent_id_idx;
DROP INDEX IF EXISTS agent_departments_department_id_idx;
DROP INDEX IF EXISTS agent_departments_prompt_id_idx;
DROP INDEX IF EXISTS agent_departments_one_active_per_agent_prompt_dept;

-- Create new indexes for agent_department_prompts
CREATE INDEX agent_department_prompts_agent_id_idx ON agent_department_prompts (agent_id);
CREATE INDEX agent_department_prompts_department_id_idx ON agent_department_prompts (department_id);
CREATE INDEX agent_department_prompts_prompt_id_idx ON agent_department_prompts (prompt_id);

-- Only one active per (agent_id, prompt_id, department_id)
CREATE UNIQUE INDEX agent_department_prompts_one_active_per_agent_prompt_dept
  ON agent_department_prompts(agent_id, prompt_id, department_id) WHERE active = true;

-- Drop old indexes on persona_department_prompts
DROP INDEX IF EXISTS persona_departments_persona_id_idx;
DROP INDEX IF EXISTS persona_departments_department_id_idx;
DROP INDEX IF EXISTS persona_departments_prompt_id_idx;
DROP INDEX IF EXISTS persona_departments_one_active_per_persona_prompt_dept;

-- Create new indexes for persona_department_prompts
CREATE INDEX persona_department_prompts_persona_id_idx ON persona_department_prompts (persona_id);
CREATE INDEX persona_department_prompts_department_id_idx ON persona_department_prompts (department_id);
CREATE INDEX persona_department_prompts_prompt_id_idx ON persona_department_prompts (prompt_id);

-- Only one active per (persona_id, prompt_id, department_id)
CREATE UNIQUE INDEX persona_department_prompts_one_active_per_persona_prompt_dept
  ON persona_department_prompts(persona_id, prompt_id, department_id) WHERE active = true;

-- ============================================================================
-- UPDATE FOREIGN KEY CONSTRAINT NAMES
-- ============================================================================

-- Drop old foreign key constraints and recreate with new names
ALTER TABLE agent_department_prompts 
  DROP CONSTRAINT IF EXISTS agent_departments_agent_id_fkey,
  DROP CONSTRAINT IF EXISTS agent_departments_department_id_fkey,
  DROP CONSTRAINT IF EXISTS agent_departments_prompt_id_fkey;

ALTER TABLE agent_department_prompts
  ADD CONSTRAINT agent_department_prompts_agent_id_fkey 
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  ADD CONSTRAINT agent_department_prompts_department_id_fkey 
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  ADD CONSTRAINT agent_department_prompts_prompt_id_fkey 
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE RESTRICT;

ALTER TABLE persona_department_prompts
  DROP CONSTRAINT IF EXISTS persona_departments_persona_id_fkey,
  DROP CONSTRAINT IF EXISTS persona_departments_department_id_fkey,
  DROP CONSTRAINT IF EXISTS persona_departments_prompt_id_fkey;

ALTER TABLE persona_department_prompts
  ADD CONSTRAINT persona_department_prompts_persona_id_fkey 
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
  ADD CONSTRAINT persona_department_prompts_department_id_fkey 
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  ADD CONSTRAINT persona_department_prompts_prompt_id_fkey 
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE RESTRICT;

-- ============================================================================
-- UPDATE PRIMARY KEY CONSTRAINT NAMES
-- ============================================================================

ALTER TABLE agent_department_prompts
  DROP CONSTRAINT IF EXISTS agent_departments_pkey;

ALTER TABLE agent_department_prompts
  ADD CONSTRAINT agent_department_prompts_pkey 
    PRIMARY KEY (agent_id, department_id, prompt_id);

ALTER TABLE persona_department_prompts
  DROP CONSTRAINT IF EXISTS persona_departments_pkey;

ALTER TABLE persona_department_prompts
  ADD CONSTRAINT persona_department_prompts_pkey 
    PRIMARY KEY (persona_id, department_id, prompt_id);

-- ============================================================================
-- CREATE NEW BINARY RELATIONSHIP TABLES
-- ============================================================================

-- Agent → Departments binary relationship table
-- Tracks which agents are available to departments (no prompt_id)
CREATE TABLE agent_departments (
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, department_id)
);

CREATE INDEX agent_departments_agent_id_idx ON agent_departments (agent_id);
CREATE INDEX agent_departments_department_id_idx ON agent_departments (department_id);
CREATE INDEX agent_departments_active_idx ON agent_departments (active);

-- Persona → Departments binary relationship table
-- Tracks which personas are available to departments (no prompt_id)
CREATE TABLE persona_departments (
  persona_id    UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, department_id)
);

CREATE INDEX persona_departments_persona_id_idx ON persona_departments (persona_id);
CREATE INDEX persona_departments_department_id_idx ON persona_departments (department_id);
CREATE INDEX persona_departments_active_idx ON persona_departments (active);

-- ============================================================================
-- MIGRATE DATA TO NEW BINARY TABLES
-- ============================================================================

-- Extract unique (agent_id, department_id) pairs from agent_department_prompts
-- Use BOOL_OR to preserve active status if multiple prompts exist (true if any is true)
INSERT INTO agent_departments (agent_id, department_id, active, created_at, updated_at)
SELECT 
  agent_id,
  department_id,
  BOOL_OR(active) AS active,
  MIN(created_at) AS created_at,
  MAX(updated_at) AS updated_at
FROM agent_department_prompts
GROUP BY agent_id, department_id
ON CONFLICT (agent_id, department_id) DO NOTHING;

-- Extract unique (persona_id, department_id) pairs from persona_department_prompts
-- Use BOOL_OR to preserve active status if multiple prompts exist (true if any is true)
INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
SELECT 
  persona_id,
  department_id,
  BOOL_OR(active) AS active,
  MIN(created_at) AS created_at,
  MAX(updated_at) AS updated_at
FROM persona_department_prompts
GROUP BY persona_id, department_id
ON CONFLICT (persona_id, department_id) DO NOTHING;
