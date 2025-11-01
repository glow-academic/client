-- ============================================================================
-- REMOVE DUPLICATE CHEMISTRY DEPARTMENT
-- ============================================================================
-- This script removes the duplicate Chemistry department and migrates all
-- references to the original Chemistry department from seed files.
--
-- Original Chemistry (keep): 5af0d09d-1661-4610-9e0c-f768d1e87e36 (CHM)
-- Duplicate Chemistry (remove): c6c1da3b-6c08-4a5c-b92c-a2e5665626be (Creating new science)

DO $$
DECLARE
    original_chem_id UUID := '5af0d09d-1661-4610-9e0c-f768d1e87e36';
    duplicate_chem_id UUID := 'c6c1da3b-6c08-4a5c-b92c-a2e5665626be';
    migrated_count INTEGER;
BEGIN
    -- Step 1: Migrate agent_departments references
    -- First, update where no conflict exists
    UPDATE agent_departments home
    SET department_id = original_chem_id
    WHERE home.department_id = duplicate_chem_id
    AND NOT EXISTS (
        SELECT 1 FROM agent_departments existing
        WHERE existing.agent_id = home.agent_id
        AND existing.department_id = original_chem_id
        AND existing.prompt_id = home.prompt_id
    );
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % agent_departments references', migrated_count;
    
    -- Delete any remaining duplicates after migration
    DELETE FROM agent_departments WHERE department_id = duplicate_chem_id;
    
    -- Step 2: Migrate persona_departments references (if any)
    UPDATE persona_departments home
    SET department_id = original_chem_id
    WHERE home.department_id = duplicate_chem_id
    AND NOT EXISTS (
        SELECT 1 FROM persona_departments existing
        WHERE existing.persona_id = home.persona_id
        AND existing.department_id = original_chem_id
        AND existing.prompt_id = home.prompt_id
    );
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % persona_departments references', migrated_count;
    
    DELETE FROM persona_departments WHERE department_id = duplicate_chem_id;
    
    -- Step 3: Migrate cohort_departments references
    UPDATE cohort_departments home
    SET department_id = original_chem_id
    WHERE home.department_id = duplicate_chem_id
    AND NOT EXISTS (
        SELECT 1 FROM cohort_departments existing
        WHERE existing.cohort_id = home.cohort_id
        AND existing.department_id = original_chem_id
    );
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % cohort_departments references', migrated_count;
    
    DELETE FROM cohort_departments WHERE department_id = duplicate_chem_id;
    
    -- Step 4: Migrate document_departments references
    UPDATE document_departments home
    SET department_id = original_chem_id
    WHERE home.department_id = duplicate_chem_id
    AND NOT EXISTS (
        SELECT 1 FROM document_departments existing
        WHERE existing.document_id = home.document_id
        AND existing.department_id = original_chem_id
    );
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % document_departments references', migrated_count;
    
    DELETE FROM document_departments WHERE department_id = duplicate_chem_id;
    
    -- Step 5: Migrate parameter_item_departments references
    UPDATE parameter_item_departments home
    SET department_id = original_chem_id
    WHERE home.department_id = duplicate_chem_id
    AND NOT EXISTS (
        SELECT 1 FROM parameter_item_departments existing
        WHERE existing.parameter_item_id = home.parameter_item_id
        AND existing.department_id = original_chem_id
    );
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % parameter_item_departments references', migrated_count;
    
    DELETE FROM parameter_item_departments WHERE department_id = duplicate_chem_id;
    
    -- Step 6: Migrate profile_departments references
    UPDATE profile_departments home
    SET department_id = original_chem_id
    WHERE home.department_id = duplicate_chem_id
    AND NOT EXISTS (
        SELECT 1 FROM profile_departments existing
        WHERE existing.profile_id = home.profile_id
        AND existing.department_id = original_chem_id
    );
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % profile_departments references', migrated_count;
    
    DELETE FROM profile_departments WHERE department_id = duplicate_chem_id;
    
    -- Step 7: Migrate rubric_departments references
    UPDATE rubric_departments home
    SET department_id = original_chem_id
    WHERE home.department_id = duplicate_chem_id
    AND NOT EXISTS (
        SELECT 1 FROM rubric_departments existing
        WHERE existing.rubric_id = home.rubric_id
        AND existing.department_id = original_chem_id
    );
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % rubric_departments references', migrated_count;
    
    DELETE FROM rubric_departments WHERE department_id = duplicate_chem_id;
    
    -- Step 8: Migrate scenario_departments references
    UPDATE scenario_departments home
    SET department_id = original_chem_id
    WHERE home.department_id = duplicate_chem_id
    AND NOT EXISTS (
        SELECT 1 FROM scenario_departments existing
        WHERE existing.scenario_id = home.scenario_id
        AND existing.department_id = original_chem_id
    );
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % scenario_departments references', migrated_count;
    
    DELETE FROM scenario_departments WHERE department_id = duplicate_chem_id;
    
    -- Step 9: Migrate simulation_departments references
    UPDATE simulation_departments home
    SET department_id = original_chem_id
    WHERE home.department_id = duplicate_chem_id
    AND NOT EXISTS (
        SELECT 1 FROM simulation_departments existing
        WHERE existing.simulation_id = home.simulation_id
        AND existing.department_id = original_chem_id
    );
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % simulation_departments references', migrated_count;
    
    DELETE FROM simulation_departments WHERE department_id = duplicate_chem_id;
    
    -- Step 10: Delete the duplicate department
    DELETE FROM departments WHERE id = duplicate_chem_id;
    
    RAISE NOTICE 'Successfully removed duplicate Chemistry department';
END $$;

