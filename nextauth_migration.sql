-- Migration: Remove NextAuth tables and use profiles as single source of truth
-- Date: 2025-10-17
-- Description: Eliminates users, accounts, sessions, verification_token, and user_profiles tables
--              while maintaining Microsoft Entra ID OAuth with JWT-only authentication

-- ============================================================================
-- Step 1: Add unique constraint to profiles.alias
-- ============================================================================
-- Email will be derived as alias (email prefix before @)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_alias_unique ON profiles(alias);

-- ============================================================================
-- Step 2: Add all superadmin profiles to all departments
-- ============================================================================
INSERT INTO profile_departments (profile_id, department_id, is_primary, active)
SELECT 
    p.id as profile_id,
    d.id as department_id,
    false as is_primary,
    true as active
FROM profiles p
CROSS JOIN departments d
WHERE p.role = 'superadmin'
ON CONFLICT (profile_id, department_id) DO NOTHING;

-- ============================================================================
-- Step 3: Add all superadmin profiles to all active cohorts
-- ============================================================================
INSERT INTO cohort_profiles (cohort_id, profile_id, active)
SELECT 
    c.id as cohort_id,
    p.id as profile_id,
    true as active
FROM profiles p
CROSS JOIN cohorts c
WHERE p.role = 'superadmin'
  AND c.active = true
ON CONFLICT (cohort_id, profile_id) DO NOTHING;

-- ============================================================================
-- Step 4: Drop foreign key constraints first (order matters)
-- ============================================================================
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_profile_id_fkey;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_userId_fkey;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_userId_fkey;

-- ============================================================================
-- Step 5: Drop junction table
-- ============================================================================
DROP TABLE IF EXISTS user_profiles;

-- ============================================================================
-- Step 6: Drop NextAuth tables
-- ============================================================================
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS verification_token;
DROP TABLE IF EXISTS users;

