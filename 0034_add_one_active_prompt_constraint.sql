-- Add partial unique indexes to enforce one active prompt per agent/persona
-- This ensures that each agent and persona can have only one active prompt link at a time

-- Enforce one active prompt per agent
CREATE UNIQUE INDEX agent_prompts_one_active_per_agent 
ON agent_prompts(agent_id) 
WHERE active = true;

-- Enforce one active prompt per persona
CREATE UNIQUE INDEX persona_prompts_one_active_per_persona 
ON persona_prompts(persona_id) 
WHERE active = true;

