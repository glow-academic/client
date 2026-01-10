-- Update grade record with final values
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
        WHERE proname = 'socket_update_grade_final_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_update_grade_final_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_update_grade_final_v4(
    grade_id_param uuid,
    description_param text,
    passed_param boolean,
    score_param integer
)
RETURNS TABLE (
    id text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_conversation_id uuid;
BEGIN
    -- Update grade
    UPDATE grade 
    SET description = description_param,
        passed = passed_param,
        score = score_param
    WHERE id = grade_id_param;
    
    -- Update conversation description if linked
    SELECT conversation_id INTO v_conversation_id
    FROM grade_conversations
    WHERE grade_id = grade_id_param
    LIMIT 1;
    
    IF v_conversation_id IS NOT NULL THEN
        UPDATE conversations
        SET description = description_param,
            updated_at = NOW()
        WHERE id = v_conversation_id;
    END IF;
    
    RETURN QUERY SELECT grade_id_param::text;
END $$;