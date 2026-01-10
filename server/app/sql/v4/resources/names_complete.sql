-- Create names resource
-- Always INSERT operation (preserves all information)
-- Parameters: name (text)
-- Returns: name_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_names_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_names_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_names_v4(
    name text
)
RETURNS TABLE (
    name_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_name_id uuid;
    v_call_id uuid;
    v_tool_id uuid := '019b9f61-8047-7c3f-aa8a-8f5ea051145f'::uuid; -- create_names tool
    v_schema_id uuid := '019b9be3-0edd-7c56-a0cd-288ae2641d9f'::uuid; -- names schema
    v_template_id uuid;
BEGIN
    -- Create template instance
    v_template_id := uuidv7();
    INSERT INTO templates (id, name, created_at, updated_at, active)
    VALUES (v_template_id, 'manual_name_' || v_template_id::text, NOW(), NOW(), true);
    
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
        'manual_name_' || v_call_id::text,
        v_tool_id,
        v_template_id,
        jsonb_build_object('name', name)::text,
        true,
        NOW(),
        NOW()
    );
    
    -- INSERT into names table (always insert, never update)
    INSERT INTO names(name, active, call_id)
    VALUES (name, true, v_call_id)
    RETURNING id INTO v_name_id;
    
    RETURN QUERY SELECT v_name_id;
END;
$$;
