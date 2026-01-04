-- Check if profile exists
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Drop function if exists (handle signature changes)
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS infra_profile_exists_v4(uuid);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION infra_profile_exists_v4(
    profile_id uuid
)
RETURNS TABLE (
    profile_exists boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = profile_id) as profile_exists;
$$;