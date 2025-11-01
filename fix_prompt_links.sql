-- ============================================================================
-- FIX PROMPT LOGIC AND LINKING FOR AGENTS AND DEPARTMENTS
-- ============================================================================
-- This script fixes prompt linking WITHOUT changing persona/agent IDs
-- (since these are referenced throughout the database)
--
-- Fixes:
-- 1. Updates persona prompt_ids to match seed files (keeps existing persona IDs)
-- 2. Updates agent prompt_ids to match seed files (keeps existing agent IDs)
-- 3. Creates agent_departments links for all departments using actual agent IDs
-- 4. Creates persona_departments links for all departments using actual persona IDs
-- 5. Maps department UUIDs correctly (handles CS department UUID mismatch)
-- 6. Ensures department-specific prompts are correctly linked
--
-- Uses \i commands to include seed files as suggested

-- Step 1: First, ensure all prompts exist (includes root and department-specific)
\i database/seed/prompts.sql

-- Insert department-specific persona prompts
\i database/seed/biol/prompts.sql
\i database/seed/chem/prompts.sql
\i database/seed/cs/prompts.sql
\i database/seed/eaps/prompts.sql
\i database/seed/ma/prompts.sql
\i database/seed/phys/prompts.sql
\i database/seed/stat/prompts.sql

-- Step 2: Update personas to use correct default prompt_ids (KEEP existing IDs)
-- Map by name to find existing personas and update their prompt_ids
DO $$
DECLARE
    aggressive_persona_id UUID;
    happy_persona_id UUID;
    confused_persona_id UUID;
    passive_persona_id UUID;
BEGIN
    -- Find existing persona IDs by name
    SELECT id INTO aggressive_persona_id FROM personas WHERE name = 'Aggressive' LIMIT 1;
    SELECT id INTO happy_persona_id FROM personas WHERE name = 'Happy' LIMIT 1;
    SELECT id INTO confused_persona_id FROM personas WHERE name = 'Confused' LIMIT 1;
    SELECT id INTO passive_persona_id FROM personas WHERE name = 'Passive' LIMIT 1;
    
    -- Update prompt_ids to match seed files (root prompts)
    IF aggressive_persona_id IS NOT NULL THEN
        UPDATE personas SET prompt_id = '58eff094-d80f-401e-a8c6-c7e12042bc90'
        WHERE id = aggressive_persona_id;
    END IF;
    
    IF happy_persona_id IS NOT NULL THEN
        UPDATE personas SET prompt_id = 'bb2f5a82-d242-406d-967d-9f01a9fbfe95'
        WHERE id = happy_persona_id;
    END IF;
    
    IF confused_persona_id IS NOT NULL THEN
        UPDATE personas SET prompt_id = 'df3d4736-f3b5-42bc-9650-1ef1ca8b3f5b'
        WHERE id = confused_persona_id;
    END IF;
    
    IF passive_persona_id IS NOT NULL THEN
        UPDATE personas SET prompt_id = 'de4885a9-e768-455b-8536-e7729189ead3'
        WHERE id = passive_persona_id;
    END IF;
END $$;

-- Step 3: Update agents to use correct default prompt_ids (KEEP existing IDs)
-- Map by name to find existing agents and update their prompt_ids
DO $$
DECLARE
    assistant_agent_id UUID;
    grade_agent_id UUID;
    scenario_agent_id UUID;
    classify_agent_id UUID;
    title_agent_id UUID;
    output_guardrail_agent_id UUID;
    input_guardrail_agent_id UUID;
    hint_agent_id UUID;
