-- Create improvement record and link to message/grade via junction tables
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_create_message_feedback_improvement_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_message_feedback_improvement_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
-- Creates improvement record and links via message_improvements and grade_improvements junction tables
CREATE OR REPLACE FUNCTION socket_create_message_feedback_improvement_v4(
    grade_id uuid,
    message_id uuid,
    name text,
    description text,
    tool_call_id uuid
)
RETURNS TABLE (
    id text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    improvement_id_val uuid;
BEGIN
    -- Create improvement record
    INSERT INTO improvements 
    (name, description, tool_call_id, created_at)
    VALUES (name, description, tool_call_id, NOW())
    RETURNING id INTO improvement_id_val;
    
    -- Link to message via junction table
    INSERT INTO message_improvements (improvement_id, message_id, created_at)
    VALUES (improvement_id_val, message_id, NOW())
    ON CONFLICT (improvement_id, message_id) DO NOTHING;
    
    -- Link to grade via junction table
    INSERT INTO grade_improvements (grade_id, improvement_id, created_at)
    VALUES (grade_id, improvement_id_val, NOW())
    ON CONFLICT (grade_id, improvement_id) DO NOTHING;
    
    -- Return improvement id
    RETURN QUERY SELECT improvement_id_val::text;
END;
$$;

