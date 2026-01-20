-- Resolve profile ID FROM department_artifact-id + auth-mode cookies
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Drop function if exists (handle signature changes)
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS infra_resolve_from_department_profile_v4(text, text);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION infra_resolve_from_department_profile_v4(
    department_id text,
    auth_mode text
)
RETURNS TABLE (
    resolved_profile_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT NULL::uuid as resolved_profile_id
    WHERE false;
$$;
