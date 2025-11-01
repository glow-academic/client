-- ============================================================================
-- RESTRUCTURE PROMPT RELATIONSHIPS
-- ============================================================================
-- Migrate from junction tables (prompt_departments, agent_prompts, persona_prompts)
-- to direct prompt_id columns on agents/personas (defaults) and 
-- agent_departments/persona_departments (department-specific overrides).
--
-- IMPORTANT: Data extraction must happen BEFORE any DELETE operations
-- to preserve existing prompt assignments.

-- Step 1: Add prompt_id to agents table
-- Extract current prompt_id values from agent_prompts BEFORE we delete or drop the table
DO $$
DECLARE
    agent_prompt_data RECORD;
BEGIN
    -- Add prompt_id column to agents (temporarily nullable)
    ALTER TABLE agents ADD COLUMN prompt_id UUID;
    
    -- Populate prompt_id from agent_prompts where active = true
    FOR agent_prompt_data IN 
        SELECT DISTINCT ON (agent_id) agent_id, prompt_id
        FROM agent_prompts
        WHERE active = true
        ORDER BY agent_id, created_at DESC
    LOOP
        UPDATE agents 
        SET prompt_id = agent_prompt_data.prompt_id
        WHERE id = agent_prompt_data.agent_id;
    END LOOP;
    
    -- Verify all agents have prompt_id set
    IF EXISTS (SELECT 1 FROM agents WHERE prompt_id IS NULL) THEN
        RAISE EXCEPTION 'Some agents do not have a prompt_id assigned';
    END IF;
    
    -- Make column NOT NULL
    ALTER TABLE agents ALTER COLUMN prompt_id SET NOT NULL;
    
    -- Add foreign key constraint
    ALTER TABLE agents 
    ADD CONSTRAINT agents_prompt_id_fkey 
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE RESTRICT;
END $$;

-- Step 2: Add prompt_id to personas table
DO $$
DECLARE
    persona_prompt_data RECORD;
BEGIN
    -- Add prompt_id column to personas (temporarily nullable)
    ALTER TABLE personas ADD COLUMN prompt_id UUID;
    
    -- Populate prompt_id from persona_prompts where active = true
    FOR persona_prompt_data IN 
        SELECT DISTINCT ON (persona_id) persona_id, prompt_id
        FROM persona_prompts
        WHERE active = true
        ORDER BY persona_id, created_at DESC
    LOOP
        UPDATE personas 
        SET prompt_id = persona_prompt_data.prompt_id
        WHERE id = persona_prompt_data.persona_id;
    END LOOP;
    
    -- Verify all personas have prompt_id set
    IF EXISTS (SELECT 1 FROM personas WHERE prompt_id IS NULL) THEN
        RAISE EXCEPTION 'Some personas do not have a prompt_id assigned';
    END IF;
    
    -- Make column NOT NULL
    ALTER TABLE personas ALTER COLUMN prompt_id SET NOT NULL;
    
    -- Add foreign key constraint
    ALTER TABLE personas 
    ADD CONSTRAINT personas_prompt_id_fkey 
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE RESTRICT;
END $$;

-- Step 3: Delete all rows from agent_departments (assumes defaults will be used)
DELETE FROM agent_departments;

-- Step 4: Delete all rows from persona_departments (assumes defaults will be used)
DELETE FROM persona_departments;

-- Step 5: Add prompt_id to agent_departments table
-- Drop existing primary key first
ALTER TABLE agent_departments DROP CONSTRAINT agent_departments_pkey;

-- Add prompt_id column (NOT NULL, will be populated when rows are inserted)
ALTER TABLE agent_departments ADD COLUMN prompt_id UUID NOT NULL;

-- Add foreign key constraint
ALTER TABLE agent_departments 
ADD CONSTRAINT agent_departments_prompt_id_fkey 
FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE RESTRICT;

-- Create new primary key including prompt_id
ALTER TABLE agent_departments 
ADD CONSTRAINT agent_departments_pkey 
PRIMARY KEY (agent_id, department_id, prompt_id);

-- Step 6: Add prompt_id to persona_departments table
-- Drop existing primary key first
ALTER TABLE persona_departments DROP CONSTRAINT persona_departments_pkey;

-- Add prompt_id column (NOT NULL, will be populated when rows are inserted)
ALTER TABLE persona_departments ADD COLUMN prompt_id UUID NOT NULL;

-- Add foreign key constraint
ALTER TABLE persona_departments 
ADD CONSTRAINT persona_departments_prompt_id_fkey 
FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE RESTRICT;

-- Create new primary key including prompt_id
ALTER TABLE persona_departments 
ADD CONSTRAINT persona_departments_pkey 
PRIMARY KEY (persona_id, department_id, prompt_id);

-- Step 7: Add constraints for one active per (agent_id, prompt_id, department_id) and (persona_id, prompt_id, department_id)
CREATE UNIQUE INDEX agent_departments_one_active_per_agent_prompt_dept 
ON agent_departments(agent_id, prompt_id, department_id) 
WHERE active = true;

CREATE UNIQUE INDEX persona_departments_one_active_per_persona_prompt_dept 
ON persona_departments(persona_id, prompt_id, department_id) 
WHERE active = true;

-- Step 8: Drop junction tables
DROP TABLE IF EXISTS prompt_departments CASCADE;
DROP TABLE IF EXISTS agent_prompts CASCADE;
DROP TABLE IF EXISTS persona_prompts CASCADE;

-- Step 9: Verify data integrity (will fail if constraints violated)
-- All agents should have prompt_id set (enforced by NOT NULL constraint)
-- All personas should have prompt_id set (enforced by NOT NULL constraint)
-- Foreign keys ensure prompt_ids reference existing prompts

-- Note: The original migration code that deleted from agent_prompts/persona_prompts
-- and created indexes has been removed since we now drop these tables entirely.
