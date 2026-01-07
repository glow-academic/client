-- Get developer instruction template and schema for a given type and agent role
-- Joins developer_instructions → developer_instruction_schemas → schemas
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_developer_instruction_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_developer_instruction_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
-- Note: developer_instructions.type column was removed - developer instructions are now linked via agent_developer_instructions only
CREATE OR REPLACE FUNCTION api_get_developer_instruction_v4(
    instruction_type text,  -- Changed from developer_instruction_type enum to text (no longer used, kept for compatibility)
    agent_role_val text
)
RETURNS TABLE (
    developer_instruction_id uuid,
    type text,  -- Changed from developer_instruction_type enum to text
    template text,
    active boolean,
    schema_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT
    di.id as developer_instruction_id,
    instruction_type as type,  -- Return the passed parameter since di.type no longer exists
    di.template,
    di.active,
    dis.schema_id
FROM developer_instructions di
JOIN agent_developer_instructions adi ON adi.developer_instruction_id = di.id
JOIN agents a ON a.id = adi.agent_id
JOIN domains d ON d.agent_id = a.id AND d.artifact = CAST(agent_role_val AS artifacts)
LEFT JOIN developer_instruction_schemas dis ON dis.developer_instruction_id = di.id
WHERE di.active = true
LIMIT 1
$$;

