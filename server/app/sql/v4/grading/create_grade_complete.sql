-- Create grade record and associated conversation
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_create_grade_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_create_grade_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_create_grade_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_create_grade_v4_result AS (
    id text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_create_grade_v4(
    run_id uuid,
    rubric_grade_agent_id uuid,
    description text,
    passed boolean,
    score integer,
    time_taken integer,
    conversation_name text DEFAULT NULL,
    conversation_description text DEFAULT NULL
)
RETURNS TABLE (
    id text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_grade_id uuid;
    v_conversation_id uuid;
    v_time_id uuid;
    v_chat_title text;
    v_final_conversation_name text;
    v_final_conversation_description text;
    v_end_reason text;
BEGIN
    -- Get chat title if run is linked to a chat
    SELECT (SELECT n.name FROM cohort_names cn JOIN names n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) INTO v_chat_title
    FROM chat_runs cr
    JOIN chat c ON c.id = cr.chat_id
    WHERE cr.run_id = run_id
    LIMIT 1;
    
    -- Determine conversation name and description
    v_final_conversation_name := COALESCE(conversation_name, v_chat_title, description, 'Conversation');
    v_final_conversation_description := COALESCE(conversation_description, description);
    v_end_reason := CASE
        WHEN v_final_conversation_description IS NULL OR v_final_conversation_description = '' THEN v_final_conversation_name
        WHEN v_final_conversation_name IS NULL OR v_final_conversation_name = '' THEN v_final_conversation_description
        ELSE v_final_conversation_name || ': ' || v_final_conversation_description
    END;
    
    -- Create conversation
    INSERT INTO conversations (end_reason, created_at, updated_at)
    VALUES (v_end_reason, NOW(), NOW())
    RETURNING id INTO v_conversation_id;
    
    -- Create time record if time_taken is provided
    IF time_taken IS NOT NULL AND time_taken > 0 THEN
        INSERT INTO times (time_taken, active, created_at, updated_at)
        VALUES (time_taken, TRUE, NOW(), NOW())
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_time_id;
        
        -- Get existing time if conflict occurred
        IF v_time_id IS NULL THEN
            SELECT id INTO v_time_id FROM times WHERE time_taken = time_taken AND active = TRUE LIMIT 1;
        END IF;
    END IF;
    
    -- Create grade
    INSERT INTO grade (run_id, rubric_grade_agent_id, description, passed, score, created_at)
    VALUES (run_id, rubric_grade_agent_id, description, passed, score, NOW())
    RETURNING id INTO v_grade_id;
    
    -- Link grade to conversation
    INSERT INTO grade_conversations (grade_id, conversation_id, created_at, updated_at)
    VALUES (v_grade_id, v_conversation_id, NOW(), NOW())
    ON CONFLICT (grade_id, conversation_id) DO NOTHING;
    
    -- Link grade to time if time was created
    IF v_time_id IS NOT NULL THEN
        INSERT INTO grade_times (grade_id, time_id, active, created_at, updated_at)
        VALUES (v_grade_id, v_time_id, TRUE, NOW(), NOW())
        ON CONFLICT (grade_id, time_id) DO NOTHING;
    END IF;
    
    -- Return grade id
    RETURN QUERY SELECT v_grade_id::text;
END $$;

