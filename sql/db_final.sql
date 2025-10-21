-- ============================================================================
-- Database Migration: Final Schema and Data Updates
-- ============================================================================
-- Description: This migration applies critical schema changes and data updates
-- including chat time limits, parameter additions, provider schema changes,
-- scenario tree updates, and document parameter linkages.
-- ============================================================================

-- ============================================================================
-- 1. Cap Simulation Chats to 1 Hour
-- ============================================================================
-- Updates all simulation chats that exceed 1 hour duration to be capped at
-- exactly 1 hour and marks them as completed.

UPDATE simulation_chats
SET 
  updated_at = created_at + INTERVAL '1 hour',
  completed = true
WHERE (updated_at - created_at) > INTERVAL '1 hour';

-- ============================================================================
-- 2. Add practice_parameter Field to Parameters Table
-- ============================================================================
-- Adds a new boolean field to track whether a parameter is used for practice
-- scenarios. Defaults to false for all existing parameters.

ALTER TABLE parameters 
ADD COLUMN practice_parameter BOOLEAN NOT NULL DEFAULT FALSE;

-- Set practice_parameter to TRUE for the Intensity parameter
UPDATE parameters
SET practice_parameter = TRUE
WHERE name = 'Intensity';

-- ============================================================================
-- 3. Drop department_id from Providers Table
-- ============================================================================
-- Removes the department foreign key constraint and column from providers.
-- Providers should not be linked to specific departments.

-- Drop foreign key constraint first
ALTER TABLE providers 
DROP CONSTRAINT providers_department_id_fkey;

-- Drop the column
ALTER TABLE providers 
DROP COLUMN department_id;

-- ============================================================================
-- 4. Update Scenario Tree - Make Scenarios Parent Scenarios
-- ============================================================================
-- Converts two scenarios to parent scenarios by updating scenario_tree:
-- - 4810f3d7-c52b-4e56-866d-8a0b9ebf7f47 (CS182 Logic Homework)
-- - 0fed8d98-8efd-4d3c-888d-418ff1ba3cca (CS253 Algorithm Analysis)

-- Remove child relationship for CS182 Logic Homework scenario
DELETE FROM scenario_tree 
WHERE parent_id = '4810f3d7-c52b-4e56-866d-8a0b9ebf7f47' 
  AND child_id = 'e23a01c1-66cb-4158-8c93-86750f13422d';

-- Make 4810f3d7-c52b-4e56-866d-8a0b9ebf7f47 a parent scenario (self-referencing)
INSERT INTO scenario_tree (parent_id, child_id, active, created_at, updated_at)
VALUES (
  '4810f3d7-c52b-4e56-866d-8a0b9ebf7f47',
  '4810f3d7-c52b-4e56-866d-8a0b9ebf7f47',
  true,
  NOW(),
  NOW()
);

-- Make 0fed8d98-8efd-4d3c-888d-418ff1ba3cca a parent scenario (self-referencing)
INSERT INTO scenario_tree (parent_id, child_id, active, created_at, updated_at)
VALUES (
  '0fed8d98-8efd-4d3c-888d-418ff1ba3cca',
  '0fed8d98-8efd-4d3c-888d-418ff1ba3cca',
  true,
  NOW(),
  NOW()
);

-- ============================================================================
-- 5. Link Documents to Parameter Items
-- ============================================================================
-- Creates linkages between documents and their corresponding course parameter items:
-- - CS182-HW1 → CS 182
-- - CS253-PSO1 → CS 251
-- - CS253-PSO6.pdf → CS 251
-- - hw5_pdf.pdf → CS 180

INSERT INTO document_parameter_items (document_id, parameter_item_id, active, created_at, updated_at)
VALUES
  ('92195a25-513d-5182-a93f-654d3a392f99', 'aeafc75f-132a-5bfa-b753-3c0adf9cc0d5', true, NOW(), NOW()),
  ('673336d0-aae9-531f-a591-9bc155d5f137', 'b1689d1c-666f-56a6-9892-07bc47dc7451', true, NOW(), NOW()),
  ('57d963bc-f6f9-4fd4-b7b5-cdb822f4778a', 'b1689d1c-666f-56a6-9892-07bc47dc7451', true, NOW(), NOW()),
  ('edfab767-8ff1-4418-ad8f-22cec348b76c', '000eb8b1-2885-5de0-958d-d1c0d498707e', true, NOW(), NOW());

-- ============================================================================
-- Migration Complete
-- ============================================================================

