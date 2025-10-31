-- Migration: Add new departments and reorganize seed data
-- This migration:
-- 1. Adds 7 new departments (Biology, Chemistry, EAPS, Mathematics, Physics, Statistics)
-- 2. Links superadmins to all departments
-- 3. Creates default guest profile and links to all departments

BEGIN;

-- ============================================================================
-- PART 1: Add new departments
-- ============================================================================

INSERT INTO departments (id, title, description, active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Biology', 'BIOL', true),
  ('22222222-2222-2222-2222-222222222222', 'Chemistry', 'CHM', true),
  ('44444444-4444-4444-4444-444444444444', 'Earth, Atmospheric, and Planetary Sciences', 'EAPS', true),
  ('55555555-5555-5555-5555-555555555555', 'Mathematics', 'MA', true),
  ('66666666-6666-6666-6666-666666666666', 'Physics', 'PHYS', true),
  ('77777777-7777-7777-7777-777777777777', 'Statistics', 'STAT', true)
ON CONFLICT (id) DO NOTHING;

-- Note: Computer Science ('33333333-3333-3333-3333-333333333333') already exists

-- ============================================================================
-- PART 2: Link superadmins to all departments
-- ============================================================================

-- Link superadmins to all departments
-- Note: CS department is primary, others are secondary
INSERT INTO profile_departments (profile_id, department_id, is_primary)
SELECT 
  p.id,
  d.id,
  CASE WHEN d.id = '33333333-3333-3333-3333-333333333333' THEN true ELSE false END
FROM profiles p
CROSS JOIN departments d
WHERE p.role = 'superadmin'
  AND d.active = true
  AND NOT EXISTS (
    SELECT 1 FROM profile_departments pd 
    WHERE pd.profile_id = p.id AND pd.department_id = d.id
  );

-- ============================================================================
-- PART 3: Create default guest profile if it doesn't exist
-- ============================================================================

-- Create default guest profile for each role level
INSERT INTO profiles (id, first_name, last_name, alias, role, default_profile, active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Default', 'Guest', 'guest', 'guest', true, true),
  ('00000000-0000-0000-0000-000000000002', 'Default', 'TA', 'default_ta', 'ta', true, true),
  ('00000000-0000-0000-0000-000000000003', 'Default', 'Instructional', 'default_instructional', 'instructional', true, true),
  ('00000000-0000-0000-0000-000000000004', 'Default', 'Admin', 'default_admin', 'admin', true, true),
  ('00000000-0000-0000-0000-000000000005', 'Default', 'Superadmin', 'default_superadmin', 'superadmin', true, true)
ON CONFLICT (id) DO NOTHING;

-- Link default profiles to all departments
INSERT INTO profile_departments (profile_id, department_id, is_primary)
SELECT 
  p.id,
  d.id,
  false
FROM profiles p
CROSS JOIN departments d
WHERE p.default_profile = true
  AND NOT EXISTS (
    SELECT 1 FROM profile_departments pd 
    WHERE pd.profile_id = p.id AND pd.department_id = d.id
  );

COMMIT;

