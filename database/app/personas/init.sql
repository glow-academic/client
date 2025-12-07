-- Enable the gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TYPE reasoning_effort AS ENUM ('none', 'minimal', 'low', 'medium', 'high');
CREATE TYPE voice AS ENUM ('alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse');

CREATE TABLE personas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  instructions TEXT, -- Personality-specific instructions (replaces prompts)
  color TEXT        NOT NULL, -- hex color code
  icon TEXT        NOT NULL, -- icon name, in Lucide Icons
  active BOOLEAN NOT NULL DEFAULT FALSE
);

-- Persona → Departments binary relationship table
-- Tracks which personas are available to departments (no prompt_id)
-- No records = available to all departments (cross-department)
CREATE TABLE persona_departments (
  persona_id    UUID NOT NULL REFERENCES personas(id)     ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id)  ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, department_id)
);

CREATE INDEX ON persona_departments (persona_id);
CREATE INDEX ON persona_departments (department_id);
CREATE INDEX ON persona_departments (active);

-- Persona → Text Agents junction table (BCNF normalization)
-- Links personas to their simulation-text agents
-- Models are inferred from the agent (via agent.model_id)
CREATE TABLE persona_text_agents (
  persona_id UUID NOT NULL REFERENCES personas(id)     ON DELETE CASCADE,
  agent_id   UUID NOT NULL REFERENCES agents(id)      ON DELETE RESTRICT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, agent_id)
);

CREATE INDEX ON persona_text_agents (persona_id);
CREATE INDEX ON persona_text_agents (agent_id);
CREATE INDEX ON persona_text_agents (persona_id, active);

-- Only one active text agent per persona (enforced by unique partial index)
CREATE UNIQUE INDEX persona_text_agents_one_active
  ON persona_text_agents(persona_id) WHERE active = true;

-- Persona → Voice Agents junction table (BCNF normalization)
-- Links personas to their simulation-voice agents
-- Models are inferred from the agent (via agent.model_id)
CREATE TABLE persona_voice_agents (
  persona_id UUID NOT NULL REFERENCES personas(id)     ON DELETE CASCADE,
  agent_id   UUID NOT NULL REFERENCES agents(id)      ON DELETE RESTRICT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, agent_id)
);

CREATE INDEX ON persona_voice_agents (persona_id);
CREATE INDEX ON persona_voice_agents (agent_id);
CREATE INDEX ON persona_voice_agents (persona_id, active);

-- Only one active voice agent per persona (enforced by unique partial index)
CREATE UNIQUE INDEX persona_voice_agents_one_active
  ON persona_voice_agents(persona_id) WHERE active = true;