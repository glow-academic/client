-- Add partial unique indexes to enforce one active prompt per agent/persona
-- This ensures that each agent and persona can have only one active prompt link at a time
--
-- Note: This migration drops all existing links in agent_prompts and persona_prompts
-- The new setup uses generate-agents-sql.sh and generate-persona-sql.sh to recreate links properly

-- Drop all existing agent_prompts links
-- These will be recreated by generate-agents-sql.sh with proper department-specific prompts
DELETE FROM agent_prompts;

-- Drop all existing persona_prompts links
-- These will be recreated by generate-persona-sql.sh with proper department-specific prompts
DELETE FROM persona_prompts;

-- Enforce one active prompt per agent
CREATE UNIQUE INDEX agent_prompts_one_active_per_agent 
ON agent_prompts(agent_id) 
WHERE active = true;

-- Enforce one active prompt per persona
CREATE UNIQUE INDEX persona_prompts_one_active_per_persona 
ON persona_prompts(persona_id) 
WHERE active = true;

