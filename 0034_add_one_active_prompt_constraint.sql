-- ============================================================================
-- RESTRUCTURE PROMPT RELATIONSHIPS
-- ============================================================================
-- Migrate from junction tables (prompt_departments, agent_prompts, persona_prompts)
-- to direct prompt_id columns on agents/personas (defaults) and 
-- agent_departments/persona_departments (department-specific overrides).
--
-- IMPORTANT: Data extraction must happen BEFORE any DELETE operations
-- to preserve existing prompt assignments.

-- Step 0: Insert all prompts BEFORE migration
-- This ensures prompts exist when we reference them in the migration
-- Uses \i commands to include prompt files (avoids inlining large content)
\i database/seed/prompts.sql

-- Insert department-specific persona prompts
\i database/seed/biol/prompts.sql
\i database/seed/chem/prompts.sql
\i database/seed/cs/prompts.sql
\i database/seed/eaps/prompts.sql
\i database/seed/ma/prompts.sql
\i database/seed/phys/prompts.sql
\i database/seed/stat/prompts.sql

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

-- Step 3: Extract persona-department-prompt relationships BEFORE deleting
-- We need to preserve which personas are linked to which departments with which prompts
-- First try prompt_departments, then infer from prompt content if needed
CREATE TEMP TABLE persona_dept_prompt_mapping AS
WITH prompt_dept_from_table AS (
    -- Get department from prompt_departments if it exists
    SELECT DISTINCT
        pp.persona_id,
        pd.department_id,
        pp.prompt_id
    FROM persona_prompts pp
    JOIN prompt_departments pd ON pp.prompt_id = pd.prompt_id AND pd.active = true
    WHERE pp.active = true
),
prompt_dept_from_content AS (
    -- Infer department from prompt content if not in prompt_departments
    -- Use more specific matching to avoid false positives
    SELECT DISTINCT
        pp.persona_id,
        d.id as department_id,
        pp.prompt_id
    FROM persona_prompts pp
    CROSS JOIN departments d
    JOIN prompts pr ON pp.prompt_id = pr.id
    WHERE pp.active = true
    AND pp.prompt_id NOT IN (SELECT prompt_id FROM prompt_dept_from_table)
    AND (
        -- CS: Match CS or Computer Science explicitly (but not "CS 180" style course numbers)
        (LOWER(d.title) LIKE '%computer%' AND (
            pr.system_prompt ILIKE '%CS undergraduate%' 
            OR pr.system_prompt ILIKE '%computer science undergraduate%'
            OR (pr.system_prompt ILIKE '%CS%' AND pr.system_prompt NOT ILIKE '%CS [0-9]%')
        ))
        -- Physics: Match phys/physics explicitly
        OR (LOWER(d.title) LIKE '%physics%' AND (
            pr.system_prompt ILIKE '%phys undergraduate%'
            OR pr.system_prompt ILIKE '%physics undergraduate%'
        ))
        -- Chemistry: Match chem/chemistry explicitly  
        OR (LOWER(d.title) LIKE '%chemistry%' AND (
            pr.system_prompt ILIKE '%chem undergraduate%'
            OR pr.system_prompt ILIKE '%chemistry undergraduate%'
        ))
        -- Biology: Match biol/biology explicitly
        OR (LOWER(d.title) LIKE '%biology%' AND (
            pr.system_prompt ILIKE '%biol undergraduate%'
            OR pr.system_prompt ILIKE '%biology undergraduate%'
        ))
        -- Math: Match math/mathematics explicitly (avoid matching "math" in other contexts)
        OR (LOWER(d.title) LIKE '%mathematics%' AND (
            pr.system_prompt ILIKE '%math undergraduate%'
            OR pr.system_prompt ILIKE '%mathematics undergraduate%'
        ))
        -- Statistics: Match stat/statistics explicitly
        OR (LOWER(d.title) LIKE '%statistics%' AND (
            pr.system_prompt ILIKE '%stat undergraduate%'
            OR pr.system_prompt ILIKE '%statistics undergraduate%'
        ))
        -- EAPS: Match eaps/earth explicitly
        OR (LOWER(d.title) LIKE '%earth%' AND (
            pr.system_prompt ILIKE '%eaps undergraduate%'
            OR pr.system_prompt ILIKE '%earth%undergraduate%'
        ))
    )
)
SELECT * FROM prompt_dept_from_table
UNION
SELECT * FROM prompt_dept_from_content;

-- Step 4: Delete all rows from agent_departments (assumes defaults will be used)
DELETE FROM agent_departments;

-- Step 5: Delete all rows from persona_departments (will be repopulated with prompt_id)
DELETE FROM persona_departments;

-- Step 6: Add prompt_id to agent_departments table
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

-- Step 7: Add prompt_id to persona_departments table
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

-- Step 8: Repopulate persona_departments with prompt_id from mapping
INSERT INTO persona_departments (persona_id, department_id, prompt_id, active)
SELECT persona_id, department_id, prompt_id, true
FROM persona_dept_prompt_mapping
WHERE department_id IS NOT NULL
ON CONFLICT (persona_id, department_id, prompt_id) DO NOTHING;

-- Step 9: Add constraints for one active per (agent_id, prompt_id, department_id) and (persona_id, prompt_id, department_id)
CREATE UNIQUE INDEX agent_departments_one_active_per_agent_prompt_dept 
ON agent_departments(agent_id, prompt_id, department_id) 
WHERE active = true;

CREATE UNIQUE INDEX persona_departments_one_active_per_persona_prompt_dept 
ON persona_departments(persona_id, prompt_id, department_id) 
WHERE active = true;

-- Step 10: Drop junction tables and temp table
DROP TABLE IF EXISTS persona_dept_prompt_mapping;
DROP TABLE IF EXISTS prompt_departments CASCADE;
DROP TABLE IF EXISTS agent_prompts CASCADE;
DROP TABLE IF EXISTS persona_prompts CASCADE;

-- Step 11: Verify data integrity (will fail if constraints violated)
-- All agents should have prompt_id set (enforced by NOT NULL constraint)
-- All personas should have prompt_id set (enforced by NOT NULL constraint)
-- Foreign keys ensure prompt_ids reference existing prompts

-- Note: The original migration code that deleted from agent_prompts/persona_prompts
-- and created indexes has been removed since we now drop these tables entirely.
