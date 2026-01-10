-- Create colors resource
-- Always INSERT operation (preserves all information)
-- Parameters: name (text), description (text), hex_code (text)
-- Returns: color_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_colors_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_colors_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_colors_v4(
    name text, description text, hex_code text
)
RETURNS TABLE (
    color_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_color_id uuid;
    v_call_id uuid;
    v_tool_id uuid := '019b9f61-8046-7081-8a69-c4d21045facd'::uuid; -- create_colors tool
    v_schema_id uuid := '019b9be3-0eda-7394-b599-6a220ac35ccc'::uuid; -- colors schema
    v_template_id uuid;
BEGIN
    -- Create template instance
    v_template_id := uuidv7();
    INSERT INTO templates (id, name, created_at, updated_at, active)
    VALUES (v_template_id, 'manual_color_' || v_template_id::text, NOW(), NOW(), true);
    
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
        'manual_color_' || v_call_id::text,
        v_tool_id,
        v_template_id,
        jsonb_build_object('name', name, 'description', description, 'hex_code', hex_code)::text,
        true,
        NOW(),
        NOW()
    );
    
    -- INSERT into colors table (always insert, never update)
    INSERT INTO colors(name, description, hex_code, active, call_id)
    VALUES (name, description, hex_code, true, v_call_id)
    RETURNING id INTO v_color_id;
    
    RETURN QUERY SELECT v_color_id;
END;
$$;