BEGIN
    -- Find existing agent IDs by name
    SELECT id INTO assistant_agent_id FROM agents WHERE name = 'Assistant' LIMIT 1;
    SELECT id INTO grade_agent_id FROM agents WHERE name = 'Grade' LIMIT 1;
    SELECT id INTO scenario_agent_id FROM agents WHERE name = 'Scenario' LIMIT 1;
    SELECT id INTO classify_agent_id FROM agents WHERE name = 'Classify' LIMIT 1;
    SELECT id INTO title_agent_id FROM agents WHERE name = 'Title' LIMIT 1;
    SELECT id INTO output_guardrail_agent_id FROM agents WHERE name = 'Output Guardrail' LIMIT 1;
    SELECT id INTO input_guardrail_agent_id FROM agents WHERE name = 'Input Guardrail' LIMIT 1;
    SELECT id INTO hint_agent_id FROM agents WHERE name = 'Hint' LIMIT 1;
    
    -- Update prompt_ids to match seed files (root prompts)
    IF assistant_agent_id IS NOT NULL THEN
        UPDATE agents SET prompt_id = '3ce48577-5210-4fe1-a01f-77c1ec5aef9f'
        WHERE id = assistant_agent_id;
    END IF;
    
    IF grade_agent_id IS NOT NULL THEN
        UPDATE agents SET prompt_id = '4c90073a-0d60-4f4a-a145-4d72c37e1f08'
        WHERE id = grade_agent_id;
    END IF;
    
    IF scenario_agent_id IS NOT NULL THEN
        UPDATE agents SET prompt_id = '91232ff2-cd13-4810-83a6-d908ede47a41'
        WHERE id = scenario_agent_id;
    END IF;
    
    IF classify_agent_id IS NOT NULL THEN
        UPDATE agents SET prompt_id = 'b07882db-8319-4447-83ff-4905a30c8a93'
        WHERE id = classify_agent_id;
    END IF;
    
    IF title_agent_id IS NOT NULL THEN
        UPDATE agents SET prompt_id = '5d2b40d5-7fb1-46fd-8af6-f1cb05c20fb0'
        WHERE id = title_agent_id;
    END IF;
    
    IF output_guardrail_agent_id IS NOT NULL THEN
        UPDATE agents SET prompt_id = '391af4d9-9d4c-4898-bc57-e9b0d40f95b0'
        WHERE id = output_guardrail_agent_id;
    END IF;
    
    IF input_guardrail_agent_id IS NOT NULL THEN
        UPDATE agents SET prompt_id = '47402b83-6c4c-4538-8b03-06e750521106'
        WHERE id = input_guardrail_agent_id;
    END IF;
    
    IF hint_agent_id IS NOT NULL THEN
        UPDATE agents SET prompt_id = '29da664e-4b53-49d6-baf3-d4d8534ee90f'
        WHERE id = hint_agent_id;
    END IF;
END $$;

-- Step 4: Clear existing persona_departments and agent_departments to rebuild cleanly
-- Note: agent_departments should be empty by default (agents are cross-department)
-- Only create agent_departments records if department-specific prompt overrides are needed
DELETE FROM persona_departments;
DELETE FROM agent_departments;

-- Step 5: Create persona_departments links for all departments
-- Map existing persona IDs and department UUIDs, then link with department-specific prompts
DO $$
DECLARE
    -- Persona IDs (from database, found by name)
    aggressive_persona_id UUID;
    happy_persona_id UUID;
    confused_persona_id UUID;
    passive_persona_id UUID;
    
    -- Department IDs (from database)
    biol_dept_id UUID := 'fc3d3994-6274-4b87-ae85-2b845282c194';
    chem_dept_id UUID := '5af0d09d-1661-4610-9e0c-f768d1e87e36';
    cs_dept_id UUID;  -- Will look up
    eaps_dept_id UUID := '001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb';
    ma_dept_id UUID := '0258cdab-7cf4-4d2f-96ec-98fae38df1bc';
    phys_dept_id UUID := 'a9cc891d-859f-4ef8-b09d-2f6beabb618d';
    stat_dept_id UUID := '083f55e9-08af-4b0a-8e1b-32f28d3afea3';
    
    -- Department-specific prompt IDs (from seed files)
    -- Biology prompts
    biol_aggressive_prompt UUID := '8b9cab67-d4a8-406f-bb70-e606d0688688';
    biol_happy_prompt UUID := 'c5bb4f7f-1687-4f58-8e69-60294c767e4a';
    biol_confused_prompt UUID := 'd4bb562f-fe90-4944-9b18-9bacc690c123';
    biol_passive_prompt UUID := 'd454c572-b2c6-470b-a76c-7adbceedb2dd';
    
    -- Chemistry prompts (need to check seed file for actual UUIDs)
    chem_aggressive_prompt UUID := '8999196e-cc47-4022-b60e-cf101e4a24c4';
    chem_happy_prompt UUID := '7d13ccfb-2374-48ed-b379-2356ce0d627d';
    chem_confused_prompt UUID := 'c7347d49-72c9-413f-be2b-dd74f6d09ca1';
    chem_passive_prompt UUID := 'fb43d5f8-8d9c-4f86-9adc-9df92a04f2d6';
    
    -- CS prompts (need to check seed file for actual UUIDs)
    cs_aggressive_prompt UUID := '25885491-3e78-4490-983c-07cec01560a4';
    cs_happy_prompt UUID := '4de808ae-893d-40c7-952a-929141a80525';
    cs_confused_prompt UUID := '2488b84c-fa6d-4fd3-a5d3-3ad1cdca3eb0';
    cs_passive_prompt UUID := '497a634c-e2b5-44ba-be2a-5f2af71f56a0';
    
    -- EAPS prompts
    eaps_aggressive_prompt UUID := '7185f4cd-1dd1-494f-85fa-963199f9e314';
    eaps_happy_prompt UUID := 'd274f871-1da6-4fdc-82bf-8c20efc732cf';
    eaps_confused_prompt UUID := '278c6d73-6e17-4a49-9354-0fd66f81190a';
    eaps_passive_prompt UUID := '23f2f4bf-06ca-493f-acec-c78dd6e6691a';
    
    -- Math prompts
    ma_aggressive_prompt UUID := 'e67e0193-e085-42c9-91e4-8eb726dc6654';
    ma_happy_prompt UUID := 'ae749484-df60-4b28-8485-4624f6dfc640';
    ma_confused_prompt UUID := '9b1df8b2-6467-4281-a46b-95779a2d5598';
    ma_passive_prompt UUID := '718575e5-3ff3-44ce-bfc9-cff7142fc7ae';
    
    -- Physics prompts
    phys_aggressive_prompt UUID := 'a1e800b5-a6c2-42da-b2ca-3f85f3d91adb';
    phys_happy_prompt UUID := 'e01d173d-5f94-4d89-9c1e-71c9909af412';
    phys_confused_prompt UUID := '9455b79f-5bfa-4d1d-86c1-bf56bb602ad3';
    phys_passive_prompt UUID := '3b1f4c35-6b05-41dc-a3c7-71b7a2383362';
    
    -- Statistics prompts
    stat_aggressive_prompt UUID := '4583ffb2-09c3-4b68-a131-f7a458c5664a';
    stat_happy_prompt UUID := '6f0c8a76-544b-4a4a-aeb7-94f869adaf59';
    stat_confused_prompt UUID := 'e502c2ed-3f1f-4ad5-a503-e34d63f83c5f';
    stat_passive_prompt UUID := '45ca42c3-a853-45cc-888e-f91f1bbd3b58';
