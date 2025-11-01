-- Migration 0036: Add agent_prompts and persona_prompts junction tables
-- Remove prompt_id from agents and personas tables, replacing with junction tables
-- with constraint ensuring only one active prompt per agent/persona

-- ============================================================================
-- CREATE JUNCTION TABLES
-- ============================================================================

-- Agent → Prompts junction table (default prompts)
CREATE TABLE IF NOT EXISTS agent_prompts (
  agent_id    UUID NOT NULL REFERENCES agents(id)     ON DELETE CASCADE,
  prompt_id  UUID NOT NULL REFERENCES prompts(id)      ON DELETE RESTRICT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, prompt_id)
);

CREATE INDEX ON agent_prompts (agent_id);
CREATE INDEX ON agent_prompts (prompt_id);
CREATE INDEX ON agent_prompts (agent_id, active);

-- Only one active prompt per agent
CREATE UNIQUE INDEX agent_prompts_one_active_per_agent
  ON agent_prompts(agent_id) WHERE active = true;

-- Persona → Prompts junction table (default prompts)
CREATE TABLE IF NOT EXISTS persona_prompts (
  persona_id UUID NOT NULL REFERENCES personas(id)     ON DELETE CASCADE,
  prompt_id  UUID NOT NULL REFERENCES prompts(id)      ON DELETE RESTRICT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, prompt_id)
);

CREATE INDEX ON persona_prompts (persona_id);
CREATE INDEX ON persona_prompts (prompt_id);
CREATE INDEX ON persona_prompts (persona_id, active);

-- Only one active prompt per persona
CREATE UNIQUE INDEX persona_prompts_one_active_per_persona
  ON persona_prompts(persona_id) WHERE active = true;

-- ============================================================================
-- BACKFILL EXISTING DATA
-- ============================================================================

-- Migrate agents.prompt_id to agent_prompts junction table
INSERT INTO agent_prompts (agent_id, prompt_id, active, created_at, updated_at)
SELECT id, prompt_id, true, created_at, updated_at
FROM agents
WHERE prompt_id IS NOT NULL
ON CONFLICT (agent_id, prompt_id) DO NOTHING;

-- Migrate personas.prompt_id to persona_prompts junction table
INSERT INTO persona_prompts (persona_id, prompt_id, active, created_at, updated_at)
SELECT id, prompt_id, true, created_at, updated_at
FROM personas
WHERE prompt_id IS NOT NULL
ON CONFLICT (persona_id, prompt_id) DO NOTHING;

-- ============================================================================
-- DROP OLD COLUMNS
-- ============================================================================

-- Drop foreign key constraints first
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_prompt_id_fkey;
ALTER TABLE personas DROP CONSTRAINT IF EXISTS personas_prompt_id_fkey;

-- Drop prompt_id columns
ALTER TABLE agents DROP COLUMN IF EXISTS prompt_id;
ALTER TABLE personas DROP COLUMN IF EXISTS prompt_id;

