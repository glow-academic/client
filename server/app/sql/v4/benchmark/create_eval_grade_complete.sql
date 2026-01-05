-- Create eval grade record
-- Converted to PostgreSQL function
-- Note: eval_id removed from grades table - derive from test_runs → tests → attempt_tests → eval_attempts → evals
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_eval_grade_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_eval_grade_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_create_eval_grade_v4(
    run_id uuid,
    eval_id uuid,
    description text,
    passed boolean,
    score numeric,
    time_taken numeric,
    rubric_grade_agent_id uuid
)
RETURNS TABLE (
    grade_id text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_grade_id uuid;
    v_conversation_id uuid;
    v_chat_title text;
BEGIN
    -- Get chat title if run is linked to a chat
    SELECT c.title INTO v_chat_title
    FROM chat_runs cr
    JOIN chats c ON c.id = cr.chat_id
    WHERE cr.run_id = run_id
    LIMIT 1;
    
    -- Create conversation
    INSERT INTO conversations (name, description, time_taken, created_at, updated_at)
    VALUES (
        COALESCE(v_chat_title, description, 'Conversation'),
        description,
        time_taken::integer,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_conversation_id;
    
    -- Create grade (time_taken removed from grades table)
    INSERT INTO grades (run_id, rubric_grade_agent_id, description, passed, score, created_at)
    VALUES (run_id, rubric_grade_agent_id, description, passed, score::integer, NOW())
    RETURNING id INTO v_grade_id;
    
    -- Link grade to conversation
    INSERT INTO grade_conversations (grade_id, conversation_id, created_at, updated_at)
    VALUES (v_grade_id, v_conversation_id, NOW(), NOW())
    ON CONFLICT (grade_id, conversation_id) DO NOTHING;
    
    -- Return grade id
    RETURN QUERY SELECT v_grade_id::text;
END $$;