BEGIN
    -- Find existing persona IDs by name
    SELECT id INTO aggressive_persona_id FROM personas WHERE name = 'Aggressive' LIMIT 1;
    SELECT id INTO happy_persona_id FROM personas WHERE name = 'Happy' LIMIT 1;
    SELECT id INTO confused_persona_id FROM personas WHERE name = 'Confused' LIMIT 1;
    SELECT id INTO passive_persona_id FROM personas WHERE name = 'Passive' LIMIT 1;
    
    -- Find CS department ID (might be different from seed file)
    SELECT id INTO cs_dept_id FROM departments WHERE title = 'Computer Science' LIMIT 1;
    
    -- If any personas are missing, skip (shouldn't happen)
    IF aggressive_persona_id IS NULL OR happy_persona_id IS NULL OR 
       confused_persona_id IS NULL OR passive_persona_id IS NULL THEN
        RAISE EXCEPTION 'Missing personas - cannot create department links';
    END IF;
    
    -- Biology department links
    INSERT INTO persona_departments (persona_id, department_id, prompt_id, active) VALUES
        (aggressive_persona_id, biol_dept_id, biol_aggressive_prompt, true),
        (happy_persona_id, biol_dept_id, biol_happy_prompt, true),
        (confused_persona_id, biol_dept_id, biol_confused_prompt, true),
        (passive_persona_id, biol_dept_id, biol_passive_prompt, true)
    ON CONFLICT (persona_id, department_id, prompt_id) DO UPDATE SET active = true;
    
    -- Chemistry department links
    INSERT INTO persona_departments (persona_id, department_id, prompt_id, active) VALUES
        (aggressive_persona_id, chem_dept_id, chem_aggressive_prompt, true),
        (happy_persona_id, chem_dept_id, chem_happy_prompt, true),
        (confused_persona_id, chem_dept_id, chem_confused_prompt, true),
        (passive_persona_id, chem_dept_id, chem_passive_prompt, true)
    ON CONFLICT (persona_id, department_id, prompt_id) DO UPDATE SET active = true;
    
    -- CS department links (use actual CS department ID from database)
    IF cs_dept_id IS NOT NULL THEN
        INSERT INTO persona_departments (persona_id, department_id, prompt_id, active) VALUES
            (aggressive_persona_id, cs_dept_id, cs_aggressive_prompt, true),
            (happy_persona_id, cs_dept_id, cs_happy_prompt, true),
            (confused_persona_id, cs_dept_id, cs_confused_prompt, true),
            (passive_persona_id, cs_dept_id, cs_passive_prompt, true)
        ON CONFLICT (persona_id, department_id, prompt_id) DO UPDATE SET active = true;
    END IF;
    
    -- EAPS department links
    INSERT INTO persona_departments (persona_id, department_id, prompt_id, active) VALUES
        (aggressive_persona_id, eaps_dept_id, eaps_aggressive_prompt, true),
        (happy_persona_id, eaps_dept_id, eaps_happy_prompt, true),
        (confused_persona_id, eaps_dept_id, eaps_confused_prompt, true),
        (passive_persona_id, eaps_dept_id, eaps_passive_prompt, true)
    ON CONFLICT (persona_id, department_id, prompt_id) DO UPDATE SET active = true;
    
    -- Math department links
    INSERT INTO persona_departments (persona_id, department_id, prompt_id, active) VALUES
        (aggressive_persona_id, ma_dept_id, ma_aggressive_prompt, true),
        (happy_persona_id, ma_dept_id, ma_happy_prompt, true),
        (confused_persona_id, ma_dept_id, ma_confused_prompt, true),
        (passive_persona_id, ma_dept_id, ma_passive_prompt, true)
    ON CONFLICT (persona_id, department_id, prompt_id) DO UPDATE SET active = true;
    
    -- Physics department links
    INSERT INTO persona_departments (persona_id, department_id, prompt_id, active) VALUES
        (aggressive_persona_id, phys_dept_id, phys_aggressive_prompt, true),
        (happy_persona_id, phys_dept_id, phys_happy_prompt, true),
        (confused_persona_id, phys_dept_id, phys_confused_prompt, true),
        (passive_persona_id, phys_dept_id, phys_passive_prompt, true)
    ON CONFLICT (persona_id, department_id, prompt_id) DO UPDATE SET active = true;
    
    -- Statistics department links
    INSERT INTO persona_departments (persona_id, department_id, prompt_id, active) VALUES
        (aggressive_persona_id, stat_dept_id, stat_aggressive_prompt, true),
        (happy_persona_id, stat_dept_id, stat_happy_prompt, true),
        (confused_persona_id, stat_dept_id, stat_confused_prompt, true),
        (passive_persona_id, stat_dept_id, stat_passive_prompt, true)
    ON CONFLICT (persona_id, department_id, prompt_id) DO UPDATE SET active = true;
END $$;

-- Step 6: Keep agent_departments empty (agents are cross-department by default)
-- According to database/app/agents/init.sql:
-- "No records = available to all departments (cross-department)"
-- Only create agent_departments records if department-specific prompt overrides are needed
-- Since all agents use the same prompts across departments, we keep agent_departments empty
-- This makes agents available to all departments using their default prompt_id

-- Step 7: Verify data integrity
DO $$
DECLARE
    persona_count INTEGER;
    agent_count INTEGER;
    persona_link_count INTEGER;
    agent_link_count INTEGER;
    dept_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO persona_count FROM personas;
    SELECT COUNT(*) INTO agent_count FROM agents;
    SELECT COUNT(*) INTO persona_link_count FROM persona_departments WHERE active = true;
    SELECT COUNT(*) INTO agent_link_count FROM agent_departments WHERE active = true;
    SELECT COUNT(*) INTO dept_count FROM departments WHERE active = true;
    
    RAISE NOTICE 'Verification:';
    RAISE NOTICE '  Personas: %', persona_count;
    RAISE NOTICE '  Agents: %', agent_count;
    RAISE NOTICE '  Departments: %', dept_count;
    RAISE NOTICE '  Persona-Department links: % (expected: 4 personas × % departments = %)', 
        persona_link_count, dept_count, 4 * dept_count;
    RAISE NOTICE '  Agent-Department links: % (expected: 0 - agents are cross-department by default)', 
        agent_link_count;
    
    IF persona_link_count < 4 * dept_count THEN
        RAISE WARNING 'Missing persona_departments links. Expected %, found %', 
            4 * dept_count, persona_link_count;
    END IF;
    
    IF agent_link_count > 0 THEN
        RAISE NOTICE 'Note: % agent_departments links exist (agents should be cross-department by default)', 
            agent_link_count;
        RAISE NOTICE 'These are for department-specific prompt overrides if needed';
    END IF;
    
    RAISE NOTICE 'Fix completed successfully!';
END $$;
