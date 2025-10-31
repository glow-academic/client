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
  ('fc3d3994-6274-4b87-ae85-2b845282c194', 'Biology', 'BIOL', true),
  ('5af0d09d-1661-4610-9e0c-f768d1e87e36', 'Chemistry', 'CHM', true),
  ('001c8926-9dd8-4eaa-8b7f-e8f1868c5aeb', 'Earth, Atmospheric, and Planetary Sciences', 'EAPS', true),
  ('0258cdab-7cf4-4d2f-96ec-98fae38df1bc', 'Mathematics', 'MA', true),
  ('a9cc891d-859f-4ef8-b09d-2f6beabb618d', 'Physics', 'PHYS', true),
  ('083f55e9-08af-4b0a-8e1b-32f28d3afea3', 'Statistics', 'STAT', true)
ON CONFLICT (id) DO NOTHING;

-- Note: Computer Science ('3f256cf4-cf5e-4eae-8804-8a204f867e58') already exists

-- ============================================================================
-- PART 2: Link superadmins to all departments
-- ============================================================================

-- Link superadmins to all departments
-- Note: CS department is primary, others are secondary
INSERT INTO profile_departments (profile_id, department_id, is_primary)
SELECT 
  p.id,
  d.id,
  CASE WHEN d.id = '3f256cf4-cf5e-4eae-8804-8a204f867e58' THEN true ELSE false END
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
  ('fc4dff8a-e05b-405c-9f14-7db2569a8456', 'Default', 'Guest', 'guest', 'guest', true, true),
  ('26a233a5-68f5-4efe-8037-661862b0e453', 'Default', 'TA', 'default_ta', 'ta', true, true),
  ('2d69576c-e4dc-48c1-b245-cfca6ed1f7fc', 'Default', 'Instructional', 'default_instructional', 'instructional', true, true),
  ('6e94eec6-a1e0-4a1a-a33b-5edc6bf88bbe', 'Default', 'Admin', 'default_admin', 'admin', true, true),
  ('f5795bc0-4a98-4650-a1f3-7d321cf9038c', 'Default', 'Superadmin', 'default_superadmin', 'superadmin', true, true)
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

