-- Create descriptions resource
-- Always INSERT operation (preserves all information)
-- Parameters: description (text)
-- Returns: description_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_descriptions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_descriptions_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_descriptions_v4(
    description text
)
RETURNS TABLE (
    description_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_description_id uuid;
    v_call_id uuid;
    v_tool_id uuid := '019b9f61-8046-78d0-9078-2c12eaffbd0d'::uuid; -- create_descriptions tool
    v_schema_id uuid := '019b9be3-0eda-7ba5-8a49-725da945a29a'::uuid; -- descriptions schema
    v_template_id uuid;
BEGIN
    -- Create template instance
    v_template_id := uuidv7();
    INSERT INTO templates (id, name, created_at, updated_at, active)
    VALUES (v_template_id, 'manual_description_' || v_template_id::text, NOW(), NOW(), true);
    
    INSERT INTO schema_templates (schema_id, template_id, created_at, updated_at)
    VALUES (v_schema_id, v_template_id, NOW(), NOW())
    ON CONFLICT (schema_id, template_id) DO NOTHING;
    
    -- Create call record
    v_call_id := uuidv7();
    INSERT INTO calls (
        id, external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at
    )
    VALUES (
        v_call_id,
        'manual_description_' || v_call_id::text,
        v_tool_id,
        v_template_id,
        jsonb_build_object('description', description)::text,
        true,
        NOW(),
        NOW()
    );
    
    -- INSERT into descriptions table (always insert, never update)
    INSERT INTO descriptions(description, active, call_id)
    VALUES (description, true, v_call_id)
    RETURNING id INTO v_description_id;
    
    RETURN QUERY SELECT v_description_id;
END;
$$;
