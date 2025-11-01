-- Migration 0038: Delete all persona department links
-- Removes all entries from persona_departments table only

-- ============================================================================
-- DELETE PERSONA DEPARTMENT LINKS
-- ============================================================================

-- Delete from binary persona_departments table
DELETE FROM persona_departments;

